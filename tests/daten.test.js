// Tests fuer das Zusammenrechnen der Tagesdateien in src/daten.js, hier die Kartenwerte
// fuer den Reiter Analysis (specs/features/mulligan-guide.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { _imSpeicher, _speicherLeeren, anmelden, EntsperrFehler, holen, verschluesselung, verschmelzen, zeitraumLaden } from "../src/daten.js";

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

/* Optimieren (specs/features/optimieren.md): Zeitraum in Gruppen, gleiches Ergebnis. */

const LEADER = ["OP17-039", "OP16-001", "EB05-001", "ST30-001"];
function tagesdatei(n) {
  return {
    partien: 40 + n,
    stand: "2026-11-0" + n,
    leader: LEADER.map((id, k) => ({
      id: (k + 1) + "x" + id, w: 5 + n + k, l: 4 + k, fw: 3, fl: 2, sw: 2 + n, sl: 2, dur: 600 + n * 10 + k,
      geg: LEADER.filter((g) => g !== id).map((g) => "1x" + g), gm: [3, 2 + n, 1], gw: [2, 1, n % 2],
      gfw: [1, 1, 0], gfl: [1, 0, 1], gsw: [1, 0, 0], gsl: [0, 1, 0],
      hand: { "OP17-054": [n, 1, 2, 3, 4, 5, 6, 7] }, kopien: { ["2xOP17-04" + (n % 3)]: [n + 1, 1] },
      listen: [{ d: ["4xOP17-041", "4xOP17-04" + (n % 4)], w: 2 + k, l: 1, fw: 1, fl: 0, sw: 1, sl: 1, dur: 500 + n }],
    })).concat([{ id: "Mobile", w: 9, l: 9 }]),
  };
}
const DATEIEN = [1, 2, 3, 4, 5, 6, 7].map((n) => "tage/2026-11-0" + n + "__mode_0__25_1000.json.gz");
const INHALT = Object.fromEntries(DATEIEN.map((d, i) => [d, tagesdatei(i + 1)]));

async function mitTagen(lauf, { fehlt = null } = {}) {
  const vorher = globalThis.fetch;
  const zustand = { laufend: 0, hoechstens: 0 };
  globalThis.fetch = async (adresse) => {
    const datei = adresse.replace(/^\//, "");
    zustand.laufend += 1;
    zustand.hoechstens = Math.max(zustand.hoechstens, zustand.laufend);
    await new Promise((fertig) => setTimeout(fertig, 2));
    zustand.laufend -= 1;
    return datei === fehlt || !INHALT[datei] ? fehlt_() : json(INHALT[datei]);
  };
  const fehlt_ = () => ({ ok: false, status: 404 });
  _speicherLeeren();
  try {
    await lauf(zustand);
  } finally {
    globalThis.fetch = vorher;
    _speicherLeeren();
  }
}

test("Zeitraum in Gruppen ergibt denselben Satz wie verschmelzen ueber alle Tage", async () => {
  await mitTagen(async () => {
    const neu = await zeitraumLaden(DATEIEN, "probe");
    const alt = verschmelzen(DATEIEN.map((d) => INHALT[d]), "probe");
    assert.deepEqual(neu, alt);
    assert.equal(neu.leader.length, LEADER.length);
  });
});

test("Nach dem Zeitraum liegen keine Tagesdateien mehr im Zwischenspeicher", async () => {
  await mitTagen(async () => {
    await zeitraumLaden(DATEIEN, "probe");
    assert.deepEqual(_imSpeicher().filter((d) => d.startsWith("tage/")), []);
  });
});

test("Hoechstens drei Tagesdateien werden gleichzeitig geholt", async () => {
  await mitTagen(async (zustand) => {
    await zeitraumLaden(DATEIEN, "probe");
    assert.ok(zustand.hoechstens <= 3, "gleichzeitig: " + zustand.hoechstens);
    assert.ok(zustand.hoechstens >= 2, "Gruppen laufen parallel");
  });
});

test("Ein fehlender Tag laesst den Zeitraum scheitern statt einen halben Satz zu liefern", async () => {
  await mitTagen(async () => {
    await assert.rejects(zeitraumLaden(DATEIEN, "probe"), /HTTP 404/);
    assert.deepEqual(_imSpeicher().filter((d) => d.startsWith("tage/")), []);
  }, { fehlt: DATEIEN[4] });
});

test("Derselbe Zeitraum ein zweites Mal wird nicht neu geholt", async () => {
  await mitTagen(async () => {
    const a = await zeitraumLaden(DATEIEN, "probe");
    const b = await zeitraumLaden(DATEIEN, "probe");
    assert.equal(a, b);
  });
});

/* Bilder und Leistung (specs/features/bilder-leistung.md): Reihenfolge der Bildquellen. */
import { bildQuellen, BILD_CDN } from "../src/daten.js";

test("Kleine Bilder kommen zuerst aus der eigenen Datei, das CDN ist der Rueckfall", () => {
  const [erste, zweite] = bildQuellen("OP17-039");
  assert.match(erste, /img\/OP17-039\.jpg$/);
  assert.equal(zweite, BILD_CDN + "OP17-039.webp");
});

test("Scharfe Bilder kommen zuerst vom CDN, die eigene Datei ist der Rueckfall", () => {
  const [erste, zweite] = bildQuellen("OP17-039", true);
  assert.equal(erste, BILD_CDN + "OP17-039.webp");
  assert.match(zweite, /img\/OP17-039\.jpg$/);
});

test("Karten mit X Vorsilbe zeigen auf das Bild ohne X, in beiden Quellen", () => {
  const quellen = bildQuellen("XOP17-039");
  assert.match(quellen[0], /img\/OP17-039\.jpg$/);
  assert.equal(quellen[1], BILD_CDN + "OP17-039.webp");
});

test("decklistText: eine Zeile je Karte, Leader ohne Anzahl gilt als 1x", async () => {
  const { decklistText } = await import("../src/daten.js");
  assert.equal(decklistText(["OP17-001", "4xST30-004", "2xOP17-045"]), "1xOP17-001\n4xST30-004\n2xOP17-045");
  assert.equal(decklistText(["1xEB02-030", "4xOP08-051"]), "1xEB02-030\n4xOP08-051");
  assert.equal(decklistText(undefined), "");
  assert.equal(decklistText(["", null, "3xOP17-049"]), "3xOP17-049");
});
