// Tests fuer das Zusammenrechnen der Tagesdateien in src/daten.js, hier die Kartenwerte
// fuer den Reiter Analysis (specs/features/mulligan-guide.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { _speicherLeeren, anmelden, EntsperrFehler, holen, verschluesselung, verschmelzen } from "../src/daten.js";

const tag = (keep, kopien) => ({
  partien: 10,
  leader: [{ id: "1xOP17-039", w: 6, l: 4, hand: { "OP17-054": keep }, kopien }],
});

test("Kartenwerte werden ueber Tage addiert", () => {
  const s = verschmelzen([
    tag([1, 2, 3, 4, 5, 6, 7, 8], { "2xOP17-041": [10, 6] }),
    tag([1, 1, 1, 1, 1, 1, 1, 1], { "2xOP17-041": [5, 1], "4xOP08-051": [3, 3] }),
  ], "probe");
  const x = s.leader[0];
  assert.deepEqual(x.hand["OP17-054"], [2, 3, 4, 5, 6, 7, 8, 9]);
  assert.deepEqual(x.kopien["2xOP17-041"], [15, 7]);
  assert.deepEqual(x.kopien["4xOP08-051"], [3, 3]);
});

test("Tagesdateien ohne Kartenwerte (Format 1) gehen weiter", () => {
  const s = verschmelzen([{ partien: 5, leader: [{ id: "1xOP17-039", w: 3, l: 2 }] }], "alt");
  assert.deepEqual(s.leader[0].hand, {});
  assert.deepEqual(s.leader[0].kopien, {});
});

/* Haerten (specs/features/haerten.md): Abrufe mit vorgetaeuschtem fetch. */

const json = (wert) => ({ ok: true, status: 200, arrayBuffer: async () => new TextEncoder().encode(JSON.stringify(wert)).buffer, json: async () => wert });
const fehlt = () => ({ ok: false, status: 404 });
const kaputt = () => ({ ok: false, status: 503 });

async function mitFetch(antworten, lauf) {
  const vorher = globalThis.fetch;
  const aufrufe = [];
  globalThis.fetch = async (adresse) => {
    aufrufe.push(adresse);
    const naechste = antworten.shift();
    if (naechste instanceof Error) throw naechste;
    return naechste;
  };
  _speicherLeeren();
  try {
    await lauf(aufrufe);
  } finally {
    globalThis.fetch = vorher;
    _speicherLeeren();
  }
}

test("Ein gescheiterter Abruf wird beim naechsten Versuch neu geholt (P2-1)", async () => {
  await mitFetch([kaputt(), json({ a: 1 })], async (aufrufe) => {
    await assert.rejects(holen("karten.json.gz"), /HTTP 503/);
    assert.deepEqual(await holen("karten.json.gz"), { a: 1 });
    assert.equal(aufrufe.length, 2);
  });
});

test("Ein gelungener Abruf bleibt im Zwischenspeicher", async () => {
  await mitFetch([json({ a: 1 })], async (aufrufe) => {
    await holen("verzeichnis.json.gz");
    await holen("verzeichnis.json.gz");
    assert.equal(aufrufe.length, 1);
  });
});

test("Netzfehler bei schluessel.json wird nicht als unverschluesselt gemerkt (P2-2)", async () => {
  await mitFetch([new TypeError("offline"), fehlt()], async () => {
    await assert.rejects(verschluesselung(), (f) => f instanceof EntsperrFehler && f.grund === "netz");
    assert.equal(await verschluesselung(), false);
  });
});

test("503 bei schluessel.json wirft und wird nicht gemerkt", async () => {
  await mitFetch([kaputt(), json({ salz: "AAAA", probe: "AAAA", runden: 1 })], async () => {
    await assert.rejects(verschluesselung(), (f) => f.grund === "netz");
    assert.equal((await verschluesselung()).runden, 1);
  });
});

test("index.html statt schluessel.json (Vite Entwicklung) heisst unverschluesselt", async () => {
  const html = { ok: true, status: 200, headers: new Map([["content-type", "text/html"]]), json: async () => { throw new SyntaxError("x"); } };
  await mitFetch([html], async () => {
    assert.equal(await verschluesselung(), false);
  });
});

test("Kaputte schluessel.json meldet kaputt", async () => {
  await mitFetch([json({ salz: 3 })], async () => {
    await assert.rejects(verschluesselung(), (f) => f instanceof EntsperrFehler && f.grund === "kaputt");
  });
});

test("Ohne crypto.subtle meldet anmelden krypto statt zu werfen (P1-3)", async () => {
  const echt = Object.getOwnPropertyDescriptor(globalThis, "crypto");
  Object.defineProperty(globalThis, "crypto", { value: {}, configurable: true, writable: true });
  try {
    await mitFetch([json({ salz: "AAAA", probe: "AAAA", runden: 1 })], async () => {
      await assert.rejects(anmelden("x"), (f) => f instanceof EntsperrFehler && f.grund === "krypto");
    });
  } finally {
    Object.defineProperty(globalThis, "crypto", echt);
  }
});

test("Ohne Tage ergibt verschmelzen einen leeren Satz statt eines Fehlers (P2-3)", () => {
  const s = verschmelzen([], "2026-11-01 to 2026-11-02");
  assert.deepEqual(s.leader, []);
  assert.equal(s.partien, 0);
});
