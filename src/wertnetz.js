/* Das Wertnetz von Metacoach in reinem JavaScript (specs/features/
   eigenes-replay-analysieren.md, Plan 1). Die Gewichte kommen verschluesselt von
   Metacoach (/fiesta/netz/wertnetz.json.gz.enc, gebaut von tools/fiesta_export.py); die
   Rechnung steht dort im Feld `rechnung`:

     e = [Summe Karteneinbettungen mein, Summe gegner, leader_mein, leader_gegner, zaehl]
     h1 = relu(W1 e + b1); h2 = relu(W2 h1 + b2); logit = W3 h2 + b3
     p_sieg = sigmoid(logit / temperatur)

   Karten: die ersten max_board des Boards, Nummer aus `karten`, unbekannt 0 (leer, Zeile 0
   ist null). Leader: Nummer aus `leader`, unbekannt 1 (andere). Matrizen zeilenweise, W
   hat die Form [aus, ein]. Getestet in tests/wertnetz.test.js gegen Python auf 0,1 Punkte. */

const ZAEHL_TEILER = { life: 5, board: 5, hand: 10, don: 10, deck: 50 };

/* Die 13 Zaehlmerkmale wie wertnetz.zaehlmerkmale (zwoelf von N1 und der Sitz). */
export function zaehlmerkmale(z) {
  const nMein = z.board_mein.length;
  const nGegner = z.board_gegner.length;
  return [
    1.0,
    (z.life_mein - z.life_gegner) / ZAEHL_TEILER.life,
    (nMein - nGegner) / ZAEHL_TEILER.board,
    (z.hand_mein - z.hand_gegner) / ZAEHL_TEILER.hand,
    z.life_mein / ZAEHL_TEILER.life,
    nMein / ZAEHL_TEILER.board,
    z.hand_mein / ZAEHL_TEILER.hand,
    (z.don_mein_aktiv + z.don_mein_gerastet) / ZAEHL_TEILER.don,
    z.zug,
    z.deck_mein_rest / ZAEHL_TEILER.deck,
    z.don_gegner / ZAEHL_TEILER.don,
    z.hand_gegner / ZAEHL_TEILER.hand,
    z.first_mein ? 1.0 : 0.0,
  ];
}

/* Eine Lage aus dem Zuglager als Zeile wie im Lager, aus Sicht von Spieler `nr`
   (book.lage_zeile). null, wenn einem Spieler noch der Checkpoint fehlt. */
export function lageZeile(lage, nr, partie, zugNorm) {
  const mein = lage.c[String(nr)];
  const gegner = lage.c[String(3 - nr)];
  if (mein === null || mein === undefined || gegner === null || gegner === undefined) return null;
  const [hand, life, deck, donA, donR, trash] = mein;
  return {
    zug: Math.min(lage.hz / zugNorm, 1.0),
    first_mein: partie.erster === nr,
    leader_mein: partie.leader[String(nr)],
    leader_gegner: partie.leader[String(3 - nr)],
    board_mein: lage.b[String(nr)],
    board_gegner: lage.b[String(3 - nr)],
    hand_mein: hand,
    hand_gegner: gegner[0],
    life_mein: life,
    life_gegner: gegner[1],
    don_mein_aktiv: donA,
    don_mein_gerastet: donR,
    don_gegner: gegner[3] + gegner[4],
    deck_mein_rest: deck,
    trash_mein: trash,
    trash_gegner: gegner[5],
  };
}

function matrix(m, name) {
  if (!m || !Array.isArray(m.form) || !Array.isArray(m.werte)) throw new Error("Wertnetz: " + name + " fehlt");
  const n = m.form.reduce((a, b) => a * b, 1);
  if (m.werte.length !== n) throw new Error("Wertnetz: " + name + " hat die falsche Groesse");
  return { form: m.form, werte: Float64Array.from(m.werte) };
}

/* y = W x + b, W zeilenweise [aus, ein]. */
function linear(w, b, x) {
  const [aus, ein] = w.form;
  const y = new Float64Array(aus);
  for (let i = 0; i < aus; i += 1) {
    let s = b.werte[i];
    const z = i * ein;
    for (let j = 0; j < ein; j += 1) s += w.werte[z + j] * x[j];
    y[i] = s;
  }
  return y;
}

function relu(x) {
  for (let i = 0; i < x.length; i += 1) if (x[i] < 0) x[i] = 0;
  return x;
}

/* Das Netz aus dem JSON von Metacoach. Wirft, wenn Teile fehlen. */
export function netzBauen(json) {
  const g = json.gewichte || {};
  const karte = matrix(g.karte, "karte");
  const lm = matrix(g.leader_mein, "leader_mein");
  const lg = matrix(g.leader_gegner, "leader_gegner");
  const schichten = [1, 2, 3].map((k) => ({
    w: matrix(g["schicht" + k]?.w, "schicht" + k),
    b: matrix(g["schicht" + k]?.b, "schicht" + k),
  }));
  const dimKarte = json.dim_karte;
  const dimLeader = json.dim_leader;
  const maxBoard = json.max_board;
  const nZaehl = json.n_zaehl;
  const leer = json.leer ?? 0;
  const andere = json.andere ?? 1;
  const kartenTafel = json.karten || {};
  const leaderTafel = json.leader || {};
  const breiteEin = 2 * dimKarte + 2 * dimLeader + nZaehl;
  if (schichten[0].w.form[1] !== breiteEin) throw new Error("Wertnetz: Eingabe passt nicht");

  const kartenNummer = (k) => (Object.hasOwn(kartenTafel, k) ? kartenTafel[k] : leer);
  const leaderNummer = (l) => (Object.hasOwn(leaderTafel, l) ? leaderTafel[l] : andere);

  /* Wie Bewerter.board: die ersten max_board Karten, aufgefuellt mit 0. */
  const board = (karten) => {
    const nummern = karten.slice(0, maxBoard).map(kartenNummer);
    while (nummern.length < maxBoard) nummern.push(leer);
    return nummern;
  };

  const einbettung = (ziel, ab, nummern) => {
    for (const n of nummern) {
      const z = n * dimKarte;
      for (let d = 0; d < dimKarte; d += 1) ziel[ab + d] += karte.werte[z + d];
    }
  };

  /* Siegchance 0 bis 1 aus Nummern und Zaehlmerkmalen (die Form der Referenz). */
  const rechnen = (bm, bg, nrMein, nrGegner, zaehl) => {
    const e = new Float64Array(breiteEin);
    einbettung(e, 0, bm);
    einbettung(e, dimKarte, bg);
    for (let d = 0; d < dimLeader; d += 1) {
      e[2 * dimKarte + d] = lm.werte[nrMein * dimLeader + d];
      e[2 * dimKarte + dimLeader + d] = lg.werte[nrGegner * dimLeader + d];
    }
    for (let d = 0; d < nZaehl; d += 1) e[2 * dimKarte + 2 * dimLeader + d] = zaehl[d];
    const h1 = relu(linear(schichten[0].w, schichten[0].b, e));
    const h2 = relu(linear(schichten[1].w, schichten[1].b, h1));
    const logit = linear(schichten[2].w, schichten[2].b, h2)[0];
    return 1 / (1 + Math.exp(-logit / json.temperatur));
  };

  /* Siegchance 0 bis 1 einer Zeile wie Bewerter.p_sieg. */
  const pSieg = (z) => rechnen(board(z.board_mein), board(z.board_gegner),
    leaderNummer(z.leader_mein), leaderNummer(z.leader_gegner), zaehlmerkmale(z));

  return {
    datum: json.datum,
    zugNorm: json.zug_norm,
    board,
    kartenNummer,
    leaderNummer,
    kennt: (karte) => Object.hasOwn(kartenTafel, karte),
    kenntLeader: (l) => Object.hasOwn(leaderTafel, l),
    rechnen,
    pSieg,
  };
}

/* Je Lage und Spieler die Siegchance in Prozent, Schluessel "lage,nr" (book.werte). */
export function werteBerechnen(partie, netz) {
  const aus = new Map();
  partie.lagen.forEach((lage, i) => {
    for (const nr of [1, 2]) {
      const z = lageZeile(lage, nr, partie, netz.zugNorm);
      if (z !== null) aus.set(i + "," + nr, 100 * netz.pSieg(z));
    }
  });
  return aus;
}
