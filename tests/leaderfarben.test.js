import { test } from "node:test";
import assert from "node:assert/strict";
import { farbBuchstaben, leaderTon, fahnenFarben, mischen, themaFarbe, LEADERFARBE, STROH, FIESTA } from "../src/leaderfarben.js";

test("farbBuchstaben: nur bekannte, ohne Doppel, hoechstens zwei", () => {
  assert.deepEqual(farbBuchstaben("rb"), ["r", "b"]);
  assert.deepEqual(farbBuchstaben("bb"), ["b"]);
  assert.deepEqual(farbBuchstaben("xq"), []);
  assert.deepEqual(farbBuchstaben(undefined), []);
});

test("leaderTon: einfarbig zweimal derselbe, zweifarbig beide, ohne Farbe null", () => {
  assert.deepEqual(leaderTon("p"), { eins: LEADERFARBE.p, zwei: LEADERFARBE.p });
  assert.deepEqual(leaderTon("rb"), { eins: LEADERFARBE.r, zwei: LEADERFARBE.b });
  assert.equal(leaderTon(""), null);
});

test("fahnenFarben: Kartenfarben und Stroh, ohne Leader die Fiestafarben", () => {
  assert.deepEqual(fahnenFarben("s"), [LEADERFARBE.s, STROH]);
  assert.deepEqual(fahnenFarben("py"), [LEADERFARBE.p, LEADERFARBE.y, STROH]);
  assert.equal(fahnenFarben(null), FIESTA);
});

test("mischen und themaFarbe", () => {
  assert.equal(mischen("#ffffff", "#000000", 0.5), "#808080");
  assert.equal(mischen("#3e7bfa", "#08090a", 1), "#3e7bfa");
  assert.equal(themaFarbe(""), "#08090a");
  assert.match(themaFarbe("b"), /^#[0-9a-f]{6}$/);
});
