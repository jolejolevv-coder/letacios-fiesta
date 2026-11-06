import { test } from "node:test";
import assert from "node:assert/strict";
import { verlaufBauen } from "../src/verlauf.js";

test("verlaufBauen: weniger als zwei Werte ergibt keine Kurve", () => {
  assert.equal(verlaufBauen([]), null);
  assert.equal(verlaufBauen([1500]), null);
  assert.equal(verlaufBauen(undefined), null);
  assert.equal(verlaufBauen(["x", null]), null);
});

test("verlaufBauen: Kennwerte Start, Hoch, Jetzt und Zahl der Partien", () => {
  const k = verlaufBauen([1424.6, 1600, 1550.2]);
  assert.equal(k.start, 1424.6);
  assert.equal(k.hoch, 1600);
  assert.equal(k.jetzt, 1550.2);
  assert.equal(k.partien, 3);
});

test("verlaufBauen: x laeuft ueber die volle Breite, der Hoechstwert liegt oben mit Rand", () => {
  const k = verlaufBauen([0, 100], 1000, 120);
  const punkte = k.linie.split(" ").map((p) => p.split(",").map(Number));
  assert.equal(punkte[0][0], 0);
  assert.equal(punkte[1][0], 1000);
  assert.ok(punkte[1][1] > 0 && punkte[1][1] < 20, "hoch liegt nahe oben, aber nicht am Rand");
  assert.ok(punkte[0][1] < 120 && punkte[0][1] > 100, "tief liegt nahe unten, aber nicht am Rand");
});

test("verlaufBauen: flache Kurve teilt nicht durch null", () => {
  const k = verlaufBauen([2000, 2000, 2000]);
  assert.ok(!k.linie.includes("NaN"));
});

test("verlaufBauen: Flaeche ist bis an den Boden geschlossen", () => {
  const k = verlaufBauen([1, 2], 1000, 120);
  assert.ok(k.flaeche.startsWith("0,120 "));
  assert.ok(k.flaeche.endsWith(" 1000,120"));
});

test("verlaufBauen: kaputte Eintraege fallen weg", () => {
  const k = verlaufBauen([1, "2", null, 3, NaN]);
  assert.equal(k.partien, 2);
});
