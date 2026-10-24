/**
 * Rechnung hinter dem Zaehler in der Kennzeile (Zaehler in App.jsx), ohne DOM, damit sie
 * sich testen laesst. specs/features/zaehler-endwert.md.
 *
 * Die Zahl steht vom ersten Bild an richtig da. Hochgezaehlt wird nur beim Wechsel auf
 * einen neuen Wert, und nie bei reduzierter Bewegung oder in einem verborgenen Tab: dort
 * steht requestAnimationFrame still, und GSAP liesse die Zahl auf einem Zwischenwert stehen.
 */
export const DAUER = 0.5;
// Spaetestens so lange nach DAUER steht der Endwert, auch wenn requestAnimationFrame
// stillsteht, ohne dass document.hidden es meldet (am 24.10.2026 im eingebetteten
// Browser so gesehen: die Zahl blieb auf dem alten Wert stehen).
export const NACHLAUF_MS = 150;

/** "53.4 %" oder "42,490": Tausender nach en-US, Nachkommastellen und Suffix wie gewuenscht. */
export function zahlText(n, nachkomma = 0, suffix = "") {
  const text = nachkomma ? n.toFixed(nachkomma) : Math.round(n).toLocaleString("en-US");
  return text + suffix;
}

/** Soll der Wechsel von alt auf neu hochzaehlen? */
export function animieren({ reduziert, versteckt, alt, neu }) {
  if (reduziert || versteckt) return false;
  return alt !== neu;
}
