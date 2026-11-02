/**
 * Kartenfarben eines Leaders fuer die Signatur "Fiesta in Leaderfarbe" (specs/features/signatur.md).
 *
 * karten.json fuehrt je Karte das Feld f, einen oder zwei Buchstaben: r rot, g gruen, b blau,
 * p lila, y gelb, s schwarz. Schwarz erscheint als Silber, sonst verschwaende es auf dem
 * dunklen Grund. Die Leaderfarbe faerbt nur Flaechen, Kanten und Bild, nie Zahlen.
 */

export const LEADERFARBE = {
  r: "#e5484d",
  g: "#30a46c",
  b: "#3e7bfa",
  p: "#9b5de5",
  y: "#f5c518",
  s: "#a1a1aa",
};

export const FARBNAME = { r: "Red", g: "Green", b: "Blue", p: "Purple", y: "Yellow", s: "Black" };

/** Stroh des Sombreros, die Farbe der Marke. */
export const STROH = "#e8a33d";

/** Faehnchen der Girlande auf Seiten ohne Leader. */
export const FIESTA = [STROH, "#e05d6f", "#30a46c", "#9b5de5", "#3e7bfa"];

/** Grundfarbe der Seite, gegen die die Farbe der Browserleiste gemischt wird. */
const GRUND = "#08090a";
/** Anteil der Leaderfarbe in der Browserleiste am Handy. */
const THEMA_ANTEIL = 0.45;

/** Bekannte Farbbuchstaben eines Leaders, ohne Doppel, hoechstens zwei. */
export function farbBuchstaben(f) {
  const gesehen = [];
  for (const k of String(f || "")) {
    if (LEADERFARBE[k] && !gesehen.includes(k)) gesehen.push(k);
  }
  return gesehen.slice(0, 2);
}

/** Die beiden Toene fuer Verlaeufe; einfarbige Leader zweimal derselbe, ohne Farbe null. */
export function leaderTon(f) {
  const k = farbBuchstaben(f);
  if (!k.length) return null;
  return { eins: LEADERFARBE[k[0]], zwei: LEADERFARBE[k[k.length - 1]] };
}

/** Farben der Faehnchen: die Kartenfarben im Wechsel mit Stroh, ohne Leader die Fiestafarben. */
export function fahnenFarben(f) {
  const k = farbBuchstaben(f);
  if (!k.length) return FIESTA;
  return [...k.map((b) => LEADERFARBE[b]), STROH];
}

/** Zwei Hexfarben mischen; anteil ist der Teil von a. */
export function mischen(a, b, anteil) {
  const kanal = (hex, i) => parseInt(hex.slice(1 + 2 * i, 3 + 2 * i), 16);
  const teile = [0, 1, 2].map((i) => Math.round(kanal(a, i) * anteil + kanal(b, i) * (1 - anteil)));
  return "#" + teile.map((n) => n.toString(16).padStart(2, "0")).join("");
}

/** Farbe der Browserleiste am Handy: Leaderfarbe in den Grund gemischt, ohne Leader der Grund. */
export function themaFarbe(f) {
  const ton = leaderTon(f);
  return ton ? mischen(ton.eins, GRUND, THEMA_ANTEIL) : GRUND;
}
