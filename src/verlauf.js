/* Bountyverlauf der Spielerseite (specs/features/spielerseite-verlauf.md).

   Die Werte kommen aus `Graph.y` des Profils: die Bounty nach jeder Partie der Saison, aelteste
   zuerst, ohne Zeitachse. Hier entstehen nur die SVG Punkte und die drei Kennwerte; die
   Komponente in App.jsx zeichnet sie. */

// Masse im SVG; die Kurve wird auf die volle Breite gestreckt (preserveAspectRatio none).
export const VERLAUF_BREITE = 1000;
export const VERLAUF_HOEHE = 120;
// Luft ueber dem Hoechst und unter dem Tiefstwert, damit die Linie nicht am Rand klebt.
const RAND_ANTEIL = 0.08;

/** Nur endliche Zahlen; alles andere faellt weg. */
function zahlen(werte) {
  return (Array.isArray(werte) ? werte : []).filter((v) => typeof v === "number" && Number.isFinite(v));
}

/**
 * Punkte und Kennwerte des Verlaufs, oder null bei weniger als zwei Werten.
 * linie: "x,y x,y ..." fuer die Polyline; flaeche: dieselbe Linie bis an den Boden geschlossen.
 */
export function verlaufBauen(werte, breite = VERLAUF_BREITE, hoehe = VERLAUF_HOEHE) {
  const v = zahlen(werte);
  if (v.length < 2) return null;
  const tief = Math.min(...v);
  const hoch = Math.max(...v);
  const spanne = hoch - tief || 1;
  const unten = tief - spanne * RAND_ANTEIL;
  const oben = hoch + spanne * RAND_ANTEIL;
  const px = (i) => ((i / (v.length - 1)) * breite).toFixed(1);
  const py = (w) => (hoehe - ((w - unten) / (oben - unten)) * hoehe).toFixed(1);
  const linie = v.map((w, i) => `${px(i)},${py(w)}`).join(" ");
  return {
    linie,
    flaeche: `0,${hoehe} ${linie} ${breite},${hoehe}`,
    start: v[0],
    hoch,
    jetzt: v[v.length - 1],
    partien: v.length,
  };
}
