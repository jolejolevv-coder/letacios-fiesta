/**
 * Lesart einer Winrate: Klasse fuer die Schrift und Toenung fuer Matrixzellen.
 *
 * Gewinnt steht in Seegruen (--gewinnt), verliert in Ziegelrot (--verliert), beides
 * gedaempft und getrennt vom Akzent Turn Order Blau (DESIGN.md, The Two Signals Rule).
 * Fett ab GUT, die verlierende Seite ab SCHWACH abwaerts in der dunkleren Farbe; dazwischen
 * bleibt die Zahl neutral. Die Toenung einer Matrixzelle waechst mit dem Abstand von 50 %
 * und ist ab VOLL_AB Punkten Abstand voll.
 */
export const GUT = 55;
export const SCHWACH = 45;
export const MITTE = 50;
export const VOLL_AB = 12;

/** "gut", "schwach" oder "" fuer eine Winrate in Prozent. */
export function seite(wr) {
  if (wr == null || Number.isNaN(wr)) return "";
  return wr >= GUT ? "gut" : wr < SCHWACH ? "schwach" : "";
}

/** Klasse fuer Zahlen mit .wr; ohne Wert "wr leer", damit kein Strich rot wird. */
export function wrKlasse(wr) {
  if (wr == null || Number.isNaN(wr)) return "wr leer";
  const s = seite(wr);
  return s ? "wr " + s : "wr";
}

/**
 * Toenung einer Zelle: Richtung ("plus", "minus" oder "") und Staerke von 0 bis 1,
 * auf zwei Stellen gerundet, damit die Zellen nicht bei jeder Nachkommastelle neu malen.
 */
export function ton(wr) {
  if (wr == null || Number.isNaN(wr) || wr === MITTE) return { richtung: "", staerke: 0 };
  const staerke = Math.round(Math.min(1, Math.abs(wr - MITTE) / VOLL_AB) * 100) / 100;
  return { richtung: wr > MITTE ? "plus" : "minus", staerke };
}

/* ---------------------------------------------------------------- Sortieren der Matrix
   Eine Wahl fuer Matrix und Fokus, so wie sie in der Adresse steht (&sort=):
   "partien" (Standard, ohne Abfrage), "wr" absteigend, "wr_auf" aufsteigend. Die ganze
   Matrix kennt nur Partien und Winrate; "wr_auf" ordnet sie wie "wr". */
export const SORTEN = ["partien", "wr", "wr_auf"];

/** Sortwahl aus der Adresse; Unbekanntes faellt auf "partien" zurueck. */
export function sortAusText(text) {
  return SORTEN.includes(text) ? text : "partien";
}

const rate = (w, g) => (g > 0 ? (100 * w) / g : 0);

/**
 * Reihenfolge der Leader in der ganzen Matrix. Gewaehlt werden immer die `top` mit den
 * meisten Partien; bei "wr" stehen sie nach ihrer Winrate gegen das Feld, absteigend.
 * Zeilen und Spalten nutzen dieselbe Liste, damit die Diagonale der Spiegel bleibt.
 */
export function matrixOrdnen(leader, top, sort) {
  const auswahl = leader.slice(0, top);
  if (sort !== "wr" && sort !== "wr_auf") return auswahl;
  return auswahl
    .map((e, i) => ({ e, i, wr: rate(e.w, e.w + e.l) }))
    .sort((a, b) => b.wr - a.wr || a.i - b.i)
    .map((x) => x.e);
}

/**
 * Gegner im Fokus: nach Partien absteigend, oder nach Winrate (`w` von `m`) ab oder
 * aufsteigend. Gleichstand loest die Partienzahl, dann die Kennung.
 */
export function fokusOrdnen(zeilen, sort) {
  const r = [...zeilen];
  const nachPartien = (a, b) => b.m - a.m || String(a.id).localeCompare(String(b.id));
  if (sort === "wr") r.sort((a, b) => rate(b.w, b.m) - rate(a.w, a.m) || nachPartien(a, b));
  else if (sort === "wr_auf") r.sort((a, b) => rate(a.w, a.m) - rate(b.w, b.m) || nachPartien(a, b));
  else r.sort(nachPartien);
  return r;
}
