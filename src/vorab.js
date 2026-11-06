/* Vorabruf der Startdaten (specs/features/ladepfad-handy.md).
 *
 * WARUM. Ohne ihn startet der erste Datenabruf erst, wenn das ganze JS geladen und
 * ausgefuehrt ist, und danach laufen Schluessel, Verzeichnis und Satz nacheinander. Am
 * Handy standen so 130 KB JS und 160 KB Satz hintereinander vor dem ersten Bild.
 *
 * WIE. `vite.vorab.js` bettet diese Datei als Skript in index.html ein, sie laeuft also,
 * waehrend das Bundle noch laedt. Sie holt nur Antworten und legt sie unter der vollen
 * Adresse in `window.__lfVorab` ab. Entschluesselt und gelesen wird weiter in
 * `holen` (src/daten.js), das eine passende Antwort genau einmal abnimmt und sonst
 * selbst abruft. Geht hier etwas schief, verliert die Seite nur den Vorsprung.
 *
 * Diese Datei darf nichts importieren: im HTML gibt es keine Module zum Nachladen.
 */

/** Name der Ablage in `window`. */
export const ABLAGE = "__lfVorab";

/** Satz, den die Seite zeigt, wenn das Verzeichnis keinen gueltigen Start nennt. */
export const VORGABE_SATZ = "Roh_mode_0_op17eb05";

/** Dateien, die sich unter ihrem Namen nie aendern; alle anderen holt der Browser frisch. */
export const UNVERAENDERLICH = /^(replays|tage|saetze|analyse)\//;

/** Seiten, deren Reiter beim Start keinen Satz braucht (PFADE und SATZ_REITER in App.jsx).
 *  Dort holt der Vorabruf den Satz nicht, sonst teilt er sich am Handy die Leitung mit
 *  dem, was die Seite wirklich zeigt (Leaderboard: 95 statt 99 Punkte). Unbekannte Pfade
 *  zeigen Decklists und bekommen den Satz. */
export const OHNE_SATZ = ["/leaderboard", "/player", "/replay", "/guide", "/analyze", "/changelog"];

/** Braucht die Seite unter diesem Pfad beim Start den Satz? */
export function brauchtSatz(pfad) {
  return !OHNE_SATZ.includes(String(pfad || "/").replace(/\/$/, ""));
}

/** Nur solche Satznamen werden vorab geholt; alles andere ist kaputt oder fremd. */
const SATZDATEI = /^saetze\/[\w.-]+\.json\.gz$/;

/** Dieselbe Abrufart wie in `holen`, sonst holte der Browser die Datei zweimal. */
export function abrufArt(datei) {
  return { cache: UNVERAENDERLICH.test(datei) ? "default" : "no-cache" };
}

/**
 * Die Satzdatei, die die Seite beim Start laedt. Gleiche Regel wie in App.jsx: der Start
 * aus dem Verzeichnis, wenn es ihn gibt, sonst die Vorgabe, sonst der erste Satz.
 */
export function startDatei(verzeichnis) {
  const saetze = (verzeichnis && verzeichnis.saetze) || [];
  const start = verzeichnis && verzeichnis.start;
  const schluessel = saetze.some((s) => s.schluessel === start) ? start : VORGABE_SATZ;
  const satz = saetze.find((s) => s.schluessel === schluessel) || saetze[0];
  return satz && SATZDATEI.test(satz.datei) ? satz.datei : null;
}

/** Ist schluessel.json echt da? Gleiche Regel wie `verschluesselung` in src/daten.js. */
function istVerschluesselt(antwort) {
  const art = (antwort.headers && antwort.headers.get && antwort.headers.get("content-type")) || "";
  return antwort.ok && !art.includes("text/html");
}

/** Ist ein Passwort gemerkt? Ohne es zeigt die Seite erst die Anmeldung, und die Daten
 *  kaemen umsonst. Gleicher Schluessel wie in App.jsx. */
export const PASSWORT_SCHLUESSEL = "lf.pw";

function passwortGemerkt(fenster) {
  try {
    return Boolean(fenster.localStorage && fenster.localStorage.getItem(PASSWORT_SCHLUESSEL));
  } catch {
    return false;
  }
}

/** Verzeichnis im Klartext lesen, gzip oder schon entpackt (nur ohne Verschluesselung). */
async function verzeichnisLesen(antwort) {
  const puffer = await antwort.clone().arrayBuffer();
  const kopf = new Uint8Array(puffer.slice(0, 2));
  if (kopf[0] !== 0x1f || kopf[1] !== 0x8b) return JSON.parse(new TextDecoder().decode(puffer));
  const strom = new Blob([puffer]).stream().pipeThrough(new DecompressionStream("gzip"));
  return JSON.parse(await new Response(strom).text());
}

/**
 * Startet die Abrufe. `abrufen` ist fetch, in Tests ein Ersatz. Gibt ein Versprechen
 * zurueck, das erfuellt ist, wenn alle Abrufe gestartet sind (nur fuer Tests).
 */
export function vorabStarten(fenster, abrufen, basis = "/") {
  const mitSatz = brauchtSatz(fenster.location && fenster.location.pathname);
  const ablage = {};
  fenster[ABLAGE] = ablage;
  const holen = (datei) => {
    const versprechen = abrufen(basis + datei, abrufArt(datei));
    // Ein Fehlschlag wird erst in `holen` bemerkt; hier soll er nicht als unbehandelt melden.
    versprechen.catch(() => {});
    ablage[basis + datei] = versprechen;
    return versprechen;
  };
  return holen("schluessel.json")
    .then(async (antwort) => {
      const verschluesselt = istVerschluesselt(antwort);
      if (verschluesselt && !passwortGemerkt(fenster)) return;
      const endung = verschluesselt ? ".enc" : "";
      const verzeichnis = holen("verzeichnis.json.gz" + endung);
      holen("karten.json.gz" + endung);
      if (!mitSatz) return;
      const satz = verschluesselt
        ? (await antwort.clone().json()).start
        : startDatei(await verzeichnisLesen(await verzeichnis));
      if (typeof satz === "string" && SATZDATEI.test(satz)) holen(satz + endung);
    })
    .catch(() => {});
}

/**
 * Nimmt eine vorab geholte Antwort fuer diese Adresse ab, genau einmal. Ohne Treffer
 * kommt null; dann ruft `holen` selbst ab.
 */
export function vorabAbnehmen(adresse, fenster = globalThis) {
  const ablage = fenster && fenster[ABLAGE];
  if (!ablage || !(adresse in ablage)) return null;
  const versprechen = ablage[adresse];
  delete ablage[adresse];
  return versprechen;
}
