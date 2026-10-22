/* Noten und Accuracy einer Partie wie tools/spielbewertung.py in Metacoach (specs/features/
   eigenes-replay-analysieren.md, Plan 3), dazu die Analyse fuer den Replay Viewer wie
   tools/fiesta_analyse.analyse. Getestet in tests/spielbewertung.test.js gegen die
   Referenz.

   Jede Entscheidung wird gegen das Book derselben Lage gemessen (Matchup, sonst alle
   Gegner; Spitze, sonst Feld): der Verlust ist das mittlere Delta V der besten Option
   minus das der gewaehlten, in Punkten Siegchance. Daraus Note und Accuracy (Formel von
   Lichess). Gespielte Karten stehen nur als Hinweis da, ohne Note. */

import { werteBerechnen } from "./wertnetz.js";

export const MIN_OPTION = 10;            // Faelle je Option, ab denen sie im Vergleich zaehlt
export const NOTEN = [["excellent", 1.0], ["good", 2.5], ["inaccuracy", 5.0], ["mistake", 10.0]];
export const BLUNDER = "blunder";
export const BEST = "best";
export const NOTENFOLGE = [BEST, ...NOTEN.map(([n]) => n), BLUNDER];
const HINWEIS_WERT = 2.5;                // Hinweis zu einer Karte ab so vielen Punkten Wert
const SCHWERSTE = 3;
// Accuracy je Entscheidung wie bei Lichess, aus dem Verlust in Punkten Siegchance.
const ACC_A = 103.1668, ACC_B = 0.04354, ACC_C = 3.1669;
// Aus tools/book.py
export const ALLE = "alle";
export const MAX_ZUG = 7;
const BEDARF_SCHRITT = 1000;
const MAX_BEDARF = 4000;
const sitzVon = (first) => (first ? "first" : "second");

/* Pythons round(x, n): gerundet wird die exakte Dezimaldarstellung der Zahl, genau Halbe
   zur geraden Ziffer. toFixed rundet Halbe weg von null; beim Mulligan kommt ein Mittel
   wie 10,125 exakt vor (Referenz 2026-09-25T07.31.59: Python 10,12, toFixed 10,13). */
const GENAU = 100;
export function runden(x, stellen) {
  if (!Number.isFinite(x)) return x;
  const [ganz, bruch] = Math.abs(x).toFixed(GENAU).split(".");
  const vorne = bruch.slice(0, stellen);
  const rest = bruch.slice(stellen);
  let ziffern = BigInt(ganz + vorne);
  const halb = "5" + "0".repeat(rest.length - 1);
  if (rest > halb || (rest === halb && ziffern % 2n === 1n)) ziffern += 1n;
  const text = ziffern.toString().padStart(stellen + 1, "0");
  const zahl = Number(stellen ? text.slice(0, -stellen) + "." + text.slice(-stellen) : text);
  return x < 0 ? -zahl : zahl;
}

/* Pythons Wahrheitswert: leere Listen und Objekte sind falsch. */
function wahr(x) {
  if (x === null || x === undefined || x === false || x === 0 || x === "") return false;
  if (Array.isArray(x)) return x.length > 0;
  if (typeof x === "object") return Object.keys(x).length > 0;
  return true;
}

export function note(verlust, beste) {
  if (beste) return BEST;
  for (const [name, grenze] of NOTEN) if (verlust < grenze) return name;
  return BLUNDER;
}

export function accuracy(verlust) {
  return Math.max(0, Math.min(100, ACC_A * Math.exp(-ACC_B * verlust) - ACC_C));
}

/* Verlust der Wahl gegen die beste erlaubte Option mit genug Faellen, oder null. */
export function vergleich(optionen, wahl, erlaubt) {
  const gut = {};
  for (const [o, v] of Object.entries(optionen || {})) {
    if (erlaubt.has(o) && (v.n ?? 0) >= MIN_OPTION && v.d !== null && v.d !== undefined) gut[o] = v.d;
  }
  const namen = Object.keys(gut);
  if (!Object.hasOwn(gut, wahl) || namen.length < 2) return null;
  let beste = namen[0];
  for (const o of namen) if (gut[o] > gut[beste]) beste = o;
  const verlust = runden(gut[beste] - gut[wahl], 2);
  return {
    wahl, beste, verlust, note: note(verlust, beste === wahl),
    optionen: Object.fromEntries(namen.map((o) => [o, runden(gut[o], 2)])),
  };
}

/* Das Book eines Leaders: je Gegner und Sitz Matchup oder alle, je Zelle Spitze oder Feld. */
export class Quelle {
  constructor(daten) {
    this.g = daten.gegner || {};
  }

  eintrag(gegner, sitz) {
    let e = this.g[gegner]?.[sitz];
    if (e === undefined || e === null || e.rueckfall) e = this.g[ALLE]?.[sitz];
    return e;
  }

  zelle(gegner, sitz, hole) {
    const e = this.eintrag(gegner, sitz);
    if (!wahr(e)) return [null, null];
    for (const stufe of ["spitze", "feld"]) {
      const a = e[stufe];
      if (wahr(a)) {
        const wert = hole(a);
        if (wahr(wert)) return [wert, stufe];
      }
    }
    return [null, null];
  }
}

/* Wie viel Counter der Verteidiger braucht, damit der Angriff scheitert (book.counter_bedarf). */
export function counterBedarf(a) {
  if (!wahr(a.kampf)) return null;
  const [pAngreifer, pZiel] = a.kampf;
  const pLeader = pZiel - (a.counter ?? 0);
  if (pAngreifer < pLeader) return null;
  return Math.floor((pAngreifer - pLeader) / BEDARF_SCHRITT) * BEDARF_SCHRITT + BEDARF_SCHRITT;
}

export function counterAufHand(hand, counter) {
  return hand.reduce((s, k) => s + (counter[k] ?? 0), 0);
}

/* (benotete Entscheidungen, Hinweise) des Spielers `nr` in der Partie `p` (Zuglager). */
export function entscheidungen(p, nr, q, counter, kosten) {
  const gegner = p.leader[String(3 - nr)];
  const sitz = sitzVon(p.erster === nr);
  const aus = [];
  const hinweise = [];

  p.angriffe.forEach((a, i) => {
    if (a.wer === nr && a.gerestet && a.T <= MAX_ZUG) {
      const [zelle, stufe] = q.zelle(gegner, sitz, (s) => (s.angriffe || []).find((x) => x.T === a.T) ?? null);
      const v = zelle ? vergleich(zelle.optionen || {}, a.ziel, new Set(["leader", "character"])) : null;
      if (v) aus.push({ art: "angriff", T: a.T, angriff: i, lage: "Gegner mit gerestet Character", stufe, ...v });
    }
    if (a.wer !== nr && a.ziel === "leader" && a.trifft) {
      const c = p.lagen[a.vor]?.c?.[String(nr)];
      if (!c) return;
      const life = c[1];
      const bedarf = counterBedarf(a);
      const reicht = bedarf !== null && counterAufHand(a.hand_karten || [], counter) >= bedarf;
      let zelle;
      let stufe;
      let lage;
      if (reicht) {
        const y = String(Math.min(bedarf, MAX_BEDARF));
        [zelle, stufe] = q.zelle(gegner, sitz, (s) => s.abwehr?.counter?.[String(life)]?.[y] ?? null);
        lage = `${life} Life, ${bedarf} Counter nötig, Hand reicht`;
      } else {
        [zelle, stufe] = q.zelle(gegner, sitz, (s) => s.abwehr?.zug?.[String(a.T)]?.[String(life)] ?? null);
        lage = `Gegnerzug ${a.T}, ${life} Life`;
      }
      const erlaubt = new Set(["nehmen"]);
      if (reicht || a.antwort === "countern") erlaubt.add("countern");
      if (a.antwort === "blocken") erlaubt.add("blocken");
      const v = zelle ? vergleich(zelle.optionen || {}, a.antwort, erlaubt) : null;
      if (v) aus.push({ art: "abwehr", T: a.T, angriff: i, lage, stufe, ...v });
    }
  });

  const m = p.mulligan[String(nr)];
  const hand = m.mull ? m.hand_vor : (wahr(m.hand) ? m.hand : m.hand_vor);
  if (wahr(hand)) {
    const [zelle, stufe] = q.zelle(gegner, sitz, (s) => (wahr(s.mulligan?.karten) ? s.mulligan.karten : null));
    if (zelle) {
      const karten = Object.fromEntries(zelle.map((k) => [k.karte, k]));
      const abstaende = hand
        .filter((k) => Object.hasOwn(karten, k) && karten[k].wr_behalten !== null && karten[k].wr_weg !== null
          && Math.min(karten[k].behalten, karten[k].weg) >= MIN_OPTION)
        .map((k) => karten[k].wr_behalten - karten[k].wr_weg);
      if (abstaende.length) {
        const d = abstaende.reduce((s, x) => s + x, 0) / abstaende.length;
        const v = vergleich({ behalten: { n: MIN_OPTION, d }, weggemischt: { n: MIN_OPTION, d: 0.0 } },
          m.mull ? "weggemischt" : "behalten", new Set(["behalten", "weggemischt"]));
        if (v) {
          aus.push({ art: "mulligan", T: 0, lage: `${abstaende.length} Karten der Starthand im Book`, stufe, ...v });
        }
      }
    }
  }

  for (const z of p.zuege) {
    if (z.wer !== nr || z.T > MAX_ZUG) continue;
    const [zeilen] = q.zelle(gegner, sitz, (s) => (wahr(s.karten?.[String(z.T)]) ? s.karten[String(z.T)] : null));
    if (!zeilen) continue;
    const werte = {};
    for (const k of zeilen) if (k.wert !== null && k.wert !== undefined) werte[k.karte] = k.wert;
    const bezahlbar = [...new Set(z.hand || [])].filter((k) => (kosten[k] ?? 99) <= (z.don || 0));
    bezahlbar.sort((a, b) => -(werte[a] ?? 0) + (werte[b] ?? 0));
    for (const k of bezahlbar) {
      const w = werte[k];
      if (w === undefined) continue;
      const gespielt = z.plays.includes(k);
      if (!gespielt && w >= HINWEIS_WERT) {
        hinweise.push({ T: z.T, karte: k, wert: w, text: "lag bezahlbar auf der Hand" });
      } else if (gespielt && w <= -HINWEIS_WERT) {
        hinweise.push({ T: z.T, karte: k, wert: w, text: "gespielt, Halten wäre besser" });
      }
    }
  }
  return [aus, hinweise];
}

/* Gleiche Fehler im selben Zug als ein Eintrag mit Anzahl; der Verlust gilt je Entscheidung. */
export function zusammenfassen(fehler) {
  const gruppen = new Map();
  for (const e of fehler) {
    const schluessel = JSON.stringify([e.art, e.T, e.lage, e.wahl, e.beste]);
    if (gruppen.has(schluessel)) gruppen.get(schluessel).anzahl += 1;
    else gruppen.set(schluessel, { ...e, anzahl: 1 });
  }
  return [...gruppen.values()];
}

export function partieBewerten(p, nr, q, counter, kosten, datei) {
  const [aus, hinweise] = entscheidungen(p, nr, q, counter, kosten);
  const zaehlung = Object.fromEntries(NOTENFOLGE.map((n) => [n, 0]));
  for (const e of aus) zaehlung[e.note] += 1;
  const acc = aus.length
    ? runden(aus.reduce((s, e) => s + accuracy(e.verlust), 0) / aus.length, 1)
    : null;
  const schwer = zusammenfassen(aus.filter((e) => e.verlust > 0))
    .sort((a, b) => b.verlust - a.verlust)
    .slice(0, SCHWERSTE);
  return {
    datei, datum: p.tag, gegner: p.leader[String(3 - nr)], sitz: sitzVon(p.erster === nr),
    sieg: p.sieger === nr, accuracy: acc, noten: zaehlung, schwerste: schwer,
    entscheidungen: aus, hinweise,
  };
}

/* ---------------------------------------------------------- Analyse fuer den Viewer */

// Fiesta ist englisch; die Lagen aus der Bewertung sind deutsch (fiesta_analyse.LAGE_EN).
const LAGE_EN = [
  [/^Gegner mit gerestet Character$/, "opponent has a rested character"],
  [/^(\d+) Life, (\d+) Counter nötig, Hand reicht$/, "$1 life, $2 counter needed and in hand"],
  [/^Gegnerzug (\d+), (\d+) Life$/, "opponent turn $1, $2 life"],
  [/^(\d+) Karten der Starthand im Book$/, "$1 opening cards in the guide"],
];

export function lageEnglisch(lage) {
  for (const [muster, text] of LAGE_EN) if (muster.test(lage)) return lage.replace(muster, text);
  return lage;
}

/* Die Kurve: je Halbzug die Siegchance beider Spieler am Zugende, in Prozent. */
export function kurveBauen(p, werte) {
  const aus = [];
  for (const z of p.zuege) {
    if (z.nach === null || z.nach === undefined || !werte.has(z.nach + ",1")) continue;
    const v2 = werte.get(z.nach + ",2");
    aus.push({ hz: p.lagen[z.nach].hz, wer: z.wer, T: z.T, lage: z.nach,
      v1: werte.get(z.nach + ",1"), v2: v2 === undefined ? null : v2 });
  }
  return aus;
}

/* Die Analyse einer Partie in der Form, die ReplayAnalyse im Viewer liest (wie
   fiesta_analyse.analyse). books: Leader -> Book Daten (oder fehlend); werte aus
   werteBerechnen. Ein Spieler ohne Book bekommt keine Noten. */
export function analyseBauen(p, werte, books, counter, kosten, modell) {
  const kurve = kurveBauen(p, werte).map((k) => ({ hz: k.hz, wer: k.wer, T: k.T, v1: runden(k.v1, 1) }));
  const spieler = {};
  let alle = [];
  let hinweiseAlle = [];
  for (const nr of [1, 2]) {
    const leader = p.leader[String(nr)];
    const book = books[leader];
    if (!book) {
      spieler[String(nr)] = { leader, accuracy: null, noten: null, first: p.erster === nr, sieg: p.sieger === nr };
      continue;
    }
    const r = partieBewerten(p, nr, new Quelle(book), counter, kosten, "");
    spieler[String(nr)] = { leader, accuracy: r.accuracy, noten: r.noten, first: p.erster === nr, sieg: p.sieger === nr };
    alle = alle.concat(r.entscheidungen.map((e) => ({
      wer: nr, art: e.art, T: e.T, wahl: e.wahl, beste: e.beste, verlust: e.verlust, note: e.note,
      lage: lageEnglisch(e.lage), angriff: e.angriff ?? null,
    })));
    hinweiseAlle = hinweiseAlle.concat(r.hinweise.map((h) => ({ wer: nr, ...h })));
  }
  return { version: 1, modell, kurve, spieler, entscheidungen: alle, hinweise: hinweiseAlle };
}

/* Alles in einem Schritt: Werte aus dem Netz, dann die Analyse. */
export function partieAnalysieren(p, netz, books, counter, kosten) {
  const werte = werteBerechnen(p, netz);
  return analyseBauen(p, werte, books, counter, kosten, netz.datum);
}
