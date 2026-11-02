/**
 * Suche der ⌘K Palette ueber die Leader des geladenen Satzes.
 *
 * Ein Eintrag ist { id, name, partien }: id die Kartennummer (OP17-039), name der
 * Kartenname, partien die Zahl der Partien im Satz. Gesucht wird nach Name und
 * Kartennummer, ohne Gross und Kleinschreibung, Punkte, Bindestriche und Leerzeichen.
 */

export const TREFFER_MAX = 8;

// Je kleiner, desto weiter oben: Nummer exakt, Nummer am Anfang, Name am Anfang,
// ein Wort des Namens am Anfang, irgendwo enthalten.
const RANG_NUMMER_GLEICH = 0;
const RANG_NUMMER_ANFANG = 1;
const RANG_NAME_ANFANG = 2;
const RANG_WORT_ANFANG = 3;
const RANG_ENTHALTEN = 4;

/** Text auf Buchstaben und Ziffern in Kleinschrift bringen. */
export function glaetten(text) {
  return String(text || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

/** Rang eines Eintrags fuer die Anfrage, oder null, wenn er nicht passt. */
function rangVon(eintrag, anfrage) {
  const nummer = glaetten(eintrag.id);
  const name = glaetten(eintrag.name);
  if (nummer === anfrage) return RANG_NUMMER_GLEICH;
  if (nummer.startsWith(anfrage)) return RANG_NUMMER_ANFANG;
  if (name.startsWith(anfrage)) return RANG_NAME_ANFANG;
  const woerter = String(eintrag.name || "").toLowerCase().split(/[\s.\-]+/).map(glaetten);
  if (woerter.some((w) => w && w.startsWith(anfrage))) return RANG_WORT_ANFANG;
  if (name.includes(anfrage) || nummer.includes(anfrage)) return RANG_ENTHALTEN;
  return null;
}

/**
 * Passende Leader, am besten passende zuerst, bei gleichem Rang die meisten Partien zuerst.
 * Eine leere Anfrage liefert die meistgespielten.
 */
export function leaderSuchen(eintraege, text, max = TREFFER_MAX) {
  const anfrage = glaetten(text);
  const bewertet = [];
  for (const e of eintraege) {
    const rang = anfrage ? rangVon(e, anfrage) : RANG_ENTHALTEN;
    if (rang !== null) bewertet.push({ e, rang });
  }
  bewertet.sort((a, b) => a.rang - b.rang || (b.e.partien || 0) - (a.e.partien || 0));
  return bewertet.slice(0, max).map((b) => b.e);
}
