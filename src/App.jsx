import { createContext, Fragment, useCallback, useContext, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";
import gsap from "gsap";
import Sombrero from "./Sombrero.jsx";
import {
  anmelden,
  anzahl,
  bildpfad,
  deckSchluessel,
  grossesBild,
  holen,
  kartenLaden,
  KARTE,
  kennung,
  metacoachHolen,
  satzLaden,
  spielerJeListe,
  verschluesselung,
  zeitraumLaden,
} from "./daten.js";
import { eindampfen, schritteBauen } from "./replay.js";
import {
  abwehrBeleg, abwehrSatz, ALLE as BOOK_ALLE, angriffBeleg, angriffSatz, bookAusschnitt, gegnerListe,
  MIN_ZELLE as BOOK_MIN_ZELLE, mulliganBelege, mulliganSatz, spielenSaetze, spitzeSatz, unterschiedeImZug,
  unterschiedeSonst, vorzeichen, zahl as bookZahl, zuegeMitDaten, zugBelege, zugDaten,
} from "./book.js";
import { eigeneNummer, partieLesen } from "./zuglager.js";
import { netzBauen } from "./wertnetz.js";
import { NOTENFOLGE, partieAnalysieren } from "./spielbewertung.js";
import { CHANGELOG } from "./changelog.js";
import { animieren, DAUER, NACHLAUF_MS, zahlText } from "./zaehler.js";
import { fokusOrdnen, GUT, matrixOrdnen, SCHWACH, seite as wrSeite, sortAusText, ton as wrTon, wrKlasse } from "./winrate.js";
import { ankerBauen, fehlerSuchen, FEHLERNOTEN, kurveBauen, markenBauen, spielerZuordnen } from "./analyse.js";

/* --------------------------------------------------------------------------
   Kleine Helfer

   Gestaltet nach der Spielhilfe von Metacoach (DESIGN.md): nummerierte Zeilen mit
   Zebra, Zahlen rechtsbuendig in Saira, eine Akzentfarbe. Gut und schlecht stehen in
   Gewicht und in zwei gedaempften Signalfarben, Seegruen und Ziegelrot (src/winrate.js).
   -------------------------------------------------------------------------- */

const proz = (w, g) => (g > 0 ? (100 * w) / g : 0);
const fmtProz = (w, g) => (g > 0 ? proz(w, g).toFixed(1) + " %" : "–");
const fmtZahl = (n) => (n || 0).toLocaleString("en-US");
const fmtDauer = (s) =>
  s ? Math.floor(s / 60) + ":" + String(Math.round(s % 60)).padStart(2, "0") : "–";
const nr2 = (n) => String(n).padStart(2, "0");
const datumKurz = (iso) => (iso ? new Date(String(iso).slice(0, 10) + "T12:00:00Z")
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
};
// Pfeile etwas kraeftiger als die Bildzeichen, wie in Metacoach.
const STRICH = { dreh: 1.9, rueck: 1.9, rechts: 1.9, links: 1.9 };

function Zeichen({ name, groesse = 18 }) {
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

function Bild({ id, className = "", alt = "", breite, hoehe }) {
  const [kaputt, setKaputt] = useState(false);
  // Ohne Kennung (etwa ein unbekannter Leader in einer Partie) steht ein leerer Platzhalter.
  if (!id) return <span className={className + " kb-kaputt"} aria-hidden="true" />;
  if (kaputt) {
    const strich = id.lastIndexOf("-");
    return (
      <span className={className + " kb-kaputt"} title={id}>
        {strich > 0 ? <span className="kb-satz">{id.slice(0, strich + 1)}</span> : null}
        <span className="kb-nr">{strich > 0 ? id.slice(strich + 1) : id}</span>
      </span>
    );
  }
  return (
    <img
      src={bildpfad(id)}
      alt={alt}
      width={breite}
      height={hoehe}
      loading="lazy"
      decoding="async"
      className={className}
      onError={() => setKaputt(true)}
    />
  );
}

/** Kartenbild klein im Rahmenring, wie das Kartensymbol auf einer Spielhilfe.
 *  Mit `vorschau` ist es ein Knopf, der die Karte gross zeigt (Kartenvorschau). */
function Kartenbild({ id, breite = 26, alt = "", vorschau = false, name = "" }) {
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
    const objekt = { n: alt };
    const anim = gsap.to(objekt, {
      n: wert,
      duration: DAUER,
      ease: "power2.out",
      onUpdate: () => zeigen(objekt.n),
    });
    const sicher = setTimeout(() => {
      anim.kill();
      zeigen(wert);
    }, DAUER * 1000 + NACHLAUF_MS);
    return () => {
      clearTimeout(sicher);
      anim.kill();
    };
  }, [wert, nachkomma, suffix]);
  return <span ref={knoten} className="z" />;
}

/** Ein Paar aus Label und Wert in der Kennzeile unter dem Titel. */
function Kennzahl({ etikett, kind, unter, nurGross = false }) {
  return (
    <div className={nurGross ? "nur-gross" : undefined}>
      <dt>{etikett}</dt>
      <dd>
        {kind}
        {unter ? <small>{unter}</small> : null}
      </dd>
    </div>
  );
}

/** Umschalter in normaler Schreibung, etwa Games, Win rate, Lists. */
function Schalter({ paare, wert, setzen, label }) {
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
function Sitzwahl({ wert, setzen, paare = SITZ_KNOPF, label = "Seat" }) {
  return (
    <div className="sitzwahl" role="group" aria-label={label}>
      {paare.map(([k, t]) => (
        <button key={k} type="button" aria-pressed={wert === k} onClick={() => setzen(k)}>{t}</button>
      ))}
    </div>
  );
}

/** Abschnitt mit Ueberschrift in hellem Blau und auslaufender Haarlinie. */
function Abschnitt({ titel, children, className = "" }) {
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
function DrehKnopf({ offen, label, text = false, umdrehen }) {
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
function Rueckseite({ offen, children }) {
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

function RueckMarke({ children }) {
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
function Zelle({ k, label, wert, klasse = "" }) {
  return <span className={"z zahlzelle " + k + " " + klasse} data-label={label}>{wert}</span>;
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

function Deckzeile({ nr, liste, leaderId, spielerIndex, namen }) {
  const g = liste.w + liste.l;
  const [offen, setOffen] = useState(false);
  const [kopiert, setKopiert] = useState(false);
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
        <Zelle k="z-wr" label="Win rate" wert={fmtProz(liste.w, g)} klasse={wrKlasseWG(liste.w, g)} />
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
            <div><dt>Record</dt><dd className="z">{liste.w} – {liste.l}</dd></div>
            <div><dt>Std. error</dt><dd className="z">± {fehler(g).toFixed(1)}</dd></div>
            <div><dt>Duration</dt><dd className="z">{fmtDauer(liste.dur)}</dd></div>
          </dl>
          <button type="button" className="knopf rand" onClick={kopieren}>
            {kopiert ? "Copied" : "Copy decklist"}
          </button>
        </div>
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
    return <p className="leer-satz">No opponent reaches that game count.</p>;
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
              <span className="name gegner"><b>{(namen[r.id] || {}).n || r.id}</b><span className="kartennr">{r.id}</span></span>
              <Zelle k="z-partien" label="Games" wert={fmtZahl(r.m)} />
              <Zelle k="z-wr" label="Win rate" wert={fmtProz(r.w, r.m)} klasse={wrKlasseWG(r.w, r.m)} />
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
      {!zeilen.length ? <p className="leer-satz">No opponent reaches {mindest} games.</p> : (
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
    return <p className="leer-satz">No data in this range.</p>;
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
                        <b>{name(zeile.id)}</b>
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
      daten.spieler.map((e) => {
        const leader = (e.leader || []).filter((l) => l.leader);
        if (e.quelle === "ocr") return { ...e, leader, siege: null, partien: null, wr: null };
        const siege = leader.reduce((a, l) => a + (l.siege || 0), 0);
        const partien = leader.reduce((a, l) => a + (l.partien || 0), 0);
        return { ...e, leader, siege, partien, wr: proz(siege, partien) };
      }),
    [daten]
  );
  const mitZahlen = angereichert.some((e) => e.partien);

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
  const klasse = "tafel ladder" + (mitZahlen ? " mit-zahlen" : "");

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
        <div className={"tafel-spalten spalten ladder" + (mitZahlen ? " mit-zahlen" : "")}>
          <SortKopf text="Nr" schluessel="rang" sortiert={sortiert} setSortiert={setSortiert} rechts={false} absteigendZuerst={false} />
          <span>Player</span>
          {kopf("Bounty", "bounty")}
          {mitZahlen ? <>{kopf("Games", "partien")}{kopf("Win rate", "wr")}{kopf("Time", "spielzeit")}</> : null}
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
                  <span className="bounty">{fmtZahl(e.bounty)}</span>
                  {mitZahlen ? (
                    <>
                      <Zelle k="z-partien" label="Games" wert={e.partien == null ? "–" : fmtZahl(e.partien)} />
                      <Zelle k="z-wr" label="Win rate" wert={e.partien ? e.wr.toFixed(1) + " %" : "–"}
                             klasse={e.partien ? wrKlasse(e.wr) : "wr leer"} />
                      <Zelle k="z-zeit" label="Time" wert={e.partien == null ? "–" : stunden(e.spielzeit || 0)} />
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
        {!spieler.length ? <p className="leer-satz">No player matches.</p> : null}
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
function dateiname(pfad) {
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

/** Angelegtes Don unter einer Karte, als kleine Reihe. */
function AngelegtesDon({ n }) {
  if (!n) return null;
  return (
    <span className="dons">
      {Array.from({ length: Math.min(n, 10) }, (_, i) => <i key={i} />)}
    </span>
  );
}

/** Ein verdeckter Stapel mit seiner Zahl. Deck, Don-Deck und Trash liegen so. */
function Stapel({ n, art = "karte", leer = "empty" }) {
  if (!n) return <span className="stapel leer">{leer}</span>;
  return (
    <span className={"stapel sk-" + art}>
      <span className="zahl">{n}</span>
    </span>
  );
}

/** Cost Area: aktive Don zuerst, danach die gerasteten gekippt und blass. */
function DonZone({ aktiv = 0, gerastet = 0 }) {
  if (!aktiv && !gerastet) return <span className="leer">no don</span>;
  return (
    <>
      {Array.from({ length: aktiv }, (_, i) => (
        <span key={"a" + i}><i /></span>
      ))}
      {Array.from({ length: gerastet }, (_, i) => (
        <span key={"r" + i} className="rest"><i /></span>
      ))}
    </>
  );
}

/** Die Lifekarten als leicht ueberlappender verdeckter Stapel. */
function LifeStapel({ n }) {
  if (!n) return <div className="lifestapel aus">0 Life</div>;
  return (
    <div className="lifestapel">
      {Array.from({ length: n }, (_, i) => <span key={i} className="lk" />)}
    </div>
  );
}

function Zone({ name, feld, className = "", children }) {
  return (
    <div className={(feld ? "rzone " : "") + className}>
      <div className="zonenname">{name}</div>
      {children}
    </div>
  );
}

/**
 * Ein Spielerbrett im Zonenraster des Simulatorviewers.
 *
 * Die obere Seite wird um 180 Grad gedreht, damit sich beide Spieler
 * gegenueberliegen wie am Tisch. Gedreht wird nur das Raster ueber
 * grid-template-areas; die Karten bleiben aufrecht und damit lesbar.
 */
function Brett({ wer, stand, leader, namen, eigen, gedreht, amZug, geist }) {
  const s = stand || {};
  const don = s.don || {};
  const hand = s.hand || [];
  const board = s.board || [];
  const angelegt = s.angelegt || {};
  // Gerestete Plaetze. Aeltere Schnappschuesse kennen das Feld nicht, dann steht alles
  // aktiv, so wie der Viewer es bis zum 20.09.2026 gezeigt hat.
  const gerestet = s.gerestet instanceof Set ? s.gerestet : new Set(s.gerestet || []);
  const angelegtGesamt = Object.values(angelegt).reduce((a, b) => a + b, 0);
  const life = s.life || 0;

  return (
    <div className={"rseite" + (amZug ? " amzug" : "")} data-seite={wer}>
      <div className="rkopf">
        <span className={"rname" + (eigen ? " eigen" : "")}>
          {wer.split("#")[0]}
          {amZug ? " · to move" : ""}
        </span>
        <span className="pille">Life <b>{life}</b></span>
        <span className="lifeleiste">
          {Array.from({ length: life }, (_, i) => <i key={i} />)}
        </span>
        <span className="pille">
          Don <b>{don.aktiv || 0}</b>/{(don.aktiv || 0) + (don.gerastet || 0)}
          {/* Angelegtes Don haengt unter seiner Karte. Auf dem Telefon steht die
              Summe zusaetzlich hier, weil die Reihen dort winzig sind. */}
          {angelegtGesamt ? (
            <span className="sm:hidden"> &middot; {angelegtGesamt} attached</span>
          ) : null}
        </span>
        <span className="pille">Deck <b>{don.deck ?? "-"}</b></span>
        <span className="pille">Trash <b>{s.trash ? s.trash.length : don.trash ?? 0}</b></span>
        <span className="pille">Hand <b>{hand.length || don.handzahl || 0}</b></span>
      </div>

      <div className={"mat" + (gedreht ? " gedreht" : "")}>
        <div className="z-life"><LifeStapel n={life} /></div>

        <Zone name="Character Area" feld className="z-chars">
          <div className="rkarten">
            {board.length || geist ? (
              <>
                {board.map((k, i) => (
                  <Fragment key={k + i}>
                    {/* Eine im laufenden Kampf zerstoerte Karte steht verblasst an
                        ihrem alten Platz, bis der Kampf endet. Nur Anzeige, der
                        Stand kennt sie nicht mehr. Siehe replay.js, angriffeSchieben. */}
                    {geist && geist.platz === i ? <Geist id={geist.karte} namen={namen} /> : null}
                    <span className="platz" data-platz={i}>
                      <Bild id={k} breite={120} hoehe={168}
                            className={"bkarte" + (gerestet.has(i) ? " gerestet" : "")}
                            alt={(namen[k] || {}).n || k
                                 + (gerestet.has(i) ? ", rested" : "")} />
                      <AngelegtesDon n={angelegt[i] || 0} />
                    </span>
                  </Fragment>
                ))}
                {geist && geist.platz >= board.length ? <Geist id={geist.karte} namen={namen} /> : null}
              </>
            ) : (
              <span className="brettleer">empty board</span>
            )}
          </div>
        </Zone>

        <div className="rzone z-mid">
          <div className="rmitte">
            <div className="zonenpaar">
              <div className="zonenname">Leader</div>
              {leader ? (
                <span className="platz" data-platz="leader">
                  <Bild id={leader} breite={120} hoehe={168}
                        className={"bkarte leader" + (s.leaderGerestet ? " gerestet" : "")}
                        alt={(namen[leader] || {}).n || leader} />
                  {/* Der Slot 99xx meint den Leader. */}
                  <AngelegtesDon n={angelegt[99] || 0} />
                </span>
              ) : (
                <Stapel n={0} />
              )}
            </div>
            <div className="zonenpaar">
              <div className="zonenname">Stage</div>
              {s.stagekarten && s.stagekarten.length ? (
                <Bild id={s.stagekarten[0]} breite={120} hoehe={168}
                      className="bkarte" alt={s.stagekarten[0]} />
              ) : (
                <Stapel n={don.stage || 0} />
              )}
            </div>
          </div>
        </div>

        <div className="zonenpaar z-deck">
          <div className="zonenname">Deck</div>
          <Stapel n={don.deck || 0} />
        </div>

        <div className="zonenpaar z-dond">
          <div className="zonenname">Don-Deck</div>
          <Stapel n={don.donDeck || 0} art="don" />
        </div>

        <Zone
          name={`Cost Area · ${don.aktiv || 0} active, ${don.gerastet || 0} rested`}
          feld
          className="z-cost"
        >
          <div className="donzone">
            <DonZone aktiv={don.aktiv || 0} gerastet={don.gerastet || 0} />
          </div>
        </Zone>

        <div className="zonenpaar z-trash">
          <div className="zonenname">Trash</div>
          <Stapel n={s.trash ? s.trash.length : don.trash || 0} />
        </div>
      </div>

      <div className="z-hand">
        <div className="zonenname" style={{ marginTop: 8 }}>Hand</div>
        <div className="rhand">
          {hand.length ? (
            hand.map((k, i) => (
              <Bild key={k + i} id={k} breite={120} hoehe={168}
                    className="bkarte" alt={(namen[k] || {}).n || k} />
            ))
          ) : (
            <span className="brettleer">empty hand</span>
          )}
        </div>
      </div>
    </div>
  );
}

/** Eine im laufenden Kampf zerstoerte Karte, verblasst an ihrem alten Platz. */
function Geist({ id, namen }) {
  return (
    <span className="platz geist" data-platz="geist" aria-hidden="true">
      <Bild id={id} breite={120} hoehe={168} className="bkarte gerestet"
            alt={((namen[id] || {}).n || id) + ", destroyed"} />
    </span>
  );
}

/** Die Karte eines Pfeilendes im Brett suchen: Seite, dann Platz. */
function pfeilKarte(ebene, ende) {
  if (!ebene || !ende) return null;
  const platz = ende.geist ? "geist" : ende.platz;
  if (platz === null || platz === undefined) return null;
  for (const seite of ebene.querySelectorAll("[data-seite]")) {
    if (seite.dataset.seite !== ende.wer) continue;
    return seite.querySelector(`[data-platz="${platz}"] .bkarte`);
  }
  return null;
}

// Abstand der Pfeilspitze vom Mittelpunkt des Ziels, in Pixeln bei Zoom 1. Die Spitze
// soll auf der Karte liegen, aber ihr Bild nicht ganz verdecken.
const PFEIL_VORSPRUNG = 14;
// Wie weit der Bogen seitlich ausholt, als Anteil der Strecke. Ein gerader Pfeil lief
// zwischen den Brettern oft genau ueber andere Karten.
const PFEIL_BOGEN = 0.12;

/**
 * Der Angriffspfeil, als SVG Ebene ueber beiden Brettern.
 *
 * Gemessen wird nach jedem Schritt und bei jeder Groessenaenderung: die Lage der Karten
 * haengt an Zoom, Fensterbreite und daran, ob eine Karte gerade quer liegt. Die Ebene
 * liegt im rollbaren Brettcontainer und ist so gross wie sein Inhalt, rollt also mit.
 * Der Pfeil steht in hellem Blau mit dunklem Saum (eine Akzentfarbe).
 */
function Angriffspfeil({ angriff, ebeneRef, zoom, schritt }) {
  const [linie, setLinie] = useState(null);

  useLayoutEffect(() => {
    const ebene = ebeneRef.current;
    if (!angriff || !ebene) { setLinie(null); return; }

    const messen = () => {
      const von = pfeilKarte(ebene, angriff.von);
      const auf = pfeilKarte(ebene, angriff.auf);
      if (!von || !auf) { setLinie(null); return; }
      const e = ebene.getBoundingClientRect();
      const lage = (el) => {
        const r = el.getBoundingClientRect();
        return {
          x: r.left - e.left + ebene.scrollLeft, y: r.top - e.top + ebene.scrollTop,
          b: r.width, h: r.height,
        };
      };
      setLinie({ von: lage(von), auf: lage(auf), breite: ebene.scrollWidth, hoehe: ebene.scrollHeight });
    };

    messen();
    const beobachter = new ResizeObserver(messen);
    beobachter.observe(ebene);
    // Eine gerestete Karte dreht sich animiert; danach noch einmal messen, damit der
    // Rahmen um das Ziel die endgueltige Lage trifft.
    const nachher = setTimeout(messen, 350);
    return () => { beobachter.disconnect(); clearTimeout(nachher); };
  }, [angriff, ebeneRef, zoom, schritt]);

  if (!linie) return null;
  const { von, auf } = linie;
  const x1 = von.x + von.b / 2, y1 = von.y + von.h / 2;
  const mx = auf.x + auf.b / 2, my = auf.y + auf.h / 2;
  const dx = mx - x1, dy = my - y1;
  const laenge = Math.hypot(dx, dy) || 1;
  const vor = Math.min(PFEIL_VORSPRUNG * zoom, laenge / 3);
  const x2 = mx - (dx / laenge) * vor, y2 = my - (dy / laenge) * vor;
  // Kontrollpunkt seitlich der Mitte, immer zur selben Seite gebogen.
  const cx = (x1 + x2) / 2 - (dy / laenge) * laenge * PFEIL_BOGEN;
  const cy = (y1 + y2) / 2 + (dx / laenge) * laenge * PFEIL_BOGEN;
  const pfad = `M ${x1} ${y1} Q ${cx} ${cy} ${x2} ${y2}`;
  const rahmen = (r, dick) => (
    <rect x={r.x - 3} y={r.y - 3} width={r.b + 6} height={r.h + 6} rx={5}
          fill="none" stroke="var(--angriff)" strokeWidth={dick} />
  );

  return (
    <svg className="angriffspfeil" width={linie.breite} height={linie.hoehe} aria-hidden="true">
      <defs>
        <marker id="pfeilspitze" viewBox="0 0 10 10" refX="7" refY="5"
                markerWidth="4.5" markerHeight="4.5" orient="auto-start-reverse">
          <path d="M 0 0 L 10 5 L 0 10 z" fill="var(--angriff)" />
        </marker>
      </defs>
      {rahmen(von, 1.5)}
      {rahmen(auf, 2.5)}
      {/* Dunkler Saum unter dem Pfeil, damit er auf hellen Kartenbildern lesbar bleibt. */}
      <path d={pfad} fill="none" stroke="var(--grund)" strokeOpacity="0.75"
            strokeWidth={7} strokeLinecap="round" />
      <path d={pfad} fill="none" stroke="var(--angriff)" strokeWidth={3.5}
            strokeLinecap="round" markerEnd="url(#pfeilspitze)" />
    </svg>
  );
}

/** Ereignisart aus der Zeile ableiten, fuer das Etikett vor dem Zug. */
function ereignisart(text) {
  if (/Leader is|Chose to go|Will select turn order/i.test(text)) return "start";
  if (/Has Connected|Version is|Waiting for/i.test(text)) return "info";
  if (/zieht|Drew card|Draw \d/i.test(text)) return "draw";
  if (/attacking|hit for|Destroyed|Attack Fails|Counter|\bvs\b/i.test(text)) return "combat";
  return "effect";
}

/* Steuerzeichen als SVG statt als Unicode. Zeichen wie U+25B6 rendert manches
   Geraet, allen voran iOS, als farbiges Emoji; die Leiste sah dann nach Chat aus
   statt nach Wiedergabe. Ein Pfad erbt dagegen die Textfarbe und bleibt ueberall
   gleich. */
function Symbol({ art }) {
  const gemeinsam = {
    width: 13, height: 13, viewBox: "0 0 16 16",
    fill: "currentColor", "aria-hidden": "true",
    style: { display: "block" },
  };
  if (art === "anfang") {
    return (
      <svg {...gemeinsam}>
        <path d="M3 2h2v12H3zM14 2.5v11a.5.5 0 0 1-.77.42L6 9.42v4.08a.5.5 0 0 1-.77.42l-.23-.15V2.23l.23-.15A.5.5 0 0 1 6 2.5v4.08l7.23-4.5A.5.5 0 0 1 14 2.5z" />
      </svg>
    );
  }
  if (art === "ende") {
    return (
      <svg {...gemeinsam}>
        <path d="M11 2h2v12h-2zM2 2.5v11a.5.5 0 0 0 .77.42L10 9.42v4.08a.5.5 0 0 0 .77.42l.23-.15V2.23l-.23-.15A.5.5 0 0 0 10 2.5v4.08L2.77 2.08A.5.5 0 0 0 2 2.5z" />
      </svg>
    );
  }
  if (art === "zurueck") {
    return (
      <svg {...gemeinsam}>
        <path d="M12 2.5v11a.5.5 0 0 1-.77.42l-8.5-5.5a.5.5 0 0 1 0-.84l8.5-5.5A.5.5 0 0 1 12 2.5z" />
      </svg>
    );
  }
  if (art === "vor") {
    return (
      <svg {...gemeinsam}>
        <path d="M4 2.5v11a.5.5 0 0 0 .77.42l8.5-5.5a.5.5 0 0 0 0-.84l-8.5-5.5A.5.5 0 0 0 4 2.5z" />
      </svg>
    );
  }
  if (art === "pause") {
    return (
      <svg {...gemeinsam}>
        <path d="M4 2.5h3v11H4zM9 2.5h3v11H9z" />
      </svg>
    );
  }
  // spielen
  return (
    <svg {...gemeinsam}>
      <path d="M4.5 2.4v11.2a.6.6 0 0 0 .92.5l8.6-5.6a.6.6 0 0 0 0-1L5.42 1.9a.6.6 0 0 0-.92.5z" />
    </svg>
  );
}

// Die kleinste Stufe heisst "Mobile" statt "70 %". Sie ist keine Zoomstufe unter
// anderen, sondern die Groesse, auf die das Telefonlayout ausgelegt ist.
const ZOOMSTUFEN = [0.7, 1, 1.3, 1.6, 2];
const zoomName = (z) => (z === 0.7 ? "Mobile" : Math.round(z * 100) + "%");
const TEMPO = [0.5, 1, 2, 4];

function Kartenband({ karten, namen }) {
  if (!karten || !karten.length) return null;
  return (
    <span className="kartenband">
      {karten.slice(0, 3).map((k, i) => (
        <Kartenbild key={k + i} id={k} breite={16} alt={(namen[k] || {}).n || k} />
      ))}
    </span>
  );
}

/**
 * @param eigenerLeader Kartennummer des Leaders, den der betrachtete Spieler
 *   gespielt hat. Der Ladder Name taugt zur Zuordnung nicht: im Log stehen die
 *   Spielnamen, und die sind andere. Ueber den Leader geht es zuverlaessig.
 *
 * Fuer "Analyze my replay" kommen Zeilen und Analyse direkt aus dem Speicher der Seite
 * (zeilenDirekt, analyseDirekt), statt sie zu holen; eigenerName legt dort die eigene
 * Seite fest, auch im Mirror.
 */
function Replay({ pfad, namen, eigenerLeader, zurueck, zeilenDirekt, analyseDirekt, eigenerName }) {
  const direkt = zeilenDirekt !== undefined;
  const [zeilen, setZeilen] = useState(direkt ? zeilenDirekt : null);
  const [i, setI] = useState(0);
  const [zoom, setZoom] = useState(() =>
    typeof window !== "undefined" && window.innerWidth < 720 ? 0.7 : 1
  );
  const [tempo, setTempo] = useState(1);
  const [laeuft, setLaeuft] = useState(false);
  const [logOffen, setLogOffen] = useState(false);
  const [analyse, setAnalyse] = useState(null);
  const listeRef = useRef(null);
  const ebeneRef = useRef(null);

  /* Die Analyse aus Metacoach liegt neben dem Replay, wenn es eine gibt; sonst bleibt
     der Viewer wie er war. */
  useEffect(() => {
    if (direkt) {
      setAnalyse(analyseDirekt || null);
      return undefined;
    }
    let abgebrochen = false;
    setAnalyse(null);
    holen("analyse/" + dateiname(pfad))
      .then((a) => !abgebrochen && setAnalyse(a))
      .catch(() => !abgebrochen && setAnalyse(null));
    return () => {
      abgebrochen = true;
    };
  }, [pfad, direkt, analyseDirekt]);

  useEffect(() => {
    if (direkt) {
      setZeilen(zeilenDirekt);
      setI(0);
      return undefined;
    }
    let abgebrochen = false;
    setZeilen(null);
    setI(0);
    holen("replays/" + dateiname(pfad))
      .then((d) => !abgebrochen && setZeilen(d.zeilen || []))
      .catch(() => !abgebrochen && setZeilen(false));
    return () => {
      abgebrochen = true;
    };
  }, [pfad, direkt, zeilenDirekt]);

  const { schritte, leader, zuege } = useMemo(
    () => (zeilen ? schritteBauen(zeilen) : { schritte: [], leader: {}, zuege: 0 }),
    [zeilen]
  );

  /* Abspielen, Schritt fuer Schritt. Am Ende haelt es von selbst an. */
  useEffect(() => {
    if (!laeuft || !schritte.length) return;
    const uhr = setTimeout(() => {
      setI((n) => {
        if (n >= schritte.length - 1) {
          setLaeuft(false);
          return n;
        }
        return n + 1;
      });
    }, 700 / tempo);
    return () => clearTimeout(uhr);
  }, [laeuft, tempo, i, schritte.length]);

  /* Tastatur: Leertaste spielt, Pfeile einen Schritt, Bild springt zehn. */
  useEffect(() => {
    function taste(e) {
      if (e.target.matches("input, textarea, select")) return;
      const max = schritte.length - 1;
      if (e.key === " ") { e.preventDefault(); setLaeuft((l) => !l); }
      else if (e.key === "ArrowRight") setI((n) => Math.min(max, n + 1));
      else if (e.key === "ArrowLeft") setI((n) => Math.max(0, n - 1));
      else if (e.key === "PageDown") setI((n) => Math.min(max, n + 10));
      else if (e.key === "PageUp") setI((n) => Math.max(0, n - 10));
    }
    window.addEventListener("keydown", taste);
    return () => window.removeEventListener("keydown", taste);
  }, [schritte.length]);

  /* Die laufende Zeile in der Liste sichtbar halten. */
  useEffect(() => {
    if (!logOffen || !listeRef.current) return;
    const el = listeRef.current.querySelector('[data-jetzt="1"]');
    if (el) el.scrollIntoView({ block: "nearest" });
  }, [i, logOffen]);

  if (zeilen === null) {
    return <p className="laedt">Loading replay ...</p>;
  }
  if (zeilen === false || !schritte.length) {
    return (
      <>
        {zurueck ? (
          <button type="button" onClick={zurueck} className="knopf leise zurueck-knopf">
            <Zeichen name="links" groesse={16} />Back
          </button>
        ) : null}
        <p className="leer-satz">No replay stored for this game. The client only uploads part of them.</p>
      </>
    );
  }

  const nr = Math.min(i, schritte.length - 1);
  const jetzt = schritte[nr];
  const spieler = eigenerName && Object.hasOwn(leader, eigenerName)
    ? eigenerName
    : Object.entries(leader).find(([, k]) => k === eigenerLeader)?.[0];
  const seiten = [...new Set(schritte.flatMap((s) => Object.keys(s.stand)))]
    .sort((a, b) => (a === spieler ? 1 : b === spieler ? -1 : 0));

  // Auf dem Telefon zaehlt Treffsicherheit, nicht Vollstaendigkeit. Dort bleiben
  // Zurueck, ein Schritt vor und zurueck, Abspielen; Tempo und Zoom stecken je in
  // einem Umschalter, der die Stufen durchgeht. Die Knoepfe sind dort 44 Pixel gross.
  const knopf = "knopf rand rknopf";
  // Beide Klassen setzen `display`, genau wie der Grundknopf. Ohne das Ausrufezeichen
  // entscheidet die Reihenfolge im erzeugten CSS, und die Sprungknoepfe standen auf
  // dem Telefon wieder da.
  const nurGross = " !hidden sm:!inline-flex";
  const nurKlein = " sm:!hidden";
  const weiter = (liste, wert) => liste[(liste.indexOf(wert) + 1) % liste.length];

  return (
    <div className="brett" style={{ "--sk": zoom }}>
      <div className="r-steuer">
        {zurueck ? (
          <button type="button" onClick={zurueck} className="knopf leise">
            <Zeichen name="links" groesse={16} />Back
          </button>
        ) : null}

        <span className="gruppe">
          <button type="button" className={knopf + nurGross}
                  disabled={nr <= 0} onClick={() => setI(0)}
                  aria-label="first step"><Symbol art="anfang" /></button>
          <button type="button" className={knopf}
                  disabled={nr <= 0} onClick={() => setI((n) => Math.max(0, n - 1))}
                  aria-label="previous step"><Symbol art="zurueck" /></button>
          <button type="button" className={knopf + " voll"} aria-pressed={laeuft}
                  onClick={() => setLaeuft((l) => !l)}
                  aria-label={laeuft ? "pause" : "play"}>
            <Symbol art={laeuft ? "pause" : "spielen"} />
          </button>
          <button type="button" className={knopf}
                  disabled={nr >= schritte.length - 1}
                  onClick={() => setI((n) => Math.min(schritte.length - 1, n + 1))}
                  aria-label="next step"><Symbol art="vor" /></button>
          <button type="button" className={knopf + nurGross}
                  disabled={nr >= schritte.length - 1}
                  onClick={() => setI(schritte.length - 1)}
                  aria-label="last step"><Symbol art="ende" /></button>
        </span>

        <span className={"gruppe" + nurGross}>
          {TEMPO.map((t) => (
            <button key={t} type="button" className={knopf + " z"} aria-pressed={tempo === t}
                    onClick={() => setTempo(t)}>
              {t === 0.5 ? "\u00BDx" : t + "x"}
            </button>
          ))}
        </span>

        <span className={"gruppe" + nurGross}>
          {ZOOMSTUFEN.map((z) => (
            <button key={z} type="button" className={knopf} aria-pressed={zoom === z}
                    onClick={() => setZoom(z)}>
              {zoomName(z)}
            </button>
          ))}
        </span>

        {/* Auf dem Telefon je ein Umschalter statt einer Reihe. */}
        <button type="button" className={knopf + nurKlein} aria-pressed={tempo !== 1}
                onClick={() => setTempo((t) => weiter(TEMPO, t))}>
          {tempo === 0.5 ? "\u00BDx" : tempo + "x"}
        </button>
        <button type="button" className={knopf + nurKlein} aria-pressed={zoom !== 1}
                onClick={() => setZoom((z) => weiter(ZOOMSTUFEN, z))}>
          {zoomName(zoom)}
        </button>

        <span className="r-stand">
          {nr + 1} / {schritte.length}
          <span className="hidden sm:inline">
            {" "}&middot; turn {jetzt.zug} / {zuege}
          </span>
        </span>

        <button type="button" className={knopf + " ml-auto"} aria-pressed={logOffen}
                onClick={() => setLogOffen((o) => !o)}>
          {logOffen ? "Hide events" : "Events"}
        </button>
      </div>

      {analyse ? (
        <ReplayAnalyse analyse={analyse} schritte={schritte} leader={leader} spieler={spieler}
                       nr={nr} setI={setI} knopf={knopf} />
      ) : null}

      {/* Die laufende Zeile steht immer da, auch wenn die Liste zu ist. */}
      <p className="r-jetzt">
        {jetzt.wer ? (
          <span className={"wer" + (jetzt.wer === spieler ? " eigen" : "")}>{jetzt.wer.split("#")[0]}</span>
        ) : null}
        <span className={jetzt.wer ? undefined : "blass"}>{jetzt.text}</span>
        <Kartenband karten={jetzt.karten} namen={namen} />
      </p>

      <div className={"r-raster" + (logOffen ? " mit-log" : "")}>
        <div ref={listeRef} className={"r-log" + (logOffen ? "" : " hidden")}>
          <div className="ereignisse">
            {schritte.map((s, j) => {
              const art = ereignisart(s.text);
              const dran = j === nr;
              return (
                <button
                  key={j}
                  type="button"
                  data-jetzt={dran ? "1" : "0"}
                  onClick={() => setI(j)}
                  className={"ereignis " + art + (dran ? " jetzt" : "") + (j > nr ? " spaeter" : "")}
                >
                  <div className="art">
                    <span className={"etikett art-" + art + (art === "combat" ? " akzent" : "")}>{art}</span>
                    <span>turn {s.zug}</span>
                  </div>
                  <div className="text">
                    {s.wer ? (
                      <span className={"wer" + (s.wer === spieler ? " eigen" : "")}>{s.wer.split("#")[0]}</span>
                    ) : null}
                    {s.text}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        <div ref={ebeneRef} className="r-ebene">
          {seiten.map((n, k) => (
            <Brett
              key={n}
              wer={n}
              stand={jetzt.stand[n]}
              leader={leader[n]}
              namen={namen}
              eigen={n === spieler}
              gedreht={k === 0}
              amZug={jetzt.amZug === n}
              geist={jetzt.angriff?.auf?.geist && jetzt.angriff.auf.wer === n
                ? jetzt.angriff.auf : null}
            />
          ))}
          <Angriffspfeil angriff={jetzt.angriff} ebeneRef={ebeneRef} zoom={zoom} schritt={nr} />
        </div>
      </div>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Mulligan je Gegner aus Metacoach (vom Bazzite nach public/mulligan/ gepusht): fuer
   den gewaehlten Leader, Gegner und Sitz behaltene gegen gemischte Haende und je Karte
   der Starthand die echte Winrate. "Top players" heisst beide Spieler ab 2000 Bounty.
   -------------------------------------------------------------------------- */

const MULLIGAN_ABSTAND = 3;
// Skala der Hantel wie in Metacoach: 30 bis 80 %, Strich bei 50 %.
const HANTEL_UNTEN = 30;
const HANTEL_OBEN = 80;

/** Winrate mit (gefuellt) gegen ohne (Ring). */
function Hantel({ mit, ohne }) {
  const x = (v) => Math.max(0, Math.min(100, ((v - HANTEL_UNTEN) / (HANTEL_OBEN - HANTEL_UNTEN)) * 100));
  const a = x(mit);
  const b = x(ohne);
  return (
    <span className="hantel" aria-hidden="true">
      <span className="mitte" style={{ left: x(50) + "%" }} />
      <span className="spanne" style={{ left: Math.min(a, b) + "%", width: Math.abs(a - b) + "%" }} />
      <span className="punkt ohne" style={{ left: b + "%" }} />
      <span className="punkt mit" style={{ left: a + "%" }} />
    </span>
  );
}

function MulliganJeGegner({ leaderId, namen }) {
  const [daten, setDaten] = useState(undefined);
  const [gegner, setGegner] = useState("alle");
  const [sitz, setSitz] = useState("first");
  const [stufe, setStufe] = useState("feld");

  useEffect(() => {
    let ab = false;
    setDaten(undefined);
    setGegner("alle");
    holen("mulligan/" + leaderId + ".json.gz")
      .then((d) => !ab && setDaten(d))
      .catch(() => !ab && setDaten(null));
    return () => { ab = true; };
  }, [leaderId]);

  if (daten === undefined) return <Abschnitt titel="Mulligan by matchup"><p className="laedt">Loading mulligan data ...</p></Abschnitt>;
  if (daten === null) {
    return (
      <Abschnitt titel="Mulligan by matchup">
        <p className="leer-satz">No per matchup mulligan data for this leader yet.</p>
      </Abschnitt>
    );
  }
  const mindest = daten.grenzen?.min_zelle ?? 30;
  const name = (id) => (id === "alle" ? "All opponents" : (namen[id] || {}).n || id);
  const liste = Object.entries(daten.gegner)
    .filter(([g, e]) => g === "alle" || e.first || e.second)
    .sort(([a, x], [b, y]) => (a === "alle" ? -1 : b === "alle" ? 1 :
      (y.partien.first + y.partien.second) - (x.partien.first + x.partien.second)));
  const eintrag = daten.gegner[gegner] || daten.gegner.alle;
  const m = eintrag?.[sitz]?.[stufe] || (stufe === "spitze" ? null : eintrag?.[sitz]?.feld);
  const wr = (w, n) => (n >= mindest && w !== null ? w.toFixed(1) + " %" : "\u2013");
  const karten = (m?.karten || [])
    .map((k) => ({ ...k, abstand: k.behalten >= mindest && k.weg >= mindest ? k.wr_behalten - k.wr_weg : null }))
    .sort((a, b) => (b.abstand ?? -99) - (a.abstand ?? -99));
  const gut = karten.filter((k) => k.abstand !== null && k.abstand >= MULLIGAN_ABSTAND).slice(0, 3);
  const schlecht = karten.filter((k) => k.abstand !== null && k.abstand <= -MULLIGAN_ABSTAND).slice(-3).reverse();
  const nameK = (id) => (namen[id] || {}).n || id;
  const und = (l) => l.length <= 1 ? l.join("") : l.slice(0, -1).join(", ") + " or " + l[l.length - 1];

  return (
    <Abschnitt titel="Mulligan by matchup">
      <div className="steuer eins">
        <label className="fl eng wahlfeld">
          <span>Opponent</span>
          <select className="feld" value={gegner} onChange={(e) => setGegner(e.target.value)}>
            {liste.map(([g, e]) => (
              <option key={g} value={g}>
                {name(g)}{g !== "alle" ? " " + g : ""} ({fmtZahl((e.partien.first || 0) + (e.partien.second || 0))} games)
              </option>
            ))}
          </select>
        </label>
        <div className="fl eng"><span>Seat</span><Sitzwahl wert={sitz} setzen={setSitz} /></div>
        <div className="fl eng"><span>Players</span>
          <Schalter paare={[["feld", "All players"], ["spitze", "Top players"]]} wert={stufe} setzen={setStufe} label="Players" />
        </div>
      </div>
      <div style={{ height: 18 }} />

      {!m ? (
        <p className="leer-satz">Not enough games for this matchup, seat and group. Try All players or All opponents.</p>
      ) : (
        <>
          <ul className="rat-zeilen">
            {gut.length ? (
              <li><Zeichen name="karte" /><span className="label">Keep</span>
                <p>Keep hands with <b>{und(gut.map((k) => nameK(k.karte)))}</b>.</p></li>
            ) : null}
            {schlecht.length ? (
              <li><Zeichen name="karte" /><span className="label">Mulligan</span>
                <p>With <b>{und(schlecht.map((k) => nameK(k.karte)))}</b>, mulligan more often.</p></li>
            ) : null}
            {!gut.length && !schlecht.length ? (
              <li><Zeichen name="karte" /><span className="label">Opening hand</span>
                <p>No card makes a clear difference here.</p></li>
            ) : null}
          </ul>
          <p className="lesart">
            Kept the opening hand: <span className="z">{fmtZahl(m.behalten)}</span> games, win rate{" "}
            <span className="z">{wr(m.wr_behalten, m.behalten)}</span>. Mulliganed: <span className="z">{fmtZahl(m.weg)}</span> games,
            win rate <span className="z">{wr(m.wr_weg, m.weg)}</span>. Real results from the ladder replays, computed by
            Metacoach; a dash means fewer than {mindest} games.
          </p>
          <div className="tafel-spalten spalten mull" style={{ marginTop: 16 }}>
            <span>Nr</span><span /><span>Card in opening hand</span>
            <span className="rechts">Kept</span><span className="rechts">Win rate kept</span>
            <span style={{ textAlign: "center" }}>Kept vs mull.</span>
            <span className="rechts">Mulliganed</span><span className="rechts">Win rate mulligan</span>
          </div>
          <ol className="tafel mull">
            {karten.map((k, i) => {
              const keep = k.abstand !== null && k.abstand >= MULLIGAN_ABSTAND;
              const mull = k.abstand !== null && k.abstand <= -MULLIGAN_ABSTAND;
              const kl = (an) => (k.abstand === null ? "wr leer" : an ? "wr gut" : "wr");
              return (
                <li key={k.karte} className={"zeile" + (keep || mull ? " rat" : "")}>
                  <div className="vorn">
                    <span className="nr">{nr2(i + 1)}</span>
                    <Kartenbild id={k.karte} breite={26} vorschau name={nameK(k.karte)} />
                    <span className="name gegner"><b>{nameK(k.karte)}</b><span className="kartennr">{k.karte}</span></span>
                    <span className="z zahlzelle z-b">{fmtZahl(k.behalten)}</span>
                    <span className={"z zahlzelle z-wrb " + kl(keep)} data-label="Kept">{wr(k.wr_behalten, k.behalten)}</span>
                    {k.abstand === null ? <span className="hantel" /> : <Hantel mit={k.wr_behalten} ohne={k.wr_weg} />}
                    <span className="z zahlzelle z-w">{fmtZahl(k.weg)}</span>
                    <span className={"z zahlzelle z-wrw " + kl(mull)} data-label="Mull.">{wr(k.wr_weg, k.weg)}</span>
                    <span className="meta-handy">kept {fmtZahl(k.behalten)} · mulliganed {fmtZahl(k.weg)}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="lesart">
            Filled dot: win rate when the card was kept in the opening hand; ring: when that hand was mulliganed.
            Scale {HANTEL_UNTEN} to {HANTEL_OBEN} %, the tick is 50 %. Highlighted rows differ by {MULLIGAN_ABSTAND} points or more.
          </p>
        </>
      )}
    </Abschnitt>
  );
}

/* Was neu ist: ein Eintrag je Tag aus src/changelog.js, neueste oben. */
function Changelog() {
  const datum = (iso) =>
    new Date(iso + "T12:00:00Z").toLocaleDateString("en-GB", { day: "numeric", month: "long", year: "numeric" });
  return (
    <>
      <section className="vorspann">
        <h1>Changelog</h1>
        <p className="lead">What changed on Fiesta, one entry per day, newest first.</p>
      </section>
      <Abschnitt titel="Changes">
        <ol className="chronik">
          {CHANGELOG.map((e) => (
            <li key={e.tag}>
              <h2>{datum(e.tag)}</h2>
              <ul>
                {e.punkte.map((p, i) => <li key={i}>{p}</li>)}
              </ul>
            </li>
          ))}
        </ol>
      </Abschnitt>
    </>
  );
}

/* --------------------------------------------------------------------------
   Die Analyse aus Metacoach: Siegchance ueber die Partie, Accuracy beider Spieler,
   die Note am laufenden Schritt und ein Sprung zum naechsten Fehler. Alles ist eine
   Schaetzung aus dem Wertnetz von Metacoach, ausser beim Mulligan (echte Winrate).
   -------------------------------------------------------------------------- */

const NOTE_TEXT = {
  best: "Best", excellent: "Excellent", good: "Good",
  inaccuracy: "Inaccuracy", mistake: "Mistake", blunder: "Blunder",
};
const WAHL_TEXT = {
  leader: "attacked the leader", character: "attacked the character", nehmen: "took the damage",
  countern: "countered", blocken: "blocked", behalten: "kept the hand", weggemischt: "mulliganed",
};
const BESSER_TEXT = {
  leader: "attack the leader", character: "attack the character", nehmen: "take the damage",
  countern: "counter", blocken: "block", behalten: "keep", weggemischt: "mulligan",
};
const ART_TEXT = { angriff: "Attack", abwehr: "Defense", mulligan: "Mulligan" };
const ART_ZEICHEN = { angriff: "schwert", abwehr: "schild", mulligan: "karte" };

// Masse der Siegkurve im SVG, gestreckt auf die volle Breite.
const KURVE_BREITE = 1000;
const KURVE_HOEHE = 120;
const KURVE_STRICH = 12;

/** Die Siegchance als Flaeche, 50 % gestrichelt, Fehler als Striche am Boden.
    werte: [{x, v}] mit x von 0 bis 1 und v in Prozent; striche und marke ebenso auf x. */
function Siegkurve({ werte, striche = [], marke = null, hoehe = KURVE_HOEHE, label = "Win chance over the game" }) {
  const px = (x) => (x * KURVE_BREITE).toFixed(1);
  const py = (v) => (hoehe - (v / 100) * hoehe).toFixed(1);
  const linie = werte.map((w) => `${px(w.x)},${py(w.v)}`).join(" ");
  const anfang = px(werte[0].x);
  const ende = px(werte[werte.length - 1].x);
  return (
    <svg className="kurve" viewBox={`0 0 ${KURVE_BREITE} ${hoehe}`} preserveAspectRatio="none" role="img" aria-label={label}>
      <line x1="0" y1={hoehe / 2} x2={KURVE_BREITE} y2={hoehe / 2} stroke="var(--linie-stark)" strokeWidth="1"
            strokeDasharray="4 4" vectorEffect="non-scaling-stroke" />
      <polyline points={`${anfang},${hoehe} ${linie} ${ende},${hoehe}`} fill="var(--akzent-flaeche)" stroke="none" />
      <polyline points={linie} fill="none" stroke="var(--akzent)" strokeWidth="2" vectorEffect="non-scaling-stroke" />
      {striche.map((s, j) => (
        <line key={j} x1={px(s.x)} x2={px(s.x)} y1={hoehe - KURVE_STRICH} y2={hoehe}
              stroke={s.leise ? "var(--text-3)" : "var(--akzent-hell)"} strokeWidth="2" vectorEffect="non-scaling-stroke" />
      ))}
      {marke !== null ? (
        <line x1={px(marke)} x2={px(marke)} y1="0" y2={hoehe} stroke="var(--text)" strokeWidth="1"
              vectorEffect="non-scaling-stroke" />
      ) : null}
    </svg>
  );
}

function ReplayAnalyse({ analyse, schritte, leader, spieler, nr, setI, knopf }) {
  const anker = useMemo(() => ankerBauen(schritte), [schritte]);
  const namen = useMemo(() => spielerZuordnen(analyse, leader, anker.erster), [analyse, leader, anker]);
  const marken = useMemo(() => markenBauen(analyse, anker), [analyse, anker]);
  const eigen = Object.keys(namen).find((k) => namen[k] === spieler) || "1";
  const kurve = useMemo(() => kurveBauen(analyse, anker, eigen), [analyse, anker, eigen]);
  const hier = marken.filter((m) => m.schritt === nr);
  const max = Math.max(1, schritte.length - 1);
  const zurueck = fehlerSuchen(marken, nr, -1);
  const vor = fehlerSuchen(marken, nr, 1);

  // Die Kurve liegt hier auf der Schrittachse des Viewers.
  const werte = kurve.map((k) => ({ x: k.schritt / max, v: k.wert }));
  const striche = marken.filter((m) => FEHLERNOTEN.includes(m.note))
    .map((m) => ({ x: m.schritt / max, leise: String(m.wer) !== eigen }));

  return (
    <div className="r-analyse">
      <div className="r-analyse-kopf">
        <span className="rueck-marke" style={{ margin: 0 }}>Analysis</span>
        {["1", "2"].map((k) => {
          const s = analyse.spieler?.[k];
          if (!s || !namen[k]) return null;
          const fehlerZahl = s.noten ? FEHLERNOTEN.reduce((n, x) => n + (s.noten[x] || 0), 0) : null;
          return (
            <span key={k} className={namen[k] === spieler ? "eigen" : "klein"}>
              {namen[k].split("#")[0]}: accuracy{" "}
              <span className="z">{s.accuracy === null ? "\u2013" : s.accuracy.toFixed(1)}</span>
              {fehlerZahl !== null ? (
                <span className="blass">
                  {" "}&middot; {fehlerZahl} {fehlerZahl === 1 ? "flagged decision" : "flagged decisions"}
                </span>
              ) : null}
            </span>
          );
        })}
        <span className="knopfreihe">
          <button type="button" className={knopf} disabled={zurueck === null}
                  onClick={() => zurueck !== null && setI(zurueck)}>Previous mistake</button>
          <button type="button" className={knopf} disabled={vor === null}
                  onClick={() => vor !== null && setI(vor)}>Next mistake</button>
        </span>
      </div>

      {werte.length > 1 ? <Siegkurve werte={werte} striche={striche} marke={nr / max} hoehe={72} /> : null}
      <p className="lesart" style={{ marginTop: 4 }}>
        {spieler ? spieler.split("#")[0] + "'s" : "Player"} win chance after each turn, estimated by the Metacoach
        model of {String(analyse.modell || "").slice(0, 10)}. Ticks mark inaccuracies, mistakes and blunders.
      </p>

      {hier.map((m, j) => {
        const fehlerNote = FEHLERNOTEN.includes(m.note);
        return (
          <p key={j} className="note">
            <span className={"etikett" + (fehlerNote ? " voll" : m.note === "best" ? " akzent" : "")}>
              {NOTE_TEXT[m.note]}
            </span>{" "}
            {namen[String(m.wer)] ? namen[String(m.wer)].split("#")[0] + " " : ""}
            <b>{WAHL_TEXT[m.wahl] || m.wahl}</b>
            {m.note !== "best" ? (
              <> &middot; better: {BESSER_TEXT[m.beste] || m.beste},{" "}
                {m.art === "mulligan"
                  ? <span className="z">{m.verlust.toFixed(1)} points</span>
                  : <span className="sch">{m.verlust.toFixed(1)} points</span>}
              </>
            ) : null}
            <span className="blass"> &middot; {ART_TEXT[m.art]}, {m.lage}</span>
          </p>
        );
      })}
    </div>
  );
}

/* --------------------------------------------------------------------------
   Book aus Metacoach (specs/features/book-auf-fiesta.md)

   Holt das Verzeichnis der Leader und das Book des gewaehlten Leaders direkt bei
   Metacoach (metacoachHolen), nicht aus dem Repo. Die Saetze kommen aus src/book.js,
   englisch, mit denselben Grenzen wie in Metacoach. Ist Metacoach nicht erreichbar,
   steht nur ein Hinweis da; die anderen Reiter laufen unveraendert.
   -------------------------------------------------------------------------- */

/* Ein Hinweis, warum etwas von Metacoach fehlt, je nach Grund des Fehlers. */
function MetacoachHinweis({ fehler: f, was }) {
  const grund = f?.grund;
  const text = grund === "kaputt"
    ? `The ${was} could not be unlocked. After a password change Metacoach encrypts it again the following night.`
    : `${was[0].toUpperCase() + was.slice(1)} currently unavailable: Metacoach, where it comes from, cannot be reached right now. Everything else on Fiesta works as usual.`;
  return <div className="notiz"><p>{text}</p></div>;
}

/* Ein Satz mit seiner Zahl klein dahinter; Schaetzungen aus dem Wertnetz kursiv mit Raute. */
function BookSatz({ s }) {
  return (
    <li>
      {s.text}
      {s.schaetzung ? <span className="zahl sch">{s.zahl || "estimate"}</span>
        : s.zahl ? <span className="zahl z">{s.zahl}</span> : null}
    </li>
  );
}

/* Eine Hilfezeile im Schritt: Zeichen, Label in Versalien, Saetze. */
function BookZeile({ etikett, saetze, zeichen }) {
  if (!saetze.length) return null;
  return (
    <li className="hilfe-zeile">
      <Zeichen name={zeichen} />
      <span className="label">{etikett}</span>
      <ul className="saetze">
        {saetze.map((s, i) => <BookSatz key={i} s={s} />)}
      </ul>
    </li>
  );
}

/*
 * Ein nummerierter Schritt mit Nummernfeld. Mit liste=false steht freier Inhalt darin.
 * Mit belege (eine Funktion, gebaut erst beim ersten Oeffnen) traegt der Kopf den Knopf
 * "Show evidence" und unter den Zeilen klappt die Rueckseite auf.
 */
function BookSchritt({ marke, titel, unter, id, liste = true, belege, belegTitel, children }) {
  const [offen, setOffen] = useState(false);
  return (
    <li className="schritt" id={id}>
      <span className="schritt-nr" aria-hidden="true">{marke}</span>
      <div style={{ minWidth: 0 }}>
        <div className="schritt-kopf">
          <h3>{titel}{unter ? <span className="don"> · {unter}</span> : null}</h3>
          {belege ? <DrehKnopf offen={offen} label={titel} text umdrehen={() => setOffen((o) => !o)} /> : null}
        </div>
        {liste ? <ul className="hilfe">{children}</ul> : <div className="schritt-text">{children}</div>}
        {belege ? (
          <Rueckseite offen={offen}>
            <RueckMarke>{belegTitel}</RueckMarke>
            {belege()}
          </Rueckseite>
        ) : null}
      </div>
    </li>
  );
}

/* ------------------------------------------------------------ Belege im Guide */

const STUFE_TEXT = { spitze: "top players", feld: "all players" };
const ROLLE_TEXT = { rat: "Advice", zweit: "Next best", halten: "Hold" };
const URTEIL_TEXT = {
  leader: "attack the leader", character: "attack the character",
  countern: "counter", nehmen: "take the damage", gleich: "even",
};
const urteilText = (u) => (u ? URTEIL_TEXT[u] ?? u : "too few cases");
const STRICH_LEER = "\u2013";
const punkte = (w) => (w === null || w === undefined ? STRICH_LEER : vorzeichen(w));
const prozentOder = (w) => (w === null || w === undefined ? STRICH_LEER : bookZahl(w) + " %");

/* Rolle einer Karte als Etikett; ein zweitbester Play aus dem Wertnetz traegt die Raute. */
function RollenEtikett({ rolle, schaetzung }) {
  if (!rolle) return null;
  const klasse = rolle === "rat" ? "etikett voll" : rolle === "zweit" ? "etikett akzent" : "etikett";
  return (
    <span className={klasse + " rolle"}>
      {rolle === "zweit" && schaetzung ? <span className="raute" aria-hidden="true">{"\u25C6"} </span> : null}
      {ROLLE_TEXT[rolle]}
      {rolle === "zweit" && schaetzung ? <span className="nur-sr"> (estimate)</span> : null}
    </span>
  );
}

function ZugBelege({ b, T, mindest, name }) {
  const k = zugBelege(T, b.spitze, b.feld, mindest);
  const angriff = angriffBeleg(T, b.spitze, b.feld);
  const abwehr = abwehrBeleg(T, b.spitze, b.feld);
  const zweit = k.zweit ? k.karten.find((x) => x.karte === k.zweit.karte) : null;
  return (
    <>
      {k.karten.length ? (
        <>
          <h4 className="beleg-titel"><Zeichen name="hand" groesse={15} />Play · cards in hand, {STUFE_TEXT[k.stufe]}</h4>
          <div className="scrollx">
            <table className="tab">
              <thead>
                <tr>
                  <th className="bildzelle"><span className="nur-sr">Image</span></th>
                  <th>Card</th>
                  <th className="rechts">Play rate</th>
                  <th className="rechts" title="Points of win chance from the Metacoach model">Value</th>
                  <th className="rechts">Hands</th>
                </tr>
              </thead>
              <tbody>
                {k.karten.map((x) => (
                  <tr key={x.karte} className={x.rolle ? "markiert" : undefined}>
                    <td className="bildzelle"><Kartenbild id={x.karte} breite={24} vorschau name={name(x.karte)} /></td>
                    <td className="name">
                      <b>{name(x.karte)}</b><small>{x.karte}</small>
                      <RollenEtikett rolle={x.rolle} schaetzung={x.rolle === "zweit" && k.zweit.schaetzung} />
                    </td>
                    <td className="rechts z">{bookZahl(x.rate, 0)} %</td>
                    <td className="rechts">{x.wert === null ? <span className="blass">{STRICH_LEER}</span> : <span className="sch">{punkte(x.wert)}</span>}</td>
                    <td className="rechts z">{fmtZahl(x.n_hand)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="beleg-zeile">
            Next best play:{" "}
            {zweit ? (
              <>
                <b>{name(zweit.karte)}</b>,{" "}
                {k.zweit.schaetzung
                  ? <span className="sch">{punkte(zweit.wert)} points win chance</span>
                  : <span className="z">played {bookZahl(zweit.rate, 0)} %</span>}
              </>
            ) : <span className="blass">none, {k.rat ? "no other card has a value with enough hands" : "there is no advice for this turn"}</span>}
            {k.mehr ? <span className="blass"> · {k.mehr} more cards not shown</span> : null}
          </p>
        </>
      ) : null}

      {angriff ? (
        <>
          <h4 className="beleg-titel"><Zeichen name="schwert" groesse={15} />Attack · opponent has a rested character</h4>
          <div className="scrollx">
            <table className="tab">
              <thead>
                <tr>
                  <th>Players</th>
                  <th className="rechts">On the leader</th>
                  <th className="rechts">Cases</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {["feld", "spitze"].map((st) => {
                  const a = angriff[st];
                  return (
                    <tr key={st}>
                      <th scope="row">{st === "feld" ? "All players" : "Top players"}</th>
                      {a ? (
                        <>
                          <td className="rechts z">{prozentOder(a.leader_anteil)}</td>
                          <td className="rechts z">{fmtZahl(a.n)}</td>
                          <td>{urteilText(a.urteil)} <span className="sch">{punkte(a.q)}</span></td>
                        </>
                      ) : (
                        <td colSpan={3} className="blass">{STRICH_LEER}</td>
                      )}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </>
      ) : null}

      {abwehr ? (
        <>
          <h4 className="beleg-titel"><Zeichen name="schild" groesse={15} />Defend · opponent turn {T}, {STUFE_TEXT[abwehr.stufe]}</h4>
          <div className="scrollx">
            <table className="tab">
              <thead>
                <tr>
                  <th>Your life</th>
                  <th className="rechts">Take</th>
                  <th className="rechts">Counter</th>
                  <th className="rechts">Block</th>
                  <th className="rechts">Cases</th>
                  <th>Verdict</th>
                </tr>
              </thead>
              <tbody>
                {abwehr.zellen.map((z) => (
                  <tr key={z.life}>
                    <th scope="row">{z.life} life</th>
                    <td className="rechts z">{prozentOder(z.nehmen === undefined ? null : Math.round(z.nehmen))}</td>
                    <td className="rechts z">{prozentOder(z.countern === undefined ? null : Math.round(z.countern))}</td>
                    <td className="rechts z">{prozentOder(z.blocken === undefined ? null : Math.round(z.blocken))}</td>
                    <td className="rechts z">{fmtZahl(z.n)}</td>
                    <td>{urteilText(z.urteil)} {z.urteil ? <span className="sch">{punkte(z.q)}</span> : null}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      ) : null}
      <p className="lesart">
        Values are points of win chance from the Metacoach model; a dash means no value, either fewer than {mindest} hands or none from the model.
        Take, counter and block are shares of the attacks on your leader that would hit.
      </p>
    </>
  );
}

function MulliganBelege({ a, mindest, name }) {
  const m = mulliganBelege(a, mindest);
  if (!m) return <p className="leer-satz">No mulligan numbers for this seat.</p>;
  return (
    <>
      <dl className="rueck-zeilen">
        <div><dt>Kept</dt><dd className="z">{prozentOder(m.wr_behalten)} <span className="blass">({fmtZahl(m.behalten)})</span></dd></div>
        <div><dt>Mulliganed</dt><dd className="z">{prozentOder(m.wr_weg)} <span className="blass">({fmtZahl(m.weg)})</span></dd></div>
      </dl>
      {m.karten.length ? (
        <div className="scrollx" style={{ marginTop: 12 }}>
          <table className="tab mull-beleg">
            <thead>
              <tr>
                <th className="bildzelle"><span className="nur-sr">Image</span></th>
                <th>Card in opening hand</th>
                <th className="rechts">Kept</th>
                <th className="rechts">Win rate</th>
                <th className="hantelzelle"><span className="nur-sr">Kept against mulliganed</span></th>
                <th className="rechts">Mulliganed</th>
                <th className="rechts">Win rate</th>
              </tr>
            </thead>
            <tbody>
              {m.karten.map((k) => (
                <tr key={k.karte}>
                  <td className="bildzelle"><Kartenbild id={k.karte} breite={24} vorschau name={name(k.karte)} /></td>
                  <td className="name"><b>{name(k.karte)}</b><small>{k.karte}</small></td>
                  <td className="rechts z">{fmtZahl(k.behalten)}</td>
                  <td className="rechts z">{prozentOder(k.wr_behalten)}</td>
                  <td className="hantelzelle">{k.abstand === null ? <span className="hantel" /> : <Hantel mit={k.wr_behalten} ohne={k.wr_weg} />}</td>
                  <td className="rechts z">{fmtZahl(k.weg)}</td>
                  <td className="rechts z">{prozentOder(k.wr_weg)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
      <p className="lesart">
        Real win rate from the ladder replays, no model. A dash means fewer than {mindest} games. Filled dot: kept,
        ring: mulliganed, scale {HANTEL_UNTEN} to {HANTEL_OBEN} %.
      </p>
    </>
  );
}

function Book({ namen, startLeader }) {
  const [liste, setListe] = useState(undefined);
  const [listeFehler, setListeFehler] = useState(null);
  const [leaderId, setLeaderId] = useState(null);
  const [daten, setDaten] = useState(undefined);
  const [datenFehler, setDatenFehler] = useState(null);
  const [gegner, setGegner] = useState(BOOK_ALLE);
  const [sitz, setSitz] = useState("first");

  useEffect(() => {
    let ab = false;
    metacoachHolen("book", "_leader")
      .then((d) => {
        if (ab) return;
        const l = (d.leader || []).filter((e) => e.leader !== "OP14-020");
        setListe(l);
        setLeaderId((alt) => alt || (l.some((e) => e.leader === startLeader) ? startLeader : l[0]?.leader || null));
      })
      .catch((f) => !ab && (setListe(null), setListeFehler(f)));
    return () => { ab = true; };
  }, [startLeader]);

  useEffect(() => {
    if (!leaderId) return undefined;
    let ab = false;
    setDaten(undefined);
    setDatenFehler(null);
    setGegner(BOOK_ALLE);
    metacoachHolen("book", leaderId)
      .then((d) => !ab && setDaten(d))
      .catch((f) => !ab && (setDaten(null), setDatenFehler(f)));
    return () => { ab = true; };
  }, [leaderId]);

  const name = (id) => (namen[id] || {}).n || id;
  const lead = (
    <p className="lead">
      Turn by turn: what to play, where to attack and when to counter, from the ladder replays, computed by
      Metacoach. Small numbers in italics are estimates from its model; upright numbers are real results.
    </p>
  );
  const kopf = (titel) => <section className="vorspann"><h1>{titel}</h1>{lead}</section>;
  if (liste === undefined) return <>{kopf("Guide")}<p className="laedt">Loading the guide ...</p></>;
  if (liste === null) return <>{kopf("Guide")}<MetacoachHinweis fehler={listeFehler} was="guide" /></>;
  if (!liste.length) return <>{kopf("Guide")}<p className="leer-satz">No leader has a book yet.</p></>;

  const b = daten ? bookAusschnitt(daten, gegner, sitz) : null;
  const mindest = b?.grenzen?.min_zelle ?? BOOK_MIN_ZELLE;
  const zuege = b ? zuegeMitDaten(b) : [];
  const gegnerName = gegner === BOOK_ALLE ? "all opponents" : name(gegner);
  const sonst = b ? unterschiedeSonst(b.unterschiede) : [];
  const springen = (T) => (e) => {
    e.preventDefault();
    document.getElementById("zug-" + T)?.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <>
      {kopf(b ? `${name(b.leader)} against ${gegner === BOOK_ALLE ? "all opponents" : name(gegner)}, ${sitz}` : "Guide")}
      <div className="steuer eins">
        <label className="fl eng wahlfeld">
          <span>Leader</span>
          <select className="feld" value={leaderId || ""} onChange={(e) => setLeaderId(e.target.value)}>
            {liste.map((e) => (
              <option key={e.leader} value={e.leader}>
                {name(e.leader)} {e.leader} ({fmtZahl((e.partien?.first || 0) + (e.partien?.second || 0))} games)
              </option>
            ))}
          </select>
        </label>
        {daten ? (
          <label className="fl eng wahlfeld">
            <span>Opponent</span>
            <select className="feld" value={gegner} onChange={(e) => setGegner(e.target.value)}>
              {gegnerListe(daten).map((g) => (
                <option key={g.gegner} value={g.gegner}>
                  {g.gegner === BOOK_ALLE ? "All opponents" : name(g.gegner) + " " + g.gegner} ({fmtZahl((g.partien.first || 0) + (g.partien.second || 0))} games)
                </option>
              ))}
            </select>
          </label>
        ) : null}
        <Sitzwahl wert={sitz} setzen={setSitz} />
      </div>

      {daten === undefined ? (
        <p className="laedt">Loading the guide ...</p>
      ) : daten === null ? (
        datenFehler?.grund === "fehlt"
          ? <p className="leer-satz" style={{ marginTop: 16 }}>No guide for this leader right now.</p>
          : <MetacoachHinweis fehler={datenFehler} was="guide" />
      ) : !b ? (
        <p className="leer-satz" style={{ marginTop: 16 }}>Not in the guide.</p>
      ) : (
        <>
          {b.rueckfall ? (
            <div className="notiz warn">
              <p>Too few games against {gegnerName} on this seat, so this shows the numbers against all opponents.</p>
            </div>
          ) : null}
          <div className="raster">
            <div style={{ minWidth: 0 }}>
              <Abschnitt titel="Turn by turn">
                <ol className="schritte">
                  <BookSchritt marke={<Zeichen name="karte" groesse={20} />} titel="Mulligan" unter="before turn 1" id="zug-0"
                               belegTitel={"Evidence mulligan · " + sitz}
                               belege={() => <MulliganBelege a={b.feld ?? b.spitze} mindest={mindest} name={name} />}>
                    <BookZeile etikett="Opening hand" zeichen="karte" saetze={[mulliganSatz(b.feld ?? b.spitze, mindest, name)]} />
                  </BookSchritt>
                  {zuege.map((T) => {
                    const z = zugDaten(b, T);
                    const angriff = angriffSatz(T, b.spitze, b.feld);
                    const abwehr = abwehrSatz(T, b.spitze, b.feld);
                    return (
                      <BookSchritt key={T} marke={T} titel={"Turn " + T} id={"zug-" + T}
                                   belegTitel={"Evidence turn " + T}
                                   belege={() => <ZugBelege b={b} T={T} mindest={mindest} name={name} />}
                                   unter={z && z.don !== null && z.don !== undefined ? bookZahl(z.don) + " Don" : ""}>
                        <BookZeile etikett="Play" zeichen="hand" saetze={spielenSaetze(T, b.spitze, b.feld, mindest, name)} />
                        <BookZeile etikett="Attack" zeichen="schwert" saetze={angriff ? [angriff] : []} />
                        <BookZeile etikett="Defend" zeichen="schild" saetze={abwehr ? [abwehr] : []} />
                        <BookZeile etikett="Top players" zeichen="krone" saetze={unterschiedeImZug(b.unterschiede, T).map((u) => spitzeSatz(u, name))} />
                      </BookSchritt>
                    );
                  })}
                </ol>
                {!zuege.length ? <p className="leer-satz">Too few turns on this seat yet.</p> : null}
              </Abschnitt>
              {sonst.length ? (
                <Abschnitt titel="What top players do differently otherwise">
                  <ul className="hilfe">
                    <BookZeile etikett="Top players" zeichen="krone" saetze={sonst.map((u) => spitzeSatz(u, name))} />
                  </ul>
                </Abschnitt>
              ) : null}
            </div>
            <aside className="seitenleiste">
              <div className="leiste-block pikto-block">
                <h3>Signs</h3>
                <ul className="pikto-liste">
                  <li><Zeichen name="karte" />Mulligan</li>
                  <li><Zeichen name="hand" />Play</li>
                  <li><Zeichen name="schwert" />Attack</li>
                  <li><Zeichen name="schild" />Defend</li>
                  <li><Zeichen name="krone" />Top players</li>
                </ul>
              </div>
              <div className="leiste-block lesen">
                <h3>Reading numbers</h3>
                <p><span className="z">99 %</span> upright: a real result from the ladder replays.</p>
                <p><span className="sch">−6.9 points</span> in italics: an estimate from the Metacoach model.</p>
              </div>
              {zuege.length ? (
                <div className="leiste-block sprung-block">
                  <h3>To turn</h3>
                  <div className="sprung">
                    {zuege.map((T) => <a key={T} href={"#zug-" + T} onClick={springen(T)}>{T}</a>)}
                  </div>
                </div>
              ) : null}
              <div className="leiste-block quelle">
                <h3>Source</h3>
                <p>{name(b.leader)} against {gegnerName}, {sitz}: <span className="z">{fmtZahl(b.partien?.[sitz] || 0)}</span> games.</p>
                <p>Model of {datumKurz(b.modell)}, book of {datumKurz(b.stand)}.</p>
                <p>Top players means both players at <span className="z">{fmtZahl(daten?.grenzen?.spitze_bounty ?? 2000)}</span> bounty or more.</p>
              </div>
            </aside>
          </div>
        </>
      )}
    </>
  );
}

/* --------------------------------------------------------------------------
   Analyze my replay (specs/features/eigenes-replay-analysieren.md)

   Das Log einer eigenen Partie wird im Browser gelesen (src/zuglager.js), mit dem
   Wertnetz (src/wertnetz.js) und dem Book von Metacoach bewertet (src/spielbewertung.js).
   Oben stehen Kurve und die nummerierte Tafel der Entscheidungen, darunter aufklappbar
   das Brett des Replay Viewers. Das Log verlaesst den Browser nie: kein Upload, kein
   Speichern; es lebt nur im Zustand dieser Komponente.
   -------------------------------------------------------------------------- */

const LOG_PFAD_MAC = "~/Library/Application Support/com.Batsu.OPTCGSim/CombatLogs/AutoSaved/";
const LOG_PFAD_WINDOWS = "C:\\Users\\<Name>\\AppData\\LocalLow\\Batsu\\OPTCGSim\\CombatLogs\\AutoSaved\\";
const LOG_PFAD_EXPLORER = "%USERPROFILE%\\AppData\\LocalLow\\Batsu\\OPTCGSim\\CombatLogs";
const LOG_GROESSE_MAX = 20 * 1024 * 1024;     // ein Log hat rund 100 KB; mehr ist keines
const UNSICHTBAR_NAME = /[\u200b\u200c\u200d\ufeff]/g;

const LESEGRUND = {
  "keine zwei spieler": "it does not name two players. Is it an OPTCGSim combat log?",
  "kein sieger": "the game has no winner yet (no concede and no lethal hit).",
  "keine zuordnung": "the players could not be matched to the game state.",
  "zu kurz": "the game is too short, fewer than four turns.",
  "log kaputt": "it is damaged or cut off.",
};

/* Kartentabellen aus karten.json: Events, Counter, Kosten (wie karten.tsv in Metacoach). */
function kartenTabellen(namen) {
  const events = new Set();
  const counter = {};
  const kosten = {};
  for (const [id, k] of Object.entries(namen || {})) {
    if (k.a === "e") events.add(id);
    if (typeof k.c === "number") counter[id] = k.c;
    if (typeof k.k === "number") kosten[id] = k.k;
  }
  return { events, counter, kosten };
}

/** Kurve und Entscheidungen des eigenen Spielers aus der Analyse einer Partie. */
function EigeneAnalyse({ analyse, ich, eigenName }) {
  const anderer = ich === "1" ? "2" : "1";
  const s = analyse.spieler[ich];
  const o = analyse.spieler[anderer];
  const fehlerZahl = s?.noten ? FEHLERNOTEN.reduce((n, x) => n + (s.noten[x] || 0), 0) : 0;
  // Der Mulligan zuerst, danach die Partie in ihrer Reihenfolge.
  const eigene = (analyse.entscheidungen || [])
    .filter((e) => String(e.wer) === ich)
    .map((e, i) => ({ e, i }))
    .sort((x, y) => (x.e.art === "mulligan" ? -1 : 0) - (y.e.art === "mulligan" ? -1 : 0) || x.i - y.i)
    .map((x) => x.e);
  const roh = (analyse.kurve || []).map((k) => (ich === "2" ? 100 - k.v1 : k.v1));
  const n = Math.max(1, roh.length - 1);
  const kurve = roh.map((v, i) => ({ x: i / n, v }));
  const halbzug = (e) => {
    if (e.art === "mulligan") return 0;
    const wer = e.art === "abwehr" ? Number(anderer) : Number(ich);
    const i = analyse.kurve.findIndex((k) => k.T === e.T && k.wer === wer);
    return i < 0 ? null : i;
  };
  const striche = eigene.filter((e) => FEHLERNOTEN.includes(e.note)).map(halbzug)
    .filter((i) => i !== null).map((i) => ({ x: i / n }));
  const letzterT = analyse.kurve?.length ? analyse.kurve[analyse.kurve.length - 1].T : 1;

  return (
    <>
      <Abschnitt titel="Analysis">
        <dl className="genau">
          <div>
            <dt>{eigenName}</dt>
            <dd><span className="z gross">{s?.accuracy == null ? "–" : s.accuracy.toFixed(1)}</span>{" "}
              <span className="klein">accuracy{s?.noten ? <> · {fehlerZahl} {fehlerZahl === 1 ? "flagged decision" : "flagged decisions"}</> : null}</span>
            </dd>
          </div>
          <div>
            <dt>Opponent</dt>
            <dd><span className="z gross blass">{o?.accuracy == null ? "–" : o.accuracy.toFixed(1)}</span>{" "}
              <span className="klein">accuracy</span></dd>
          </div>
        </dl>
        {s?.noten ? (
          <div className="noten-zeile">
            {NOTENFOLGE.filter((x) => s.noten[x]).map((x) => (
              <span key={x} className={"etikett" + (FEHLERNOTEN.includes(x) ? " akzent" : "")}>
                <span className="z">{s.noten[x]}</span> {NOTE_TEXT[x].toLowerCase()}
              </span>
            ))}
            {!NOTENFOLGE.some((x) => s.noten[x]) ? <span className="klein">No graded decisions.</span> : null}
          </div>
        ) : null}
      </Abschnitt>

      {kurve.length > 1 ? (
        <Abschnitt titel="Win chance">
          <div className="kurve-huelle">
            <Siegkurve werte={kurve} striche={striche} />
            <div className="kurve-achse"><span>Turn 1</span><span>Turn {letzterT}</span></div>
          </div>
          <p className="lesart">
            {eigenName}'s win chance after each turn, estimated by the Metacoach model
            of {String(analyse.modell || "").slice(0, 10)}. The dashed line is 50 %. Ticks mark inaccuracies,
            mistakes and blunders.
          </p>
        </Abschnitt>
      ) : null}

      {eigene.length ? (
        <Abschnitt titel="Your decisions">
          <div className="tafel-spalten spalten entsch">
            <span>Nr</span><span>Turn</span><span /><span>Grade</span><span>Decision</span><span>Situation</span>
          </div>
          <ol className="tafel entsch">
            {eigene.map((e, i) => {
              const markiert = FEHLERNOTEN.includes(e.note);
              const punkte = e.art === "mulligan"
                ? <span className="z">{e.verlust.toFixed(1)} points</span>
                : <span className="sch">{e.verlust.toFixed(1)} points</span>;
              return (
                <li key={i} className={"zeile" + (markiert ? " fehler" : "")}>
                  <div className="vorn">
                    <span className="nr">{nr2(i + 1)}</span>
                    <span className={"stufe" + (e.art === "abwehr" ? " leise" : "")}
                          title={(e.art === "abwehr" ? "opponent's turn " : "your turn ") + e.T}>
                      {e.art === "mulligan" ? "M" : e.T}
                    </span>
                    <Zeichen name={ART_ZEICHEN[e.art] || "karte"} />
                    <span className="notenkopf">
                      <span className={"etikett" + (markiert ? " voll" : e.note === "best" ? " akzent" : "")}>
                        {NOTE_TEXT[e.note]}
                      </span>
                    </span>
                    <span className="wahltext">
                      <b>{WAHL_TEXT[e.wahl] || e.wahl}</b>
                      {e.note !== "best" ? <> · better: {BESSER_TEXT[e.beste] || e.beste}, {punkte}</> : null}
                    </span>
                    <span className="lage">{ART_TEXT[e.art]}, {e.lage}</span>
                  </div>
                </li>
              );
            })}
          </ol>
          <p className="lesart">
            Points are the win chance lost against the best choice, <span className="raute">◆</span> italic as an
            estimate from the model. A grey turn number is the opponent's turn.
          </p>
        </Abschnitt>
      ) : null}
    </>
  );
}

function EigenesReplay({ namen }) {
  const [text, setText] = useState(null);
  const [eingefuegt, setEingefuegt] = useState("");
  const [dateiName, setDateiName] = useState("");
  const [leseFehler, setLeseFehler] = useState("");
  const [wahl, setWahl] = useState(null);
  const [netzJson, setNetzJson] = useState(undefined);
  const [netzFehler, setNetzFehler] = useState(null);
  const [books, setBooks] = useState(null);
  const [ziehen, setZiehen] = useState(false);
  // null heisst: von selbst offen, wenn es keine Analyse gibt.
  const [brettOffen, setBrettOffen] = useState(null);

  const tabellen = useMemo(() => kartenTabellen(namen), [namen]);
  const kartenDa = tabellen.counter && Object.keys(namen || {}).length > 0;

  const gelesen = useMemo(() => {
    if (text === null) return null;
    const id = (dateiName || "pasted").replace(/\.(log|txt)$/i, "");
    const [grund, zeilen] = partieLesen(text, { id, timestamp: id.slice(0, 10) }, tabellen.events);
    return { grund, partie: zeilen[0] || null };
  }, [text, dateiName, tabellen]);
  const partie = gelesen?.partie || null;
  const eigen = partie ? (wahl ?? eigeneNummer(partie)) : null;

  /* Netz und Books erst holen, wenn ein lesbares Log da ist. */
  useEffect(() => {
    if (!partie) return undefined;
    let ab = false;
    setNetzFehler(null);
    metacoachHolen("netz", "wertnetz")
      .then((d) => !ab && setNetzJson(d))
      .catch((f) => !ab && (setNetzJson(null), setNetzFehler(f)));
    const leader = [...new Set([partie.leader["1"], partie.leader["2"]])];
    Promise.all(leader.map((l) => metacoachHolen("book", l).then((d) => [l, d], (f) => [l, f.grund === "fehlt" ? null : f])))
      .then((paare) => !ab && setBooks(Object.fromEntries(paare)));
    return () => { ab = true; };
  }, [partie]);

  const netz = useMemo(() => {
    if (!netzJson) return null;
    try {
      return netzBauen(netzJson);
    } catch {
      return null;
    }
  }, [netzJson]);

  const nurBooks = useMemo(() => {
    if (!books) return null;
    return Object.fromEntries(Object.entries(books).filter(([, d]) => d && !(d instanceof Error)));
  }, [books]);

  const analyse = useMemo(() => {
    if (!partie || !netz || !nurBooks) return null;
    return partieAnalysieren(partie, netz, nurBooks, tabellen.counter, tabellen.kosten);
  }, [partie, netz, nurBooks, tabellen]);

  /* Zeilen fuer den Viewer. Das eigene Log nennt den Spieler einmal als "[You]" (etwa
     "[You] Will select turn order"); der Viewer machte daraus eine dritte Seite. Gezeigt
     werden deshalb nur Zeilen der beiden Spieler und solche ohne Sprecher. */
  const zeilen = useMemo(() => {
    if (text === null || !partie) return null;
    const spieler = new Set(Object.values(partie.namen).map((n) => String(n).replace(UNSICHTBAR_NAME, "")));
    return eindampfen(text).filter((z) => {
      const m = z.t ? /^\[(.+?)\]/.exec(z.t) : null;
      return !m || spieler.has(m[1]);
    });
  }, [text, partie]);

  const neu = () => {
    setText(null);
    setEingefuegt("");
    setDateiName("");
    setWahl(null);
    setLeseFehler("");
    setBrettOffen(null);
  };

  const dateiLesen = (datei) => {
    if (!datei) return;
    setLeseFehler("");
    if (datei.size > LOG_GROESSE_MAX) {
      setLeseFehler("This file is far too large for a combat log.");
      return;
    }
    datei.text()
      .then((t) => { setWahl(null); setDateiName(datei.name); setText(t); })
      .catch(() => setLeseFehler("The file could not be read."));
  };

  const name = (id) => (namen[id] || {}).n || id;
  const spielerName = (nr) => String(partie?.namen?.[nr] || "Player " + nr).replace(UNSICHTBAR_NAME, "");

  if (text === null || !partie) {
    return (
      <>
        <section className="vorspann">
          <h1>Analyze my replay</h1>
          <p className="lead">
            Open the log of one of your own games and get the same analysis as on the replays here: your accuracy,
            the win chance over the game and a grade for every attack, defense and mulligan.
          </p>
        </section>

        <Abschnitt titel="Three steps">
          <ol className="schritte">
            <BookSchritt marke="1" titel="Find the log" liste={false}>
              <p>OPTCGSim saves every game by itself, one .log file per game, named by date and time.</p>
              <span className="label">Mac</span>
              <code className="pfad">{LOG_PFAD_MAC}</code>
              <p className="klein">In Finder use Go, then Go to Folder, and paste the path.</p>
              <span className="label">Windows</span>
              <code className="pfad">{LOG_PFAD_WINDOWS}</code>
              <p className="klein">The AppData folder is hidden. Type this into the address bar of the File Explorer and press Enter:</p>
              <code className="pfad">{LOG_PFAD_EXPLORER}</code>
              <p className="klein">
                %USERPROFILE% stands for your own user folder, so you do not need to know your user name.
                Then open AutoSaved.
              </p>
            </BookSchritt>
            <BookSchritt marke="2" titel="Or save it from the game" liste={false}>
              <p>After the game, press <b>Download Log</b> in the game and use that file.</p>
            </BookSchritt>
            <BookSchritt marke="3" titel="Open it here" liste={false}>
              <label
                className={"ablage" + (ziehen ? " zieht" : "")}
                onDragOver={(e) => { e.preventDefault(); setZiehen(true); }}
                onDragLeave={() => setZiehen(false)}
                onDrop={(e) => { e.preventDefault(); setZiehen(false); dateiLesen(e.dataTransfer.files?.[0]); }}
              >
                <span>Choose a log file</span>
                <small>or drop it here</small>
                <input type="file" accept=".log,.txt,text/plain" className="nur-sr"
                       onChange={(e) => { dateiLesen(e.target.files?.[0]); e.target.value = ""; }} />
              </label>
              <textarea
                className="feld"
                style={{ minHeight: 96 }}
                value={eingefuegt}
                placeholder="Or paste the whole log here"
                aria-label="Paste the log"
                spellCheck={false}
                onChange={(e) => setEingefuegt(e.target.value)}
              />
              <span>
                <button type="button" className="knopf voll" disabled={!eingefuegt.trim()}
                        onClick={() => { setWahl(null); setDateiName(""); setText(eingefuegt); }}>
                  Analyze pasted log
                </button>
              </span>
              <p className="klein">
                Your log never leaves this browser. It is read and analyzed right here; nothing is uploaded or saved,
                and it is gone when you close the page.
              </p>
            </BookSchritt>
          </ol>
        </Abschnitt>

        {leseFehler ? <p className="meldung fehler">{leseFehler}</p> : null}
        {gelesen && !partie ? (
          <p className="meldung fehler">This log could not be analyzed: {LESEGRUND[gelesen.grund] || gelesen.grund}</p>
        ) : null}
        {!kartenDa ? <p className="meldung">Card data is still loading.</p> : null}
      </>
    );
  }

  const ich = eigen ? String(eigen) : null;
  const meinLeader = ich ? partie.leader[ich] : null;
  const unbekannt = netz
    ? [...new Set(partie.lagen.flatMap((l) => [...(l.b["1"] || []), ...(l.b["2"] || [])]))].filter((k) => !netz.kennt(k))
    : [];
  const leaderUnbekannt = netz ? [partie.leader["1"], partie.leader["2"]].filter((l) => !netz.kenntLeader(l)) : [];
  const bookFehlt = books && meinLeader && books[meinLeader] === null;
  const bookFehler = books && Object.values(books).find((d) => d instanceof Error);
  const s = analyse && ich ? analyse.spieler[ich] : null;
  const anderer = ich === "2" ? "1" : "2";
  const laedtModell = netzJson === undefined || (partie && !books);
  const offen = brettOffen ?? !analyse;

  return (
    <>
      <section className="vorspann">
        <div className="titelzeile" style={{ justifyContent: "space-between", flexWrap: "wrap" }}>
          <h1>Analyze my replay</h1>
          <button type="button" className="knopf rand" onClick={neu}>Analyze another log</button>
        </div>
        <p className="lead" style={{ overflowWrap: "anywhere" }}>
          {dateiName || "pasted log"} · <strong>{name(partie.leader[ich || "1"])}</strong> against{" "}
          <strong>{name(partie.leader[ich ? anderer : "2"])}</strong>
          {s ? <>, {s.first ? "first" : "second"}, {s.sieg ? "won" : "lost"}</> : null}.
        </p>
      </section>

      {!ich ? (
        <div className="wer-war-ich">
          <span>Which player were you?</span>
          {["1", "2"].map((nr) => (
            <button key={nr} type="button" className="knopf rand" onClick={() => setWahl(Number(nr))}>
              {spielerName(nr)} ({name(partie.leader[nr])})
            </button>
          ))}
        </div>
      ) : null}

      {netzJson === null || (netzJson && !netz) ? <MetacoachHinweis fehler={netzFehler} was="analysis" /> : null}
      {bookFehler ? <MetacoachHinweis fehler={bookFehler} was="guide" /> : null}
      {bookFehlt ? (
        <div className="notiz"><p>
          There is no guide for {name(meinLeader)} {meinLeader} yet, so your decisions get no grades.
          The win chance over the game is still shown.
        </p></div>
      ) : null}
      {leaderUnbekannt.length ? (
        <div className="notiz"><p>
          The model has no value of its own for {leaderUnbekannt.map((l) => name(l) + " " + l).join(" and ")} and counts it
          as an other leader.
        </p></div>
      ) : null}
      {unbekannt.length ? (
        <div className="notiz"><p>
          {unbekannt.length === 1 ? "One card" : unbekannt.length + " cards"} of this game {unbekannt.length === 1 ? "is" : "are"} not
          known to the model and {unbekannt.length === 1 ? "counts" : "count"} as an empty slot
          for the win chance: {unbekannt.map((k) => name(k) + " " + k).join(", ")}.
        </p></div>
      ) : null}

      {laedtModell ? (
        <p className="laedt">Loading the model ...</p>
      ) : (
        <>
          {analyse && ich ? <EigeneAnalyse analyse={analyse} ich={ich} eigenName={spielerName(ich).split("#")[0]} /> : null}
          <details className="allezahlen brett-auf" open={offen}
                   onToggle={(e) => setBrettOffen(e.currentTarget.open)}>
            <summary><Zeichen name="dreh" groesse={16} />Replay board</summary>
            {offen ? (
              <Replay
                key={(dateiName || "eingefuegt") + ":" + (ich || "")}
                pfad={null}
                namen={namen}
                eigenerName={ich ? spielerName(ich) : undefined}
                zeilenDirekt={zeilen || []}
                analyseDirekt={analyse}
              />
            ) : null}
          </details>
        </>
      )}
    </>
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

function Spieler({ eintrag, daten, namen, zurueck, replayOeffnen }) {
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
  const nurWr = leader.every((l) => l.partien == null);
  return (
    <>
      <button type="button" onClick={zurueck} className="knopf leise zurueck-knopf">
        <Zeichen name="links" groesse={16} />Leaderboard
      </button>

      <section className="vorspann">
        <h1>{eintrag.name}</h1>
        <dl className="kennzeile">
          <Kennzahl etikett="Rank" kind={<Zaehler wert={eintrag.rang} />} />
          <Kennzahl etikett="Bounty" kind={<span className="z">{fmtZahl(eintrag.bounty)}</span>} />
          {daten ? (
            <>
              <Kennzahl etikett="Win rate" kind={<Zaehler wert={daten.winrate || 0} nachkomma={1} suffix=" %" />} />
              <Kennzahl etikett="Record" kind={<span className="z">{daten.siege} – {daten.niederlagen}</span>} />
            </>
          ) : null}
          {eintrag.quelle === "ocr" ? null : (
            <Kennzahl etikett="Games" kind={<Zaehler wert={eintrag.partien} />} nurGross />
          )}
        </dl>
      </section>

      <Abschnitt titel="Leaders played">
        <div className="tafel-spalten spalten gespielt">
          <span>Nr</span><span /><span>Leader</span>
          {nurWr ? <><span className="rechts">Win rate</span><span /><span /></>
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
                  {l.partien == null ? (
                    <>
                      <Zelle k="z-a" label="Win rate" wert={l.winrate == null ? "unreadable" : l.winrate.toFixed(1) + " %"}
                             klasse={wrKlasse(l.winrate)} />
                      <span className="z-b" /><span className="z-c" />
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
          <p className="leer-satz">No recent games recorded for this player.</p>
        )}
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
const ALTE_PFADE = { "/analysis": "analyse", "/book": "book" };

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

/** Ein Klick mit Taste oder Mittelknopf oeffnet wie gewohnt einen neuen Tab. */
const eigenerKlick = (e) => !(e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0);

/* --------------------------------------------------------------------------
   Schloss
   -------------------------------------------------------------------------- */

function Schloss({ aufSchliessen }) {
  const [passwort, setPasswort] = useState("");
  const [fehlerText, setFehlerText] = useState("");
  const [laeuft, setLaeuft] = useState(false);

  async function absenden(e) {
    e.preventDefault();
    if (!passwort || laeuft) return;
    setLaeuft(true);
    setFehlerText("");
    const ok = await anmelden(passwort);
    setLaeuft(false);
    if (!ok) {
      setFehlerText("That password does not fit.");
      setPasswort("");
      return;
    }
    try {
      localStorage.setItem("lf.pw", passwort);
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
        {fehlerText ? <p className="meldung fehler">{fehlerText}</p> : null}
      </form>
    </div>
  );
}

/* --------------------------------------------------------------------------
   Mulligan

   Seit dem 22.10.2026 nur noch der Mulligan je Matchup aus Metacoach; der Teil aus den
   oeffentlichen Zahlen von OPBounty (alle Gegner, Kopien) ist auf Wunsch des Nutzers weg.
   -------------------------------------------------------------------------- */

function Analyse({ leader, namen }) {
  return <MulliganJeGegner leaderId={kennung(leader.id)} namen={namen} />;
}

/* --------------------------------------------------------------------------
   Die Seite
   -------------------------------------------------------------------------- */

const MATRIX_HANDY_TOP = 8;

export default function App() {
  const [entsperrt, setEntsperrt] = useState(null);
  const [verzeichnis, setVerzeichnis] = useState(null);
  const [satz, setSatz] = useState(null);
  const [laedt, setLaedt] = useState(true);
  const [fehlerText, setFehlerText] = useState("");
  const [wahl, setWahl] = useState({
    art: "satz",
    satz: "Roh_mode_0_op17eb05",
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

  /* Liegt eine Verschluesselung vor, und passt ein gemerktes Passwort noch? */
  useEffect(() => {
    let abgebrochen = false;
    (async () => {
      const info = await verschluesselung();
      if (abgebrochen) return;
      if (!info) {
        setEntsperrt(true);
        return;
      }
      let gemerkt = null;
      try {
        gemerkt = localStorage.getItem("lf.pw");
      } catch {
        /* egal */
      }
      if (gemerkt && (await anmelden(gemerkt))) {
        if (!abgebrochen) setEntsperrt(true);
        return;
      }
      if (!abgebrochen) setEntsperrt(false);
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

  /* Die Partien je Spieler. Eigene Datei, fuer die Spielerseite und den Deckreiter
     (wer hat welche Liste gespielt), und sie darf ebenso fehlen wie die Bestenliste. */
  useEffect(() => {
    if (entsperrt !== true || spielerAlle !== null) return;
    if (reiter !== "spieler" && reiter !== "decks") return;
    let abgebrochen = false;
    holen("spieler.json.gz")
      .then((d) => !abgebrochen && setSpielerAlle(d))
      .catch(() => !abgebrochen && setSpielerAlle(false));
    return () => {
      abgebrochen = true;
    };
  }, [entsperrt, reiter, spielerAlle]);

  /* Wer hat welche Liste gespielt? Einmal bauen, nicht je Liste neu. */
  const spielerIndex = useMemo(() => spielerJeListe(spielerAlle), [spielerAlle]);

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
        const tage = (v.tage || []).filter((t) => t.modus === "mode_0" && t.bounty === "25_1000");
        const letzter = tage.length ? tage[tage.length - 1].tag : "";
        const start = tage.length ? tage[Math.max(0, tage.length - 7)].tag : "";
        setWahl((w) => ({ ...w, von: start, bis: letzter }));
      })
      .catch((e) => {
        setFehlerText(
          "Data missing. Run `python3 aktualisieren.py --tage 30 --bilder` once. (" +
            e.message +
            ")"
        );
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
        ? (() => {
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
            if (!dateien.length) return Promise.reject(new Error("No day in that range"));
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
        setFehlerText(e.message);
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
    const ctx = gsap.context(() => {
      // Ziel ausdruecklich setzen: gsap.from liest sonst den gerade sichtbaren Wert, und
      // der Uebergang der Buehne (opacity) liess sie dann halb durchsichtig stehen.
      gsap.fromTo(ziele, { y: 14, opacity: 0 }, {
        y: 0,
        opacity: 1,
        duration: 0.45,
        stagger: 0.07,
        ease: "power2.out",
        clearProps: "opacity,transform,translate,rotate,scale",
      });
    });
    return () => ctx.revert();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [satz === null]);

  const leader = useMemo(
    () => (satz ? satz.leader.find((e) => e.id === gewaehlt) || satz.leader[0] : null),
    [satz, gewaehlt]
  );

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
  useEffect(() => {
    if (entsperrt !== true || !gewaehlt) return;
    adresseSetzen(reiter, reiter === "matrix" ? matrixFokus : gewaehlt, false, null, null, matrixSort);
  }, [reiter, gewaehlt, entsperrt, matrixFokus, matrixSort]);

  /* Fokus setzen; der fokussierte Leader wird auch der gewaehlte fuer die anderen Reiter. */
  const fokusSetzen = useCallback((id) => {
    setMatrixFokus(id);
    if (id && satz) {
      const treffer = satz.leader.find((e) => kennung(e.id) === id);
      if (treffer) setGewaehlt(treffer.id);
    }
  }, [satz]);

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
  if (entsperrt === false) return <Schloss aufSchliessen={() => setEntsperrt(true)} />;

  if (fehlerText && !satz) {
    return (
      <div className="fehlerseite">
        <div className="marke" style={{ marginBottom: 14 }}>
          <Sombrero groesse={40} />
          <b style={{ font: "700 22px/1 var(--kopf-font)" }}>Letacios Fiesta</b>
        </div>
        <p className="meldung fehler">{fehlerText}</p>
      </div>
    );
  }

  const leaderbezogen = reiter === "decks" || reiter === "matchups" || reiter === "analyse";
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
        {!leaderListe.length ? <li className="leer-satz">No leader matches that search.</li> : null}
      </ol>
    </aside>
  ) : null;

  /* Titel und Kennzeile des gewaehlten Leaders */
  const leaderKopf = leader ? (
    <section className="vorspann">
      <div className="titelzeile">
        <Kartenbild id={lid} breite={36} />
        <h1>{leaderName}</h1>
        <span className="kartennr">{lid}</span>
      </div>
      <dl className="kennzeile">
        <Kennzahl etikett="Win rate"
                  kind={<Zaehler wert={proz(leader.w, leader.w + leader.l)} nachkomma={1} suffix=" %" />}
                  unter={"± " + fehler(leader.w + leader.l).toFixed(1)} />
        <Kennzahl etikett="Games" kind={<Zaehler wert={leader.w + leader.l} />} />
        <Kennzahl etikett="Wins" kind={<Zaehler wert={leader.w} />} nurGross />
        <Kennzahl etikett="Losses" kind={<Zaehler wert={leader.l} />} nurGross />
        <Kennzahl etikett="Going first"
                  kind={<Zaehler wert={proz(leader.fw, leader.fw + leader.fl)} nachkomma={1} suffix=" %" />} />
        <Kennzahl etikett="Going second"
                  kind={<Zaehler wert={proz(leader.sw, leader.sw + leader.sl)} nachkomma={1} suffix=" %" />} />
        <Kennzahl etikett="Duration" kind={<span className="z">{fmtDauer(leader.dur)}</span>} nurGross />
        <Kennzahl etikett="Lists" kind={<Zaehler wert={leader.listen.length} />} nurGross />
      </dl>
    </section>
  ) : null;

  let inhalt = null;
  if (!leader) {
    inhalt = <p className="laedt">Loading ...</p>;
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
                         spielerIndex={spielerIndex} namen={namen} />
            ))}
          </ol>
          {!listen.length ? <p className="leer-satz">No list matches these filters.</p> : null}
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
    inhalt = <Book namen={namen} startLeader={gewaehlt ? kennung(gewaehlt) : null} />;
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
      <p className="leer-satz">No replay selected.</p>
    );
  } else if (reiter === "spieler") {
    inhalt = beste === null || spielerAlle === null ? (
      <p className="laedt">Loading ...</p>
    ) : (
      <Spieler
        eintrag={beste && beste.spieler
          ? beste.spieler.find((e) => String(e.user_id) === String(spielerId))
          : null}
        daten={spielerAlle && spielerAlle.spieler ? spielerAlle.spieler[String(spielerId)] : null}
        namen={namen}
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
      <p className="laedt">Loading the ladder ...</p>
    ) : beste === false ? (
      <p className="leer-satz">No ladder snapshot available yet.</p>
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
      {fehlerText ? <p className="meldung fehler">{fehlerText}</p> : null}
      {leaderbezogen ? leaderKopf : null}
      {inhalt}
    </div>
  );

  return (
    <VorschauBuehne>
    <div className="blatt">
      <div className="karte">
        <header ref={kopfRef} className="band">
          <a className="marke" href={PFADE.decks}
             onClick={(e) => { if (!eigenerKlick(e)) return; e.preventDefault(); setReiter("decks"); }}>
            <Sombrero groesse={30} className="hut" />
            <b>Letacios Fiesta</b>
          </a>

          {/* Der Quellenchip zeigt, was geladen ist, und oeffnet erst auf Klick die
              Bedienelemente. */}
          <div className="quelle-huelle" ref={quelleRef}>
            <button type="button" className="quelle-chip" aria-expanded={quelleOffen}
                    onClick={() => setQuelleOffen((o) => !o)}>
              <span className="lang">{satz ? satz.name : "loading"}</span>
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

        {/* Neun Reiter: am Rechner eine Zeile, am Handy zwei Zeilen, nichts verborgen. */}
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
