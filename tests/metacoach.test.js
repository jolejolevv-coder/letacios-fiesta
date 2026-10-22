// metacoachHolen (src/daten.js): eine Datei, die Metacoach mit dem Verfahren von Fiesta
// verschluesselt (verschluesseln.py), entschluesselt Fiesta mit dem Passwort der Seite.
// Fest sind Testpasswort und Testsalz (tests/fixtures/, gebaut mit verschluesseln.py),
// nicht die echten. fetch wird ersetzt; es geht kein Aufruf ins Netz.
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { anmelden, metacoachBasis, metacoachHolen } from "../src/daten.js";

const HIER = path.dirname(fileURLToPath(import.meta.url));
const SCHLUESSEL = JSON.parse(fs.readFileSync(path.join(HIER, "fixtures", "metacoach_schluessel.json"), "utf-8"));
const GEHEIM = fs.readFileSync(path.join(HIER, "fixtures", "metacoach_leader.json.gz.enc"));

const aufrufe = [];
let antworten = {};
globalThis.fetch = async (url) => {
  aufrufe.push(String(url));
  if (String(url).endsWith("schluessel.json")) {
    return new Response(JSON.stringify({ salz: SCHLUESSEL.salz, runden: SCHLUESSEL.runden, probe: SCHLUESSEL.probe }));
  }
  const a = antworten[String(url)];
  if (a instanceof Error) throw a;
  if (!a) return new Response("", { status: 404 });
  return new Response(a.body, { status: a.status ?? 200 });
};

test("Ohne Anmeldung gibt es keinen Schluessel und damit kein Book", async () => {
  await assert.rejects(metacoachHolen("book", "_leader"), (e) => e.grund === "schluessel");
});

test("Testpasswort und Testsalz: _leader.json kommt entschluesselt und entpackt an", async () => {
  assert.equal(await anmelden("falsch"), false);
  assert.equal(await anmelden(SCHLUESSEL.passwort), true);
  const url = metacoachBasis() + "/fiesta/book/_leader.json.gz.enc";
  assert.equal(url, "https://meta.nahobinoco.com/fiesta/book/_leader.json.gz.enc");
  antworten = { [url]: { body: GEHEIM } };
  assert.deepEqual(await metacoachHolen("book", "_leader"), SCHLUESSEL.inhalt);
  // Zweiter Abruf aus dem Speicher.
  const vorher = aufrufe.length;
  await metacoachHolen("book", "_leader");
  assert.equal(aufrufe.length, vorher);
});

test("404, nicht erreichbar, falscher Schluessel und fremde Namen", async () => {
  const basis = metacoachBasis() + "/fiesta/";
  antworten = {
    [basis + "book/OP01-001.json.gz.enc"]: { body: "", status: 404 },
    [basis + "netz/wertnetz.json.gz.enc"]: new TypeError("Failed to fetch"),
    [basis + "book/OP02-001.json.gz.enc"]: { body: Buffer.from("x".repeat(40)) },
  };
  await assert.rejects(metacoachHolen("book", "OP01-001"), (e) => e.grund === "fehlt");
  await assert.rejects(metacoachHolen("netz", "wertnetz"), (e) => e.grund === "netz");
  await assert.rejects(metacoachHolen("book", "OP02-001"), (e) => e.grund === "kaputt");
  await assert.rejects(metacoachHolen("book", "../geheim"), (e) => e.grund === "fehlt");
  await assert.rejects(metacoachHolen("analyse", "x"), (e) => e.grund === "fehlt");
  // Ein Fehlschlag wird nicht gemerkt: beim naechsten Mal fragt es neu.
  antworten[basis + "netz/wertnetz.json.gz.enc"] = { body: GEHEIM };
  assert.deepEqual(await metacoachHolen("netz", "wertnetz"), SCHLUESSEL.inhalt);
});
