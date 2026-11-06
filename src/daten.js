/**
 * Laden und Zusammenfuehren der Statistikdateien.
 *
 * Die Dateien liegen als gzip verpacktes JSON neben der Seite. Ein statischer
 * Webserver liefert sie unveraendert aus, entpackt wird hier mit DecompressionStream.
 * Grund ist die Groesse: ein einzelner Tag im Bereich 25_1000 sind 4,8 MB nacktes
 * JSON und 0,41 MB gepackt. Ohne das waere ein tagesgenauer Zeitraum nicht ladbar.
 */

import { abrufArt, vorabAbnehmen } from "./vorab.js";

const zwischenspeicher = new Map();
const HTTP_NICHT_GEFUNDEN = 404;

/**
 * fetch mit Vorabruf: liegt die Antwort schon aus index.html bereit (src/vorab.js),
 * wird sie genommen. Ist der Vorabruf gescheitert, wird normal geholt; ein Netzfehler
 * im Vorabruf soll nicht ueber die eigene Fehlerbehandlung des Aufrufers entscheiden.
 */
async function abrufen(adresse, art) {
  const vorab = vorabAbnehmen(adresse);
  if (vorab) {
    try {
      return await vorab;
    } catch {
      // Vorabruf gescheitert: selbst holen.
    }
  }
  return fetch(adresse, art);
}

/** Basis der Datendateien. Feste Wurzel, weil Adressen wie /matrix sonst danebengreifen. */
function basis() {
  return "/";
}

/**
 * Pfad zum Kartenbild.
 *
 * Manche Kennungen tragen ein vorangestelltes X, etwa XOP12-040 statt OP12-040. Ein
 * eigenes Bild dazu gibt es nirgends, gemeint ist dieselbe Karte. Fuer die Anzeige wird
 * das X deshalb abgestreift, in den Daten bleibt die Kennung unveraendert.
 */
export function bildpfad(id) {
  const ohneX = /^X([A-Z]{2,4}\d{2}-\d{3})$/.exec(String(id));
  return basis() + "img/" + (ohneX ? ohneX[1] : id) + ".jpg";
}

/* Schnelle Quelle fuer Kartenbilder: ein CDN mit WebP, wie die Seite optcg-data sie nutzt.
 * Fehlt dort ein Bild, faellt die Anzeige auf die eigene Datei (bildpfad) zurueck. */
export const BILD_CDN = "https://static.dotgg.gg/onepiece/card/";
export function bildpfadCdn(id) {
  return BILD_CDN + bildpfad(id).replace(/^.*\/img\//, "").replace(/\.jpg$/, "") + ".webp";
}

/* Reihenfolge der Bildquellen (specs/features/bilder-leistung.md). Kleine Bilder (16 bis 36 px)
 * kommen zuerst aus der eigenen Datei: 120 px, rund 9 KB. Das CDN liefert 600 px mit rund
 * 290 KB und ist dort nur der Rueckfall, wenn die eigene Datei fehlt (img/offen.txt).
 * Scharfe Bilder (Karten auf dem Replaybrett) werden gross gezeigt und kommen
 * zuerst vom CDN, die eigene Datei ist ihr Rueckfall. */
export function bildQuellen(id, scharf = false) {
  const eigene = bildpfad(id);
  const cdn = bildpfadCdn(id);
  return scharf ? [cdn, eigene] : [eigene, cdn];
}

export const KARTE = /([A-Z]{2,4}\d{2}-\d{3}|P-\d{3})/;

export function kennung(text) {
  const t = KARTE.exec(String(text ?? ""));
  return t ? t[1] : String(text ?? "");
}

/* Kartenzeilen "4xOP17-039" aus einer Deckliste. Die Kaizoku Spielerdaten trugen bis
 * zum 06.11.2026 je Deck nur eine Zeile mit dem Python Listentext
 * "['1xEB02-030', '4xOP08-051', ...]"; das hier liest beide Formen. */
const KARTENZEILE = /(\d+)x([A-Z]{2,4}\d{2}-\d{3}|P-\d{3})/g;
export function kartenzeilen(eintraege) {
  const text = (eintraege || []).join("\n");
  return [...text.matchAll(KARTENZEILE)].map((t) => `${t[1]}x${t[2]}`);
}

export function anzahl(text) {
  const t = /^(\d+)x/.exec(String(text ?? ""));
  return t ? parseInt(t[1], 10) : 1;
}

/**
 * Schluessel einer Deckliste, unabhaengig von der Schreibweise.
 *
 * Die beiden Quellen schreiben dasselbe Deck verschieden: die Statistik fuehrt eine
 * einzelne Kopie als "1xOP07-026", das Spielerprofil als "OP07-026". Und die Statistik
 * traegt den Leader in der Liste, das Profil ebenso, aber an anderer Stelle. Hier wird
 * beides auf "AnzahlxID" normiert, der Leader herausgenommen und sortiert.
 */
export function deckSchluessel(eintraege, leaderId) {
  const leader = kennung(leaderId ?? "");
  const teile = [];
  for (const e of eintraege || []) {
    const id = kennung(e);
    if (leader && id === leader) continue;
    teile.push(anzahl(e) + "x" + id);
  }
  return teile.sort().join("|");
}

/**
 * Wer hat welche Liste gespielt? Aus den Profilen der Bestenliste.
 *
 * Die Zuordnung ist duenn und soll es auch bleiben: der Server schreibt je Spieler nur
 * die letzten neun Partien, und nur die Spieler der Bestenliste werden gelesen. Getroffen
 * werden dadurch vor allem die haeufig gespielten Listen. Wo nichts bekannt ist, steht
 * nichts; geraten wird nicht.
 */
export function spielerJeListe(spielerAlle) {
  const index = new Map();
  const spieler = spielerAlle && spielerAlle.spieler;
  if (!spieler) return index;
  for (const eintrag of Object.values(spieler)) {
    const name = eintrag && eintrag.name;
    if (!name) continue;
    for (const partie of eintrag.partien || []) {
      const schluessel = deckSchluessel(partie.deck, partie.eigener_leader);
      if (!schluessel) continue;
      let namen = index.get(schluessel);
      if (!namen) {
        namen = new Set();
        index.set(schluessel, namen);
      }
      namen.add(name);
    }
  }
  return index;
}

/* ---------------------------------------------------------------------------
   Passwort.

   Die Seite liegt statisch und oeffentlich auf GitHub Pages. Eine Abfrage, die nur
   etwas ein- und ausblendet, waere dort wirkungslos: die Datendateien laegen daneben.
   Deshalb sind die Daten selbst verschluesselt, AES-256-GCM, der Schluessel kommt aus
   PBKDF2 ueber das Passwort. Ohne Passwort laedt die Huelle, aber es gibt nichts zu
   sehen. Verschluesselt wird beim Bauen, siehe verschluesseln.py.

   Beim Entwickeln liegt keine schluessel.json neben der Seite. Dann laeuft alles
   unverschluesselt weiter, ohne Abfrage.
   --------------------------------------------------------------------------- */

let schluesselInfo;
let sitzungsSchluessel = null;

function ausBase64(text) {
  const roh = atob(text);
  const feld = new Uint8Array(roh.length);
  for (let i = 0; i < roh.length; i += 1) feld[i] = roh.charCodeAt(i);
  return feld;
}

/** Fehler beim Entsperren mit Grund, damit die Anmeldung die passende Meldung zeigt. */
export class EntsperrFehler extends Error {
  constructor(grund, text) {
    super(text);
    this.grund = grund;           // "netz", "kaputt", "krypto"
  }
}

/** Kann dieser Browser WebCrypto? Ohne https oder in manchen Webviews fehlt crypto.subtle. */
export function kryptoDa() {
  return typeof crypto !== "undefined" && crypto !== null && typeof crypto.subtle === "object" && crypto.subtle !== null;
}

/**
 * Liegt eine Verschluesselung vor? Gibt die Angaben zurueck oder false.
 *
 * Gemerkt wird nur eine klare Antwort: die Datei ist da, oder der Server sagt 404. Ein
 * Netzfehler oder eine andere Statusmeldung wirft EntsperrFehler und wird nicht gemerkt,
 * sonst wuerde ein kurzer Aussetzer die Seite bis zum Neuladen auf unverschluesselte
 * Adressen schicken, die es im Betrieb nicht gibt.
 */
export async function verschluesselung() {
  if (schluesselInfo !== undefined) return schluesselInfo;
  let antwort;
  try {
    antwort = await abrufen(basis() + "schluessel.json", abrufArt("schluessel.json"));
  } catch (fehler) {
    throw new EntsperrFehler("netz", "schluessel.json nicht erreichbar: " + fehler.message);
  }
  // Der Entwicklungsserver von Vite antwortet auf eine fehlende Datei mit index.html und 200.
  // Das heisst hier dasselbe wie 404: keine Verschluesselung.
  const art = (antwort.headers && antwort.headers.get && antwort.headers.get("content-type")) || "";
  if (antwort.status === HTTP_NICHT_GEFUNDEN || (antwort.ok && art.includes("text/html"))) {
    schluesselInfo = false;
    return schluesselInfo;
  }
  if (!antwort.ok) throw new EntsperrFehler("netz", "schluessel.json: HTTP " + antwort.status);
  let info;
  try {
    info = await antwort.json();
  } catch {
    throw new EntsperrFehler("kaputt", "schluessel.json ist kein JSON");
  }
  if (!info || typeof info.salz !== "string" || typeof info.probe !== "string" || !Number.isFinite(info.runden)) {
    throw new EntsperrFehler("kaputt", "schluessel.json ohne salz, probe oder runden");
  }
  schluesselInfo = info;
  return schluesselInfo;
}

async function entschluesseln(schluessel, feld) {
  const iv = feld.slice(0, 12);
  const rest = feld.slice(12);
  return new Uint8Array(
    await crypto.subtle.decrypt({ name: "AES-GCM", iv }, schluessel, rest)
  );
}

/** Prueft das Passwort an der Probe und merkt sich den Schluessel fuer die Sitzung. */
export async function anmelden(passwort) {
  const info = await verschluesselung();
  if (!info) return true;
  if (!kryptoDa()) throw new EntsperrFehler("krypto", "crypto.subtle fehlt");
  let schluessel;
  try {
    schluessel = await schluesselAbleiten(passwort, info);
  } catch (fehler) {
    throw new EntsperrFehler("kaputt", "Schluessel nicht ableitbar: " + fehler.message);
  }
  try {
    const probe = await entschluesseln(schluessel, ausBase64(info.probe));
    if (new TextDecoder().decode(probe) !== "letacios-fiesta") return false;
  } catch {
    return false;
  }
  sitzungsSchluessel = schluessel;
  return true;
}

/** PBKDF2 ueber das Passwort mit Salz und Runden aus schluessel.json. */
async function schluesselAbleiten(passwort, info) {
  const roh = await crypto.subtle.importKey(
    "raw", new TextEncoder().encode(passwort), "PBKDF2", false, ["deriveKey"]
  );
  return crypto.subtle.deriveKey(
    { name: "PBKDF2", salt: ausBase64(info.salz), iterations: info.runden, hash: "SHA-256" },
    roh,
    { name: "AES-GCM", length: 256 },
    false,
    ["decrypt"]
  );
}

// Dateien, deren Inhalt sich unter demselben Namen nie mehr aendert (ein Replay, ein
// Tagesausschnitt, ein fertiger Satz), holt der Browser aus seinem Speicher; alles andere
// wird taeglich neu geschrieben. Die Regel steht in src/vorab.js (`abrufArt`), weil der
// Vorabruf dieselbe Abrufart braucht.

/** Entschluesselter oder roher Inhalt als JSON, gzip oder nicht. */
async function auspacken(puffer) {
  const kopf = new Uint8Array(puffer.slice(0, 2));
  // Manche Server entpacken gzip bereits selbst. Dann fehlt die Signatur 1f 8b.
  if (kopf[0] !== 0x1f || kopf[1] !== 0x8b) {
    return JSON.parse(new TextDecoder().decode(puffer));
  }
  if (typeof DecompressionStream !== "function") {
    throw new Error("Dieser Browser kann kein gzip entpacken.");
  }
  const strom = new Blob([puffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(strom).text());
}

/** Holt eine .json.gz Datei und entpackt sie. Ergebnisse bleiben im Speicher. */
export async function holen(datei) {
  if (zwischenspeicher.has(datei)) return zwischenspeicher.get(datei);
  const versprechen = (async () => {
    const verschluesselt = sitzungsSchluessel !== null;
    // GitHub Pages liefert `max-age=600` fuer alles. Mit "no-cache" fragt der Browser
    // trotzdem bei jedem Abruf beim Server nach. Fuer die taeglich neu geschriebenen
    // Dateien ist das richtig, sonst saehe man bis zu zehn Minuten alte Zahlen. Fuer
    // die unveraenderlichen ist es verschenkt: ein Tagesausschnitt wiegt bis zu 400 KB
    // und wurde bisher bei jedem Wechsel des Zeitraums neu geholt.
    const antwort = await abrufen(basis() + datei + (verschluesselt ? ".enc" : ""), abrufArt(datei));
    if (!antwort.ok) throw new Error(datei + ": HTTP " + antwort.status);
    let puffer = await antwort.arrayBuffer();
    if (verschluesselt) {
      puffer = (await entschluesseln(sitzungsSchluessel, new Uint8Array(puffer))).buffer;
    }
    return auspacken(puffer);
  })();
  zwischenspeicher.set(datei, versprechen);
  // Ein Fehlschlag wird vergessen, damit der naechste Aufruf wirklich neu laedt.
  versprechen.catch(() => {
    if (zwischenspeicher.get(datei) === versprechen) zwischenspeicher.delete(datei);
  });
  return versprechen;
}

/** Nur fuer Tests: Dateinamen, die gerade im Zwischenspeicher liegen. */
export function _imSpeicher() {
  return [...zwischenspeicher.keys()];
}

/** Nur fuer Tests: vergisst Zwischenspeicher und Verschluesselungsangaben. */
export function _speicherLeeren() {
  zwischenspeicher.clear();
  letzterZeitraum = { schluessel: null, versprechen: null };
  schluesselInfo = undefined;
  sitzungsSchluessel = null;
}

/* ---------------------------------------------------------------------------
   Metacoach als zweite Quelle (specs/features/book-auf-fiesta.md).

   Book und Wertnetz liegen nicht im Repo von Fiesta, sondern kommen direkt vom Bazzite:
   GET <Metacoach>/fiesta/<art>/<datei>.json.gz.enc, verschluesselt mit demselben Salz und
   Passwort wie Fiesta (tools/fiesta_export.py dort). Die Route braucht keine Anmeldung,
   weil sie nur Geheimtext ausliefert, und erlaubt CORS nur fuer Fiesta und den
   Entwicklungsserver auf Port 5173. Ohne Sitzungsschluessel (Entwicklung ohne
   schluessel.json) laesst sich nichts davon lesen; dann scheitert der Abruf, und die
   Reiter zeigen ihren Hinweis.
   --------------------------------------------------------------------------- */

const METACOACH_STANDARD = "https://meta.nahobinoco.com";
const METACOACH_ARTEN = new Set(["book", "netz"]);
// Wie die Route in Metacoach: nur Kartennummern, _leader und wertnetz als Namen.
const METACOACH_DATEI = /^(?:[A-Z0-9-]+|_leader|wertnetz)$/;
const metacoachSpeicher = new Map();

/** Basis von Metacoach; zum Pruefen mit Testdaten ueber VITE_METACOACH umzustellen. */
export function metacoachBasis() {
  const env = typeof import.meta !== "undefined" ? import.meta.env : undefined;
  return String(env?.VITE_METACOACH || METACOACH_STANDARD).replace(/\/$/, "");
}

/* Grosse Kartenbilder fuer die Kartenvorschau: GET <Metacoach>/fiesta/bilder/<nr>.jpg, ohne
   Anmeldung, 600 px breit. Metacoach holt ein fehlendes Bild einmal ueber punk records und
   behaelt es. Gleiche Form wie die Route dort: Grundnummer, dazu Drucke wie _p1 oder _r1. */
const GROSSBILD_NR = /^[A-Z]{1,4}\d{0,2}-\d{3}(?:_[pr]\d{1,2})?$/;

/** Adresse des grossen Bildes einer Karte oder null, wenn die Kennung keine Kartennummer ist. */
export function grossesBild(id) {
  const ohneX = /^X([A-Z]{2,4}\d{2}-\d{3})$/.exec(String(id ?? ""));
  const nr = ohneX ? ohneX[1] : String(id ?? "");
  if (!GROSSBILD_NR.test(nr)) return null;
  return `${metacoachBasis()}/fiesta/bilder/${nr}.jpg`;
}

/** Fehler mit Grund, damit die Seite "nicht erreichbar" von "gibt es nicht" trennt. */
export class MetacoachFehler extends Error {
  constructor(grund, text) {
    super(text);
    this.grund = grund;           // "schluessel", "netz", "fehlt", "kaputt"
  }
}

/**
 * Holt eine Datei von Metacoach, etwa metacoachHolen("book", "OP17-039") oder
 * metacoachHolen("netz", "wertnetz"). Entschluesselt mit dem Sitzungsschluessel und
 * entpackt wie `holen`. Ergebnisse bleiben im Speicher; ein Fehlschlag wird vergessen,
 * damit ein spaeterer Versuch neu fragt.
 */
export async function metacoachHolen(art, datei) {
  if (!METACOACH_ARTEN.has(art) || !METACOACH_DATEI.test(datei)) {
    throw new MetacoachFehler("fehlt", "unbekannte Datei " + art + "/" + datei);
  }
  const schluessel = art + "/" + datei;
  if (metacoachSpeicher.has(schluessel)) return metacoachSpeicher.get(schluessel);
  const versprechen = (async () => {
    if (sitzungsSchluessel === null) {
      throw new MetacoachFehler("schluessel", "kein Schluessel fuer Metacoach");
    }
    let antwort;
    try {
      antwort = await fetch(`${metacoachBasis()}/fiesta/${art}/${datei}.json.gz.enc`, { cache: "default" });
    } catch (fehler) {
      throw new MetacoachFehler("netz", "Metacoach nicht erreichbar: " + fehler.message);
    }
    if (antwort.status === 404) throw new MetacoachFehler("fehlt", schluessel + ": HTTP 404");
    if (!antwort.ok) throw new MetacoachFehler("netz", schluessel + ": HTTP " + antwort.status);
    let klar;
    try {
      klar = await entschluesseln(sitzungsSchluessel, new Uint8Array(await antwort.arrayBuffer()));
    } catch {
      // Neues Passwort bei Fiesta: Metacoach verschluesselt erst in der naechsten Nacht neu.
      throw new MetacoachFehler("kaputt", schluessel + ": nicht zu entschluesseln");
    }
    return auspacken(klar.buffer);
  })();
  metacoachSpeicher.set(schluessel, versprechen);
  versprechen.catch(() => metacoachSpeicher.delete(schluessel));
  return versprechen;
}

/**
 * Kartennamen, damit die Seite nicht nur Seriennummern zeigt.
 *
 * Quelle ist der Punk Records Datensatz, `aktualisieren.py` legt daraus namen.json.gz
 * neben die Seite. Faellt die Datei aus, bleibt die Nummer stehen; die Seite laeuft
 * weiter, sie ist nur karger.
 */
let kartenLauf = null;

/* Ein fehlgeschlagener Abruf darf nicht haengen bleiben. Frueher wurde im Fehlerfall
   eine leere Tabelle gemerkt, und weil die wahr ist, hat jeder spaetere Aufruf sie
   zurueckgegeben: die Leader standen dann bis zum Neuladen der Seite als Kartennummern
   da. Genau das passiert, wenn GitHub Pages unter dem Bilderschwall einmal mit 503
   antwortet. Gemerkt wird jetzt der laufende Abruf, nicht sein Ergebnis, damit
   gleichzeitige Aufrufer sich einen teilen; scheitert er, wird er vergessen und der
   naechste Aufruf versucht es erneut. */
const WARTEN_MS = 400;

async function kartenHolen() {
  try {
    return await holen("karten.json.gz");
  } catch {
    // Einmal nachfassen: 503 von Pages ist fast immer voruebergehend.
    await new Promise((fertig) => setTimeout(fertig, WARTEN_MS));
    return await holen("karten.json.gz");
  }
}

export async function kartenLaden() {
  if (!kartenLauf) {
    kartenLauf = kartenHolen().catch(() => {
      kartenLauf = null;   // nicht merken, damit es wieder versucht werden kann
      return {};
    });
  }
  return kartenLauf;
}

const ZAEHLER = ["w", "l", "fw", "fl", "sw", "sl"];

/**
 * Fuehrt mehrere Tagesdateien zu einem Satz zusammen.
 *
 * Decklisten werden ueber die sortierte Kartenliste zusammengelegt, Matchups ueber die
 * Gegnerkennung. Dieselbe Rechnung macht `zusammenfuehren` in aktualisieren.py, und
 * dieselbe macht der OPBounty Client in `merge_statlists`.
 */
export function verschmelzen(saetze, name) {
  const sammler = neuerSammler();
  for (const satz of saetze) sammler.hinzu(satz);
  return sammler.fertig(name);
}

/**
 * Sammelt Saetze nacheinander ein und rechnet am Ende denselben Satz wie verschmelzen.
 * So muss ein Zeitraum nicht alle Tagesdateien gleichzeitig im Speicher halten (Audit
 * P2-8, specs/features/optimieren.md): jeder Tag wird eingerechnet und kann danach weg.
 */
export function neuerSammler() {
  const leader = new Map();
  let partien = 0;
  let stand = "";
  let listenAlleGegner = false;
  let quelle = "";
  // Die Quelle fuehrt Eintraege, die keine Karte sind, allen voran "Mobile". Das ist ein
  // Platzhalter fuer Partien vom Handy, kein Leader. Er taucht sonst in der Leiste, in der
  // Matrix und in der Rangliste auf und verzerrt jede davon.
  const istLeader = (id) => KARTE.test(String(id));

  function hinzu(satz) {
    if (!satz) return;
    // Der Heroines Event Satz zaehlt Winrates nur gegen Event Leader, Decklisten aber gegen
    // alle Gegner (aktualisieren.py, event_satz). Die Seite sagt das an den Listen.
    if (satz.listen_alle_gegner) listenAlleGegner = true;
    if (!quelle && satz.quelle) quelle = satz.quelle;
    partien += satz.partien || 0;
    if ((satz.stand || "") > stand) stand = satz.stand || "";
    for (const e of satz.leader || []) {
      if (!istLeader(e.id)) continue;
      let ziel = leader.get(e.id);
      if (!ziel) {
        ziel = { id: e.id, w: 0, l: 0, fw: 0, fl: 0, sw: 0, sl: 0,
                 dauerSumme: 0, dauerPartien: 0, gegner: new Map(), listen: new Map(),
                 hand: {}, kopien: {} };
        leader.set(e.id, ziel);
      }
      for (const f of ZAEHLER) ziel[f] += e[f] || 0;
      const spiele = (e.w || 0) + (e.l || 0);
      ziel.dauerSumme += (e.dur || 0) * spiele;
      ziel.dauerPartien += spiele;

      (e.geg || []).forEach((gid, i) => {
        if (!istLeader(gid)) return;
        let g = ziel.gegner.get(gid);
        if (!g) { g = { id: gid, m: 0, w: 0, fw: 0, fl: 0, sw: 0, sl: 0 }; ziel.gegner.set(gid, g); }
        g.m += (e.gm || [])[i] || 0;
        g.w += (e.gw || [])[i] || 0;
        g.fw += (e.gfw || [])[i] || 0;
        g.fl += (e.gfl || [])[i] || 0;
        g.sw += (e.gsw || [])[i] || 0;
        g.sl += (e.gsl || [])[i] || 0;
      });

      // Kartenwerte fuer den Reiter Analysis, seit Format 2 (aktualisieren.py, 20.10.2026).
      // hand: je Karte acht Zaehler, siehe HAND_FELDER dort; kopien: je "2xOP17-041" [Partien, Siege].
      for (const [karte, z] of Object.entries(e.hand || {})) {
        const ziel8 = (ziel.hand[karte] ||= [0, 0, 0, 0, 0, 0, 0, 0]);
        z.forEach((wert, i) => { ziel8[i] += wert || 0; });
      }
      for (const [karte, [m, w]] of Object.entries(e.kopien || {})) {
        const ziel2 = (ziel.kopien[karte] ||= [0, 0]);
        ziel2[0] += m || 0;
        ziel2[1] += w || 0;
      }

      for (const li of e.listen || []) {
        const schluessel = [...li.d].sort().join("|");
        let z = ziel.listen.get(schluessel);
        if (!z) {
          z = { d: li.d, w: 0, l: 0, fw: 0, fl: 0, sw: 0, sl: 0, dauerSumme: 0, dauerPartien: 0 };
        // Nur Kaizoku fuehrt die Bilanz je Gegnerleader einer Liste ([Leader, Partien, Siege]).
        if (li.gegner) z.gegner = li.gegner;
          ziel.listen.set(schluessel, z);
        }
        for (const f of ZAEHLER) z[f] += li[f] || 0;
        const s = (li.w || 0) + (li.l || 0);
        z.dauerSumme += (li.dur || 0) * s;
        z.dauerPartien += s;
      }
    }
  }

  function fertig(name) {
    const ergebnis = [...leader.values()].map((e) => ({
      id: e.id,
      w: e.w, l: e.l, fw: e.fw, fl: e.fl, sw: e.sw, sl: e.sl,
      dur: e.dauerPartien ? Math.round(e.dauerSumme / e.dauerPartien) : 0,
      gegner: [...e.gegner.values()].sort((a, b) => b.m - a.m),
      hand: e.hand,
      kopien: e.kopien,
      listen: [...e.listen.values()]
        .map((l) => ({ ...l, dur: l.dauerPartien ? Math.round(l.dauerSumme / l.dauerPartien) : 0 }))
        .sort((a, b) => b.w + b.l - (a.w + a.l)),
    }));
    ergebnis.sort((a, b) => b.w + b.l - (a.w + a.l));
    return { name, stand, partien, leader: ergebnis, listenAlleGegner, quelle };
  }

  return { hinzu, fertig };
}

/* --------------------------------------------------------------------------
   Kaizoku als Quelle (docs/kaizoku-einbau.md). Der Adapter bildet kaizoku.json.gz auf die
   Leader Form von `eindampfen` in aktualisieren.py ab, damit Decklists, Ranking,
   Matchups und Matrix ohne Sonderweg rechnen.
   -------------------------------------------------------------------------- */

/* Die Kaizoku Quellen: Schluessel in der Quellenwahl, Datensatz bei Kaizoku, Name wie in der
   Auswahl. Dateien: kaizoku_<datensatz>.json.gz und kaizoku_<datensatz>_b.json.gz
   (kaizoku_holen.py, kaizoku_wochen.py). Alle sind die Woche bis zum Stand; "top 10" und
   "top 20" zaehlen nur die besten Spieler. */
const kaizokuQuelle = (datensatz, name) => ({
  datei: `kaizoku_${datensatz}.json.gz`, bDatei: `kaizoku_${datensatz}_b.json.gz`,
  name: "Card Kaizoku, " + name,
});
export const KAIZOKU_QUELLEN = {
  kaizoku_eb05_lw_p: kaizokuQuelle("eb05_lw_p", "OP17 + EB05 Standard, last week"),
  kaizoku_eb05_lw_p_top20: kaizokuQuelle("eb05_lw_p_top20", "OP17 + EB05 Standard, last week, top 20"),
};
export const istKaizokuQuelle = (schluessel) => Object.hasOwn(KAIZOKU_QUELLEN, schluessel);

/**
 * Kaizoku nennt je Leader und Liste nur Gesamtzahlen und, fuer den Leader, die Siegquote als
 * Erster und als Zweiter. Die Zahl der Partien als Erster oder Zweiter fehlt. Sie wird mit
 * der Haelfte der Partien geschaetzt (Muenzwurf), nur damit die Quote stimmt; Zahl der
 * Partien als Erster oder Zweiter ist damit keine Messung. Je Gegner und je Liste gibt es
 * keine Aufteilung, dort bleibt sie leer.
 */
/** Kaizoku schreibt den Stand als 20261102, die Seite rechnet mit 2026-11-02. */
export const kaizokuStand = (s) => (/^\d{8}$/.test(s || "") ? `${s.slice(0, 4)}-${s.slice(4, 6)}-${s.slice(6, 8)}` : s || "");

export function kaizokuZuSatz(roh, schluessel = "kaizoku_eb05_lw_p") {
  const leader = (roh.leader || []).map((l) => {
    const m = l.m || 0;
    const erste = Math.round(m / 2);
    const zweite = m - erste;
    const siegeSeite = (rate, n) => (rate == null ? [0, 0] : [Math.round(rate * n), n - Math.round(rate * n)]);
    const [fw, fl] = siegeSeite(l.first, erste);
    const [sw, sl] = siegeSeite(l.second, zweite);
    const gegner = l.gegner || [];
    return {
      id: l.id,
      w: l.w, l: m - l.w, fw, fl, sw, sl, dur: 0,
      geg: gegner.map((g) => g[0]),
      gm: gegner.map((g) => g[1]),
      gw: gegner.map((g) => g[2]),
      listen: (l.listen || []).map((li) => ({
        d: li.d, w: li.w, l: li.m - li.w, fw: 0, fl: 0, sw: 0, sl: 0, dur: 0,
        gegner: li.gegner || [],
      })),
    };
  });
  return { name: KAIZOKU_QUELLEN[schluessel].name, stand: kaizokuStand(roh.stand), partien: roh.partien || 0,
           quelle: schluessel, leader };
}

export async function kaizokuLaden(schluessel) {
  const roh = await holen(KAIZOKU_QUELLEN[schluessel].datei);
  const satz = kaizokuZuSatz(roh, schluessel);
  return verschmelzen([satz], satz.name);
}

/** Ein fertiger Satz aus saetze/ hat schon die richtige Form, wird aber gleich behandelt. */
export async function satzLaden(datei, name) {
  const roh = await holen(datei);
  return verschmelzen([roh], name || roh.name || "");
}

/* Ein Zeitraum holt hoechstens so viele Tagesdateien gleichzeitig. Ein Tag sind bis zu
   4,8 MB JSON; 30 auf einmal hielten rund 150 MB im Speicher (Audit P2-8). */
const TAGE_GLEICHZEITIG = 3;
// Der zuletzt fertige Zeitraum, damit ein erneutes Rendern ihn nicht neu rechnet.
let letzterZeitraum = { schluessel: null, versprechen: null };

/**
 * Holt die Tage eines Zeitraums in Gruppen, rechnet jede Gruppe in der Reihenfolge der
 * Dateien ein und nimmt die geparsten Tage danach aus dem Zwischenspeicher. Die gepackten
 * Dateien haelt weiter der Browser Cache (cache "default" fuer tage/).
 */
export async function zeitraumLaden(dateien, name) {
  const schluessel = name + "\n" + dateien.join("\n");
  if (letzterZeitraum.schluessel === schluessel) return letzterZeitraum.versprechen;
  const versprechen = zeitraumRechnen(dateien, name);
  letzterZeitraum = { schluessel, versprechen };
  versprechen.catch(() => {
    if (letzterZeitraum.versprechen === versprechen) letzterZeitraum = { schluessel: null, versprechen: null };
  });
  return versprechen;
}

async function zeitraumRechnen(dateien, name) {
  const sammler = neuerSammler();
  try {
    for (let ab = 0; ab < dateien.length; ab += TAGE_GLEICHZEITIG) {
      const gruppe = dateien.slice(ab, ab + TAGE_GLEICHZEITIG);
      const teile = await Promise.all(gruppe.map((d) => holen(d)));
      teile.forEach((teil) => sammler.hinzu(teil));
      gruppe.forEach((d) => zwischenspeicher.delete(d));
    }
  } catch (fehler) {
    dateien.forEach((d) => zwischenspeicher.delete(d));
    throw fehler;
  }
  return sammler.fertig(name);
}
