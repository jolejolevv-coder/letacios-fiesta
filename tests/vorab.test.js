// Tests fuer den Vorabruf (src/vorab.js) und seine Abnahme in holen (src/daten.js),
// specs/features/ladepfad-handy.md.
import { test } from "node:test";
import assert from "node:assert/strict";
import { gzipSync } from "node:zlib";
import { ABLAGE, abrufArt, brauchtSatz, startDatei, vorabAbnehmen, vorabStarten, VORGABE_SATZ } from "../src/vorab.js";
import { _speicherLeeren, holen } from "../src/daten.js";

const KLARTEXT_HTML = { "content-type": "text/html" };

function antwort(koerper, { status = 200, kopf = {} } = {}) {
  return new Response(koerper, { status, headers: kopf });
}

/** Ersatz fuer fetch, der die Adressen mitschreibt. `antworten` bildet Adresse auf Antwort ab. */
function abrufer(antworten) {
  const aufrufe = [];
  const abrufen = async (adresse, art) => {
    aufrufe.push([adresse, art.cache]);
    const bau = antworten[adresse];
    if (!bau) return antwort("fehlt", { status: 404 });
    return bau();
  };
  return { abrufen, aufrufe };
}

const verzeichnis = { saetze: [{ schluessel: "A", datei: "saetze/A.json.gz" }, { schluessel: "B", datei: "saetze/B.json.gz" }] };

test("startDatei folgt der Regel aus App.jsx", () => {
  assert.equal(startDatei({ ...verzeichnis, start: "B" }), "saetze/B.json.gz");
  assert.equal(startDatei({ ...verzeichnis, start: "fehlt" }), "saetze/A.json.gz");
  const mitVorgabe = { saetze: [...verzeichnis.saetze, { schluessel: VORGABE_SATZ, datei: "saetze/V.json.gz" }] };
  assert.equal(startDatei(mitVorgabe), "saetze/V.json.gz");
  assert.equal(startDatei({ saetze: [] }), null);
  assert.equal(startDatei({ start: "X", saetze: [{ schluessel: "X", datei: "../x" }] }), null);
});

test("brauchtSatz: Leaderboard und Spielerseite ohne Satz, Decklists und Unbekanntes mit", () => {
  assert.equal(brauchtSatz("/decklists"), true);
  assert.equal(brauchtSatz("/"), true);
  assert.equal(brauchtSatz("/irgendwas"), true);
  assert.equal(brauchtSatz("/leaderboard"), false);
  assert.equal(brauchtSatz("/player/"), false);
});

test("Auf dem Leaderboard holt der Vorabruf keinen Satz", async () => {
  const fenster = { location: { pathname: "/leaderboard" } };
  const { abrufen, aufrufe } = abrufer({
    "/schluessel.json": () => antwort("<html>", { kopf: KLARTEXT_HTML }),
    "/verzeichnis.json.gz": () => antwort(gzipSync(JSON.stringify({ ...verzeichnis, start: "B" }))),
  });
  await vorabStarten(fenster, abrufen);
  assert.deepEqual(aufrufe.map((a) => a[0]), ["/schluessel.json", "/verzeichnis.json.gz", "/karten.json.gz"]);
});

test("abrufArt: Saetze aus dem Speicher, alles andere frisch", () => {
  assert.equal(abrufArt("saetze/A.json.gz").cache, "default");
  assert.equal(abrufArt("verzeichnis.json.gz").cache, "no-cache");
});

test("Ohne Verschluesselung: Verzeichnis, Karten und Startsatz werden vorab geholt", async () => {
  const fenster = {};
  const { abrufen, aufrufe } = abrufer({
    "/schluessel.json": () => antwort("<html>", { kopf: KLARTEXT_HTML }),
    "/verzeichnis.json.gz": () => antwort(gzipSync(JSON.stringify({ ...verzeichnis, start: "B" }))),
    "/karten.json.gz": () => antwort("{}"),
    "/saetze/B.json.gz": () => antwort("{}"),
  });
  await vorabStarten(fenster, abrufen);
  assert.deepEqual(aufrufe, [
    ["/schluessel.json", "no-cache"],
    ["/verzeichnis.json.gz", "no-cache"],
    ["/karten.json.gz", "no-cache"],
    ["/saetze/B.json.gz", "default"],
  ]);
  assert.deepEqual(Object.keys(fenster[ABLAGE]).sort(),
    ["/karten.json.gz", "/saetze/B.json.gz", "/schluessel.json", "/verzeichnis.json.gz"]);
});

test("Mit Verschluesselung und gemerktem Passwort: .enc Dateien und Start aus schluessel.json", async () => {
  const fenster = { localStorage: { getItem: () => "pw" } };
  const { abrufen, aufrufe } = abrufer({
    "/schluessel.json": () => antwort(JSON.stringify({ salz: "s", runden: 1, probe: "p", start: "saetze/A.json.gz" }),
      { kopf: { "content-type": "application/json" } }),
  });
  await vorabStarten(fenster, abrufen);
  assert.deepEqual(aufrufe.map((a) => a[0]),
    ["/schluessel.json", "/verzeichnis.json.gz.enc", "/karten.json.gz.enc", "/saetze/A.json.gz.enc"]);
});

test("Mit Verschluesselung ohne Passwort wird nur schluessel.json geholt", async () => {
  const fenster = { localStorage: { getItem: () => null } };
  const { abrufen, aufrufe } = abrufer({
    "/schluessel.json": () => antwort(JSON.stringify({ salz: "s", runden: 1, probe: "p", start: "saetze/A.json.gz" })),
  });
  await vorabStarten(fenster, abrufen);
  assert.deepEqual(aufrufe.map((a) => a[0]), ["/schluessel.json"]);
});

test("Ein fremder start Wert wird nicht geholt", async () => {
  const fenster = { localStorage: { getItem: () => "pw" } };
  const { abrufen, aufrufe } = abrufer({
    "/schluessel.json": () => antwort(JSON.stringify({ start: "https://fremd.example/x" })),
  });
  await vorabStarten(fenster, abrufen);
  assert.equal(aufrufe.length, 3);
});

test("vorabAbnehmen gibt eine Antwort genau einmal heraus", () => {
  const p = Promise.resolve("a");
  const fenster = { [ABLAGE]: { "/x": p } };
  assert.equal(vorabAbnehmen("/x", fenster), p);
  assert.equal(vorabAbnehmen("/x", fenster), null);
  assert.equal(vorabAbnehmen("/y", {}), null);
});

/* Abnahme in holen: der Vorabruf liegt in globalThis, wie im Browser in window. */
async function mitAblage(ablage, fetchErsatz, lauf) {
  const vorher = globalThis.fetch;
  const aufrufe = [];
  globalThis.fetch = async (adresse) => {
    aufrufe.push(adresse);
    return fetchErsatz(adresse);
  };
  globalThis[ABLAGE] = ablage;
  _speicherLeeren();
  try {
    await lauf(aufrufe);
  } finally {
    globalThis.fetch = vorher;
    delete globalThis[ABLAGE];
    _speicherLeeren();
  }
}

test("holen nimmt den Vorabruf und ruft nicht selbst ab", async () => {
  await mitAblage({ "/karten.json.gz": Promise.resolve(antwort('{"a":1}')) }, () => antwort("{}"), async (aufrufe) => {
    assert.deepEqual(await holen("karten.json.gz"), { a: 1 });
    assert.equal(aufrufe.length, 0);
  });
});

test("Gescheiterter Vorabruf: holen ruft selbst ab", async () => {
  const kaputt = Promise.reject(new TypeError("offline"));
  kaputt.catch(() => {});
  await mitAblage({ "/karten.json.gz": kaputt }, () => antwort('{"b":2}'), async (aufrufe) => {
    assert.deepEqual(await holen("karten.json.gz"), { b: 2 });
    assert.deepEqual(aufrufe, ["/karten.json.gz"]);
  });
});

test("Ohne passenden Vorabruf ruft holen wie bisher ab", async () => {
  await mitAblage({ "/andere.json.gz": Promise.resolve(antwort("{}")) }, () => antwort('{"c":3}'), async (aufrufe) => {
    assert.deepEqual(await holen("karten.json.gz"), { c: 3 });
    assert.deepEqual(aufrufe, ["/karten.json.gz"]);
  });
});
