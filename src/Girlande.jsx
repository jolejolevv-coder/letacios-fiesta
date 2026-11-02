import { useEffect, useRef, useState } from "react";

/**
 * Girlande aus Papel Picado ueber dem Kopf, die zweite Haelfte der Marke neben dem Sombrero.
 * Die Faehnchen tragen die Farben, die die Seite uebergibt (Leaderfarben mit Stroh oder die
 * Fiestafarben). Wechseln die Farben, flattert die Girlande einmal; bei reduzierter Bewegung
 * schaltet das CSS die Animation ab.
 */

const HOEHE = 26;           // Hoehe der Girlande in px, zugleich Masstab des viewBox
const SCHRITT = 34;         // Abstand von Faehnchen zu Faehnchen
const BREITE_F = 26;        // Breite eines Faehnchens
const ANZAHL = 64;          // genug fuer breite Bildschirme, der Rest wird abgeschnitten
const VERSATZ_MS = 26;      // Welle: jedes Faehnchen startet etwas spaeter
const WELLE_MAX_MS = 520;   // danach beginnt die Welle von vorn

function Faehnchen({ i, farbe }) {
  const x = i * SCHRITT + 4;
  const mitte = x + BREITE_F / 2;
  const h = HOEHE - 3;
  const kante = h * 0.64;
  return (
    <g className="f" style={{ animationDelay: ((i * VERSATZ_MS) % WELLE_MAX_MS) + "ms" }}>
      <path d={`M${x} 1.5h${BREITE_F}v${kante}l${-BREITE_F / 2} ${h - kante}l${-BREITE_F / 2} ${kante - h}z`} fill={farbe} />
      {/* ausgeschnittenes Muster: ein Loch und ein kleiner Winkel */}
      <circle cx={mitte} cy={h * 0.34} r={2.4} fill="var(--karton)" />
      <path d={`M${mitte - 5} ${h * 0.6}l5 3l5 -3`} stroke="var(--karton)" strokeWidth="1.3" fill="none" />
    </g>
  );
}

export default function Girlande({ farben }) {
  const schluessel = farben.join(",");
  const vorher = useRef(schluessel);
  const [flattert, setFlattert] = useState(false);

  useEffect(() => {
    if (vorher.current === schluessel) return;
    vorher.current = schluessel;
    setFlattert(false);
    // Neu starten im naechsten Bild, damit die Animation auch beim zweiten Wechsel laeuft.
    const id = requestAnimationFrame(() => setFlattert(true));
    return () => cancelAnimationFrame(id);
  }, [schluessel]);

  return (
    <svg className={"girlande" + (flattert ? " flattert" : "")} viewBox={`0 0 ${ANZAHL * SCHRITT} ${HOEHE}`}
         preserveAspectRatio="xMinYMin slice" aria-hidden="true" focusable="false">
      <path d={`M0 1.2H${ANZAHL * SCHRITT}`} stroke="rgba(255,255,255,.22)" strokeWidth="1" />
      {Array.from({ length: ANZAHL }, (_, i) => (
        <Faehnchen key={i} i={i} farbe={farben[i % farben.length]} />
      ))}
    </svg>
  );
}
