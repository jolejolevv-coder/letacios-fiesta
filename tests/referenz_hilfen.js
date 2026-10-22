// Gemeinsame Helfer fuer die Tests gegen tests/referenz/ (specs/features/
// eigenes-replay-analysieren.md). Die Logs liegen nicht im Repo, sondern im Ordner von
// OPTCGSim am Mac; die Eingaben (Wertnetz, Book, Kartenwerte) nur lokal unter
// tests/referenz/eingaben/. Fehlt etwas, ueberspringen die Tests sauber.
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import zlib from "node:zlib";
import { fileURLToPath } from "node:url";

const HIER = path.dirname(fileURLToPath(import.meta.url));
export const REFERENZ = path.join(HIER, "referenz");
export const EINGABEN = path.join(REFERENZ, "eingaben");
export const LOGS = path.join(os.homedir(), "Library", "Application Support", "com.Batsu.OPTCGSim",
  "CombatLogs", "AutoSaved");
const KARTEN = path.join(HIER, "..", "public", "karten.json.gz");

export function jsonLesen(datei) {
  let roh = fs.readFileSync(datei);
  if (roh[0] === 0x1f && roh[1] === 0x8b) roh = zlib.gunzipSync(roh);
  return JSON.parse(roh.toString("utf-8"));
}

export function index() {
  return jsonLesen(path.join(REFERENZ, "index.json"));
}

export function referenz(id, art) {
  return jsonLesen(path.join(REFERENZ, `${id}.${art}.json`));
}

/* Das Log als Text wie im Browser (TextDecoder ersetzt kaputte Bytes), oder null. */
export function logLesen(id) {
  const datei = path.join(LOGS, id + ".log");
  if (!fs.existsSync(datei)) return null;
  return new TextDecoder("utf-8").decode(fs.readFileSync(datei));
}

/* Alle zwanzig Logs vorhanden? Sonst ein Grund zum Ueberspringen. */
export function logsFehlen() {
  const fehlt = index().logs.filter((e) => !fs.existsSync(path.join(LOGS, e.id + ".log")));
  return fehlt.length ? `${fehlt.length} Logs fehlen unter ${LOGS}` : false;
}

export function eingabenFehlen() {
  const noetig = ["wertnetz.json.gz", "book_OP17-039.json.gz", "kartenwerte.json"];
  const fehlt = noetig.filter((d) => !fs.existsSync(path.join(EINGABEN, d)));
  return fehlt.length ? "Eingaben fehlen: " + fehlt.join(", ") : false;
}

/* Die Events aus karten.json.gz (gitignored, von aktualisieren.py gebaut). */
export function eventsLesen() {
  if (!fs.existsSync(KARTEN)) return null;
  const karten = jsonLesen(KARTEN);
  return new Set(Object.entries(karten).filter(([, k]) => k.a === "e").map(([id]) => id));
}

export function kartenFehlen() {
  return fs.existsSync(KARTEN) ? false : "public/karten.json.gz fehlt (python3 aktualisieren.py)";
}
