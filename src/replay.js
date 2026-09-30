/* Replay Auswertung: aus den Logzeilen eine Schrittliste mit dem Stand beider Seiten.

   Am 30.09.2026 aus src/App.jsx hierher gezogen, damit sie ohne React testbar ist
   (tests/replay.test.js, `npm test`). Der Inhalt ist bis auf die Angriffspfeile
   unveraendert, siehe specs/features/replay-angriffspfeile.md. */

/* --------------------------------------------------------------------------
   Replay

   Das Log erzaehlt die Partie in Klartextzeilen, dazwischen liegen nach jedem Zug
   Zustandsabzuege beider Spieler:

       [Spieler] Attach 3 Don to Portgas D. Ace [OP16-001] (3 Total)
       [Spieler] Portgas D. Ace [OP16-001] attacking Rocks D. Xebec [OP17-039]
       Portgas D. Ace [OP16-001][8000] vs Rocks D. Xebec [OP17-039][5000]
       Rocks D. Xebec [OP17-039] hit for 1 damage
       [Spieler] Hand: [...]   Board: [...]   Trash: [...]   Life: 5

   Die Ansicht trennt beides: die Zuege erzaehlen, die Abzuege liefern den Stand am
   Zugende. Ohne diese Trennung liest sich das Log als Wand aus Kartennummern.
   -------------------------------------------------------------------------- */

const ZUSTAND = /^\[(.+?)\]\s+(Hand|Board|Trash|Life):\s*(.*)$/;
const SPRECHER = /^\[(.+?)\]\s*(.*)$/;
// Zeilen, mit denen ein Kampf endet, gezaehlt am 30.09.2026 ueber alle lokalen Replays:
// "Attack Fails" 3574, "hit for" 2923, "Destroyed" 2265. Bei Banish steht statt "hit
// for" die Zeile "Trash ... from Life".
const KAMPFENDE = /Attack Fails|hit for \d+ damage|\bDestroyed\b|from Life\b/i;
// Kartennummern in einer Angriffszeile, in Reihenfolge und mit Wiederholung. Anders als
// in `kartenliste` auch Promos ("P-107"), die als Ziel vorkommen.
const ANGRIFFSZEILE = /\]\s+attacking\s+\S/;
const ANGRIFFSNUMMER = /\b(?:[A-Z]{2,4}\d{2}|P)-\d{3}\b/g;
const LEADERZEILE = /^\[(.+?)\]\s+Leader is .+\[([A-Z]{2,4}\d{2}-\d{3})\]/;

function kartenliste(text) {
  return text.match(/[A-Z]{2,4}\d{2}-\d{3}/g) || [];
}

/**
 * Aus den Logzeilen Zuege bauen.
 *
 * Der Gewinn gegenueber einer Textliste steckt in den Zustandsabzuegen: sie fuehren
 * Hand, Board und Trash nicht als Zahl, sondern mit den Kartennummern. Damit laesst
 * sich das Brett am Ende jedes Zuges wirklich zeigen, statt es zu beschreiben.
 */
/* Die Zonencodes der Bewegungszeilen. Sie stehen als `enum CardZone` im
   Spielpaket; die Checkpointzeile bildet denselben Enum auf ihre Zaehler ab.
   Am 02.09.2026 an 311 Logs geprueft: die Bewegungen nachgespielt stimmen alle
   zehn Zaehler an allen 135.846 Checkpoints. */
const Z_DECK = 0, Z_HAND = 1, Z_CHARACTER = 2, Z_LIFE = 3;
const Z_DON_START = 4, Z_DON_FIELD = 5, Z_TRASH = 6, Z_STAGE = 7;
const Z_LEADER = 8, Z_DON_EQUIPPED = 9;

// Nur diese Zonen fuehren wir als Kartenliste. Deck und Don sind verdeckte
// Stapel, dort genuegt die Zahl aus dem Checkpoint.
const LISTENZONEN = {
  [Z_HAND]: "hand",
  [Z_CHARACTER]: "board",
  [Z_TRASH]: "trash",
  [Z_STAGE]: "stagekarten",
};

/**
 * Aus den Logzeilen eine Schrittliste bauen, eine Klartextzeile ein Schritt.
 *
 * Der Zustand kommt aus drei Quellen, jede mit ihrer Rolle:
 *   - die Bewegungszeilen fuehren die Karten von Zone zu Zone. Daraus entsteht die
 *     genaue Aufstellung nach jedem einzelnen Schritt.
 *   - die Checkpoints liefern die Zaehler. Sie sind die Wahrheit fuer Zahlen, auch
 *     fuer die verdeckten Stapel Deck und Don-Deck, deren Inhalt niemand kennt.
 *   - die Klartextzeilen sind die Erzaehlung und geben die Schritte vor.
 *
 * Frueher stand die Aufstellung nur an den Zugenden, weil sie aus den
 * Klartextabzuegen kam. Ein gespielter Charakter erschien dadurch erst Zuege
 * spaeter auf dem Brett.
 */
/**
 * Spielernummer zu Name, wenn die RZ1 Zeilen dazu fehlen.
 *
 * In 223 von 373 Replays gibt es keine PLY Zeile. Ohne sie liessen sich die
 * Checkpoints und Bewegungen keinem Namen zuordnen und das Brett blieb leer.
 *
 * Die Reihenfolge der "Leader is" Zeilen taugt NICHT als Ersatz: sie folgt der
 * Verbindungsreihenfolge, nicht der Spielernummer, und in rund jedem fuenften Log
 * sind beide vertauscht. Entschieden wird deshalb gemessen, genau wie in
 * `player_mapping` des Simulators: beide Zuordnungen durchspielen und die nehmen,
 * unter der die Lebenspunkte der Checkpoints zu den Klartextzeilen passen.
 */
function zuordnungRaten(zeilen) {
  const namen = [];
  for (const z of zeilen) {
    const t = z.t;
    if (!t) continue;
    const m = LEADERZEILE.exec(t);
    if (m && !namen.includes(m[1])) namen.push(m[1]);
    if (namen.length === 2) break;
  }
  if (namen.length < 2) return null;

  const punkte = (zuordnung) => {
    const life = {};
    let treffer = 0;
    for (const z of zeilen) {
      if (z.c) {
        life[z.c[0]] = z.c[4];
        continue;
      }
      const t = z.t;
      if (!t) continue;
      const m = /^\[(.+?)\]\s+Life:\s*(\d+)$/.exec(t);
      if (!m) continue;
      const nr = zuordnung[m[1]];
      if (nr !== undefined && life[nr] === parseInt(m[2], 10)) treffer += 1;
    }
    return treffer;
  };

  const a = { [namen[0]]: 1, [namen[1]]: 2 };
  const b = { [namen[0]]: 2, [namen[1]]: 1 };
  const pa = punkte(a);
  const pb = punkte(b);
  // Gleichstand heisst: nicht entscheidbar. Dann lieber die Reihenfolge nehmen,
  // als eine Seite zu erfinden; die Zaehler sind dann im Zweifel vertauscht, die
  // Karten der Klartextabzuege stimmen aber weiter, weil sie am Namen haengen.
  const gewaehlt = pb > pa ? b : a;
  const aus = {};
  for (const [name, nr] of Object.entries(gewaehlt)) aus[nr] = name;
  return aus;
}

export function schritteBauen(zeilen) {
  const leader = {};
  const zuName = {};
  const nummern = {};
  const schritte = [];

  let stand = {};
  let zug = 1;
  let amZug = null;
  // Der laufende Kampf, fuer den Angriffspfeil: { von, auf }, je { wer, platz } mit
  // platz = Boardindex oder "leader". Lebt vom "attacking" bis zur Ergebniszeile.
  let angriff = null;

  // Rueckt ein Brettplatz nach, ruecken die Pfeilenden mit. Das betrifft den laufenden
  // Kampf und den Pfeil des letzten Schritts, denn Bewegungszeilen stehen NACH ihrer
  // Klartextzeile und aendern deren Stand noch.
  //
  // Verschwindet die Karte eines Endes selbst, wird das Ende zum Geist: es behaelt
  // Karte und Platz, und das Brett zeigt die Karte dort verblasst bis zum Kampfende.
  // Noetig, weil das Spiel die Bewegung einer zerstoerten Karte in den Trash direkt
  // hinter die Angriffszeile schreibt, noch vor "vs" und "Destroyed". Ohne Geist
  // verschwand das Ziel schon beim Angriff, bei 813 von 8107 Angriffen (30.09.2026).
  // Ein Geist ist ein gedachter Platz vor der Karte, die jetzt an seiner Stelle steht.
  const angriffeSchieben = (wer, ab, richtung, karte) => {
    const letzter = schritte.length ? schritte[schritte.length - 1].angriff : null;
    for (const a of [angriff, letzter]) {
      if (!a) continue;
      for (const ende of [a.von, a.auf]) {
        if (!ende || ende.wer !== wer || typeof ende.platz !== "number") continue;
        if (richtung < 0) {
          if (ende.platz === ab && !ende.geist) { ende.geist = true; ende.karte = karte; }
          else if (ende.platz > ab) ende.platz -= 1;
        } else if (ende.platz > ab || (ende.platz === ab && !ende.geist)) {
          ende.platz += 1;
        }
      }
    }
  };

  // Fehlen die PLY Zeilen, wird die Zuordnung gemessen statt geraten.
  if (!zeilen.some((z) => z.p)) {
    const geraten = zuordnungRaten(zeilen);
    if (geraten) {
      for (const [nr, name] of Object.entries(geraten)) {
        zuName[Number(nr)] = name;
        nummern[name] = Number(nr);
      }
    }
  }

  const seite = (wer) => {
    let s = stand[wer];
    if (!s) {
      s = stand[wer] = { hand: [], board: [], trash: [], stagekarten: [],
                         angelegt: {},
                         // Gerestete Boardplaetze, der Leader getrennt. Resten ist kein
                         // Zonenwechsel, es steht deshalb nur in den Klartextzeilen.
                         gerestet: new Set(), leaderGerestet: false,
                         // "will not Activate during next Refresh": bleibt einen Refresh
                         // laenger liegen.
                         bleibtGerestet: new Set() };
    }
    return s;
  };

  const kopie = () => {
    const k = {};
    for (const [wer, s] of Object.entries(stand)) {
      k[wer] = {
        ...s,
        hand: [...s.hand], board: [...s.board], trash: [...s.trash],
        stagekarten: [...s.stagekarten], angelegt: { ...s.angelegt },
        gerestet: new Set(s.gerestet), bleibtGerestet: new Set(s.bleibtGerestet),
      };
    }
    return k;
  };

  const anwenden = (m) => {
    const [nr, karte, vonZone, vonSlot, nachZone, nachSlot] = m;
    const wer = zuName[nr];
    if (!wer) return;
    const s = seite(wer);

    const vonName = LISTENZONEN[vonZone];
    if (vonName) {
      const liste = s[vonName];
      // Erst am gemeldeten Platz, sonst ueber die Kartennummer. Der Platz stimmt
      // fast immer; der Rueckfall faengt die wenigen Faelle ab, in denen der
      // Client eine Karte nennt, die er nie in diese Zone gelegt hat.
      let i = vonSlot >= 0 && vonSlot < liste.length && liste[vonSlot] === karte
        ? vonSlot
        : liste.indexOf(karte);
      if (i >= 0) {
        liste.splice(i, 1);
        if (vonZone === Z_CHARACTER) {
          plaetzeSchieben(s, i, -1);
          angriffeSchieben(wer, i, -1, karte);
        }
      }
    } else if (vonZone === Z_DON_EQUIPPED) {
      const wirt = Math.floor(vonSlot / 100);
      s.angelegt[wirt] = Math.max(0, (s.angelegt[wirt] || 0) - 1);
    }

    const nachName = LISTENZONEN[nachZone];
    if (nachName) {
      const liste = s[nachName];
      const i = Math.max(0, Math.min(nachSlot, liste.length));
      liste.splice(i, 0, karte);
      // Eine frisch gespielte Karte steht aktiv, der Platz darf also keinen alten
      // Restmerker erben.
      if (nachZone === Z_CHARACTER) {
        plaetzeSchieben(s, i, 1);
        angriffeSchieben(wer, i, 1, karte);
        s.gerestet.delete(i);
      }
    } else if (nachZone === Z_DON_EQUIPPED) {
      // Der Slot traegt hier das Ziel: 99xx ist der Leader, sonst Boardplatz
      // mal hundert plus laufende Nummer.
      const wirt = Math.floor(nachSlot / 100);
      s.angelegt[wirt] = (s.angelegt[wirt] || 0) + 1;
    }
  };

  for (const z of zeilen) {
    if (z.p) {
      zuName[z.p[0]] = z.p[1];
      nummern[z.p[1]] = z.p[0];
      leader[z.p[1]] = z.p[2];
      continue;
    }
    if (z.m) {
      anwenden(z.m);
      if (schritte.length) schritte[schritte.length - 1].stand = kopie();
      continue;
    }
    if (z.c) {
      const wer = zuName[z.c[0]];
      if (!wer) continue;
      const s = seite(wer);
      s.don = {
        deck: z.c[1], handzahl: z.c[2], boardzahl: z.c[3],
        donDeck: z.c[5], aktiv: z.c[6], trash: z.c[7],
        stage: z.c[8], gerastet: z.c[9],
      };
      if (z.c[4] > 0 || s.life !== undefined) s.life = z.c[4];
      if (schritte.length) schritte[schritte.length - 1].stand = kopie();
      continue;
    }

    const text = z.t;
    if (!text) continue;

    const ld = LEADERZEILE.exec(text);
    if (ld && !leader[ld[1]]) leader[ld[1]] = ld[2];

    // Die Klartextabzuege am Zugende werden nicht mehr gebraucht, die Aufstellung
    // kommt jetzt aus den Bewegungen. Sie bleiben als Schritt aussen vor.
    if (ZUSTAND.test(text)) continue;

    const spr = SPRECHER.exec(text);
    const wer = spr ? spr[1] : null;
    if (wer) amZug = wer;

    // --- Resten, aus den Klartextzeilen ---------------------------------------
    // Resten ist kein Zonenwechsel und steht deshalb in keiner Bewegungszeile. Die
    // vier Faelle, die im Log vorkommen, mit Beispiel aus einem echten Replay:
    //
    //   "Dracule Mihawk [OP14-020] attacking Rocks D. Xebec [OP17-039]"
    //   "Gloriosa [OP17-046] Blocks"
    //   "Dracule Mihawk [OP14-020]: Rest Otama [OP07-022]"
    //   "Law & Bepo [ST24-004]: Rocks D. Xebec [OP17-118] will not Activate ..."
    //
    // Der Refresh kommt ohne eigene Zeile: er faellt mit dem Zugbeginn zusammen,
    // also wird beim "End Turn" des einen die Gegenseite wieder aktiv gesetzt.
    const karten = z.k || [];
    if (wer) {
      const meine = seite(wer);
      const gegnerName = Object.keys(stand).find((n) => n !== wer);
      const gegner = gegnerName ? stand[gegnerName] : null;

      // "] attacking " statt nur "attacking": sonst zaehlte auch "... is no longer
      // blocked from attacking" als Angriff und restete die Karte, 63 Zeilen in den
      // lokalen Replays (30.09.2026).
      if (ANGRIFFSZEILE.test(text) && karten.length) {
        // Die Nummern aus dem Text, nicht aus `z.k`: die Liste fuehrt jede Nummer nur
        // einmal, und im Spiegel ("Mihawk attacking Mihawk") fehlte dann das Ziel, bei
        // 808 von 9122 Angriffen (30.09.2026).
        const paar = text.match(ANGRIFFSNUMMER) || [];
        const angreifer = paar[0] || karten[0];
        const ziel = paar.length > 1 ? paar[1] : karten[1];
        // Der Angreifer steht vorn in der Zeile. Ist es der Leader, kippt der Leader.
        let vonPlatz;
        if (angreifer === leader[wer]) { meine.leaderGerestet = true; vonPlatz = "leader"; }
        else {
          vonPlatz = restenUndPlatz(meine, angreifer);
          // Haelt der Restmerker die Karte schon fuer gerestet, stimmt er nicht; der
          // Pfeil nimmt dann den ersten Platz mit dieser Karte.
          if (vonPlatz < 0) vonPlatz = platzNachId(meine, angreifer);
        }
        // Das Ziel ist die zweite Karte. Angreifen darf man nur den Leader oder einen
        // geresteten Charakter, deshalb bei doppelter Karte der gerestete Platz.
        let aufPlatz = -1;
        if (ziel && gegnerName) {
          aufPlatz = ziel === leader[gegnerName] ? "leader" : geresteterPlatz(gegner, ziel);
        }
        angriff = vonPlatz !== -1 && aufPlatz !== -1
          ? { von: { wer, platz: vonPlatz }, auf: { wer: gegnerName, platz: aufPlatz } }
          : null;
      } else if (/\bBlocks\b/.test(text) && karten.length) {
        // Der Blocker gehoert dem Verteidiger, der hier spricht. Die Pfeilspitze
        // springt auf ihn.
        const blocker = restenUndPlatz(meine, karten[0]);
        if (angriff && blocker >= 0) angriff.auf = { wer, platz: blocker, geblockt: true };
      } else if (/:\s*Rest\b/i.test(text) && karten.length) {
        // Ziel ist die letzte genannte Karte, die Quelle die erste. Meistens restet
        // man eigene Karten als Kosten, manche Effekte aber gegnerische.
        const ziel = karten[karten.length - 1];
        // Der eigene Leader ist ein gueltiges Ziel: Mihawks Leadereffekt restet "1 of
        // your cards", und im Log steht dann der Leadername. Erst Leader, dann Board.
        if (ziel === leader[wer]) meine.leaderGerestet = true;
        else if (!restenNachId(meine, ziel)) restenNachId(gegner, ziel);
      } else if (/will not Activate/i.test(text) && karten.length) {
        // Trifft fast immer die Gegenseite, deshalb dort zuerst suchen.
        const ziel = karten[karten.length - 1];
        for (const s2 of [gegner, meine]) {
          const i = platzNachId(s2, ziel);
          if (i >= 0) { s2.bleibtGerestet.add(i); s2.gerestet.add(i); break; }
        }
      } else if (/End Turn/i.test(text) && gegner) {
        // Refresh der Gegenseite: alles wird aktiv, ausser was ausdruecklich
        // liegen bleibt. Der Merker gilt fuer genau diesen einen Refresh.
        gegner.gerestet = new Set(gegner.bleibtGerestet);
        gegner.bleibtGerestet = new Set();
        gegner.leaderGerestet = false;
      }
    }

    // Ein neuer Zug beendet jeden Kampf, auch einen ohne Ergebniszeile.
    if (/End Turn/i.test(text)) angriff = null;

    schritte.push({
      wer,
      text: spr ? spr[2] : text,
      karten: z.k || [],
      zug,
      amZug,
      stand: kopie(),
      angriff: angriff
        ? { von: { ...angriff.von }, auf: { ...angriff.auf } }
        : null,
    });
    // Die Ergebniszeile gehoert noch zum Kampf, der Schritt danach nicht mehr.
    if (KAMPFENDE.test(text)) angriff = null;
    if (/End Turn/i.test(text)) zug += 1;
  }

  return { schritte, leader, nummern, zuege: zug };
}

/**
 * Restmerker mitschieben, wenn sich die Boardplaetze verschieben.
 *
 * Die Merker haengen am Platz, nicht an der Karte, weil dieselbe Kartennummer mehrfach
 * auf dem Brett stehen kann. Faellt ein Platz weg oder kommt einer dazu, ruecken alle
 * dahinterliegenden Merker nach.
 */
function plaetzeSchieben(s, ab, richtung) {
  for (const feld of ["gerestet", "bleibtGerestet"]) {
    const neu = new Set();
    for (const i of s[feld]) {
      if (i < ab) neu.add(i);
      else if (richtung < 0) { if (i > ab) neu.add(i - 1); }
      else neu.add(i + 1);
    }
    s[feld] = neu;
  }
}

/** Den ersten noch aktiven Platz mit dieser Kartennummer resten. */
function restenNachId(s, id) {
  return restenUndPlatz(s, id) >= 0;
}

/** Wie restenNachId, liefert aber den geresteten Platz, sonst -1. */
function restenUndPlatz(s, id) {
  if (!id || !s) return -1;
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] === id && !s.gerestet.has(i)) { s.gerestet.add(i); return i; }
  }
  return -1;
}

/**
 * Der Platz einer angegriffenen Karte. Angreifbar sind nur gerestete Charaktere,
 * deshalb zuerst ein geresteter Platz; stimmt der Restmerker einmal nicht, der erste
 * Platz mit dieser Karte.
 */
function geresteterPlatz(s, id) {
  if (!id || !s) return -1;
  for (let i = 0; i < s.board.length; i++) {
    if (s.board[i] === id && s.gerestet.has(i)) return i;
  }
  return s.board.indexOf(id);
}

/** Einen Platz suchen, um ihn zu markieren, egal ob schon gerestet. */
function platzNachId(s, id) {
  if (!id || !s) return -1;
  return s.board.indexOf(id);
}
