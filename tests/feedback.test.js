import { test } from "node:test";
import assert from "node:assert/strict";
import { MAX_ZEICHEN, nachrichtBauen, pruefen, schluesselAus, senden } from "../src/feedback.js";

test("pruefen: leer und zu lang sind nicht erlaubt", () => {
  assert.notEqual(pruefen(""), "");
  assert.notEqual(pruefen("   "), "");
  assert.notEqual(pruefen("x".repeat(MAX_ZEICHEN + 1)), "");
  assert.equal(pruefen("Mehr Mulligan Daten bitte"), "");
});

test("nachrichtBauen: Text, darunter nur die vorhandenen Angaben", () => {
  const n = nachrichtBauen("  Idee  ", { reiter: "Player", leader: "", satz: "OP17 + EB05 Standard", adresse: "https://x/player?id=1" });
  assert.equal(n, "Idee\n\n---\nTab: Player\nData set: OP17 + EB05 Standard\nPage: https://x/player?id=1");
  assert.equal(nachrichtBauen("Nur Text"), "Nur Text");
});

test("schluesselAus: nur ein Text zaehlt", () => {
  assert.equal(schluesselAus({ schluessel: " abc " }), "abc");
  assert.equal(schluesselAus({}), "");
  assert.equal(schluesselAus(null), "");
  assert.equal(schluesselAus(false), "");
});

const antwort = (ok, json) => ({ ok, json: async () => json });

test("senden: schickt Schluessel und Nachricht als JSON", async () => {
  let gesendet = null;
  await senden("k", "Idee", { reiter: "Decklists" }, async (url, opt) => {
    gesendet = { url, body: JSON.parse(opt.body) };
    return antwort(true, { success: true });
  });
  assert.equal(gesendet.url, "https://api.web3forms.com/submit");
  assert.equal(gesendet.body.access_key, "k");
  assert.match(gesendet.body.message, /^Idee\n\n---\nTab: Decklists$/);
});

test("senden: Fehler des Dienstes, des Netzes und fehlender Schluessel werfen", async () => {
  await assert.rejects(senden("k", "Idee", {}, async () => antwort(true, { success: false })));
  await assert.rejects(senden("k", "Idee", {}, async () => antwort(false, null)));
  await assert.rejects(senden("k", "Idee", {}, async () => { throw new TypeError("offline"); }));
  await assert.rejects(senden("", "Idee", {}, async () => antwort(true, { success: true })), /not set up/);
  await assert.rejects(senden("k", "", {}, async () => antwort(true, { success: true })), /write something/);
});
