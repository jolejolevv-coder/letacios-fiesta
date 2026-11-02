import { test } from "node:test";
import assert from "node:assert/strict";
import { niederlagenNachLeader } from "../src/niederlagen.js";

const p = (gegner_leader, gewonnen, replay) => ({ gegner_leader, gewonnen, replay });

test("zaehlt Niederlagen je Gegnerleader, Anteil und Siege dagegen", () => {
  const r = niederlagenNachLeader([
    p("OP17-039", false, "a"), p("OP17-039", false, "b"), p("OP17-039", true),
    p("OP17-058", false), p("OP15-002", true),
  ]);
  assert.deepEqual(r.map((z) => z.leader), ["OP17-039", "OP17-058"]);
  assert.equal(r[0].niederlagen, 2);
  assert.equal(r[0].siege, 1);
  assert.equal(r[0].partien, 3);
  assert.ok(Math.abs(r[0].anteil - 66.666) < 0.01);
  assert.equal(r[0].replay, "a");
  assert.equal(r[1].replay, null);
});

test("Spieler ohne Niederlage oder ohne Partien: leere Liste", () => {
  assert.deepEqual(niederlagenNachLeader([p("OP17-039", true)]), []);
  assert.deepEqual(niederlagenNachLeader([]), []);
  assert.deepEqual(niederlagenNachLeader(undefined), []);
});

test("Partien ohne Gegnerleader zaehlen nicht", () => {
  const r = niederlagenNachLeader([p(null, false), p("OP17-039", false)]);
  assert.equal(r.length, 1);
  assert.equal(r[0].anteil, 100);
});

test("Gleichstand: mehr Partien zuerst, dann Kennung", () => {
  const r = niederlagenNachLeader([
    p("B-1", false), p("A-1", false), p("A-1", true), p("C-1", false),
  ]);
  assert.deepEqual(r.map((z) => z.leader), ["A-1", "B-1", "C-1"]);
});
