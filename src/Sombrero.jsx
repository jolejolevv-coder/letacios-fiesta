/**
 * Die Marke. Ein Sombrero, flach und geometrisch, keine Illustration.
 *
 * Gezeichnet aus vier Formen: Krempe, Unterschatten, Krone und Hutband. Die Proportion
 * traegt das Ganze, eine sehr breite Krempe gegen eine schmale Krone.
 *
 * Der Strohton steht fest und erbt bewusst NICHT den Akzent. Sonst wandert die Marke mit
 * der Systemfarbe mit und der Hut wurde blau.
 */
const STROH = "#e8a33d";
export default function Sombrero({ groesse = 34, className = "" }) {
  return (
    <svg
      width={groesse}
      height={(groesse * 40) / 64}
      viewBox="0 0 64 40"
      className={className}
      role="img"
      aria-label="Sombrero"
    >
      {/* Unterschatten der Krempe, gibt dem Hut Auflage */}
      <path
        d="M2 27 Q32 37 62 27 Q32 41 2 27 Z"
        fill="var(--text)"
        opacity="0.22"
      />
      {/* Krempe */}
      <ellipse cx="32" cy="26.5" rx="30" ry="9" fill={STROH} />
      {/* Stickrand, eine einzelne gestrichelte Ellipse statt Zierrat */}
      <ellipse
        cx="32"
        cy="26.5"
        rx="25"
        ry="7"
        fill="none"
        stroke="var(--grund)"
        strokeWidth="1.1"
        strokeDasharray="3 3.4"
        opacity="0.75"
      />
      {/* Krone */}
      <path
        d="M21 26.5 C21 10 26 4.5 32 4.5 C38 4.5 43 10 43 26.5 Z"
        fill={STROH}
      />
      {/* Hutband */}
      <path
        d="M21.4 20.5 Q32 24.4 42.6 20.5 L42.6 24.4 Q32 28.3 21.4 24.4 Z"
        fill="var(--text)"
        opacity="0.42"
      />
    </svg>
  );
}
