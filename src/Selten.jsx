/* Selten genutzte Reiter als eigener Chunk (specs/features/ladepfad-handy.md): Replay,
 * Analyze, Book, Changelog und eigenes Replay. App.jsx laedt diese Datei per React.lazy
 * erst, wenn einer dieser Reiter offen ist; Decklists und die anderen haeufigen Reiter
 * brauchen sie nicht. Inhaltlich unveraendert aus App.jsx verschoben. */
import { Fragment, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import { holen, kennung, metacoachHolen } from "./daten.js";
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
import { ankerBauen, fehlerSuchen, FEHLERNOTEN, kurveBauen, markenBauen, spielerZuordnen } from "./analyse.js";
import {
  Abschnitt, Bild, datumKurz, dateiname, DrehKnopf, fmtZahl, Kartenbild, nr2, Rueckseite, RueckMarke,
  Schalter, Sitzwahl, Zeichen,
} from "./App.jsx";

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
                      <Bild id={k} scharf breite={120} hoehe={168}
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
                  <Bild id={leader} scharf breite={120} hoehe={168}
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
                <Bild id={s.stagekarten[0]} scharf breite={120} hoehe={168}
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
              <Bild key={k + i} id={k} scharf breite={120} hoehe={168}
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
      <Bild id={id} scharf breite={120} hoehe={168} className="bkarte gerestet"
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
    return <p className="laedt" aria-live="polite">Loading the replay</p>;
  }
  if (zeilen === false || !schritte.length) {
    return (
      <>
        {zurueck ? (
          <button type="button" onClick={zurueck} className="knopf leise zurueck-knopf">
            <Zeichen name="links" groesse={16} />Back
          </button>
        ) : null}
        <p className="leer-satz">No replay stored for this game. The client uploads only some of them.</p>
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
          {/* Nur bauen, solange das Protokoll offen ist: sonst entstehen beim Abspielen mit 4x
              alle 175 ms Hunderte Knoepfe in einer versteckten Liste (Audit P2-7). */}
          {logOffen ? <div className="ereignisse">
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
          </div> : null}
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

  if (daten === undefined) return <Abschnitt titel="Mulligan by matchup"><p className="laedt" aria-live="polite">Loading mulligan data</p></Abschnitt>;
  if (daten === null) {
    return (
      <Abschnitt titel="Mulligan by matchup">
        <p className="leer-satz">No mulligan data per matchup for this leader yet. It fills up with the next data days.</p>
      </Abschnitt>
    );
  }
  const mindest = daten.grenzen?.min_zelle ?? 30;
  const name = (id) => (id === "alle" ? "All opponents" : (namen[id] || {}).n || id);
  // Fehlende Felder duerfen den Reiter nicht abbauen: ohne gegner bleibt die Liste leer.
  const alleGegner = daten.gegner || {};
  const summe = (e) => ((e.partien || {}).first || 0) + ((e.partien || {}).second || 0);
  const liste = Object.entries(alleGegner)
    .filter(([g, e]) => g === "alle" || (e && (e.first || e.second)))
    .sort(([a, x], [b, y]) => (a === "alle" ? -1 : b === "alle" ? 1 : summe(y) - summe(x)));
  const eintrag = alleGegner[gegner] || alleGegner.alle;
  const m = eintrag?.[sitz]?.[stufe] || (stufe === "spitze" ? null : eintrag?.[sitz]?.feld);
  const wr = (w, n) => (n >= mindest && Number.isFinite(w) ? w.toFixed(1) + " %" : "\u2013");
  const karten = (m?.karten || [])
    .map((k) => ({ ...k, abstand: k.behalten >= mindest && k.weg >= mindest && Number.isFinite(k.wr_behalten) && Number.isFinite(k.wr_weg)
      ? k.wr_behalten - k.wr_weg : null }))
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
  if (!m) return <p className="leer-satz">No mulligan numbers for this seat yet.</p>;
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
  if (liste === undefined) return <>{kopf("Guide")}<p className="laedt" aria-live="polite">Loading the guide</p></>;
  if (liste === null) return <>{kopf("Guide")}<MetacoachHinweis fehler={listeFehler} was="guide" /></>;
  if (!liste.length) return <>{kopf("Guide")}<p className="leer-satz">No leader has a guide yet. Check back after the next data day.</p></>;

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
        <p className="laedt" aria-live="polite">Loading the guide</p>
      ) : daten === null ? (
        datenFehler?.grund === "fehlt"
          ? <p className="leer-satz" style={{ marginTop: 16 }}>No guide for this leader yet. It appears once enough games are in.</p>
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

        {leseFehler ? <p className="meldung fehler" role="alert">{leseFehler}</p> : null}
        {gelesen && !partie ? (
          <p className="meldung fehler" role="alert">This log could not be analyzed: {LESEGRUND[gelesen.grund] || gelesen.grund}</p>
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
        <p className="laedt" aria-live="polite">Loading the model</p>
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
   Mulligan

   Seit dem 22.10.2026 nur noch der Mulligan je Matchup aus Metacoach; der Teil aus den
   oeffentlichen Zahlen von OPBounty (alle Gegner, Kopien) ist auf Wunsch des Nutzers weg.
   -------------------------------------------------------------------------- */

function Analyse({ leader, namen }) {
  return <MulliganJeGegner leaderId={kennung(leader.id)} namen={namen} />;
}

export { Analyse, Book, Changelog, EigenesReplay, Replay };
