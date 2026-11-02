import { test } from "node:test";
import assert from "node:assert/strict";
import { bilanzNachLeader, partienJeListe } from "../src/niederlagen.js";
import { deckSchluessel } from "../src/daten.js";

const p = (gegner_leader, gewonnen) => ({ gegner_leader, gewonnen });

test("Bilanz je Gegnerleader: Siege, Niederlagen, nach Partien sortiert", () => {
  const r = bilanzNachLeader([
    p("OP17-039", false), p("OP17-039", true), p("OP17-039", false),
    p("OP17-058", true), p("OP15-002", false),
  ]);
  assert.deepEqual(r.map((z) => z.leader), ["OP17-039", "OP15-002", "OP17-058"]);
  assert.deepEqual([r[0].siege, r[0].niederlagen], [1, 2]);
});

test("leere Eingaben und Partien ohne Gegnerleader", () => {
  assert.deepEqual(bilanzNachLeader([]), []);
  assert.deepEqual(bilanzNachLeader(undefined), []);
  assert.deepEqual(bilanzNachLeader([p(null, true)]), []);
});

test("Gleichstand: mehr Niederlagen zuerst, dann Kennung", () => {
  const r = bilanzNachLeader([p("B-1", true), p("A-1", false), p("C-1", false)]);
  assert.deepEqual(r.map((z) => z.leader), ["A-1", "C-1", "B-1"]);
});

test("partienJeListe sammelt Partien unter dem Schluessel der Liste", () => {
  const deck = ["OP17-039", "2xOP17-041", "OP17-042"];
  const alle = { spieler: {
    1: { name: "a", partien: [{ deck, eigener_leader: "OP17-039", gegner_leader: "OP17-058", gewonnen: true }] },
    2: { name: "b", partien: [{ deck, eigener_leader: "OP17-039", gegner_leader: "OP15-002", gewonnen: false },
                              { deck: [], eigener_leader: "OP17-039", gegner_leader: "X", gewonnen: true }] },
  } };
  const index = partienJeListe(alle);
  const liste = index.get(deckSchluessel(deck, "OP17-039"));
  assert.equal(liste.length, 2);
  assert.equal(liste[1].gewonnen, false);
  assert.equal(partienJeListe(null).size, 0);
});
