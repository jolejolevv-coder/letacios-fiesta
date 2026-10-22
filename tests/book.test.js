// Die englischen Saetze des Book (src/book.js) mit denselben Grenzen wie saetze.ts in
// Metacoach. Der Abgleich mit Metacoach selbst laeuft, wenn dessen Quellen und das Book der
// Referenz lokal liegen (Xebec gegen Kaido, first und second, wie in der Abnahme).
import { test } from "node:test";
import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  abwehrSatz, angriffSatz, bookAusschnitt, gegnerListe, mulliganSatz, ortEnglisch, spielenSaetze,
  spitzeSatz, unterschiedeImZug, zuegeMitDaten,
} from "../src/book.js";
import * as H from "./referenz_hilfen.js";

const namen = (id) => id;
const karte = (k, rate, wert, n = 100) => ({ karte: k, rate, wert, n_hand: n, n_gespielt: Math.round((n * rate) / 100) });

test("Spielen: Standard ab 90 %, sonst die beste Karte ueber 1 Punkt, halten unter minus 2,5", () => {
  const a = { karten: { 2: [karte("A", 91, 0.2), karte("B", 50, 3), karte("C", 40, -3)] } };
  const s = spielenSaetze(2, null, a, 30, namen);
  assert.deepEqual(s.map((x) => x.text), ["Play A. Almost everyone does.", "Better hold C."]);
  assert.equal(s[0].zahl, "91 %");
  assert.equal(s[0].schaetzung, false);
  assert.equal(s[1].zahl, "−3 points");

  const b = { karten: { 3: [karte("A", 89, 1.01), karte("B", 50, 1.0), karte("C", 20, -9), karte("D", 30, -2.5)] } };
  const t = spielenSaetze(3, null, b, 30, namen);
  assert.deepEqual(t.map((x) => x.text), ["Play A as soon as you can pay for it."]);
  assert.equal(t[0].zahl, "+1 points win chance");

  const zuWenig = { karten: { 1: [karte("A", 99, 5, 29)] } };
  assert.deepEqual(spielenSaetze(1, null, zuWenig, 30, namen).map((x) => x.text), ["Nothing special, play your curve."]);
});

test("Spielen: die Spitze geht vor, wenn sie Karten fuer den Zug hat", () => {
  const spitze = { karten: { 1: [karte("S", 95, 0)] } };
  const feld = { karten: { 1: [karte("F", 95, 0)] } };
  assert.match(spielenSaetze(1, spitze, feld, 30, namen)[0].text, /Play S/);
  assert.match(spielenSaetze(1, { karten: {} }, feld, 30, namen)[0].text, /Play F/);
});

test("Angreifen und Verteidigen", () => {
  const feld = {
    angriffe: [{ T: 4, urteil: "character", q: -0.8 }, { T: 5, urteil: "gleich", q: 0.1 }],
    abwehr: { zug: { 3: { 5: { urteil: "nehmen" }, 2: { urteil: "countern" }, 1: { urteil: "countern" }, 4: { urteil: "gleich" } } } },
  };
  assert.deepEqual(angriffSatz(4, null, feld), {
    text: "If the opponent has a rested character, rather attack the character.", zahl: "+0.8 points", schaetzung: true,
  });
  assert.equal(angriffSatz(5, null, feld), null);
  assert.equal(abwehrSatz(3, null, feld).text, "In the opponent's turn 3: counter at 1 or 2 life; rather take the damage at 5 life.");
  assert.equal(abwehrSatz(4, null, feld), null);
});

test("Mulligan: Abstand 3 Punkte, mindestens 30 je Seite, beide Haelften", () => {
  const m = (k, b, w, wb, ww) => ({ karte: k, behalten: b, weg: w, wr_behalten: wb, wr_weg: ww });
  const a = { mulligan: { karten: [m("A", 100, 40, 55, 50), m("B", 100, 40, 52, 49), m("C", 100, 29, 70, 40), m("D", 50, 50, 40, 46)] } };
  const s = mulliganSatz(a, 30, namen);
  assert.equal(s.text, "Keep if you have A or B; with D, rather mulligan.");
  assert.equal(s.zahl, "real win rate");
  assert.equal(mulliganSatz({ mulligan: { karten: [m("D", 50, 50, 40, 46)] } }, 30, namen).text,
    "No card makes keeping clearly better; with D, rather mulligan.");
  assert.equal(mulliganSatz({ mulligan: { karten: [] } }, 30, namen).text, "No clear advice for the mulligan.");
});

test("Die Starken und der Ort auf Englisch", () => {
  assert.equal(ortEnglisch("Gegnerzug 3, 4 Life"), "opponent turn 3, 4 life");
  assert.equal(ortEnglisch("2 Life, 3000 Counter nötig"), "2 life, 3000 counter needed");
  const u = { art: "abwehr", ort: "Gegnerzug 3, 4 Life", spitze: 61.2, feld: 40.4 };
  assert.deepEqual(spitzeSatz(u, namen), {
    text: "Top players counter more often here (opponent turn 3, 4 life).", zahl: "top players 61 %, others 40 %", schaetzung: false,
  });
  assert.equal(spitzeSatz({ art: "karte", karte: "X", spitze: 10, feld: 30 }, namen).text, "Top players play X less often.");
  assert.deepEqual(unterschiedeImZug([{ art: "karte", T: 2 }, { art: "abwehr", T: 2 }, { art: "angriff", T: 3 }], 2), [{ art: "karte", T: 2 }]);
});

test("Ausschnitt: Rueckfall auf alle Gegner, Mihawk und Unbekanntes", () => {
  const daten = {
    leader: "L", gegner: {
      alle: { partien: { first: 900, second: 800 }, first: { feld: { zuege: [{ T: 1 }] }, spitze: null, unterschiede: [] } },
      K: { partien: { first: 50, second: 300 }, first: { rueckfall: true }, second: { feld: { zuege: [{ T: 2 }] } } },
      "OP14-020": { partien: { first: 999, second: 999 } },
    },
  };
  const b = bookAusschnitt(daten, "K", "first");
  assert.equal(b.rueckfall, true);
  assert.deepEqual(zuegeMitDaten(b), [1]);
  assert.equal(bookAusschnitt(daten, "K", "second").rueckfall, false);
  assert.equal(bookAusschnitt(daten, "OP14-020", "first"), null);
  assert.equal(bookAusschnitt(daten, "X", "first"), null);
  assert.deepEqual(gegnerListe(daten).map((g) => g.gegner), ["alle", "K"]);
});

// ------------------------------------------------------------ Abgleich mit Metacoach

const SAETZE_TS = path.join(os.homedir(), "Downloads", "meta-coach", "web", "src", "saetze.ts");
const BOOK = path.join(H.EINGABEN, "book_OP17-039.json.gz");
const KAIDO = "OP17-058";
const ohneMetacoach = !fs.existsSync(SAETZE_TS) ? "meta-coach/web/src/saetze.ts fehlt"
  : !fs.existsSync(BOOK) ? "Book der Referenz fehlt" : false;

/* Kartennummern und Zahlen eines Satzes, unabhaengig von Sprache und Zahlformat. */
function kern(s) {
  if (!s) return null;
  const karten = (s.text.match(/[A-Z]{2,4}\d{2}-\d{3}/g) || []).join(" ");
  const zahlen = ((s.text + " " + (s.zahl ?? "")).match(/\d+(?:[.,]\d+)?/g) || [])
    .filter((z) => !/^\d{2}-\d{3}$/.test(z))
    .map((z) => z.replace(",", "."));
  return { karten, zahlen: zahlen.join(" "), schaetzung: s.schaetzung };
}

test("Xebec gegen Kaido first und second: dieselben Ratschlaege wie das Book in Metacoach", { skip: ohneMetacoach }, async () => {
  const mc = await import(SAETZE_TS);
  const daten = H.jsonLesen(BOOK);
  for (const sitz of ["first", "second"]) {
    const b = bookAusschnitt(daten, KAIDO, sitz);
    assert.ok(b, sitz);
    // saetze.ts liest den Namen aus der Karte (die API haengt ihn an); hier die Nummer.
    const mitNamen = (a) => a && JSON.parse(JSON.stringify(a), (k, v) => (v && v.karte && !v.name ? { ...v, name: v.karte } : v));
    const spitze = mitNamen(b.spitze);
    const feld = mitNamen(b.feld);
    const mindest = b.grenzen.min_zelle;
    let saetze = 0;
    for (const T of zuegeMitDaten(b)) {
      const ich = spielenSaetze(T, b.spitze, b.feld, mindest, namen).map(kern);
      const dort = mc.spielenSaetze(T, spitze, feld, mindest).map(kern);
      // Der Satz ohne Rat nennt nichts; dort wie hier.
      assert.deepEqual(ich, dort, `${sitz} Zug ${T} spielen`);
      assert.deepEqual(kern(angriffSatz(T, b.spitze, b.feld)), kern(mc.angriffSatz(T, spitze, feld)), `${sitz} Zug ${T} angreifen`);
      assert.deepEqual(kern(abwehrSatz(T, b.spitze, b.feld)), kern(mc.abwehrSatz(T, spitze, feld)), `${sitz} Zug ${T} verteidigen`);
      const u = unterschiedeImZug(b.unterschiede, T);
      assert.deepEqual(u.map((x) => kern(spitzeSatz(x, namen))), mc.unterschiedeImZug(b.unterschiede, T).map((x) => kern(mc.spitzeSatz(x, namen))));
      saetze += ich.length;
    }
    assert.deepEqual(kern(mulliganSatz(b.feld ?? b.spitze, mindest, namen)), kern(mc.mulliganSatz(feld ?? spitze, mindest, namen)), sitz + " Mulligan");
    assert.ok(saetze >= 5, sitz);
  }
});
