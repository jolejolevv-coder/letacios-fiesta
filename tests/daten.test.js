// Tests fuer das Zusammenrechnen der Tagesdateien in src/daten.js, hier die Kartenwerte
// fuer den Reiter Analysis (specs/features/mulligan-guide.md).
import { test } from "node:test";
import assert from "node:assert/strict";
import { verschmelzen } from "../src/daten.js";

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
