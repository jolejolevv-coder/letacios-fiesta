// Tests fuer den Kaizoku Adapter in src/daten.js: Form wie bei aktualisieren.py eindampfen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { kaizokuZuSatz, verschmelzen } from "../src/daten.js";

const roh = {
  stand: "20261102",
  partien: 1000,
  leader: [{
    id: "OP17-039", m: 200, w: 110, first: 0.6, second: 0.5,
    gegner: [["OP05-098", 120, 70], ["OP17-039", 80, 40]],
    listen: [{ d: ["2xOP17-044", "4xOP17-040"], pilot: 3, m: 50, w: 30, gegner: [["OP05-098", 50, 30]] }],
  }],
};

test("Adapter bildet Leader auf die eigene Form ab", () => {
  const s = kaizokuZuSatz(roh);
  const e = s.leader[0];
  assert.equal(e.w, 110);
  assert.equal(e.l, 90);
  assert.deepEqual(e.geg, ["OP05-098", "OP17-039"]);
  assert.deepEqual(e.gm, [120, 80]);
  assert.deepEqual(e.gw, [70, 40]);
  assert.equal(e.fw + e.fl, 100);
  assert.equal(e.fw, 60);
  assert.equal(e.sw, 50);
  assert.equal(s.quelle, "kaizoku");
});

test("verschmelzen liefert Gegner, Listen und Bilanz je Gegner", () => {
  const s = verschmelzen([kaizokuZuSatz(roh)], "Card Kaizoku");
  const e = s.leader[0];
  assert.equal(s.quelle, "kaizoku");
  assert.equal(e.gegner[0].id, "OP05-098");
  assert.equal(e.gegner[0].w, 70);
  assert.equal(e.listen[0].w, 30);
  assert.equal(e.listen[0].l, 20);
  assert.deepEqual(e.listen[0].gegner, [["OP05-098", 50, 30]]);
});

test("eigene Saetze behalten keine Quelle und keine Gegnerbilanz je Liste", () => {
  const s = verschmelzen([{ partien: 5, leader: [{ id: "OP17-039", w: 3, l: 2, listen: [{ d: ["4xOP17-040"], w: 3, l: 2 }] }] }], "x");
  assert.equal(s.quelle, "");
  assert.equal("gegner" in s.leader[0].listen[0], false);
});

test("Leader ohne Siegquote nach Sitz bekommt Nullen", () => {
  const e = kaizokuZuSatz({ leader: [{ id: "OP01-001", m: 10, w: 5, first: null, second: null }] }).leader[0];
  assert.equal(e.fw + e.fl + e.sw + e.sl, 0);
  assert.deepEqual(e.listen, []);
});
