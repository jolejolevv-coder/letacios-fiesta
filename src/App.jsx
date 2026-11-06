import { createContext, lazy, Suspense, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import Sombrero from "./Sombrero.jsx";
import Girlande from "./Girlande.jsx";
import Fehlergrenze, { ReiterFehler } from "./Fehlergrenze.jsx";
import { fahnenFarben, FARBNAME, farbBuchstaben, LEADERFARBE, leaderTon, themaFarbe } from "./leaderfarben.js";
import {
  anmelden,
  anzahl,
  bildpfad,
  bildQuellen,
  deckSchluessel,
  EntsperrFehler,
  grossesBild,
  holen,
  kartenLaden,
  KARTE,
  kryptoDa,
  KAIZOKU_QUELLEN,
  istKaizokuQuelle,
  kaizokuLaden,
  kartenzeilen,
  kennung,
  satzLaden,
  spielerJeListe,
  verschluesselung,
  verschmelzen,
  zeitraumLaden,
} from "./daten.js";
import { leaderSuchen } from "./leadersuche.js";
import { verlaufBauen, VERLAUF_BREITE, VERLAUF_HOEHE } from "./verlauf.js";
import { PASSWORT_SCHLUESSEL, VORGABE_SATZ } from "./vorab.js";

/* Seltene Reiter laden erst beim Oeffnen (src/Selten.jsx, specs/features/ladepfad-handy.md). */
const selten = () => import("./Selten.jsx");
const Replay = lazy(() => selten().then((m) => ({ default: m.Replay })));
const Analyse = lazy(() => selten().then((m) => ({ default: m.Analyse })));
const Book = lazy(() => selten().then((m) => ({ default: m.Book })));
const Changelog = lazy(() => selten().then((m) => ({ default: m.Changelog })));
const EigenesReplay = lazy(() => selten().then((m) => ({ default: m.EigenesReplay })));
import { BILANZ_ZEILEN_MAX, bilanzNachLeader, partienJeListe } from "./niederlagen.js";
import { animieren, DAUER, NACHLAUF_MS, zahlText } from "./zaehler.js";
import { fokusOrdnen, GUT, matrixOrdnen, SCHWACH, seite as wrSeite, sortAusText, ton as wrTon, wrKlasse } from "./winrate.js";

/* --------------------------------------------------------------------------
   Kleine Helfer

   Gestaltet als ruhiges Werkzeug (DESIGN.md): nummerierte Zeilen mit Haarlinien,
   Zahlen rechtsbuendig in Geist Mono, eine Akzentfarbe. Gut und schlecht stehen in
   Gewicht und in zwei gedaempften Signalfarben, Seegruen und Ziegelrot (src/winrate.js).
   -------------------------------------------------------------------------- */

const proz = (w, g) => (g > 0 ? (100 * w) / g : 0);
const fmtProz = (w, g) => (g > 0 ? proz(w, g).toFixed(1) + " %" : "–");
export const fmtZahl = (n) => (n || 0).toLocaleString("en-US");
/** Bounty immer mit einer Nachkommastelle, damit die Spalte buendig steht (8,984.2 neben 9,611.0). */
const fmtBounty = (n) => (n || 0).toLocaleString("en-US", { minimumFractionDigits: 1, maximumFractionDigits: 1 });
const fmtDauer = (s) =>
  s ? Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0") : "–";
export const nr2 = (n) => String(n).padStart(2, "0");
export const datumKurz = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T12:00:00Z")
  .toLocaleDateString("en-GB", { day: "numeric", month: "short", year: "numeric" }) : "–");

/** Standardfehler einer Winrate in Prozentpunkten. Ehrlicher als die blosse Zahl. */
const fehler = (g) => (g > 0 ? 100 * Math.sqrt(0.25 / g) : 0);

/* Fett und Seegruen ab 55 %, Ziegelrot unter 45 % (The Two Signals Rule, src/winrate.js). */
const wrKlasseWG = (w, g) => (g > 0 ? wrKlasse(proz(w, g)) : "wr leer");

/* Kartenbilder liegen 120 auf 167 Pixel vor. */
const BILD_B = 120;
const BILD_H = 167;

/** Ist der Schirm schmal? Fuer die wenigen Stellen, an denen das Handy anders rechnet. */
function useSchmal(grenze) {
  const abfrage = `(max-width: ${grenze}px)`;
  const [schmal, setSchmal] = useState(
    () => typeof window !== "undefined" && window.matchMedia(abfrage).matches
  );
  useEffect(() => {
    const m = window.matchMedia(abfrage);
    const pruefen = () => setSchmal(m.matches);
    pruefen();
    m.addEventListener("change", pruefen);
    return () => m.removeEventListener("change", pruefen);
  }, [abfrage]);
  return schmal;
}

/* --------------------------------------------------------------------------
   Zeichen: SVG Striche wie in Metacoach (meta-coach/web/src/teile.tsx). Hand spielen,
   Schwert angreifen, Schild verteidigen, Krone Top players, Karte Starthand, dazu
   Umdrehen, Pfeil und Rueckseite.
   -------------------------------------------------------------------------- */

const ZEICHEN = {
  hand: ["M18 11V6a2 2 0 0 0-4 0", "M14 10V4a2 2 0 0 0-4 0v2", "M10 10.5V6a2 2 0 0 0-4 0v8",
         "M18 8a2 2 0 1 1 4 0v6a8 8 0 0 1-8 8h-2c-2.8 0-4.5-.86-6-2.34l-3.6-3.6a2 2 0 0 1 2.83-2.82L7 15"],
  schwert: ["M14.5 17.5 3 6V3h3l11.5 11.5", "m13 19 6-6", "m16 16 4 4", "m19 21 2-2"],
  schild: ["M20 13c0 5-3.5 7.5-7.66 8.95a1 1 0 0 1-.67-.01C7.5 20.5 4 18 4 13V6a1 1 0 0 1 1-1c2 0 4.5-1.2 6.24-2.72a1.17 1.17 0 0 1 1.52 0C14.51 3.81 17 5 19 5a1 1 0 0 1 1 1z"],
  krone: ["M11.56 3.27a.5.5 0 0 1 .88 0l2.95 5.6a1 1 0 0 0 1.52.3l4.27-3.67a.5.5 0 0 1 .8.52l-2.84 10.25a1 1 0 0 1-.96.73H5.81a1 1 0 0 1-.96-.73L2.02 6.02a.5.5 0 0 1 .8-.52l4.27 3.67a1 1 0 0 0 1.52-.3z", "M5 21h14"],
  karte: ["M8.5 21.5h9a1.6 1.6 0 0 0 1.6-1.6V7.5", "M7.5 7.5h4", "M5.6 2.5h7.8a1.6 1.6 0 0 1 1.6 1.6v12.3a1.6 1.6 0 0 1-1.6 1.6H5.6A1.6 1.6 0 0 1 4 16.4V4.1a1.6 1.6 0 0 1 1.6-1.6z"],
  dreh: ["m6 9 6 6 6-6"],
  rueck: ["M3 12a9 9 0 0 1 15.5-6.2L21 8", "M21 3v5h-5", "M21 12a9 9 0 0 1-15.5 6.2L3 16", "M3 21v-5h5"],
  rechts: ["m9 6 6 6-6 6"],
  links: ["m15 6-6 6 6 6"],
  suche: ["M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14z", "m20 20-4-4"],
  gitter: ["M4 4h7v7H4z", "M13 4h7v7h-7z", "M4 13h7v7H4z", "M13 13h7v7h-7z"],
  mehr: ["M5 12h.01", "M12 12h.01", "M19 12h.01"],
};
// Pfeile etwas kraeftiger als die Bildzeichen, wie in Metacoach.
const STRICH = { dreh: 1.9, rueck: 1.9, rechts: 1.9, links: 1.9, mehr: 3 };

export function Zeichen({ name, groesse = 18 }) {
  return (
    <svg width={groesse} height={groesse} viewBox="0 0 24 24" fill="none" stroke="currentColor"
         strokeWidth={STRICH[name] ?? 1.7} strokeLinecap="round" strokeLinejoin="round"
         aria-hidden="true" focusable="false">
      {ZEICHEN[name].map((d) => <path key={d} d={d} />)}
    </svg>
  );
}

/* --------------------------------------------------------------------------
   Bausteine
   -------------------------------------------------------------------------- */

export function Bild({ id, className = "", alt = "", breite, hoehe, scharf = false, vorrang = false }) {
  // Die Quellen der Reihe nach (bildQuellen), danach der Platzhalter mit der Kennung.
  const [stufe, setStufe] = useState(0);
  // Ohne Kennung (etwa ein unbekannter Leader in einer Partie) steht ein leerer Platzhalter.
  if (!id) return <span className={className + " kb-kaputt"} aria-hidden="true" />;
  const quellen = bildQuellen(id, scharf);
  if (stufe >= quellen.length) {
    const strich = id.lastIndexOf("-");
    return (
      <span className={className + " kb-kaputt"} title={id}>
        {strich > 0 ? <span className="kb-satz">{id.slice(0, strich + 1)}</span> : null}
        <span className="kb-nr">{strich > 0 ? id.slice(strich + 1) : id}</span>
      </span>
    );
  }
  // vorrang: das Bild ist das groesste im ersten Bild (LCP) und laedt sofort und zuerst.
  return (
    <img
      src={quellen[stufe]}
      alt={alt}
      width={breite}
      height={hoehe}
      loading={vorrang ? "eager" : "lazy"}
      fetchpriority={vorrang ? "high" : undefined}
      decoding="async"
      className={className}
      onError={() => setStufe((s) => s + 1)}
    />
  );
}

/** Kartenbild klein im Rahmenring, wie das Kartensymbol auf einer Spielhilfe.
 *  Mit `vorschau` ist es ein Knopf, der die Karte gross zeigt (Kartenvorschau). */
export function Kartenbild({ id, breite = 26, alt = "", vorschau = false, name = "" }) {
  const hoehe = Math.round((breite * BILD_H) / BILD_B);
  const oeffnen = useContext(VorschauKontext);
  if (vorschau && oeffnen && grossesBild(id)) {
    return (
      <button type="button" className="kb-rahmen kb-knopf" style={{ width: breite, height: hoehe }}
              aria-label={"Show " + (name || id) + " large"} aria-haspopup="dialog"
              onClick={(e) => { e.stopPropagation(); oeffnen(id, name || id, e.currentTarget); }}>
        <Bild id={id} className="kb" breite={breite} hoehe={hoehe} />
      </button>
    );
  }
  return (
    <span className="kb-rahmen" style={{ width: breite, height: hoehe }} aria-hidden={alt ? undefined : "true"}>
      <Bild id={id} className="kb" alt={alt} breite={breite} hoehe={hoehe} />
    </span>
  );
}

/* --------------------------------------------------------------------------
   Kartenvorschau: ein Tipp auf ein Kartenbild zeigt die Karte gross, damit man den Text
   lesen kann. Das grosse Bild kommt von Metacoach (grossesBild in daten.js); bis es da ist,
   steht das kleine Bild vergroessert als Platzhalter. Faellt Metacoach aus, bleibt es dabei.
   -------------------------------------------------------------------------- */

/* Kartenfarben eines Leaders als kleine Punkte vor dem Namen; Farbe nur als Fläche, nie auf Zahlen. */
function Farbpunkte({ f }) {
  const buchstaben = farbBuchstaben(f);
  if (!buchstaben.length) return null;
  return (
    <span className="farbpunkte" title={buchstaben.map((b) => FARBNAME[b]).join(", ")}>
      {buchstaben.map((b) => <i key={b} style={{ background: LEADERFARBE[b] }} />)}
    </span>
  );
}

const VorschauKontext = createContext(null);
const FOKUSSIERBAR = 'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])';

function Kartenvorschau({ karte, schliessen }) {
  const [zustand, setZustand] = useState("laedt");   // "laedt", "da", "fehlt"
  const dialogRef = useRef(null);
  const knopfRef = useRef(null);
  const quelle = grossesBild(karte.id);

  useEffect(() => {
    setZustand("laedt");
  }, [karte.id]);

  useEffect(() => {
    knopfRef.current?.focus();
    const vorher = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const taste = (e) => {
      if (e.key === "Escape") {
        e.preventDefault();
        schliessen();
        return;
      }
      if (e.key !== "Tab" || !dialogRef.current) return;
      // Fokus fangen: Tab und Umschalt+Tab bleiben im Dialog.
      const ziele = [...dialogRef.current.querySelectorAll(FOKUSSIERBAR)];
      if (!ziele.length) return;
      const erstes = ziele[0];
      const letztes = ziele[ziele.length - 1];
      if (e.shiftKey && document.activeElement === erstes) {
        e.preventDefault();
        letztes.focus();
      } else if (!e.shiftKey && document.activeElement === letztes) {
        e.preventDefault();
        erstes.focus();
      } else if (!dialogRef.current.contains(document.activeElement)) {
        e.preventDefault();
        erstes.focus();
      }
    };
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("keydown", taste);
      document.body.style.overflow = vorher;
    };
  }, [schliessen]);

  return createPortal(
    <div className="vorschau-schleier" onClick={(e) => { if (e.target === e.currentTarget) schliessen(); }}>
      <div ref={dialogRef} className="vorschau" role="dialog" aria-modal="true" aria-labelledby="vorschau-titel">
        <div className={"vorschau-bild " + zustand}>
          <img className="platzhalter" src={bildpfad(karte.id)} alt="" aria-hidden="true" />
          {quelle ? (
            <img className="gross" src={quelle} alt={karte.name} decoding="async"
                 onLoad={() => setZustand("da")} onError={() => setZustand("fehlt")} />
          ) : null}
        </div>
        <div className="vorschau-fuss">
          <span className="vorschau-name" id="vorschau-titel">
            <b>{karte.name}</b>
            {karte.name !== karte.id ? <small>{karte.id}</small> : null}
          </span>
          <button ref={knopfRef} type="button" className="knopf rand" onClick={schliessen}>Close</button>
        </div>
        {zustand === "fehlt" || !quelle ? (
          <p className="vorschau-hinweis" role="status">Large image unavailable right now, showing the small one.</p>
        ) : zustand === "laedt" ? <span className="nur-sr" role="status">Loading the large image</span> : null}
      </div>
    </div>,
    document.body
  );
}

/** Haelt die offene Karte und gibt den Fokus nach dem Schliessen an den Ausloeser zurueck. */
function VorschauBuehne({ children }) {
  const [karte, setKarte] = useState(null);
  const ausloeser = useRef(null);
  const oeffnen = useCallback((id, name, element) => {
    ausloeser.current = element || null;
    setKarte({ id, name });
  }, []);
  const schliessen = useCallback(() => {
    setKarte(null);
    const ziel = ausloeser.current;
    ausloeser.current = null;
    if (ziel && document.contains(ziel)) requestAnimationFrame(() => ziel.focus());
  }, []);
  return (
    <VorschauKontext.Provider value={oeffnen}>
      {children}
      {karte ? <Kartenvorschau karte={karte} schliessen={schliessen} /> : null}
    </VorschauKontext.Provider>
  );
}

/** Zahl, die beim Wechsel hochzaehlt. Ein bewusster Einsatz von GSAP, kein Zierrat.
    Der erste Wert steht sofort da; wann gezaehlt wird, entscheidet animieren() in
    src/zaehler.js. Den Text schreibt nur der Effekt, nie React, damit sich beide nicht um
    denselben Textknoten streiten. */
function Zaehler({ wert, nachkomma = 0, suffix = "" }) {
  const knoten = useRef(null);
  const gezeigt = useRef(null);
  useLayoutEffect(() => {
    const el = knoten.current;
    if (!el) return;
    const zeigen = (n) => {
      gezeigt.current = n;
      el.textContent = zahlText(n, nachkomma, suffix);
    };
    const alt = gezeigt.current;
    const zaehlen = alt !== null && animieren({
      reduziert: window.matchMedia("(prefers-reduced-motion: reduce)").matches,
      versteckt: document.hidden,
      alt,
      neu: wert,
    });
    if (!zaehlen) {
      zeigen(wert);
      return;
    }
    // Vom gerade sichtbaren Wert aus, auch wenn ein Wechsel die letzte Animation abbrach.
    // gsap kommt erst hier per import(), nicht im ersten Bundle (specs/features/ladepfad-handy.md).
    // Gezaehlt wird nur bei einem Wechsel; bis gsap da ist, steht der alte Wert, und der
    // Sicherheitszeitpunkt setzt in jedem Fall den Endwert.
    const objekt = { n: alt };
    let anim = null;
    let vorbei = false;
    import("gsap")
      .then(({ default: gsap }) => {
        if (vorbei) return;
        anim = gsap.to(objekt, {
          n: wert,
          duration: DAUER,
          ease: "power2.out",
          onUpdate: () => zeigen(objekt.n),
        });
      })
      .catch(() => zeigen(wert));
    const sicher = setTimeout(() => {
      vorbei = true;
      if (anim) anim.kill();
      zeigen(wert);
    }, DAUER * 1000 + NACHLAUF_MS);
    return () => {
      vorbei = true;
      clearTimeout(sicher);
      if (anim) anim.kill();
    };
  }, [wert, nachkomma, suffix]);
  return <span ref={knoten} className="z" />;
}

/** Ein Paar aus Label und Wert in der Kennzeile unter dem Titel. */
/* Die Skala unter einer Winrate reicht von SKALA_VON bis SKALA_BIS Prozent; der Strich in
   der Mitte ist 50 %. Werte ausserhalb sitzen am Rand. */
const SKALA_VON = 30;
const SKALA_BIS = 70;

/** Lage einer Winrate auf der Skala als Anteil von 0 bis 1. */
const skalaAnteil = (wert) => (Math.min(SKALA_BIS, Math.max(SKALA_VON, wert)) - SKALA_VON) / (SKALA_BIS - SKALA_VON);

/** Haarlinie mit Mittelstrich und einem Punkt für die Winrate, gefärbt wie die Zahl. */
function WrSkala({ wert }) {
  if (wert == null || Number.isNaN(wert)) return null;
  const anteil = skalaAnteil(wert);
  return (
    <span className={"wr-skala " + wrKlasse(wert)} aria-hidden="true">
      <i style={{ left: (anteil * 100).toFixed(1) + "%" }} />
    </span>
  );
}

function Kennzahl({ etikett, kind, unter, zeile, skala, nurGross = false }) {
  return (
    <div className={nurGross ? "nur-gross" : undefined}>
      <dt>{etikett}</dt>
      <dd>
        {kind}
        {unter ? <small>{unter}</small> : null}
        {zeile ? <small className="zeile">{zeile}</small> : null}
      </dd>
      {skala != null ? <WrSkala wert={skala} /> : null}
    </div>
  );
}

/** Umschalter in normaler Schreibung, etwa Games, Win rate, Lists. */
export function Schalter({ paare, wert, setzen, label }) {
  return (
    <div className="schalter" role="radiogroup" aria-label={label}>
      {paare.map(([k, t]) => (
        <button key={k} type="button" role="radio" aria-checked={wert === k} onClick={() => setzen(k)}>
          {t}
        </button>
      ))}
    </div>
  );
}

const SITZ_KNOPF = [["first", "Going first"], ["second", "Going second"]];

/** Sitzwahl in Versalien, das aktive Segment blau gefuellt. */
export function Sitzwahl({ wert, setzen, paare = SITZ_KNOPF, label = "Seat" }) {
  return (
    <div className="sitzwahl" role="group" aria-label={label}>
      {paare.map(([k, t]) => (
        <button key={k} type="button" aria-pressed={wert === k} onClick={() => setzen(k)}>{t}</button>
      ))}
    </div>
  );
}

/** Abschnitt mit Ueberschrift in hellem Blau und auslaufender Haarlinie. */
export function Abschnitt({ titel, children, className = "" }) {
  return (
    <section className={"abschnitt " + className}>
      <h2>{titel}</h2>
      {children}
    </section>
  );
}

/**
 * Der Drehknopf rechts in einer Zeile. Ohne umdrehen landet der Klick auf der Zeile selbst;
 * mit text steht "Show evidence" daneben wie "Belege anzeigen" im Book von Metacoach.
 */
export function DrehKnopf({ offen, label, text = false, umdrehen }) {
  const klick = umdrehen ? (e) => { e.stopPropagation(); umdrehen(); } : undefined;
  if (text) {
    return (
      <button type="button" className="dreh dreh-text" aria-expanded={offen} onClick={klick}>
        <Zeichen name="dreh" groesse={15} />
        <span>{offen ? "Hide evidence" : "Show evidence"}</span>
        <span className="nur-sr"> {label}</span>
      </button>
    );
  }
  return (
    <button type="button" className="dreh" aria-expanded={offen} onClick={klick}
            aria-label={(offen ? "Close: " : "Open: ") + label}>
      <Zeichen name="dreh" groesse={15} />
    </button>
  );
}

/**
 * Die Rueckseite einer Zeile. Sie klappt ueber grid-template-rows auf; der Inhalt wird
 * erst beim ersten Aufklappen gebaut, damit die vielen Zeilen leicht bleiben.
 */
export function Rueckseite({ offen, children }) {
  const [gesehen, setGesehen] = useState(offen);
  useEffect(() => {
    if (offen) setGesehen(true);
  }, [offen]);
  return (
    <div className={"rueck" + (offen ? " offen" : "")} inert={offen ? undefined : ""}>
      <div className="rueck-innen">
        {gesehen || offen ? <div className="rueck-blatt">{children}</div> : null}
      </div>
    </div>
  );
}

export function RueckMarke({ children }) {
  return (
    <div className="rueck-marke">
      <span className="rueck-etikett"><Zeichen name="rueck" groesse={12} />Back</span>
      <span>{children}</span>
    </div>
  );
}

/** Spaltenkopf, der die Tafel sortiert. */
function SortKopf({ text, schluessel, sortiert, setSortiert, rechts = true, absteigendZuerst = true }) {
  const aktiv = sortiert.nach === schluessel;
  return (
    <span className={rechts ? "rechts" : undefined}>
      <button
        type="button"
        data-sortiert={aktiv ? (sortiert.ab ? "ab" : "auf") : undefined}
        aria-label={"Sort by " + text.toLowerCase()}
        onClick={() =>
          setSortiert((v) => (v.nach === schluessel
            ? { nach: schluessel, ab: !v.ab }
            : { nach: schluessel, ab: absteigendZuerst }))
        }
      >
        {text}
      </button>
    </span>
  );
}

/** Zahl in einer Tafelzelle. data-label traegt am Handy die Beschriftung. */
/** Zahlzelle einer Tafel. Mit skala (eine Winrate) traegt sie darunter die kleine Skala. */
function Zelle({ k, label, wert, klasse = "", skala = null }) {
  if (skala == null || Number.isNaN(skala)) {
    return <span className={"z zahlzelle " + k + " " + klasse} data-label={label}>{wert}</span>;
  }
  return (
    <span className={"z zahlzelle mit-skala " + k + " " + klasse} data-label={label}
          style={{ "--skala": skalaAnteil(skala).toFixed(3) }}>{wert}</span>
  );
}

/* Eine Deckliste als Tabelle nach Namen, fuer Rueckseiten. */
function Decktabellen({ eintraege, namen }) {
  const teile = eintraege.map((e) => ({ id: kennung(e), n: anzahl(e) }));
  const haelfte = Math.ceil(teile.length / 2);
  const tabelle = (stueck) => (
    <table className="tab">
      <tbody>
        {stueck.map((t, i) => (
          <tr key={t.id + i}>
            <td className="anz">{t.n}</td>
            <td className="bildzelle"><Kartenbild id={t.id} breite={24} vorschau name={(namen[t.id] || {}).n || t.id} /></td>
            <td className="name"><b>{(namen[t.id] || {}).n || t.id}</b><small>{t.id}</small></td>
          </tr>
        ))}
      </tbody>
    </table>
  );
  return (
    <div className="deckteile">
      {tabelle(teile.slice(0, haelfte))}
      {tabelle(teile.slice(haelfte))}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Quellenwahl: fertige Saetze oder tagesgenauer Zeitraum
   -------------------------------------------------------------------------- */

function Quelle({ verzeichnis, wahl, setWahl, laedt }) {
  const tage = verzeichnis.tage || [];
  const modi = [...new Set(tage.map((t) => t.modus))];
  const bereiche = [...new Set(tage.filter((t) => t.modus === wahl.modus).map((t) => t.bounty))];
  const tageDesModus = tage
    .filter((t) => t.modus === wahl.modus && t.bounty === wahl.bounty)
    .map((t) => t.tag)
    .sort();
  const ersterTag = tageDesModus[0];
  const letzterTag = tageDesModus[tageDesModus.length - 1];

  function preset(n) {
    if (!letzterTag) return;
    const ende = new Date(letzterTag + "T00:00:00Z");
    const start = new Date(ende);
    start.setUTCDate(start.getUTCDate() - (n - 1));
    setWahl({
      ...wahl,
      art: "zeitraum",
      von: start.toISOString().slice(0, 10),
      bis: letzterTag,
    });
  }

  return (
    <div>
      <div className="rueck-marke">
        <span>Source</span>
        {laedt ? <span className="blass">loading ...</span> : null}
      </div>
      <Sitzwahl
        wert={wahl.art}
        setzen={(art) => setWahl({ ...wahl, art })}
        paare={[["satz", "Ready sets"], ["zeitraum", "Date range"]]}
        label="Source"
      />

      {wahl.art === "satz" ? (
        <div className="steuer">
          <label className="fl eng wahlfeld">
            <span>Data set</span>
            <select
              className="feld"
              value={wahl.satz}
              onChange={(e) => setWahl({ ...wahl, satz: e.target.value })}
            >
              {(verzeichnis.saetze || []).map((s) => (
                <option key={s.schluessel} value={s.schluessel}>
                  {s.name} ({fmtZahl(s.partien)} games)
                </option>
              ))}
              {Object.entries(KAIZOKU_QUELLEN).map(([k, q]) => (
                <option key={k} value={k}>{q.name} (other source)</option>
              ))}
            </select>
          </label>
        </div>
      ) : (
        <>
          <div className="steuer">
            <label className="fl eng">
              <span>From</span>
              <input type="date" className="feld" value={wahl.von} min={ersterTag} max={wahl.bis}
                     onChange={(e) => setWahl({ ...wahl, von: e.target.value })} />
            </label>
            <label className="fl eng">
              <span>To</span>
              <input type="date" className="feld" value={wahl.bis} min={wahl.von} max={letzterTag}
                     onChange={(e) => setWahl({ ...wahl, bis: e.target.value })} />
            </label>
            <div className="fl eng">
              <span>Last days</span>
              <div className="voreinstellung">
                {[1, 3, 7, 14, 30].map((n) => (
                  <button key={n} type="button" className="knopf rand z" onClick={() => preset(n)}>
                    {n}d
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div className="steuer">
            <label className="fl eng">
              <span>Queue</span>
              <select className="feld" value={wahl.modus} onChange={(e) => setWahl({ ...wahl, modus: e.target.value })}>
                {modi.map((m) => (
                  <option key={m} value={m}>{(verzeichnis.modi || {})[m] || m}</option>
                ))}
              </select>
            </label>
            <label className="fl eng">
              <span>Bounty</span>
              <select className="feld" value={wahl.bounty} onChange={(e) => setWahl({ ...wahl, bounty: e.target.value })}>
                {bereiche.map((b) => (
                  <option key={b} value={b}>{(verzeichnis.bounty_name || {})[b] || b}</option>
                ))}
              </select>
            </label>
            <p className="klein tage">
              <span className="z">{tageDesModus.length}</span> days available, {ersterTag} to {letzterTag}
            </p>
          </div>
        </>
      )}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Decklisten: eine Zeile je Liste mit Kartenstreifen, die volle Liste nach Namen
   steht auf der Rueckseite.
   -------------------------------------------------------------------------- */

const KZ_BILANZ_ZEILEN_MAX = 20;

function Deckzeile({ nr, liste, leaderId, spielerIndex, partienIndex, namen }) {
  const g = liste.w + liste.l;
  const [offen, setOffen] = useState(false);
  const [kopiert, setKopiert] = useState(false);
  const [bilanzOffen, setBilanzOffen] = useState(false);
  // Bekannte Partien dieser Liste je Gegnerleader. Die Quelle der Listen kennt keine
  // Aufteilung nach Gegner; das hier sind nur die aufgezeichneten Partien der Bestenliste.
  const bilanz = useMemo(() => {
    if (!bilanzOffen) return null;
    // Kaizoku fuehrt die volle Bilanz je Gegner; bei uns sind es nur die bekannten Partien.
    if (liste.gegner) {
      return {
        partien: g,
        zeilen: liste.gegner.map(([gid, m, w]) => ({ leader: gid, siege: w, niederlagen: m - w })),
        vollstaendig: true,
      };
    }
    if (!partienIndex) return null;
    const partien = partienIndex.get(deckSchluessel(liste.d, leaderId)) || [];
    return { partien: partien.length, zeilen: bilanzNachLeader(partien) };
  }, [bilanzOffen, partienIndex, liste, leaderId, g]);
  // Wer diese Liste gespielt hat, soweit bekannt. Die Quelle sind die letzten neun
  // Partien der Spieler aus der Bestenliste, also ein Ausschnitt: bei den meisten
  // Listen bleibt es leer, und dann steht auch nichts da.
  const gespieltVon = useMemo(() => {
    if (!spielerIndex || !spielerIndex.size) return [];
    const treffer = spielerIndex.get(deckSchluessel(liste.d, leaderId));
    return treffer ? [...treffer].sort((a, b) => a.localeCompare(b)) : [];
  }, [spielerIndex, liste, leaderId]);

  function kopieren() {
    const text = liste.d.map((e) => anzahl(e) + "x" + kennung(e)).join("\n");
    navigator.clipboard.writeText(text).then(
      () => {
        setKopiert(true);
        setTimeout(() => setKopiert(false), 1500);
      },
      () => setKopiert(false)
    );
  }

  const lid = kennung(leaderId);
  const streifen = liste.d.filter((e) => kennung(e) !== lid);

  return (
    <li className={"zeile" + (offen ? " offen" : "")}>
      <div className="vorn" onClick={() => setOffen((o) => !o)}>
        <span className="nr">{nr2(nr)}</span>
        <span className="streifen" aria-label="Decklist">
          {streifen.map((e, i) => {
            const id = kennung(e);
            const n = anzahl(e);
            return (
              <span key={id + i} className="karte-klein" title={(namen[id] || {}).n || id}>
                <Kartenbild id={id} breite={20} vorschau={offen} name={(namen[id] || {}).n || id} />
                {n > 1 ? <b>{n}</b> : null}
              </span>
            );
          })}
        </span>
        <Zelle k="z-wr" label="Win rate" wert={fmtProz(liste.w, g)} klasse={wrKlasseWG(liste.w, g)}
               skala={g > 0 ? proz(liste.w, g) : null} />
        <Zelle k="z-partien" label="Games" wert={fmtZahl(g)} />
        <Zelle k="z-first" label="First" wert={fmtProz(liste.fw, liste.fw + liste.fl)}
               klasse={wrKlasseWG(liste.fw, liste.fw + liste.fl)} />
        <Zelle k="z-second" label="Second" wert={fmtProz(liste.sw, liste.sw + liste.sl)}
               klasse={wrKlasseWG(liste.sw, liste.sw + liste.sl)} />
        <Zelle k="z-dauer" label="Time" wert={fmtDauer(liste.dur)} />
        <DrehKnopf offen={offen} label={"List " + nr} />
      </div>
      <Rueckseite offen={offen}>
        <RueckMarke>List {nr2(nr)} · {fmtZahl(g)} games</RueckMarke>
        <Decktabellen eintraege={liste.d} namen={namen} />
        <div className="rueck-fuss">
          <dl className="rueck-zeilen">
            <div>
              <dt>Record</dt>
              <dd className="z">
                <button type="button" className="knopf leise" aria-expanded={bilanzOffen}
                        title="Wins and losses by opponent leader"
                        onClick={() => setBilanzOffen((o) => !o)}>
                  {liste.w} – {liste.l}
                </button>
              </dd>
            </div>
            <div><dt>Std. error</dt><dd className="z">± {fehler(g).toFixed(1)}</dd></div>
            <div><dt>Duration</dt><dd className="z">{fmtDauer(liste.dur)}</dd></div>
          </dl>
          <button type="button" className="knopf rand" onClick={kopieren}>
            {kopiert ? "Copied" : "Copy decklist"}
          </button>
        </div>
        {bilanz ? (
          <div className="rueck-fuss" style={{ display: "block" }}>
            <span className="rueck-marke" style={{ margin: 0 }}>By opponent leader</span>
            {bilanz.zeilen.length ? (
              <ul className="bilanz-liste">
                {bilanz.zeilen.slice(0, bilanz.vollstaendig ? KZ_BILANZ_ZEILEN_MAX : BILANZ_ZEILEN_MAX).map((z) => {
                  const id = kennung(z.leader);
                  return (
                    <li key={z.leader}>
                      <Kartenbild id={z.leader} breite={22} />
                      <span>{(namen[id] || {}).n || id}</span>
                      <span className="z">{z.siege} – {z.niederlagen}</span>
                    </li>
                  );
                })}
              </ul>
            ) : null}
            <p className="lesart">
              {bilanz.vollstaendig
                ? "Wins and losses against each opponent leader, from Card Kaizoku."
                : bilanz.partien
                ? `Only ${bilanz.partien} of this list's ${g} games are recorded per opponent (recent games of leaderboard players). A sample, not the full record.`
                : "No per opponent games are recorded for this list. The source only gives totals per list."}
            </p>
          </div>
        ) : null}
        {gespieltVon.length ? (
          <div className="rueck-fuss">
            <span className="rueck-marke" style={{ margin: 0 }}>Played by</span>
            <span className="etiketten">
              {gespieltVon.map((name) => <span key={name} className="etikett">{name}</span>)}
            </span>
          </div>
        ) : null}
      </Rueckseite>
    </li>
  );
}

const SORT_LISTEN_TEXT = {
  wr: "win rate", partien: "games", first: "win rate going first",
  second: "win rate going second", dauer: "duration",
};

/* --------------------------------------------------------------------------
   Matchups des gewaehlten Leaders
   -------------------------------------------------------------------------- */

const MU_SORT = [
  ["partien", "Games"], ["wr", "Win rate"], ["w", "Wins"], ["l", "Losses"],
  ["first", "Going first"], ["second", "Going second"], ["name", "Opponent"],
];

function Matchups({ leader, mindest, namen, sortiert, setSortiert }) {
  const zeilen = useMemo(() => {
    const r = (leader.gegner || [])
      .filter((g) => g.m >= mindest)
      .map((g) => ({ ...g, id: kennung(g.id), l: g.m - g.w }));
    const { nach, ab } = sortiert;
    r.sort((a, b) => {
      let v;
      if (nach === "name") v = b.id.localeCompare(a.id);
      else if (nach === "wr") v = proz(a.w, a.m) - proz(b.w, b.m);
      else if (nach === "w") v = a.w - b.w;
      else if (nach === "l") v = a.l - b.l;
      else if (nach === "first") v = proz(a.fw, a.fw + a.fl) - proz(b.fw, b.fw + b.fl);
      else if (nach === "second") v = proz(a.sw, a.sw + a.sl) - proz(b.sw, b.sw + b.sl);
      else v = a.m - b.m;
      return ab ? -v : v;
    });
    return r;
  }, [leader, mindest, sortiert]);

  if (!zeilen.length) {
    return <p className="leer-satz">No opponent has that many games yet. Lower the minimum.</p>;
  }

  const kopf = (t, k) => <SortKopf text={t} schluessel={k} sortiert={sortiert} setSortiert={setSortiert} />;
  return (
    <>
      <div className="tafel-spalten spalten mu">
        <span>Nr</span><span />
        <SortKopf text="Opponent" schluessel="name" sortiert={sortiert} setSortiert={setSortiert} rechts={false} />
        {kopf("Games", "partien")}{kopf("Win rate", "wr")}{kopf("Wins", "w")}{kopf("Losses", "l")}
        {kopf("First", "first")}{kopf("Second", "second")}
      </div>
      <ol className="tafel mu">
        {zeilen.map((r, i) => (
          <li key={r.id} className="zeile">
            <div className="vorn">
              <span className="nr">{nr2(i + 1)}</span>
              <Kartenbild id={r.id} breite={26} />
              <span className="name gegner"><b><Farbpunkte f={(namen[r.id] || {}).f} />{(namen[r.id] || {}).n || r.id}</b><span className="kartennr">{r.id}</span></span>
              <Zelle k="z-partien" label="Games" wert={fmtZahl(r.m)} />
              <Zelle k="z-wr" label="Win rate" wert={fmtProz(r.w, r.m)} klasse={wrKlasseWG(r.w, r.m)}
                     skala={r.m > 0 ? proz(r.w, r.m) : null} />
              <Zelle k="z-w" label="Wins" wert={fmtZahl(r.w)} />
              <Zelle k="z-l" label="Losses" wert={fmtZahl(r.l)} />
              <Zelle k="z-first" label="First" wert={fmtProz(r.fw, r.fw + r.fl)} klasse={wrKlasseWG(r.fw, r.fw + r.fl)} />
              <Zelle k="z-second" label="Second" wert={fmtProz(r.sw, r.sw + r.sl)} klasse={wrKlasseWG(r.sw, r.sw + r.sl)} />
              <span className="meta-handy">{fmtZahl(r.m)} games · {fmtZahl(r.w)} – {fmtZahl(r.l)}</span>
            </div>
          </li>
        ))}
      </ol>
    </>
  );
}

/* --------------------------------------------------------------------------
   Matchupmatrix: Zellen in Seegruen und Ziegelrot getoent, die Staerke waechst mit dem
   Abstand von 50 % (src/winrate.js); fett ab 55 %, der Spiegel mit Rahmen. Ein Klick auf
   einen Leader im Kopf zeigt nur noch dessen Zeile als Liste je Gegner (Fokus).
   -------------------------------------------------------------------------- */

/** Klasse und Stil einer getoenten Zahl; `zusatz` sind weitere Klassen. */
function getoent(wr, zusatz = "") {
  const t = wrTon(wr);
  const klasse = [zusatz, wrSeite(wr), t.richtung ? "ton " + t.richtung : ""].filter(Boolean).join(" ");
  return { className: klasse, style: t.richtung ? { "--t": t.staerke } : undefined };
}

/** Name und Bild eines Leaders als Knopf, der die Matrix auf ihn stellt oder zurueck. */
function MatrixLeader({ id, name, gewaehlt, waehlen, children }) {
  return (
    <button type="button" className="matrix-leader" aria-pressed={gewaehlt}
            title={gewaehlt ? "Show all leaders" : "Show only " + name}
            onClick={() => waehlen(gewaehlt ? null : id)}>
      {children}
    </button>
  );
}

/* Spaltenkopf im Fokus, der die Sortierung umschaltet; aria-sort sagt die Richtung an. */
function FokusKopf({ text, an, richtung, umschalten }) {
  return (
    <span className="rechts" role="columnheader" aria-sort={an ? richtung : "none"}>
      <button type="button" data-sortiert={an ? (richtung === "descending" ? "ab" : "auf") : undefined}
              onClick={umschalten}>
        {text}
      </button>
    </span>
  );
}

function MatrixFokus({ eintrag, satz, mindest, namen, sitzModus, setFokus, sort, setSort }) {
  const id = kennung(eintrag.id);
  const name = (k) => (namen[k] || {}).n || k;
  const zeilen = useMemo(() => {
    const r = (eintrag.gegner || [])
      .map((g) => ({ ...g, id: kennung(g.id) }))
      .filter((g) => g.m >= mindest && satz.leader.some((e) => kennung(e.id) === g.id));
    return fokusOrdnen(r, sort);
  }, [eintrag, satz, mindest, sort]);
  const nachWr = sort === "wr" || sort === "wr_auf";
  const g = eintrag.w + eintrag.l;
  return (
    <div className="matrix-fokus">
      <div className="fokus-kopf">
        <MatrixLeader id={id} name={name(id)} gewaehlt waehlen={setFokus}>
          <Kartenbild id={id} breite={30} />
          <span className="kn" style={{ minWidth: 0 }}>
            <b>{name(id)}</b>
            <small>{id} · {fmtZahl(g)} games · <span {...getoent(proz(eintrag.w, g), "wr")}>{fmtProz(eintrag.w, g)}</span></small>
          </span>
        </MatrixLeader>
        <button type="button" className="knopf rand" onClick={() => setFokus(null)}>Show all</button>
      </div>
      {!zeilen.length ? <p className="leer-satz">No opponent has {mindest} games yet. Lower the minimum.</p> : (
        <>
          <div className={"tafel-spalten spalten fokus" + (sitzModus ? " sitze" : "")} role="row">
            <span role="columnheader">Nr</span><span role="columnheader" /><span role="columnheader">Opponent</span>
            <FokusKopf text="Games" an={!nachWr} richtung="descending" umschalten={() => setSort("partien")} />
            <FokusKopf text="Win rate" an={nachWr} richtung={sort === "wr_auf" ? "ascending" : "descending"}
                       umschalten={() => setSort(sort === "wr" ? "wr_auf" : "wr")} />
            {sitzModus ? <><span className="rechts" role="columnheader">First</span><span className="rechts" role="columnheader">Second</span></> : null}
          </div>
          <ol className={"tafel fokus" + (sitzModus ? " sitze" : "")}>
            {zeilen.map((r, i) => {
              const spiegel = r.id === id;
              const zahl = (w, n, k, label) => {
                const ok = n > 0;
                const t = ok ? getoent(proz(w, n), "z zahlzelle " + k) : { className: "z zahlzelle leer " + k };
                return <span {...t} data-label={label}>{ok ? fmtProz(w, n) : "–"}</span>;
              };
              return (
                <li key={r.id} className={"zeile" + (spiegel ? " spiegel" : "")}>
                  <div className="vorn still">
                    <span className="nr">{nr2(i + 1)}</span>
                    <Kartenbild id={r.id} breite={26} />
                    <span className="name gegner">
                      <b>{name(r.id)}</b>
                      <span className="kartennr">{r.id}{spiegel ? " · mirror" : ""}</span>
                    </span>
                    <span className="z zahlzelle z-partien" data-label="Games">{fmtZahl(r.m)}</span>
                    {zahl(r.w, r.m, "z-wr", "Win rate")}
                    {sitzModus ? (
                      <>
                        {zahl(r.fw, r.fw + r.fl, "z-first", "First")}
                        {zahl(r.sw, r.sw + r.sl, "z-second", "Second")}
                      </>
                    ) : null}
                  </div>
                </li>
              );
            })}
          </ol>
        </>
      )}
    </div>
  );
}

function Matrix({ satz, top, mindest, namen, sitzModus, setSitzModus, fokus, setFokus, sort, setSort }) {
  const leader = useMemo(
    () => matrixOrdnen(satz.leader.filter((e) => e.listen.length > 0), top, sort),
    [satz, top, sort]
  );
  const nachschlag = useMemo(() => {
    const m = new Map();
    for (const e of leader) m.set(e.id, new Map(e.gegner.map((g) => [g.id, g])));
    return m;
  }, [leader]);
  const fokusEintrag = useMemo(
    () => (fokus ? satz.leader.find((e) => kennung(e.id) === fokus) || null : null),
    [satz, fokus]
  );

  if (fokusEintrag) {
    return <MatrixFokus eintrag={fokusEintrag} satz={satz} mindest={mindest} namen={namen}
                        sitzModus={sitzModus} setFokus={setFokus} sort={sort} setSort={setSort} />;
  }
  if (!leader.length) {
    return <p className="leer-satz">Nothing was played in this range. Widen it.</p>;
  }

  const name = (id) => (namen[kennung(id)] || {}).n || kennung(id);

  return (
    <div className="matrix-huelle">
      <table className="matrix">
        <thead>
          <tr>
            <th className="ecke" scope="col"><span className="lang-ecke">Row beats column</span></th>
            {leader.map((e) => (
              <th key={e.id} scope="col" title={name(e.id)}>
                <MatrixLeader id={kennung(e.id)} name={name(e.id)} gewaehlt={false} waehlen={setFokus}>
                  <Kartenbild id={kennung(e.id)} breite={24} />
                  <span className="kopfname">{name(e.id).slice(0, 13)}</span>
                </MatrixLeader>
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {leader.map((zeile, i) => {
            const g = zeile.w + zeile.l;
            return (
              <tr key={zeile.id}>
                <th scope="row">
                  <MatrixLeader id={kennung(zeile.id)} name={name(zeile.id)} gewaehlt={false} waehlen={setFokus}>
                    <span className="kopfzeile">
                      <span className="nr">{nr2(i + 1)}</span>
                      <Kartenbild id={kennung(zeile.id)} breite={26} />
                      <span className="kn" style={{ minWidth: 0 }}>
                        <b><Farbpunkte f={(namen[kennung(zeile.id)] || {}).f} />{name(zeile.id)}</b>
                        <small>{kennung(zeile.id)} · {fmtProz(zeile.w, g)}</small>
                      </span>
                    </span>
                  </MatrixLeader>
                </th>
                {leader.map((spalte) => {
                  const treffer = (nachschlag.get(zeile.id) || new Map()).get(spalte.id);
                  const partien = treffer ? treffer.m : 0;
                  const wr = treffer ? proz(treffer.w, treffer.m) : 0;
                  const genug = partien >= mindest;
                  const spiegel = spalte.id === zeile.id ? "spiegel" : "";
                  const titel = genug
                    ? fmtZahl(partien) + " games. Click to switch the whole matrix " +
                      (sitzModus ? "back to the overall rate." : "to first and second.")
                    : "too few games";
                  if (!genug) {
                    return (
                      <td key={spalte.id} className={"leer " + spiegel} title={titel}
                          onClick={() => setSitzModus(!sitzModus)}>–</td>
                    );
                  }
                  if (sitzModus) {
                    const f = proz(treffer.fw, treffer.fw + treffer.fl);
                    const s = proz(treffer.sw, treffer.sw + treffer.sl);
                    return (
                      <td key={spalte.id} className={spiegel} title={titel}
                          onClick={() => setSitzModus(!sitzModus)}>
                        <span className="sitze-zelle">
                          <span {...getoent(f)}><i>1st</i>{f.toFixed(1)}</span>
                          <span {...getoent(s)}><i>2nd</i>{s.toFixed(1)}</span>
                        </span>
                      </td>
                    );
                  }
                  return (
                    <td key={spalte.id} {...getoent(wr, spiegel)} title={titel}
                        onClick={() => setSitzModus(!sitzModus)}>
                      {wr.toFixed(1)}
                    </td>
                  );
                })}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Rangliste
   -------------------------------------------------------------------------- */

/**
 * Rating auf der vertrauten Skala bis 10.
 *
 * Die veroeffentlichten Ranglisten nennen eine solche Zahl, aber keine Formel. Aus zehn
 * abgelesenen Werten (OP12 Meta Report) laesst sie sich mit kleinsten Quadraten
 * annaehern: sie haengt vor allem am Logarithmus der Partienzahl und daneben an der
 * Winrate. R2 liegt bei 0,90, die groesste Abweichung bei 0,37 Punkten.
 *
 * Verankert wird am meistgespielten Leader des Datensatzes statt an einer festen
 * Konstante. Sonst kippt die Skala: die Vorlage hatte 13.526 Partien an der Spitze,
 * "Last Week Standard" hat 107.846, und eine absolute Formel liefe ueber die 10 hinaus.
 *
 *     Rating = 9,5 + 2,2727 * log10(Partien / Spitzenreiter) + 0,071 * (Winrate - 50)
 *
 * Das Rating misst damit vor allem Verbreitung, nicht Spielstaerke. Ein seltener Leader
 * mit guter Winrate steht bewusst unter einem haeufigen mit mittlerer.
 */
const RATING_ANKER = 9.5;
const RATING_LOG = 2.2727;
const RATING_WR = 0.071;
const RATING_STARK = 8.5;
const RATING_MITTEL = 7;
const rating = (g, spitze, wr) =>
  Math.max(0, Math.min(10, RATING_ANKER + RATING_LOG * Math.log10(g / spitze) + RATING_WR * (wr - 50)));

const RANG_SORT = [["partien", "Games"], ["anteil", "Share"], ["wr", "Win rate"], ["rating", "Rating"]];

function Rangliste({ satz, namen }) {
  const [nach, setNach] = useState("partien");
  const gesamt = useMemo(
    () => satz.leader.reduce((s, e) => s + e.w + e.l, 0),
    [satz]
  );
  const zeilen = useMemo(() => {
    const gespielt = satz.leader.filter((e) => e.listen.length > 0);
    const spitze = Math.max(1, ...gespielt.map((e) => e.w + e.l));
    const r = gespielt.map((e) => {
      const g = e.w + e.l;
      const wr = proz(e.w, g);
      return { ...e, g, wr, rat: rating(g, spitze, wr), anteil: gesamt ? (100 * g) / gesamt : 0 };
    });
    r.sort((a, b) => {
      if (nach === "wr") return b.wr - a.wr;
      if (nach === "anteil") return b.anteil - a.anteil;
      if (nach === "rating") return b.rat - a.rat;
      return b.g - a.g;
    });
    // Wie die veroeffentlichten Ranglisten: nur die ersten zehn. Der lange Schwanz
    // besteht aus Leadern mit wenigen hundert Partien und sagt nichts ueber die Meta.
    return r.slice(0, 10);
  }, [satz, nach, gesamt]);
  const anteilMax = Math.max(1, ...zeilen.map((z) => z.anteil));

  // Die Tafelkoepfe sortieren immer absteigend, wie der Umschalter.
  const sortiert = { nach, ab: true };
  const setSortiert = (f) => setNach(f(sortiert).nach);
  const kopf = (t, k) => <SortKopf text={t} schluessel={k} sortiert={sortiert} setSortiert={setSortiert} />;
  const sortText = (RANG_SORT.find(([k]) => k === nach) || RANG_SORT[0])[1].toLowerCase();

  return (
    <>
      <section className="vorspann">
        <h1>Power rankings</h1>
        <p className="lead">
          {satz.name}, <strong>{fmtZahl(satz.partien)}</strong> games. The ten leaders that shape the meta,
          with a rating on a scale to 10.
        </p>
      </section>
      <div className="steuer">
        <div className="fl eng"><span>Sort by</span>
          <Schalter paare={RANG_SORT} wert={nach} setzen={setNach} label="Sort by" />
        </div>
      </div>
      <Abschnitt titel={"Top 10 leaders by " + sortText}>
        <div className="tafel-spalten spalten rang">
          <span>Nr</span><span /><span>Leader</span>
          {kopf("Games", "partien")}{kopf("Share", "anteil")}{kopf("Win rate", "wr")}{kopf("Rating", "rating")}
        </div>
        <ol className="tafel rang">
          {zeilen.map((e, i) => {
            const id = kennung(e.id);
            return (
              <li key={e.id} className="zeile">
                <div className="vorn">
                  <span className="nr">{nr2(i + 1)}</span>
                  <Kartenbild id={id} breite={26} />
                  <span className="name gegner"><b>{(namen[id] || {}).n || id}</b><span className="kartennr">{id}</span></span>
                  <Zelle k="z-partien" label="Games" wert={fmtZahl(e.g)} />
                  <span className="anteil">
                    <span className="balken"><i style={{ width: ((100 * e.anteil) / anteilMax).toFixed(1) + "%" }} /></span>
                    <span className="z">{e.anteil.toFixed(1)} %</span>
                  </span>
                  <Zelle k="z-wr" label="Win rate" wert={fmtProz(e.w, e.g)} klasse={wrKlasse(e.wr)} />
                  <span className={"rating" + (e.rat >= RATING_STARK ? " gut" : e.rat < RATING_MITTEL ? " schwach" : "")}>
                    {e.rat.toFixed(2)}
                  </span>
                </div>
              </li>
            );
          })}
        </ol>
        <p className="lesart">
          The rating follows the published power rankings: mostly how often a leader is played, a little its win
          rate. <b>Bold</b> rating from {RATING_STARK}, pale under {RATING_MITTEL}; win rate in{" "}
          <span className="wr gut">green and bold</span> from {GUT} %, <span className="wr schwach">red</span> under {SCHWACH} %. The bar shows the share against the most played leader.
        </p>
      </Abschnitt>
    </>
  );
}

/* --------------------------------------------------------------------------
   Bestenliste

   Die Top 100 der Western Ladder. Die Daten kommen nicht vom CDN, sondern aus einem
   Mitschnitt des Spiels; warum das so ist, steht in specs/features/bestenliste.md.
   Seit OPBounty 2.7 (20.10.2026) wird die Liste vom Bildschirm gelesen: je Leader gibt
   es nur die Winrate, Partien, Spielzeit und Sitze fehlen. Die Spalten Games, Win rate
   und Time erscheinen deshalb nur, wenn die Daten sie wieder fuehren.
   -------------------------------------------------------------------------- */

const LADDER_LEADER_MAX = 3;

function Bestenliste({ daten, namen, oeffnen }) {
  const [suche, setSuche] = useState("");
  const [sortiert, setSortiert] = useState({ nach: "rang", ab: false });

  // Bilanz je Spieler aus der Leaderaufstellung. Die Zeile selbst traegt keine
  // Winrate; sie ergibt sich aus der Summe ueber die gespielten Leader.
  const angereichert = useMemo(
    () =>
      (daten.spieler || []).map((e) => {
        const leader = (e.leader || []).filter((l) => l.leader);
        if (e.quelle === "ocr") return { ...e, leader, siege: null, partien: null, wr: null };
        /* Die Web API liefert Siege und Partien je Spieler selbst; aeltere Mitschnitte nur je Leader. */
        const eigene = e.quelle === "api";
        const siege = eigene ? e.siege : leader.reduce((a, l) => a + (l.siege || 0), 0);
        const partien = eigene ? e.partien : leader.reduce((a, l) => a + (l.partien || 0), 0);
        return { ...e, leader, siege, partien, wr: proz(siege, partien) };
      }),
    [daten]
  );
  const mitZahlen = angereichert.some((e) => e.partien);
  /* Spielzeit steht nur in Mitschnitten, die Web API und die OCR kennen sie nicht. */
  const mitZeit = angereichert.some((e) => e.spielzeit);

  const spieler = useMemo(() => {
    const s = suche.trim().toLowerCase();
    let r = s
      ? angereichert.filter((e) => (e.name || "").toLowerCase().includes(s))
      : angereichert;
    const n = sortiert.nach;
    r = [...r].sort((a, b) => {
      const va = a[n] ?? 0;
      const vb = b[n] ?? 0;
      return sortiert.ab ? vb - va : va - vb;
    });
    return r;
  }, [angereichert, suche, sortiert]);

  const stunden = (sek) => (sek / 3600).toFixed(1) + " h";
  const leaderWr = (l) => (l.winrate != null ? l.winrate : l.partien ? proz(l.siege, l.partien) : null);
  const kopf = (t, k) => <SortKopf text={t} schluessel={k} sortiert={sortiert} setSortiert={setSortiert} />;
  const ocr = angereichert.some((e) => e.quelle === "ocr");
  const klasse = "tafel ladder" + (mitZahlen ? " mit-zahlen" : "") + (mitZeit ? "" : " ohne-zeit");

  return (
    <>
      <section className="vorspann">
        <h1>Leaderboard</h1>
        <p className="lead">
          Top {angereichert.length} of the Western ladder{daten.stand ? <>, as of <strong>{datumKurz(daten.stand)}</strong></> : null}.
          A tap on a player opens the player page.
        </p>
      </section>
      <div className="steuer">
        <label className="fl eng" style={{ width: 220, maxWidth: "100%" }}>
          <span>Search player</span>
          <input id="spielerSuche" type="search" autoComplete="off" placeholder="name" className="feld"
                 value={suche} onChange={(e) => setSuche(e.target.value)} />
        </label>
      </div>
      <Abschnitt titel="Players by rank">
        <div className={"tafel-spalten spalten ladder" + (mitZahlen ? " mit-zahlen" : "") + (mitZeit ? "" : " ohne-zeit")}>
          <SortKopf text="Nr" schluessel="rang" sortiert={sortiert} setSortiert={setSortiert} rechts={false} absteigendZuerst={false} />
          <span>Player</span>
          {kopf("Bounty", "bounty")}
          {mitZahlen ? <>{kopf("Games", "partien")}{kopf("Win rate", "wr")}{mitZeit ? kopf("Time", "spielzeit") : null}</> : null}
          <span>Most played</span><span />
        </div>
        <ol className={klasse}>
          {spieler.map((e) => {
            const ziel = e.user_id != null;
            const ls = (e.leader || []).slice(0, LADDER_LEADER_MAX);
            return (
              <li key={e.login} className={"zeile" + (ziel ? "" : " ohne-ziel")}>
                {/* Die ganze Zeile fuehrt auf die Spielerseite; der Name ist dazu ein
                    echter Link fuer Tastatur und neue Tabs. */}
                <div className="vorn" onClick={ziel ? () => oeffnen(e.user_id) : undefined}
                     title={ziel ? undefined : "No player page: name not matched yet"}>
                  <span className="nr">{nr2(e.rang)}</span>
                  <span className="spieler">
                    {ziel ? (
                      <a href={PFADE.spieler + "?id=" + encodeURIComponent(e.user_id)}
                         style={{ textDecoration: "none" }}
                         onClick={(ev) => { ev.preventDefault(); ev.stopPropagation(); oeffnen(e.user_id); }}>
                        <b>{e.name}</b>
                      </a>
                    ) : <b>{e.name}</b>}
                  </span>
                  <span className="bounty">{fmtBounty(e.bounty)}</span>
                  {mitZahlen ? (
                    <>
                      <Zelle k="z-partien" label="Games" wert={e.partien == null ? "–" : fmtZahl(e.partien)} />
                      <Zelle k="z-wr" label="Win rate" wert={e.partien ? e.wr.toFixed(1) + " %" : "–"}
                             klasse={e.partien ? wrKlasse(e.wr) : "wr leer"} />
                      {mitZeit ? <Zelle k="z-zeit" label="Time" wert={e.partien == null ? "–" : stunden(e.spielzeit || 0)} /> : null}
                    </>
                  ) : null}
                  <span className={"aufstellung" + (ls.length > 1 ? " mehrere" : "")}>
                    {ls.length ? ls.map((l, j) => {
                      const wr = leaderWr(l);
                      const nm = (namen[l.leader] || {}).n || l.leader;
                      return (
                        <span key={l.leader + j} className={"eintrag" + (j ? " neben" : "")} title={nm}>
                          <Kartenbild id={l.leader} breite={24} />
                          {j === 0 ? <b>{nm}</b> : null}
                          <span className={"z " + wrKlasse(wr)}>
                            {wr == null ? "" : wr.toFixed(1) + " %"}
                          </span>
                        </span>
                      );
                    }) : <span className="blass klein">no data</span>}
                  </span>
                  <span className="pfeil-rechts">{ziel ? <Zeichen name="rechts" groesse={16} /> : null}</span>
                </div>
              </li>
            );
          })}
        </ol>
        {!spieler.length ? <p className="leer-satz">No player by that name. Check the spelling.</p> : null}
        {ocr ? (
          <p className="lesart">
            Since OPBounty 2.7 the leaderboard is read from the game screen. It shows the win rate of each
            player's top three leaders, but no games, play time or first and second split.
          </p>
        ) : null}
      </Abschnitt>
    </>
  );
}

/* --------------------------------------------------------------------------
   Spielerseite

   Hinter dem Klick auf einen Namen in der Bestenliste. Zeigt die Leaderaufstellung
   und die letzten Partien mit Deckliste und Replay.

   Neun Partien sind das Maximum: der Server schreibt einen Schnappschuss der letzten
   neun ins Profil, mehr gibt es nicht.
   -------------------------------------------------------------------------- */

// Der Eimer, in dem die Replays liegen. Kein Geheimnis, er steckt in jeder
// Installation des Spiels und steht in jeder Downloadadresse.
const SPEICHER = "opbounty-3623c.firebasestorage.app";

/**
 * Aus dem Storagepfad den Dateinamen der vorbereiteten Fassung bilden.
 * Muss zu `dateiname()` in replays_holen.py passen, sonst greift die Seite daneben.
 */
export function dateiname(pfad) {
  const kurz = pfad.startsWith("Replays/") ? pfad.slice("Replays/".length) : pfad;
  return kurz.replace(/\.log$/, "").replace(/[^A-Za-z0-9._-]/g, "_") + ".json.gz";
}

function replayAdresse(pfad) {
  return (
    "https://firebasestorage.googleapis.com/v0/b/" +
    SPEICHER +
    "/o/" +
    encodeURIComponent(pfad) +
    "?alt=media"
  );
}


/* --------------------------------------------------------------------------
   Spielerseite: Aufstellung und letzte Partien
   -------------------------------------------------------------------------- */

function Partie({ nr, p, namen, replayOeffnen }) {
  const [offen, setOffen] = useState(false);
  const karten = (p.deck || []).slice(1);
  const eigenName = (namen[kennung(p.eigener_leader)] || {}).n || kennung(p.eigener_leader);
  const fremdName = (namen[p.gegner_leader] || {}).n || p.gegner_leader;
  return (
    <li className={"zeile" + (offen ? " offen" : "")}>
      <div className="vorn" onClick={() => setOffen((o) => !o)}>
        <span className={"etikett ausgang" + (p.gewonnen ? " akzent" : "")} title={p.gewonnen ? "won" : "lost"}>
          {p.gewonnen ? "W" : "L"}
        </span>
        <span className="eb"><Kartenbild id={p.eigener_leader} breite={26} /></span>
        <span className="eigen"><b>{eigenName}</b></span>
        <span className="vs">vs</span>
        <span className="fremd"><b>{fremdName}</b><small>{p.gegner}</small></span>
        <span className="fb"><Kartenbild id={p.gegner_leader} breite={26} /></span>
        <span className="zeit">{String(p.zeit).slice(0, 16).replace("T", " ")}</span>
        <span className="dauer">{fmtDauer(p.dauer)}</span>
        <DrehKnopf offen={offen} label={"Game " + nr} />
      </div>
      <Rueckseite offen={offen}>
        <RueckMarke>Game {nr2(nr)} · {String(p.zeit).slice(0, 10)}</RueckMarke>
        {p.deck_von ? (
          <p className="hinweis" style={{ marginTop: 0, marginBottom: 10 }}>
            The replay of a win stores no list. Shown is this player's last known list with
            this leader, from {String(p.deck_von).slice(0, 10)}.
          </p>
        ) : null}
        {karten.length ? (
          <Decktabellen eintraege={karten} namen={namen} />
        ) : (
          <p className="hinweis" style={{ marginTop: 0 }}>No decklist recorded for this game.</p>
        )}
        {p.replay ? (
          <div className="rueck-fuss">
            <button type="button" className="knopf voll" onClick={() => replayOeffnen(p.replay, p.eigener_leader)}>
              Watch replay
            </button>
            <a href={replayAdresse(p.replay)} target="_blank" rel="noreferrer noopener" className="link">raw log</a>
          </div>
        ) : null}
      </Rueckseite>
    </li>
  );
}

/** Bounty nach jeder Partie der Saison aus dem Profil (Graph.y). Ohne Zeitachse: x ist die
    Partie, nicht der Tag. Das Profil schreibt nur der Client des Spielers, die Kurve kann also
    hinter der Bounty der Bestenliste liegen. */
function BountyVerlauf({ werte }) {
  const k = useMemo(() => verlaufBauen(werte), [werte]);
  if (!k) return null;
  return (
    <Abschnitt titel="Bounty this season">
      <dl className="genau">
        <div><dt>Start</dt><dd><span className="z">{fmtBounty(k.start)}</span></dd></div>
        <div><dt>High</dt><dd><span className="z">{fmtBounty(k.hoch)}</span></dd></div>
        <div><dt>Latest</dt><dd><span className="z">{fmtBounty(k.jetzt)}</span></dd></div>
      </dl>
      <div className="kurve-huelle">
        <svg className="kurve" viewBox={`0 0 ${VERLAUF_BREITE} ${VERLAUF_HOEHE}`} preserveAspectRatio="none"
             role="img" aria-label={`Bounty after each of ${k.partien} games, from ${fmtBounty(k.start)} to ${fmtBounty(k.jetzt)}`}>
          <polyline points={k.flaeche} fill="var(--akzent-flaeche)" stroke="none" />
          <polyline points={k.linie} fill="none" stroke="var(--akzent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
        </svg>
        <div className="kurve-achse"><span>Game 1</span><span>Game {k.partien}</span></div>
      </div>
      <p className="lesart">
        Bounty after each game of the season, from the player's own profile. It updates when the player
        opens the app, so it can lag behind the leaderboard.
      </p>
    </Abschnitt>
  );
}

function Spieler({ eintrag, daten, namen, zurueck, replayOeffnen, kzSpieler }) {
  if (!eintrag) {
    return (
      <>
        <button type="button" onClick={zurueck} className="knopf leise zurueck-knopf">
          <Zeichen name="links" groesse={16} />Leaderboard
        </button>
        <p className="leer-satz">This player is not in the current top 100.</p>
      </>
    );
  }
  const partien = (daten && daten.partien) || [];
  const leader = (eintrag.leader || []).filter((l) => l.leader);
  // Sitzaufteilung gibt es nur aus Replays. Die Web API liefert je Leader Winrate und
  // Partien, die OCR nur die Winrate; beide zeigen die Winrate.
  const mitSitz = (l) => l.siege != null && l.erst_siege != null && l.zweit_siege != null;
  const nurWr = !leader.some(mitSitz);
  return (
    <>
      <button type="button" onClick={zurueck} className="knopf leise zurueck-knopf">
        <Zeichen name="links" groesse={16} />Leaderboard
      </button>

      <section className="vorspann">
        <h1>{eintrag.name}</h1>
        <dl className="kennzeile">
          <Kennzahl etikett="Rank" kind={<Zaehler wert={eintrag.rang} />} />
          <Kennzahl etikett="Bounty" kind={<span className="z">{fmtBounty(eintrag.bounty)}</span>} />
          {daten ? (
            <>
              <Kennzahl etikett="Win rate" kind={<Zaehler wert={daten.winrate || 0} nachkomma={1} suffix=" %" />}
                        skala={daten.winrate} />
              <Kennzahl etikett="Record" kind={<span className="z">{daten.siege} – {daten.niederlagen}</span>} />
            </>
          ) : null}
          {eintrag.quelle === "ocr" ? null : (
            <Kennzahl etikett="Games" kind={<Zaehler wert={eintrag.partien} />} nurGross />
          )}
        </dl>
      </section>

      {daten && daten.verlauf ? <BountyVerlauf werte={daten.verlauf} /> : null}

      <Abschnitt titel="Leaders played">
        <div className="tafel-spalten spalten gespielt">
          <span>Nr</span><span /><span>Leader</span>
          {nurWr ? <><span className="rechts">Win rate</span><span className="rechts">Games</span><span /></>
            : <><span className="rechts">Record</span><span className="rechts">First</span><span className="rechts">Second</span></>}
        </div>
        <ol className="tafel gespielt">
          {leader.map((l, i) => {
            const id = kennung(l.leader);
            const fw = proz(l.erst_siege, l.erst_siege + l.erst_niederlagen);
            const sw = proz(l.zweit_siege, l.zweit_siege + l.zweit_niederlagen);
            return (
              <li key={l.leader} className="zeile">
                <div className="vorn">
                  <span className="nr">{nr2(i + 1)}</span>
                  <Kartenbild id={l.leader} breite={30} />
                  <span className="name gegner"><b>{(namen[id] || {}).n || id}</b><span className="kartennr">{id}</span></span>
                  {!mitSitz(l) ? (
                    <>
                      <Zelle k="z-a" label="Win rate" wert={l.winrate == null ? "unreadable" : l.winrate.toFixed(1) + " %"}
                             klasse={wrKlasse(l.winrate)} />
                      {l.partien == null ? <span className="z-b" />
                        : <Zelle k="z-b" label="Games" wert={fmtZahl(l.partien)} />}
                      <span className="z-c" />
                    </>
                  ) : (
                    <>
                      <Zelle k="z-a" label="Record" wert={`${l.siege} – ${l.niederlagen}`} />
                      <Zelle k="z-b" label="First" wert={fw.toFixed(1) + " %"} klasse={wrKlasse(fw)} />
                      <Zelle k="z-c" label="Second" wert={sw.toFixed(1) + " %"} klasse={wrKlasse(sw)} />
                    </>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Abschnitt>

      {kzSpieler ? (
        <Abschnitt titel="Kaizoku (last 28 days)">
          <p className="lesart" style={{ marginTop: 0 }}>
            {kzSpieler.m} ranked games ({kzSpieler.w} won) found for this player at Card Kaizoku. Kaizoku only sees
            games played in the simulator, so this can be only part of the games.
          </p>
          <ol className="kz-listen">
            {(kzSpieler.decks || []).filter((d) => d && Array.isArray(d.d)).map((d, i) => (
              <KaizokuListe key={d.d.join("|")} nr={i + 1} namen={namen}
                            liste={{ d: kartenzeilen(d.d), w: d.w, m: d.m, gegner: d.gegner }} />
            ))}
          </ol>
        </Abschnitt>
      ) : null}

      <Abschnitt titel="Recent games">
        {partien.length ? (
          <>
            <div className="tafel-spalten spalten spiele">
              <span /><span /><span>Leader</span><span /><span className="rechts">Opponent</span><span />
              <span className="rechts">Played</span><span className="rechts">Time</span><span />
            </div>
            <ol className="tafel spiele">
              {partien.map((p, i) => (
                <Partie key={(p.replay || "") + i} nr={i + 1} p={p} namen={namen} replayOeffnen={replayOeffnen} />
              ))}
            </ol>
            <p className="lesart">A tap on a game turns it over and shows the list and the replay.</p>
          </>
        ) : (
          <p className="leer-satz">No recent games recorded for this player. Try another day.</p>
        )}
      </Abschnitt>
    </>
  );
}

/* --------------------------------------------------------------------------
   Kaizoku als Quelle (docs/kaizoku-einbau.md). Die Zahlen laufen ueber den Adapter in
   daten.js durch Decklists, Ranking, Matchups und Matrix. Hier stehen nur die Teile, die
   unsere Daten nicht kennen: die Techkarten (Stufe B). Kartenwerte, Starthand und Zugkurve
   stehen in kaizoku_*_b.json.gz, sind aber bewusst nicht eingebaut (Nutzer, 02.11.2026).
   -------------------------------------------------------------------------- */

function kzName(namen, code) {
  const id = kennung(code);
  return (namen[id] || {}).n || id;
}

/* Eine Kaizoku Liste auf der Spielerseite: Bilanz, Liste und Bilanz je Gegnerleader.
   Beim Umbau zum Dataset (82a930e) mit dem Reiter geloescht, die Spielerseite braucht sie
   weiter; ohne sie wurde die Seite bei jedem Spieler mit Kaizoku Partien schwarz. */
function KaizokuListe({ liste, nr, namen }) {
  const [bilanz, setBilanz] = useState(false);
  const [karten, setKarten] = useState(false);
  const rate = proz(liste.w, liste.m);
  return (
    <li className="kz-liste">
      <div className="kz-kopf">
        <span className="nr">{nr2(nr)}</span>
        <button type="button" className="knopf leise" aria-expanded={bilanz}
                title="Wins and losses by opponent leader" onClick={() => setBilanz((o) => !o)}>
          {liste.w} – {liste.m - liste.w}
        </button>
        <span className={"z " + wrKlasse(rate)}>{fmtProz(liste.w, liste.m)}</span>
        <span className="z">{fmtZahl(liste.m)} games</span>
        {liste.pilot == null ? null : (
          <span className="z">{liste.pilot} {liste.pilot === 1 ? "pilot" : "pilots"}</span>
        )}
        <button type="button" className="knopf leise" aria-expanded={karten}
                onClick={() => setKarten((o) => !o)}>{karten ? "Hide list" : "Show list"}</button>
      </div>
      {karten ? <Decktabellen eintraege={liste.d} namen={namen} /> : null}
      {bilanz ? (
        <ul className="bilanz-liste">
          {(liste.gegner || []).length ? liste.gegner.map(([gid, m, w]) => {
            const id = kennung(gid);
            return (
              <li key={gid}>
                <Kartenbild id={gid} breite={22} />
                <span>{(namen[id] || {}).n || id}</span>
                <span className="z">{w} – {m - w}</span>
              </li>
            );
          }) : <li><span /><span>No opponent split for this list.</span><span /></li>}
        </ul>
      ) : null}
    </li>
  );
}

/* Kopf der Kaizoku Teile: sagt, dass die Zahlen nicht unsere sind. */
function KaizokuHinweis({ satz }) {
  const stand = satz.stand
    ? `${satz.stand.slice(8, 10)}.${satz.stand.slice(5, 7)}.${satz.stand.slice(0, 4)}` : "";
  return (
    <p className="lesart kz-hinweis">
      Source: Card Kaizoku{stand ? <>, as of <strong>{stand}</strong></> : null}, {satz.name.replace("Card Kaizoku, ", "")}
      ({fmtZahl(satz.partien)} games in total). Not our numbers: another source and another sample. First and second
      games per leader are estimated as half each, there is no split by seat per opponent or per list, and no
      game duration.
    </p>
  );
}

function KaizokuTech({ b, leaderId, namen }) {
  const e = b && b.leader ? b.leader[leaderId] : null;
  if (!e) return null;
  const gegner = Object.entries(e.tech || {});
  return (
    <>
      <Abschnitt titel="Tech cards by opponent">
        {gegner.length ? (
          <ul className="bilanz-liste kz-tech">
            {gegner.map(([opp, karten]) => (
              <li key={opp}>
                <Kartenbild id={opp} breite={22} />
                <span>vs {kzName(namen, opp)}</span>
                <span className="z">{karten.map(([c]) => kzName(namen, c)).join(", ")}</span>
              </li>
            ))}
          </ul>
        ) : <p className="leer-satz">No tech cards with strong evidence.</p>}
        <p className="lesart">Cards that helped this leader win against that opponent, only those Kaizoku marks as strong evidence.</p>
      </Abschnitt>
    </>
  );
}

/* --------------------------------------------------------------------------
   Adressen

   Der Reiter steht im Pfad, der gewaehlte Leader als Abfrage dahinter. Damit ist jede
   Ansicht verlinkbar und der Zurueckknopf tut, was man erwartet.

   GitHub Pages liefert bei unbekannten Pfaden 404.html aus; die Action legt dort eine
   Kopie der Startseite ab, deshalb laedt /matrix auch beim direkten Aufruf.
   -------------------------------------------------------------------------- */

const PFADE = {
  decks: "/decklists",
  matchups: "/matchups",
  matrix: "/matrix",
  rang: "/rankings",
  beste: "/leaderboard",
  spieler: "/player",
  replay: "/replay",
  analyse: "/mulligan",
  book: "/guide",
  eigenes: "/analyze",
  changelog: "/changelog",
};

// Der Reiter hiess bis zum 22.10.2026 "Analysis" unter /analysis; alte Links fuehren weiter hin.
const ALTE_PFADE = { "/analysis": "analyse", "/book": "book", "/kaizoku": "decks" };

function reiterAusPfad(pfad) {
  const alt = ALTE_PFADE[pfad.replace(/\/$/, "")];
  if (alt) return alt;
  const treffer = Object.entries(PFADE).find(([, p]) => p === pfad.replace(/\/$/, ""));
  return treffer ? treffer[0] : "decks";
}

/** Fokus der Matrix aus ?leader=, nur auf /matrix und nur in der Form einer Kartennummer. */
function fokusAusAdresse() {
  if (typeof window === "undefined" || reiterAusPfad(window.location.pathname) !== "matrix") return null;
  const wunsch = new URLSearchParams(window.location.search).get("leader");
  return wunsch && KARTE.test(wunsch) ? kennung(wunsch) : null;
}

/** Sortwahl der Matrix aus &sort=, nur auf /matrix. */
function matrixSortAusAdresse() {
  if (typeof window === "undefined" || reiterAusPfad(window.location.pathname) !== "matrix") return "partien";
  return sortAusText(new URLSearchParams(window.location.search).get("sort"));
}

function adresseSetzen(reiter, leader, ersetzen, spielerId, replayPfad, sort) {
  // Die Spielerseite haengt an einer user_id, die Replayseite am Storagepfad,
  // alle anderen Reiter am Leader.
  const abfrage =
    reiter === "replay"
      ? replayPfad
        ? "?p=" + encodeURIComponent(replayPfad)
        : ""
      : reiter === "spieler"
      ? spielerId
        ? "?id=" + encodeURIComponent(spielerId)
        : ""
      : leader
        ? "?leader=" + encodeURIComponent(kennung(leader))
        : "";
  const mitSort = reiter === "matrix" && sort && sort !== "partien"
    ? (abfrage ? abfrage + "&" : "?") + "sort=" + encodeURIComponent(sort)
    : abfrage;
  const ziel = PFADE[reiter] + mitSort;
  if (window.location.pathname + window.location.search === ziel) return;
  window.history[ersetzen ? "replaceState" : "pushState"]({}, "", ziel);
}

/* Die Reiter in ihrer Reihenfolge: Schluessel, Name am Rechner, Name am Handy. */
const REITER = [
  ["decks", "Decklists", "Decks"],
  ["matchups", "Matchups", "Matchups"],
  ["matrix", "Matchup matrix", "Matrix"],
  ["rang", "Power rankings", "Ranking"],
  ["beste", "Leaderboard", "Ladder"],
  ["analyse", "Mulligan", "Mulligan"],
  ["book", "Guide", "Guide"],
  ["eigenes", "Analyze my replay", "Analyze"],
  ["changelog", "Changelog", "Changelog"],
];
const REITER_NAME = { spieler: "Player", replay: "Replay" };

/* Am Handy liegen vier Reiter in der unteren Leiste, im Daumenbereich; die übrigen stehen
   hinter More. So fällt keiner weg. */
const HANDY_LEISTE = [["decks", "karte"], ["matchups", "schwert"], ["matrix", "gitter"], ["beste", "krone"]];
const HANDY_MEHR = REITER.filter(([k]) => !HANDY_LEISTE.some(([l]) => l === k));

/** Ein Klick mit Taste oder Mittelknopf oeffnet wie gewohnt einen neuen Tab. */
const eigenerKlick = (e) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/* --------------------------------------------------------------------------
   Schloss
   -------------------------------------------------------------------------- */

/* Meldungen fuer Fehler beim Entsperren, je Grund aus EntsperrFehler (daten.js). */
const ENTSPERR_TEXT = {
  krypto: "This browser cannot unlock the data. Open the page over https in a current browser.",
  netz: "The page could not reach its key file. Check the connection and try again.",
  kaputt: "The key file could not be read. Try again later.",
};
const entsperrText = (fehler) =>
  (fehler instanceof EntsperrFehler && ENTSPERR_TEXT[fehler.grund]) || ENTSPERR_TEXT.kaputt;

function Schloss({ aufSchliessen, hinweis = "" }) {
  const [passwort, setPasswort] = useState("");
  const [fehlerText, setFehlerText] = useState(hinweis);
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e) {
    e.preventDefault();
    if (!passwort || laeuft) return;
    setLaeuft(true);
    setFehlerText("");
    let ok = false;
    try {
      ok = await anmelden(passwort);
    } catch (fehler) {
      setFehlerText(entsperrText(fehler));
      return;
    } finally {
      setLaeuft(false);
    }
    if (!ok) {
      setFehlerText("That password does not fit.");
      setPasswort("");
      return;
    }
    try {
      localStorage.setItem(PASSWORT_SCHLUESSEL, passwort);
    } catch {
      /* egal */
    }
    aufSchliessen();
  }

  return (
    <div className="anmeldung">
      <form onSubmit={absenden} className="karte">
        <div className="marke-gross"><Sombrero groesse={72} /></div>
        <h1>Letacios Fiesta</h1>
        <p className="lead">Ladder statistics for the group. Enter the password.</p>
        <input
          type="password"
          autoFocus
          autoComplete="current-password"
          aria-label="Password"
          value={passwort}
          onChange={(e) => setPasswort(e.target.value)}
          className={"feld" + (fehlerText ? " falsch" : "")}
        />
        <button type="submit" disabled={laeuft || !passwort} className="knopf voll">
          {laeuft ? "Checking" : "Continue"}
        </button>
        {fehlerText ? <p className="meldung fehler" role="alert">{fehlerText}</p> : null}
      </form>
    </div>
  );
}

/* --------------------------------------------------------------------------
   ⌘K Palette

   Sucht die Leader des geladenen Satzes nach Name und Kartennummer (src/leadersuche.js).
   Pfeiltasten waehlen, Enter oeffnet, Escape schliesst; danach kehrt der Fokus dorthin
   zurueck, wo er vorher war.
   -------------------------------------------------------------------------- */

function Palette({ eintraege, waehlen, schliessen }) {
  const [text, setText] = useState("");
  const [aktiv, setAktiv] = useState(0);
  const eingabeRef = useRef(null);
  const treffer = useMemo(() => leaderSuchen(eintraege, text), [eintraege, text]);

  useEffect(() => {
    const vorher = document.activeElement;
    eingabeRef.current?.focus();
    return () => {
      if (vorher && typeof vorher.focus === "function") vorher.focus();
    };
  }, []);
  useEffect(() => setAktiv(0), [text]);

  function taste(e) {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setAktiv((a) => Math.min(a + 1, treffer.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setAktiv((a) => Math.max(a - 1, 0));
    } else if (e.key === "Enter") {
      e.preventDefault();
      if (treffer[aktiv]) waehlen(treffer[aktiv].id);
    } else if (e.key === "Escape") {
      e.preventDefault();
      schliessen();
    }
  }

  return (
    <div className="palette-huelle" onMouseDown={schliessen}>
      <div className="palette" role="dialog" aria-modal="true" aria-label="Search leader"
           onMouseDown={(e) => e.stopPropagation()}>
        <div className="palette-feld">
          <Zeichen name="suche" groesse={16} />
          <input ref={eingabeRef} type="text" autoComplete="off" spellCheck={false}
                 placeholder="Leader name or card number" value={text}
                 role="combobox" aria-expanded="true" aria-controls="palette-liste"
                 aria-activedescendant={treffer[aktiv] ? "palette-" + treffer[aktiv].id : undefined}
                 onChange={(e) => setText(e.target.value)} onKeyDown={taste} />
          <kbd>esc</kbd>
        </div>
        <ul id="palette-liste" role="listbox" className="palette-liste">
          {treffer.map((e, i) => (
            <li key={e.id} id={"palette-" + e.id} role="option" aria-selected={i === aktiv}
                onMouseEnter={() => setAktiv(i)} onClick={() => waehlen(e.id)}>
              <Kartenbild id={e.id} breite={24} />
              <b><Farbpunkte f={e.f} />{e.name}</b>
              <span className="z">{e.id}</span>
              <small className="z">{fmtZahl(e.partien)} games</small>
            </li>
          ))}
          {!treffer.length ? <li className="leer-satz">No leader by that name. Try a card number like OP17-058.</li> : null}
        </ul>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Die Seite
   -------------------------------------------------------------------------- */

const MATRIX_HANDY_TOP = 8;
// Reiter mit eigenem Leader; aus allen anderen oeffnet die Palette den Leader in Decklists.
/* Reiter mit Leaderkopf; nur dort traegt die Seite die Leaderfarbe. */
const LEADER_KOPF = ["decks", "matchups", "analyse"];
const LEADER_REITER = ["decks", "matchups", "matrix", "analyse", "book"];
/* Reiter, die ohne geladenen Satz nichts zeigen koennen. */
const SATZ_REITER = ["decks", "matchups", "matrix", "rang", "analyse"];
/* Meldungen fuer Besucher, wenn Verzeichnis oder Satz nicht laden (P1-1). */
const DATEN_FEHLT = "The statistics could not be loaded. Leaderboard, Guide and Changelog still work; try again in a minute.";
const SATZ_FEHLT = "This data set could not be loaded. Pick another source above or try again in a minute.";

/* Einzug beim ersten Aufbau: Dauer, Versatz je Element und Kurve (power2.out). */
const EINZUG_MS = 450;
const EINZUG_VERSATZ_MS = 70;
const EINZUG_KURVE = "cubic-bezier(0.5, 1, 0.89, 1)";
/* Knapp ueber null statt null: Chrome zaehlt ein Element mit Deckkraft 0 nicht als
   gezeichnet, und bei einer Animation auf dem Compositor kam das LCP erst nach ihrem Ende
   (Render Delay 0,63 s). Mit 0,01 ist das Bild ab dem ersten Frame gemalt, sichtbar ist
   der Unterschied nicht. */
const EINZUG_START_DECKKRAFT = 0.01;

export default function App() {
  const [entsperrt, setEntsperrt] = useState(null);
  // Meldung, wenn schon das Entsperren beim Start scheitert (P1-3); die Anmeldung zeigt sie.
  const [entsperrHinweis, setEntsperrHinweis] = useState("");
  const [verzeichnis, setVerzeichnis] = useState(null);
  const [satz, setSatz] = useState(null);
  const [laedt, setLaedt] = useState(true);
  const [fehlerText, setFehlerText] = useState("");
  const [wahl, setWahl] = useState({
    art: "satz",
    satz: VORGABE_SATZ,
    modus: "mode_0",
    bounty: "25_1000",
    von: "",
    bis: "",
  });
  const [gewaehlt, setGewaehlt] = useState(null);
  const [suche, setSuche] = useState("");
  const [sortLeader, setSortLeader] = useState("partien");
  const [reiter, setReiter] = useState(() => reiterAusPfad(window.location.pathname));
  const [mindest, setMindest] = useState(50);
  const [mindestGeg, setMindestGeg] = useState(100);
  const [muSortiert, setMuSortiert] = useState({ nach: "partien", ab: true });
  const [sortListen, setSortListen] = useState("wr");
  const [karteFilter, setKarteFilter] = useState("");
  // Nur zwoelf Listen bauen. Sechzig auf einmal sind ueber tausend Kartenfelder und
  // machten den Wechsel auf den Decklistenreiter traege.
  const [sichtbar, setSichtbar] = useState(12);
  const [namen, setNamen] = useState({});
  // null heisst "noch nicht geholt", false heisst "nicht da". Beides ist erlaubt.
  const [beste, setBeste] = useState(null);
  // Stufe B von Kaizoku (Karten, Hand, Kurve, Tech), je Quelle; fehlt der Schluessel, ist sie noch nicht geholt.
  const [kzBAlle, setKzBAlle] = useState({});
  const [kzSpieler, setKzSpieler] = useState(null);
  const [spielerAlle, setSpielerAlle] = useState(null);
  const [spielerId, setSpielerId] = useState(
    () => new URLSearchParams(window.location.search).get("id") || null
  );
  // Der Leader, den der betrachtete Spieler in dieser Partie gespielt hat. Der
  // Viewer erkennt daran, welche Seite im Log die des Spielers ist; ueber den
  // Namen ginge es nicht, im Log stehen andere.
  const [replayLeader, setReplayLeader] = useState(null);
  const [replayPfad, setReplayPfad] = useState(
    () => new URLSearchParams(window.location.search).get("p") || null
  );
  const [matrixTop, setMatrixTop] = useState(12);
  const [matrixMindest, setMatrixMindest] = useState(50);
  const [sitzModus, setSitzModus] = useState(false);
  // Fokus der Matrix: nur dieser Leader, als Liste je Gegner. Steht als ?leader= in der Adresse.
  const [matrixFokus, setMatrixFokus] = useState(() => fokusAusAdresse());
  // Sortierung der Matrix und des Fokus: "partien", "wr" oder "wr_auf" (src/winrate.js).
  const [matrixSort, setMatrixSort] = useState(() => matrixSortAusAdresse());
  // Am Handy zeigt die Matrix zuerst die Top 8; ein Knopf holt alle gewaehlten dazu.
  const [matrixAlle, setMatrixAlle] = useState(false);
  const schmal = useSchmal(760);

  const [quelleOffen, setQuelleOffen] = useState(false);
  const [leisteOffen, setLeisteOffen] = useState(false);
  const [mehrOffen, setMehrOffen] = useState(false);
  const [sucheOffen, setSucheOffen] = useState(false);

  const kopfRef = useRef(null);
  const quelleRef = useRef(null);
  const railRef = useRef(null);
  const buehneRef = useRef(null);

  /* Menue schliessen, wenn daneben geklickt oder Escape gedrueckt wird */
  useEffect(() => {
    if (!quelleOffen) return undefined;
    const klick = (e) => {
      if (quelleRef.current && !quelleRef.current.contains(e.target)) setQuelleOffen(false);
    };
    const taste = (e) => {
      if (e.key === "Escape") setQuelleOffen(false);
    };
    document.addEventListener("mousedown", klick);
    document.addEventListener("keydown", taste);
    return () => {
      document.removeEventListener("mousedown", klick);
      document.removeEventListener("keydown", taste);
    };
  }, [quelleOffen]);

  /* Das Blatt More schliesst mit Escape und bei jedem Reiterwechsel. */
  useEffect(() => {
    if (!mehrOffen) return undefined;
    const taste = (e) => {
      if (e.key === "Escape") setMehrOffen(false);
    };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, [mehrOffen]);
  useEffect(() => setMehrOffen(false), [reiter]);

  /* ⌘K oder Ctrl K oeffnet und schliesst die Palette. */
  useEffect(() => {
    const taste = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSucheOffen((o) => !o);
      }
    };
    document.addEventListener("keydown", taste);
    return () => document.removeEventListener("keydown", taste);
  }, []);

  /* Liegt eine Verschluesselung vor, und passt ein gemerktes Passwort noch? */
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      try {
        const info = await verschluesselung();
        if (abgebrochen) return;
        if (!info) {
          setEntsperrt(true);
          return;
        }
        if (!kryptoDa()) throw new EntsperrFehler("krypto", "crypto.subtle fehlt");
        let gemerkt = null;
        try {
          gemerkt = localStorage.getItem(PASSWORT_SCHLUESSEL);
        } catch {
          /* egal */
        }
        if (gemerkt && (await anmelden(gemerkt))) {
          if (!abgebrochen) setEntsperrt(true);
          return;
        }
        if (!abgebrochen) setEntsperrt(false);
      } catch (fehler) {
        // Kein WebCrypto, Schluesseldatei kaputt oder nicht erreichbar: Anmeldung mit Meldung
        // statt einer leeren Seite.
        if (abgebrochen) return;
        setEntsperrHinweis(entsperrText(fehler));
        setEntsperrt(false);
      }
    })();
    return () => {
      abgebrochen = true;
    };
  }, []);

  /* Kartennamen, unabhaengig vom Datensatz */
  useEffect(() => {
    if (entsperrt !== true) return;
    kartenLaden().then(setNamen);
  }, [entsperrt]);

  /* Bestenliste. Eigene Datei, eigener Rhythmus, und sie darf fehlen: faellt sie
     aus, bleibt der Reiter leer und der Rest der Seite laeuft weiter. */
  useEffect(() => {
    if (entsperrt !== true || beste !== null) return;
    if (reiter !== "beste" && reiter !== "spieler") return;
    let abgebrochen = false;
    holen("bestenliste.json.gz")
      .then((d) => !abgebrochen && setBeste(d))
      .catch(() => !abgebrochen && setBeste(false));
    return () => {
      abgebrochen = true;
    };
  }, [entsperrt, reiter, beste]);

  /* Kaizoku Stufe B, nur wenn Kaizoku die Quelle ist. Eigene Datei, darf fehlen. */
  const kzQuelle = satz ? satz.quelle : "";
  const istKaizoku = istKaizokuQuelle(kzQuelle);
  const kzB = istKaizoku ? kzBAlle[kzQuelle] ?? null : null;
  useEffect(() => {
    if (entsperrt !== true || !istKaizoku || kzBAlle[kzQuelle] !== undefined) return undefined;
    let abgebrochen = false;
    const setzen = (d) => !abgebrochen && setKzBAlle((alle) => ({ ...alle, [kzQuelle]: d }));
    holen(KAIZOKU_QUELLEN[kzQuelle].bDatei).then(setzen).catch(() => setzen({ leader: {} }));
    return () => {
      abgebrochen = true;
    };
  }, [entsperrt, kzQuelle, istKaizoku, kzBAlle]);

  /* Kaizoku Zahlen der Top 100 (Stufe C). Eigene Datei, darf fehlen. */
  useEffect(() => {
    if (entsperrt !== true || kzSpieler !== null || reiter !== "spieler") return;
    let abgebrochen = false;
    holen("kaizoku_spieler.json.gz")
      .then((d) => !abgebrochen && setKzSpieler(d))
      .catch(() => !abgebrochen && setKzSpieler(false));
    return () => {
      abgebrochen = true;
    };
  }, [entsperrt, reiter, kzSpieler]);

  /* Die Partien je Spieler. Eigene Datei, fuer die Spielerseite und den Deckreiter
     (wer hat welche Liste gespielt), und sie darf ebenso fehlen wie die Bestenliste.
     Auf dem Deckreiter erst nach dem Satz: sonst teilen sich 48 KB Spielerdaten die
     Leitung mit dem Satz, und die Listen erscheinen spaeter (specs/features/ladepfad-handy.md). */
  useEffect(() => {
    if (entsperrt !== true || spielerAlle !== null) return;
    if (reiter !== "spieler" && reiter !== "decks") return;
    if (reiter === "decks" && !satz) return;
    let abgebrochen = false;
    holen("spieler.json.gz")
      .then((d) => !abgebrochen && setSpielerAlle(d))
      .catch(() => !abgebrochen && setSpielerAlle(false));
    return () => {
      abgebrochen = true;
    };
  }, [entsperrt, reiter, spielerAlle, satz]);

  /* Wer hat welche Liste gespielt? Einmal bauen, nicht je Liste neu. */
  const spielerIndex = useMemo(() => spielerJeListe(spielerAlle), [spielerAlle]);
  const partienIndex = useMemo(() => partienJeListe(spielerAlle), [spielerAlle]);

  /* Adresse der Spielerseite mitfuehren. */
  useEffect(() => {
    if (entsperrt !== true || reiter !== "spieler") return;
    adresseSetzen("spieler", null, false, spielerId);
  }, [reiter, spielerId, entsperrt]);

  /* Adresse der Replayseite mitfuehren. */
  useEffect(() => {
    if (entsperrt !== true || reiter !== "replay") return;
    adresseSetzen("replay", null, false, null, replayPfad);
  }, [reiter, replayPfad, entsperrt]);

  /* Verzeichnis holen */
  useEffect(() => {
    if (entsperrt !== true) return undefined;
    holen("verzeichnis.json.gz")
      .then((v) => {
        setVerzeichnis(v);
        if (v.start && (v.saetze || []).some((s) => s.schluessel === v.start)) {
          setWahl((w) => ({ ...w, satz: v.start }));
        }
        const tage = (v.tage || []).filter((t) => t.modus === "mode_0" && t.bounty === "25_1000");
        const letzter = tage.length ? tage[tage.length - 1].tag : "";
        const start = tage.length ? tage[Math.max(0, tage.length - 7)].tag : "";
        setWahl((w) => ({ ...w, von: start, bis: letzter }));
      })
      .catch((e) => {
        setFehlerText(DATEN_FEHLT + " (" + e.message + ")");
        setLaedt(false);
      });
    return undefined;
  }, [entsperrt]);

  /* Satz nach Wahl laden */
  useEffect(() => {
    if (!verzeichnis) return;
    let abgebrochen = false;
    setLaedt(true);
    setFehlerText("");
    const auftrag =
      wahl.art === "satz"
        ? istKaizokuQuelle(wahl.satz)
          ? kaizokuLaden(wahl.satz)
          : (() => {
            const s = (verzeichnis.saetze || []).find((x) => x.schluessel === wahl.satz)
              || (verzeichnis.saetze || [])[0];
            return s ? satzLaden(s.datei, s.name) : Promise.reject(new Error("Data set missing"));
          })()
        : (() => {
            const dateien = (verzeichnis.tage || [])
              .filter(
                (t) =>
                  t.modus === wahl.modus &&
                  t.bounty === wahl.bounty &&
                  t.tag >= wahl.von &&
                  t.tag <= wahl.bis
              )
              .map((t) => t.datei);
            // Kein Tag im Zeitraum ist ein leerer Satz, kein Fehler: die Reiter zeigen dann
            // "No games in this range" (P2-3).
            if (!dateien.length) return Promise.resolve(verschmelzen([], wahl.von + " to " + wahl.bis));
            const name =
              wahl.von === wahl.bis
                ? wahl.von
                : wahl.von + " to " + wahl.bis + ", " + dateien.length + " days";
            return zeitraumLaden(dateien, name);
          })();

    auftrag
      .then((s) => {
        if (abgebrochen) return;
        setSatz(s);
        const gewuenscht = new URLSearchParams(window.location.search).get("leader");
        const ausAdresse = gewuenscht
          ? s.leader.find((e) => kennung(e.id) === gewuenscht)
          : null;
        const ersterMitListen =
          ausAdresse || s.leader.find((e) => e.listen.length > 0) || s.leader[0];
        setGewaehlt(ersterMitListen ? ersterMitListen.id : null);
        setLaedt(false);
      })
      .catch((e) => {
        if (abgebrochen) return;
        setFehlerText(SATZ_FEHLT + " (" + e.message + ")");
        setLaedt(false);
      });
    return () => {
      abgebrochen = true;
    };
  }, [verzeichnis, wahl.art, wahl.satz, wahl.modus, wahl.bounty, wahl.von, wahl.bis]);

  /* Einzug beim ersten Aufbau. Eine Bewegung, nicht drei. */
  useLayoutEffect(() => {
    if (!satz) return;
    const ziele = [kopfRef.current, railRef.current, buehneRef.current].filter(Boolean);
    if (!ziele.length) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    // Web Animations statt gsap, damit gsap nicht im ersten Bundle liegt
    // (specs/features/ladepfad-handy.md). Gleiche Bewegung: 14 px, 0,45 s, Versatz 0,07 s,
    // power2.out. "both" haelt den Anfangswert waehrend des Versatzes; nach dem Ende
    // bleibt nichts am Element stehen, wie vorher mit clearProps.
    const laeufe = ziele.map((el, i) =>
      el.animate(
        [{ transform: "translateY(14px)", opacity: EINZUG_START_DECKKRAFT }, { transform: "none", opacity: 1 }],
        { duration: EINZUG_MS, delay: i * EINZUG_VERSATZ_MS, easing: EINZUG_KURVE, fill: "backwards" }
      )
    );
    return () => laeufe.forEach((l) => l.cancel());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satz === null]);

  const leader = useMemo(
    () => (satz ? satz.leader.find((e) => e.id === gewaehlt) || satz.leader[0] : null),
    [satz, gewaehlt]
  );

  /* Leaderfarbe: auf Seiten mit Leaderkopf faerben die Kartenfarben Kopf, Hauptkachel, aktiven
     Reiter, Girlande und die Browserleiste am Handy. Sonst gilt Stroh (siehe signatur.md). */
  const leaderFarbe = leader && LEADER_KOPF.includes(reiter) ? (namen[kennung(leader.id)] || {}).f || "" : "";
  useEffect(() => {
    const wurzel = document.documentElement;
    const ton = leaderTon(leaderFarbe);
    if (ton) {
      wurzel.style.setProperty("--lf1", ton.eins);
      wurzel.style.setProperty("--lf2", ton.zwei);
    } else {
      wurzel.style.removeProperty("--lf1");
      wurzel.style.removeProperty("--lf2");
    }
    wurzel.classList.toggle("mit-leaderfarbe", Boolean(ton));
    const meta = document.querySelector('meta[name="theme-color"]');
    if (meta) meta.setAttribute("content", themaFarbe(leaderFarbe));
  }, [leaderFarbe]);

  const leaderListe = useMemo(() => {
    if (!satz) return [];
    const q = suche.trim().toUpperCase();
    // Leader ohne eine einzige Deckliste im Zeitraum tauchen nicht auf. Sie haetten nur
    // eine leere Decklistenansicht, und in der Rangliste stehen sie ohnehin ganz unten.
    const r = satz.leader.filter(
      (e) => e.listen.length > 0 && (!q || String(e.id).toUpperCase().includes(q))
    );
    r.sort((a, b) => {
      if (sortLeader === "wr") return proz(b.w, b.w + b.l) - proz(a.w, a.w + a.l);
      if (sortLeader === "listen") return b.listen.length - a.listen.length;
      return b.w + b.l - (a.w + a.l);
    });
    return r;
  }, [satz, suche, sortLeader]);

  useEffect(() => {
    setSichtbar(12);
  }, [gewaehlt, mindest, sortListen, karteFilter, satz]);

  const listen = useMemo(() => {
    if (!leader) return [];
    const kf = karteFilter.trim().toUpperCase();
    const r = leader.listen.filter((l) => {
      if (l.w + l.l < mindest) return false;
      if (kf) return l.d.some((e) => String(e).toUpperCase().includes(kf));
      return true;
    });
    r.sort((a, b) => {
      if (sortListen === "partien") return b.w + b.l - (a.w + a.l);
      if (sortListen === "first") return proz(b.fw, b.fw + b.fl) - proz(a.fw, a.fw + a.fl);
      if (sortListen === "second") return proz(b.sw, b.sw + b.sl) - proz(a.sw, a.sw + a.sl);
      if (sortListen === "dauer") return b.dur - a.dur;
      return proz(b.w, b.w + b.l) - proz(a.w, a.w + a.l);
    });
    return r;
  }, [leader, mindest, sortListen, karteFilter]);

  /* Adresse mitfuehren, sobald Reiter oder Leader stehen. In der Matrix steht dort der
     Fokus, nicht der gewaehlte Leader: /matrix ohne Abfrage ist die ganze Matrix. */
  /* Spieler und Replay fuehren ihre Adresse selbst (Effekte weiter oben); hier wuerde sonst
     ?id= oder ?p= gleich wieder abgeschnitten (P1-2). Die erste Leaderwahl nach dem Laden
     ersetzt den Eintrag, statt einen zweiten anzulegen. */
  const vorherGewaehlt = useRef(null);
  useEffect(() => {
    if (entsperrt !== true || reiter === "spieler" || reiter === "replay") return;
    if (!gewaehlt && LEADER_REITER.includes(reiter)) return;
    const ersterLeader = gewaehlt && vorherGewaehlt.current === null;
    vorherGewaehlt.current = gewaehlt;
    adresseSetzen(reiter, reiter === "matrix" ? matrixFokus : gewaehlt, ersterLeader, null, null, matrixSort);
  }, [reiter, gewaehlt, entsperrt, matrixFokus, matrixSort]);

  /* Titel je Reiter, damit Verlauf und Tabs sagen, wo man war (P2-9). */
  useEffect(() => {
    const name = REITER_NAME[reiter] || (REITER.find(([k]) => k === reiter) || REITER[0])[1];
    document.title = name + " · Letacios Fiesta";
  }, [reiter]);

  /* Fokus setzen; der fokussierte Leader wird auch der gewaehlte fuer die anderen Reiter. */
  const fokusSetzen = useCallback((id) => {
    setMatrixFokus(id);
    if (id && satz) {
      const treffer = satz.leader.find((e) => kennung(e.id) === id);
      if (treffer) setGewaehlt(treffer.id);
    }
  }, [satz]);

  const paletteEintraege = useMemo(() => {
    if (!satz) return [];
    return satz.leader
      .filter((e) => e.listen.length > 0)
      .map((e) => {
        const id = kennung(e.id);
        return { id, name: (namen[id] || {}).n || id, f: (namen[id] || {}).f, partien: e.w + e.l };
      });
  }, [satz, namen]);

  /* Leader aus der Palette: im aktuellen Reiter, sonst in Decklists. */
  const paletteWaehlen = useCallback((id) => {
    setSucheOffen(false);
    if (reiter === "matrix") {
      fokusSetzen(id);
      return;
    }
    const treffer = satz && satz.leader.find((e) => kennung(e.id) === id);
    if (treffer) setGewaehlt(treffer.id);
    if (!LEADER_REITER.includes(reiter)) setReiter("decks");
  }, [reiter, satz, fokusSetzen]);

  /* Vor und Zurueck im Browser */
  useEffect(() => {
    const zurueck = () => {
      setReiter(reiterAusPfad(window.location.pathname));
      setSpielerId(new URLSearchParams(window.location.search).get("id") || null);
      setReplayPfad(new URLSearchParams(window.location.search).get("p") || null);
      setMatrixFokus(fokusAusAdresse());
      setMatrixSort(matrixSortAusAdresse());
      const wunsch = new URLSearchParams(window.location.search).get("leader");
      if (wunsch && satz) {
        const treffer = satz.leader.find((e) => kennung(e.id) === wunsch);
        if (treffer) setGewaehlt(treffer.id);
      }
    };
    window.addEventListener("popstate", zurueck);
    return () => window.removeEventListener("popstate", zurueck);
  }, [satz]);

  if (entsperrt === null) return null;
  if (entsperrt === false) {
    return <Schloss hinweis={entsperrHinweis} aufSchliessen={() => { setEntsperrHinweis(""); setEntsperrt(true); }} />;
  }

  const leaderbezogen = LEADER_KOPF.includes(reiter);
  const reiterName = REITER_NAME[reiter] || (REITER.find(([k]) => k === reiter) || REITER[0])[1];
  const zahlFeld = (setzen, max) => (e) => {
    const n = Math.round(Number(e.target.value));
    setzen(Number.isFinite(n) ? Math.max(0, Math.min(max, n)) : 0);
  };
  const lid = leader ? kennung(leader.id) : null;
  const leaderName = lid ? (namen[lid] || {}).n || lid : "–";
  const matrixZahl = schmal && !matrixAlle ? Math.min(MATRIX_HANDY_TOP, matrixTop) : matrixTop;

  /* Die Leaderleiste links. Am Handy steht nur der gewaehlte Leader als Knopf; die
     Liste klappt darunter auf. */
  const leiste = leader ? (
    <aside ref={railRef} className={"leiste" + (leisteOffen ? " offen" : "")} aria-label="Leaders">
      <button type="button" className="leiste-knopf" aria-expanded={leisteOffen}
              onClick={() => setLeisteOffen((o) => !o)}>
        <Kartenbild id={lid} breite={26} />
        <span style={{ minWidth: 0 }}><span className="fl-label">Leader</span><b>{leaderName}</b></span>
        <span className={"z " + wrKlasseWG(leader.w, leader.w + leader.l)}>{fmtProz(leader.w, leader.w + leader.l)}</span>
        <Zeichen name="dreh" groesse={16} />
      </button>
      <div className="leiste-kopf">
        <label className="fl eng">
          <span>Leader</span>
          <input id="suche" type="search" autoComplete="off" placeholder="OP17-039 ..." className="feld"
                 value={suche} onChange={(e) => setSuche(e.target.value)} />
        </label>
        <Schalter paare={[["partien", "Games"], ["wr", "Win rate"], ["listen", "Lists"]]}
                  wert={sortLeader} setzen={setSortLeader} label="Sort leaders" />
      </div>
      <ol className="leiste-liste">
        {leaderListe.map((e, i) => {
          const g = e.w + e.l;
          const id = kennung(e.id);
          return (
            <li key={e.id}>
              <a href={PFADE[reiter] + "?leader=" + encodeURIComponent(id)}
                 aria-current={e.id === leader.id ? "true" : undefined}
                 onClick={(ev) => {
                   if (!eigenerKlick(ev)) return;
                   ev.preventDefault();
                   setGewaehlt(e.id);
                   setLeisteOffen(false);
                 }}>
                <span className="nr">{nr2(i + 1)}</span>
                <Kartenbild id={id} breite={24} />
                <span style={{ minWidth: 0 }}>
                  <b>{(namen[id] || {}).n || id}</b>
                  <small>{fmtZahl(g)} games · {e.listen.length} {e.listen.length === 1 ? "list" : "lists"}</small>
                </span>
                <span className={"z " + wrKlasseWG(e.w, g)}>{fmtProz(e.w, g)}</span>
              </a>
            </li>
          );
        })}
        {!leaderListe.length ? <li className="leer-satz">No leader by that name. Try a card number like OP17-058.</li> : null}
      </ol>
    </aside>
  ) : null;

  /* Titel und Kennzeile des gewaehlten Leaders */
  const leaderKopf = leader ? (
    <section className="vorspann leaderkopf">
      <Bild key={lid} id={lid} className="kopf-bild" vorrang />
      <div className="titelzeile">
        <Kartenbild id={lid} breite={44} />
        <div>
          <h1>{leaderName}</h1>
          <p className="farbzeile">
            {farbBuchstaben((namen[lid] || {}).f).map((k) => (
              <span key={k}><i style={{ background: LEADERFARBE[k] }} />{FARBNAME[k]}</span>
            ))}
            <span className="kartennr">{lid}</span>
          </p>
        </div>
      </div>
      <dl className="kennzeile leader-zeile">
        <Kennzahl etikett="Win rate"
                  kind={<Zaehler wert={proz(leader.w, leader.w + leader.l)} nachkomma={1} suffix=" %" />}
                  unter={"± " + fehler(leader.w + leader.l).toFixed(1)}
                  skala={proz(leader.w, leader.w + leader.l)} />
        <Kennzahl etikett="Games" kind={<Zaehler wert={leader.w + leader.l} />}
                  zeile={fmtZahl(leader.w) + " W  " + fmtZahl(leader.l) + " L"} />
        <Kennzahl etikett="Going first"
                  kind={<Zaehler wert={proz(leader.fw, leader.fw + leader.fl)} nachkomma={1} suffix=" %" />}
                  skala={leader.fw + leader.fl > 0 ? proz(leader.fw, leader.fw + leader.fl) : null} />
        <Kennzahl etikett="Going second"
                  kind={<Zaehler wert={proz(leader.sw, leader.sw + leader.sl)} nachkomma={1} suffix=" %" />}
                  skala={leader.sw + leader.sl > 0 ? proz(leader.sw, leader.sw + leader.sl) : null} />
        <Kennzahl etikett="Duration" kind={<span className="z">{fmtDauer(leader.dur)}</span>} nurGross />
        <Kennzahl etikett="Lists" kind={<Zaehler wert={leader.listen.length} />} nurGross />
      </dl>
    </section>
  ) : null;

  // Reiter, die den Satz brauchen, warten auf ihn; alle anderen laufen auch ohne (P1-1).
  // Ein Ladefehler des Satzes steht dann oben in der Buehne, die Quellenwahl bleibt im Kopf.
  const brauchtSatz = SATZ_REITER.includes(reiter);
  let inhalt = null;
  if (brauchtSatz && !leader) {
    inhalt = satz && !laedt
      ? <p className="leer-satz">No games in this range. Pick a longer range or another source.</p>
      : fehlerText && !satz ? null : <p className="laedt" aria-live="polite">Loading</p>;
  } else if (reiter === "changelog") {
    inhalt = <Changelog />;
  } else if (reiter === "decks") {
    inhalt = (
      <>
        <div className="steuer">
          <label className="fl eng" style={{ width: 110 }}>
            <span>Min games</span>
            <input id="mindest" type="number" min="0" max="200" className="feld" value={mindest}
                   onChange={zahlFeld(setMindest, 200)} />
          </label>
          <label className="fl eng">
            <span>Sort by</span>
            <select id="sortListen" className="feld" value={sortListen} onChange={(e) => setSortListen(e.target.value)}>
              <option value="wr">Win rate</option>
              <option value="partien">Games</option>
              <option value="first">Win rate going first</option>
              <option value="second">Win rate going second</option>
              <option value="dauer">Duration</option>
            </select>
          </label>
          <label className="fl eng breit-handy" style={{ width: 150 }}>
            <span>Contains card</span>
            <input id="karteFilter" type="search" autoComplete="off" placeholder="OP17-041" className="feld"
                   value={karteFilter} onChange={(e) => setKarteFilter(e.target.value)} />
          </label>
          <span className="klein z" style={{ paddingBottom: 10 }}>
            {listen.length} of {leader.listen.length} lists
            {satz.listenAlleGegner ? ", list stats count all opponents" : null}
          </span>
        </div>
        <Abschnitt titel={`Lists by ${SORT_LISTEN_TEXT[sortListen]}, at least ${mindest} games`}>
          <div className="tafel-spalten spalten listen">
            <span>Nr</span><span>Deck</span><span className="rechts">Win rate</span><span className="rechts">Games</span>
            <span className="rechts">First</span><span className="rechts">Second</span><span className="rechts">Time</span><span />
          </div>
          <ol className="tafel listen">
            {listen.slice(0, sichtbar).map((l, i) => (
              <Deckzeile key={l.d.join("|") + i} nr={i + 1} liste={l} leaderId={leader.id}
                         spielerIndex={spielerIndex} partienIndex={partienIndex} namen={namen} />
            ))}
          </ol>
          {!listen.length ? <p className="leer-satz">No list matches these filters. Loosen one of them.</p> : null}
          {listen.length > sichtbar ? (
            <div className="mehr">
              <button type="button" className="knopf rand" onClick={() => setSichtbar((n) => n + 36)}>
                Show more, {listen.length - sichtbar} left
              </button>
            </div>
          ) : null}
          <p className="lesart">
            Win rate in <span className="wr gut">green and bold</span> from {GUT} %, <span className="wr schwach">red</span> under{" "}
            {SCHWACH} %. A tap on a row turns it over and shows the list by name; in an open list a tap on a card
            image shows the card large.
          </p>
        </Abschnitt>
        {istKaizoku ? (
          <KaizokuHinweis satz={satz} />
        ) : null}
      </>
    );
  } else if (reiter === "matchups") {
    inhalt = (
      <>
        <div className="steuer">
          <label className="fl eng" style={{ width: 110 }}>
            <span>Min games</span>
            <input id="mindestGeg" type="number" min="0" max="1000" className="feld" value={mindestGeg}
                   onChange={zahlFeld(setMindestGeg, 1000)} />
          </label>
          <label className="fl eng nur-handy">
            <span>Sort by</span>
            <select className="feld" value={muSortiert.nach}
                    onChange={(e) => setMuSortiert({ nach: e.target.value, ab: e.target.value !== "name" })}>
              {MU_SORT.map(([k, t]) => <option key={k} value={k}>{t}</option>)}
            </select>
          </label>
          <span className="klein z" style={{ paddingBottom: 10 }}>
            {(leader.gegner || []).filter((g) => g.m >= mindestGeg).length} of {(leader.gegner || []).length} opponents
          </span>
        </div>
        <Abschnitt titel={`Matchups of ${leaderName}, at least ${mindestGeg} games`}>
          <Matchups leader={leader} mindest={mindestGeg} namen={namen}
                    sortiert={muSortiert} setSortiert={setMuSortiert} />
          <p className="lesart">
            These are the matchups of {leaderName} alone, the leader selected on the left. For every leader against
            every other one, open the matchup matrix. <span className="wr gut">Green and bold</span> from {GUT} %,{" "}
            <span className="wr schwach">red</span> under {SCHWACH} %.
          </p>
        </Abschnitt>
        {istKaizoku ? (
          <>
            <KaizokuTech b={kzB} leaderId={leader.id} namen={namen} />
            <KaizokuHinweis satz={satz} />
          </>
        ) : null}
      </>
    );
  } else if (reiter === "matrix") {
    inhalt = (
      <>
        <section className="vorspann">
          <h1>Matchup matrix</h1>
          <p className="lead">
            {satz.name}, <strong>{fmtZahl(satz.partien)}</strong> games. The {matrixZahl} leaders with the most games,
            row against column.
          </p>
        </section>
        <div className="steuer">
          <div className="fl eng"><span>Top leaders</span>
            <Schalter paare={[[8, "8"], [12, "12"], [16, "16"], [20, "20"]]} wert={matrixTop} label="Top leaders"
                      setzen={(n) => { setMatrixTop(n); setMatrixAlle(true); }} />
          </div>
          <label className="fl eng" style={{ width: 150 }}>
            <span>Min games per cell</span>
            <input id="matrixMindest" type="number" min="0" max="500" className="feld" value={matrixMindest}
                   onChange={zahlFeld(setMatrixMindest, 500)} />
          </label>
          {!matrixFokus ? (
            <div className="fl eng"><span>Sort</span>
              <Schalter paare={[["partien", "Play rate"], ["wr", "Win rate"]]} label="Sort the matrix"
                        wert={matrixSort === "partien" ? "partien" : "wr"} setzen={setMatrixSort} />
            </div>
          ) : null}
          <button type="button" className="knopf rand" aria-pressed={sitzModus} onClick={() => setSitzModus(!sitzModus)}>
            {sitzModus ? "Showing first and second" : "Show first and second"}
          </button>
        </div>
        <Abschnitt titel={sitzModus ? "Row beats column, first and second in %" : "Row beats column, win rate in %"}>
          <Matrix satz={satz} top={matrixZahl} mindest={matrixMindest} namen={namen}
                  sitzModus={sitzModus} setSitzModus={setSitzModus}
                  fokus={matrixFokus} setFokus={fokusSetzen} sort={matrixSort} setSort={setMatrixSort} />
          {schmal && matrixTop > MATRIX_HANDY_TOP && !matrixFokus ? (
            <div className="mehr">
              <button type="button" className="knopf rand" onClick={() => setMatrixAlle((a) => !a)}>
                {matrixAlle ? "Show top " + MATRIX_HANDY_TOP : "Show all " + matrixTop}
              </button>
            </div>
          ) : null}
          <p className="lesart">
            {matrixFokus ? (
              <>
                Win rate of the chosen leader against every opponent with at least {matrixMindest} games.{" "}
                <span className="wr gut">Green and bold</span> from {GUT} %, <span className="wr schwach">red</span> under{" "}
                {SCHWACH} %, the tint grows with the distance from 50 %. Tap Games or Win rate to sort, tap Win rate again to
                turn the order. Click the leader or Show all for the whole matrix.
              </>
            ) : (
              <>
                Win rate of the row leader against the column leader. <span className="wr gut">Green and bold</span> from{" "}
                {GUT} %, <span className="wr schwach">red</span> under {SCHWACH} %, the tint grows with the distance from
                50 %. {matrixSort === "partien" ? "Leaders stand by games played" : "Leaders stand by win rate against the field"}, rows
                and columns in the same order. A dash means fewer than {matrixMindest} games, the framed cell is the mirror. Click a leader to see
                only that leader, click a cell to switch the whole matrix {sitzModus ? "back to the overall rate" : "to first and second"}.
              </>
            )}
          </p>
        </Abschnitt>
      </>
    );
  } else if (reiter === "rang") {
    inhalt = <Rangliste satz={satz} namen={namen} />;
  } else if (reiter === "analyse") {
    inhalt = <Analyse leader={leader} namen={namen} />;
  } else if (reiter === "book") {
    inhalt = <Book key={gewaehlt} namen={namen} startLeader={gewaehlt ? kennung(gewaehlt) : null} />;
  } else if (reiter === "eigenes") {
    inhalt = <EigenesReplay namen={namen} />;
  } else if (reiter === "replay") {
    inhalt = replayPfad ? (
      <Replay
        pfad={replayPfad}
        namen={namen}
        eigenerLeader={replayLeader}
        zurueck={() => setReiter(spielerId ? "spieler" : "beste")}
      />
    ) : (
      <p className="leer-satz">Pick a game to watch its replay.</p>
    );
  } else if (reiter === "spieler") {
    inhalt = beste === null || spielerAlle === null ? (
      <p className="laedt" aria-live="polite">Loading</p>
    ) : (
      <Spieler
        eintrag={beste && Array.isArray(beste.spieler)
          ? beste.spieler.find((e) => String(e.user_id) === String(spielerId))
          : null}
        daten={spielerAlle && spielerAlle.spieler ? spielerAlle.spieler[String(spielerId)] : null}
        namen={namen}
        kzSpieler={kzSpieler && kzSpieler.spieler ? kzSpieler.spieler[String(spielerId)] : null}
        zurueck={() => setReiter("beste")}
        replayOeffnen={(pfad, ldr) => {
          setReplayPfad(pfad);
          setReplayLeader(ldr);
          setReiter("replay");
          window.scrollTo(0, 0);
        }}
      />
    );
  } else {
    inhalt = beste === null ? (
      <p className="laedt" aria-live="polite">Loading the ladder</p>
    ) : beste === false || !Array.isArray(beste.spieler) || !beste.spieler.length ? (
      <p className="leer-satz">No ladder snapshot yet. It appears after the next data day.</p>
    ) : (
      <Bestenliste
        daten={beste}
        namen={namen}
        oeffnen={(id) => {
          setSpielerId(String(id));
          setReiter("spieler");
          window.scrollTo(0, 0);
        }}
      />
    );
  }

  const buehne = (
    <div ref={buehneRef} className={"buehne" + (laedt && satz ? " dimmt" : "")}>
      {fehlerText && (satz || brauchtSatz) ? <p className="meldung fehler" role="alert">{fehlerText}</p> : null}
      <Fehlergrenze key={reiter} ersatz={() => <ReiterFehler zurueck={() => setReiter("decks")} />}>
        {leaderbezogen ? leaderKopf : null}
        <Suspense fallback={<p className="laedt" aria-live="polite">Loading</p>}>{inhalt}</Suspense>
      </Fehlergrenze>
    </div>
  );

  return (
    <VorschauBuehne>
    <div className="blatt">
      <div className="karte">
        <Girlande farben={fahnenFarben(leaderFarbe)} />
        <header ref={kopfRef} className="band">
          <a className="marke" href={PFADE.decks}
             onClick={(e) => { if (!eigenerKlick(e)) return; e.preventDefault(); setReiter("decks"); }}>
            <Sombrero groesse={26} className="hut" />
            <b>Letacios Fiesta</b>
          </a>

          <button type="button" className="suche-knopf" aria-haspopup="dialog"
                  onClick={() => setSucheOffen(true)}>
            <Zeichen name="suche" groesse={15} />
            <span>Search leader</span>
            <kbd>⌘K</kbd>
          </button>

          {/* Der Quellenchip zeigt, was geladen ist, und oeffnet erst auf Klick die
              Bedienelemente. */}
          <div className="quelle-huelle" ref={quelleRef}>
            <button type="button" className="quelle-chip" aria-expanded={quelleOffen}
                    onClick={() => setQuelleOffen((o) => !o)}>
              <span className="lang">{satz ? satz.name : fehlerText ? "Pick a source" : "loading"}</span>
              {satz ? <span className="z">{fmtZahl(satz.partien)}</span> : null}
              <Zeichen name="dreh" groesse={14} />
            </button>
            {quelleOffen && verzeichnis ? (
              <div className="quelle-tafel">
                <Quelle verzeichnis={verzeichnis} wahl={wahl} setWahl={setWahl} laedt={laedt} />
              </div>
            ) : null}
          </div>
        </header>

        {/* Neun Reiter am Rechner in einer Zeile. Am Handy tritt die untere Leiste an ihre Stelle. */}
        <nav className="reiter" aria-label="Tabs">
          {REITER.map(([k, lang, kurz]) => (
            <a key={k} href={PFADE[k]} aria-current={reiter === k ? "page" : undefined}
               onClick={(e) => { if (!eigenerKlick(e)) return; e.preventDefault(); setReiter(k); }}>
              <span className="lang">{lang}</span>
              <span className="kurz">{kurz}</span>
            </a>
          ))}
        </nav>
        {/* Ladeband. Ein Zeitraum ueber dreissig Tage holt dreissig Dateien nach, ohne
            Rueckmeldung wirkt die Seite in dieser Sekunde eingefroren. */}
        <span aria-hidden="true" className={"ladeband" + (laedt ? " an" : "")}>{laedt ? <i /> : null}</span>

        <main className="inhalt">
          {leaderbezogen && leader ? (
            <div className="mit-leiste">
              {leiste}
              {buehne}
            </div>
          ) : buehne}
        </main>

        <nav className="unten-leiste" aria-label="Tabs on phone">
          {HANDY_LEISTE.map(([k, zeichen]) => (
            <a key={k} href={PFADE[k]} aria-current={reiter === k ? "page" : undefined}
               onClick={(e) => { if (!eigenerKlick(e)) return; e.preventDefault(); setReiter(k); }}>
              <Zeichen name={zeichen} groesse={20} />
              <span>{REITER.find(([r]) => r === k)[2]}</span>
            </a>
          ))}
          <button type="button" aria-expanded={mehrOffen}
                  className={HANDY_MEHR.some(([k]) => k === reiter) ? "aktiv" : undefined}
                  onClick={() => setMehrOffen((o) => !o)}>
            <Zeichen name="mehr" groesse={20} />
            <span>More</span>
          </button>
        </nav>
        {mehrOffen ? (
          <div className="mehr-huelle" onClick={() => setMehrOffen(false)}>
            <div className="mehr-blatt" role="dialog" aria-label="More tabs" onClick={(e) => e.stopPropagation()}>
              {HANDY_MEHR.map(([k, lang]) => (
                <a key={k} href={PFADE[k]} aria-current={reiter === k ? "page" : undefined}
                   onClick={(e) => { if (!eigenerKlick(e)) return; e.preventDefault(); setReiter(k); }}>
                  {lang}
                  <Zeichen name="rechts" groesse={16} />
                </a>
              ))}
            </div>
          </div>
        ) : null}

        {sucheOffen ? (
          <Palette eintraege={paletteEintraege} waehlen={paletteWaehlen} schliessen={() => setSucheOffen(false)} />
        ) : null}

        <footer className="fuss">
          <span>
            Letacios Fiesta · {reiterName}
            {satz ? <> · {satz.name}{satz.stand ? <>, data of {datumKurz(satz.stand)}</> : null}</> : null}
          </span>
          <span><span className="raute">◆</span> italic means estimate, upright means ladder</span>
        </footer>
      </div>
    </div>
    </VorschauBuehne>
  );
}
