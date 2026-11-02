import { test } from "node:test";
import assert from "node:assert/strict";
import { glaetten, leaderSuchen, TREFFER_MAX } from "../src/leadersuche.js";

const leader = [
  { id: "OP17-039", name: "Rocks.D.Xebec", partien: 42490 },
  { id: "OP17-058", name: "Kaido", partien: 30000 },
  { id: "OP15-002", name: "Lucy", partien: 25000 },
  { id: "OP12-061", name: "Donquixote Rosinante", partien: 12000 },
  { id: "ST29-001", name: "Monkey.D.Luffy", partien: 9000 },
  { id: "OP17-001", name: "Charlotte Linlin", partien: 500 },
];
const ids = (r) => r.map((e) => e.id);

test("glaetten: nur Buchstaben und Ziffern in Kleinschrift", () => {
  assert.equal(glaetten("Rocks.D. Xebec"), "rocksdxebec");
  assert.equal(glaetten("OP17-039"), "op17039");
  assert.equal(glaetten(null), "");
});

test("Leere Anfrage: die meistgespielten, hoechstens TREFFER_MAX", () => {
  const viele = Array.from({ length: 20 }, (_, i) => ({ id: "X-" + i, name: "N" + i, partien: i }));
  const r = leaderSuchen(viele, "  ");
  assert.equal(r.length, TREFFER_MAX);
  assert.equal(r[0].id, "X-19");
});

test("Kartennummer, auch ohne Bindestrich und klein geschrieben", () => {
  assert.deepEqual(ids(leaderSuchen(leader, "OP17-039")), ["OP17-039"]);
  assert.deepEqual(ids(leaderSuchen(leader, "op17039")), ["OP17-039"]);
  assert.deepEqual(ids(leaderSuchen(leader, "op17")), ["OP17-039", "OP17-058", "OP17-001"]);
});

test("Name: Anfang vor Wortanfang vor enthalten", () => {
  assert.deepEqual(ids(leaderSuchen(leader, "xebec")), ["OP17-039"]);
  assert.deepEqual(ids(leaderSuchen(leader, "rosi")), ["OP12-061"]);
  // "lu": Lucy beginnt damit, Luffy nur ein Wort darin.
  assert.deepEqual(ids(leaderSuchen(leader, "lu")), ["OP15-002", "ST29-001"]);
  assert.deepEqual(ids(leaderSuchen(leader, "linlin")), ["OP17-001"]);
});

test("Kein Treffer ergibt eine leere Liste", () => {
  assert.deepEqual(leaderSuchen(leader, "zzz"), []);
});
