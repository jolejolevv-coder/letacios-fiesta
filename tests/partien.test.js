import { test } from "node:test";
import assert from "node:assert/strict";
import { istKomplett, partienTeilen } from "../src/partien.js";

test("istKomplett: nur mit beiden Leadern", () => {
  assert.equal(istKomplett({ eigener_leader: "OP17-039", gegner_leader: "OP13-001" }), true);
  assert.equal(istKomplett({ eigener_leader: "OP17-039", gegner_leader: "" }), false);
  assert.equal(istKomplett({ eigener_leader: null, gegner_leader: "OP13-001" }), false);
  assert.equal(istKomplett(null), false);
});

test("partienTeilen: Reihenfolge bleibt, Rest wird gezaehlt", () => {
  const a = { eigener_leader: "A", gegner_leader: "B", zeit: "3" };
  const b = { eigener_leader: "A", gegner_leader: "", zeit: "2" };
  const c = { eigener_leader: "C", gegner_leader: "D", zeit: "1" };
  assert.deepEqual(partienTeilen([a, b, c]), { sichtbar: [a, c], ausgeblendet: 1 });
});

test("partienTeilen: ohne Liste leer", () => {
  assert.deepEqual(partienTeilen(undefined), { sichtbar: [], ausgeblendet: 0 });
});
