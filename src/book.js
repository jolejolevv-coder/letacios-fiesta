/* Das Book von Metacoach in Saetzen, englisch (specs/features/book-auf-fiesta.md, Schritt 2).
   Uebertragen aus meta-coach/web/src/saetze.ts mit denselben Grenzen; getestet in
   tests/book.test.js. Die Zahlen haengen klein hinter dem Satz, damit der Satz allein
   verstaendlich bleibt. `schaetzung` heisst: aus dem Wertnetz, nicht aus echten Siegen. */

export const STANDARD_RATE = 90;      // ab hier spielen "fast alle" die Karte
export const SPIELEN_AB = 1;          // Punkte Wert, ab denen "spielen" ein Rat ist
export const HALTEN_BIS = -2.5;       // Punkte Wert, unter denen "lieber halten" ein Rat ist
export const HALTEN_RATE = 20;        // ... wenn die Karte trotzdem oft gespielt wird
export const MULLIGAN_ABSTAND = 3;    // Punkte Winrate zwischen behalten und mischen
export const MIN_ZELLE = 30;          // Partien je Zelle, falls das Book keine Grenze nennt
export const MAX_ZUG = 7;
export const ALLE = "alle";
export const SITZE = ["first", "second"];
const MIHAWK = "OP14-020";            // wird ignoriert (Entscheidung vom 24.09.2026)
const PROZENT = " %";

export function zahl(wert, stellen = 1) {
  return wert.toLocaleString("en-US", { maximumFractionDigits: stellen, minimumFractionDigits: 0 });
}

export function vorzeichen(wert) {
  return (wert > 0 ? "+" : wert < 0 ? "−" : "") + zahl(Math.abs(wert));
}

export function aufzaehlen(teile, und = "or") {
  if (teile.length <= 1) return teile.join("");
  return `${teile.slice(0, -1).join(", ")} ${und} ${teile[teile.length - 1]}`;
}

function karten(a, T) {
  return a?.karten?.[String(T)] ?? [];
}

/* ------------------------------------------------------------------ Ausschnitt */

/* Ein Gegner (oder alle) und ein Sitz aus dem Book, wie book in Metacoach (src/web/
   daten.py): Feld und Spitze, die Unterschiede, und "alle" mit Hinweis, wenn das Matchup
   zu wenige Partien hat. null, wenn es den Gegner im Book nicht gibt. */
export function bookAusschnitt(daten, gegner, sitz) {
  const g = daten?.gegner;
  if (!g || !SITZE.includes(sitz) || gegner === MIHAWK || !Object.hasOwn(g, gegner)) return null;
  let eintrag = g[gegner][sitz] ?? {};
  const rueckfall = Boolean(eintrag.rueckfall);
  if (rueckfall) eintrag = g[ALLE]?.[sitz] ?? {};
  return {
    leader: daten.leader,
    modell: daten.modell,
    stand: daten.stand,
    grenzen: daten.grenzen,
    gegner,
    sitz,
    rueckfall,
    partien: g[gegner].partien ?? {},
    feld: eintrag.feld ?? null,
    spitze: eintrag.spitze ?? null,
    unterschiede: eintrag.unterschiede ?? [],
  };
}

/* Die Gegner zur Auswahl: alle zuerst, dann nach Partien; ohne Mihawk. */
export function gegnerListe(daten) {
  return Object.entries(daten?.gegner ?? {})
    .filter(([k]) => k !== MIHAWK)
    .map(([k, v]) => ({ gegner: k, partien: v.partien ?? {} }))
    .sort((a, b) => (a.gegner !== ALLE) - (b.gegner !== ALLE)
      || ((b.partien.first ?? 0) + (b.partien.second ?? 0)) - ((a.partien.first ?? 0) + (a.partien.second ?? 0)));
}

/* Die Zuege 1 bis 7, fuer die Feld oder Spitze Zahlen haben. */
export function zuegeMitDaten(b) {
  const da = (a, T) => (a?.zuege ?? []).some((z) => z.T === T);
  return Array.from({ length: MAX_ZUG }, (_, i) => i + 1).filter((T) => da(b.feld, T) || da(b.spitze, T));
}

export function zugDaten(b, T) {
  return (b.spitze?.zuege ?? []).find((z) => z.T === T) ?? (b.feld?.zuege ?? []).find((z) => z.T === T);
}

/* ----------------------------------------------------------------------- Spielen */

export function spielenSaetze(T, spitze, feld, mindest, namen) {
  const quelle = karten(spitze, T).length ? karten(spitze, T) : karten(feld, T);
  const genug = quelle.filter((k) => k.n_hand >= mindest);
  const aus = [];
  const standard = genug.filter((k) => k.rate >= STANDARD_RATE).sort((a, b) => b.n_gespielt - a.n_gespielt)[0];
  if (standard) {
    aus.push({ text: `Play ${namen(standard.karte)}. Almost everyone does.`, zahl: `${zahl(standard.rate, 0)}${PROZENT}`,
      schaetzung: false });
  } else {
    const beste = genug.filter((k) => k.wert !== null && k.wert > SPIELEN_AB).sort((a, b) => b.wert - a.wert)[0];
    if (beste) {
      aus.push({ text: `Play ${namen(beste.karte)} as soon as you can pay for it.`,
        zahl: `${vorzeichen(beste.wert)} points win chance`, schaetzung: true });
    }
  }
  const halten = genug
    .filter((k) => k.wert !== null && k.wert < HALTEN_BIS && k.rate > HALTEN_RATE && k.karte !== standard?.karte)
    .sort((a, b) => a.wert - b.wert)[0];
  if (halten) {
    aus.push({ text: `Better hold ${namen(halten.karte)}.`, zahl: `${vorzeichen(halten.wert)} points`, schaetzung: true });
  }
  if (!aus.length) aus.push({ text: "Nothing special, play your curve.", schaetzung: false });
  return aus;
}

/* --------------------------------------------------------------------- Angreifen */

export function angriffSatz(T, spitze, feld) {
  const a = (spitze?.angriffe ?? []).find((x) => x.T === T) ?? (feld?.angriffe ?? []).find((x) => x.T === T);
  if (!a || (a.urteil !== "leader" && a.urteil !== "character")) return null;
  const ziel = a.urteil === "leader" ? "the leader" : "the character";
  return {
    text: `If the opponent has a rested character, rather attack ${ziel}.`,
    zahl: `${vorzeichen(Math.abs(a.q ?? 0))} points`,
    schaetzung: true,
  };
}

/* -------------------------------------------------------------------- Verteidigen */

/* Die Zellen "Gegnerzug T" nach Life: wo das Netz countern sagt, wo nehmen. */
export function abwehrSatz(T, spitze, feld) {
  const zeile = spitze?.abwehr?.zug?.[String(T)] ?? feld?.abwehr?.zug?.[String(T)];
  if (!zeile) return null;
  const countern = [];
  const nehmen = [];
  for (const [life, z] of Object.entries(zeile)) {
    if (z.urteil === "countern") countern.push(Number(life));
    else if (z.urteil === "nehmen") nehmen.push(Number(life));
  }
  if (!countern.length && !nehmen.length) return null;
  const liste = (l) => aufzaehlen([...l].sort((a, b) => a - b).map(String));
  const teile = [];
  if (countern.length) teile.push(`counter at ${liste(countern)} life`);
  if (nehmen.length) teile.push(`rather take the damage at ${liste(nehmen)} life`);
  return { text: `In the opponent's turn ${T}: ${teile.join("; ")}.`, schaetzung: true };
}

/* ----------------------------------------------------------------------- Mulligan */

export function mulliganSatz(a, mindest, namen) {
  const zeilen = (a?.mulligan?.karten ?? []).filter(
    (k) => k.wr_behalten !== null && k.wr_weg !== null && Math.min(k.behalten, k.weg) >= mindest,
  );
  const abstand = (k) => (k.wr_behalten ?? 0) - (k.wr_weg ?? 0);
  const gut = zeilen.filter((k) => abstand(k) >= MULLIGAN_ABSTAND).sort((x, y) => abstand(y) - abstand(x)).slice(0, 2);
  const schlecht = zeilen.filter((k) => abstand(k) <= -MULLIGAN_ABSTAND).sort((x, y) => abstand(x) - abstand(y)).slice(0, 2);
  if (!gut.length && !schlecht.length) return { text: "No clear advice for the mulligan.", schaetzung: false };
  // Beide Haelften stehen immer da, auch wenn eine davon keinen klaren Rat hat.
  const teile = [
    gut.length ? `Keep if you have ${aufzaehlen(gut.map((k) => namen(k.karte)))}` : "No card makes keeping clearly better",
    schlecht.length ? `with ${aufzaehlen(schlecht.map((k) => namen(k.karte)))}, rather mulligan`
      : "no card clearly calls for a mulligan",
  ];
  return { text: `${teile.join("; ")}.`, zahl: "real win rate", schaetzung: false };
}

/* --------------------------------------------------------- Was die Starken anders tun */

const ORT_EN = [
  [/^Gegnerzug (\d+), (\d+) Life$/, "opponent turn $1, $2 life"],
  [/^(\d+) Life, (\d+) Counter nötig$/, "$1 life, $2 counter needed"],
  [/^Zug (\d+)$/, "turn $1"],
  [/^Starthand$/, "opening hand"],
];

export function ortEnglisch(ort) {
  for (const [muster, text] of ORT_EN) if (muster.test(ort ?? "")) return ort.replace(muster, text);
  return ort ?? "";
}

export function spitzeSatz(u, namen) {
  const starke = `top players ${zahl(u.spitze, 0)}${PROZENT}, others ${zahl(u.feld, 0)}${PROZENT}`;
  const mehr = u.spitze > u.feld ? "more" : "less";
  if (u.art === "karte") {
    return { text: `Top players play ${namen(u.karte ?? u.titel)} ${mehr} often.`, zahl: starke, schaetzung: false };
  }
  if (u.art === "angriff") {
    return { text: `Top players attack the leader ${mehr} often.`, zahl: starke, schaetzung: false };
  }
  if (u.art === "abwehr") {
    return { text: `Top players counter ${mehr} often here (${ortEnglisch(u.ort)}).`, zahl: starke, schaetzung: false };
  }
  return { text: `Top players keep ${namen(u.karte ?? u.titel)} ${mehr} often.`, zahl: starke, schaetzung: false };
}

export function unterschiedeImZug(liste, T) {
  return (liste ?? []).filter((u) => (u.art === "karte" || u.art === "angriff") && u.T === T);
}

/* Verteidigung und Mulligan; Karten und Angriffe stehen schon im Schritt ihres Zugs. */
export function unterschiedeSonst(liste) {
  return (liste ?? []).filter((u) => u.art === "abwehr" || u.art === "mulligan");
}
