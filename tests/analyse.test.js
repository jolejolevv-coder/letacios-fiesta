import { test } from "node:test";
import assert from "node:assert/strict";
import { ankerBauen, fehlerSuchen, kurveBauen, markenBauen, spielerZuordnen } from "../src/analyse.js";

const schritte = [
  { wer: null, text: "Waiting for a Connection" },
  { wer: "A#1", text: "Draw 1 Don" },
  { wer: "A#1", text: "End Turn" },
  { wer: "B#2", text: "Kaido [OP17-058] attacking Rocks D. Xebec [OP17-039]" },
  { wer: "A#1", text: "Discard Shiki [OP17-048] for Counter 2000" },
  { wer: "B#2", text: "End Turn" },
  { wer: "A#1", text: "Rocks D. Xebec [OP17-039] attacking Kaido [OP17-058]" },
  { wer: "A#1", text: "End Turn" },
];

const analyse = {
  spieler: { 1: { leader: "OP17-039", first: true }, 2: { leader: "OP17-058", first: false } },
  kurve: [{ hz: 0, wer: 1, T: 1, v1: 52 }, { hz: 1, wer: 2, T: 1, v1: 45 }, { hz: 2, wer: 1, T: 2, v1: 58 }],
  entscheidungen: [
    { wer: 1, art: "abwehr", angriff: 0, note: "mistake", verlust: 6 },
    { wer: 1, art: "angriff", angriff: 1, note: "best", verlust: 0 },
    { wer: 2, art: "mulligan", angriff: null, note: "good", verlust: 1 },
    { wer: 1, art: "angriff", angriff: 9, note: "blunder", verlust: 12 },
  ],
};

test("Anker: Angriffe, Zugenden und wer beginnt", () => {
  const a = ankerBauen(schritte);
  assert.deepEqual(a.angriffe, [3, 6]);
  assert.deepEqual(a.zugEnden, [2, 5, 7]);
  assert.equal(a.erster, "A#1");
});

test("Spieler ueber den Leader, im Mirror ueber den Sitz", () => {
  assert.deepEqual(spielerZuordnen(analyse, { "A#1": "OP17-039", "B#2": "OP17-058" }, "A#1"), { 1: "A#1", 2: "B#2" });
  const mirror = { spieler: { 1: { leader: "OP17-039", first: false }, 2: { leader: "OP17-039", first: true } } };
  assert.deepEqual(spielerZuordnen(mirror, { "A#1": "OP17-039", "B#2": "OP17-039" }, "A#1"), { 1: "B#2", 2: "A#1" });
});

test("Marken am Schritt, Angriffe ausserhalb des Logs fallen weg", () => {
  const m = markenBauen(analyse, ankerBauen(schritte));
  assert.deepEqual(m.map((x) => [x.art, x.schritt]), [["mulligan", 0], ["abwehr", 3], ["angriff", 6]]);
});

test("Kurve aus Sicht beider Spieler", () => {
  const a = ankerBauen(schritte);
  assert.deepEqual(kurveBauen(analyse, a, "1").map((k) => [k.schritt, k.wert]), [[2, 52], [5, 45], [7, 58]]);
  assert.deepEqual(kurveBauen(analyse, a, "2").map((k) => k.wert), [48, 55, 42]);
});

test("Fehler vor und zurueck", () => {
  const m = markenBauen(analyse, ankerBauen(schritte));
  assert.equal(fehlerSuchen(m, 0, 1), 3);
  assert.equal(fehlerSuchen(m, 3, 1), null);
  assert.equal(fehlerSuchen(m, 7, -1), 3);
  assert.equal(fehlerSuchen(m, 3, -1), null);
});
