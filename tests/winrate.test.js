// Tests fuer die Lesart der Winrate (src/winrate.js) und die Adresse der grossen
// Kartenbilder (grossesBild in src/daten.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { seite, ton, wrKlasse, GUT, SCHWACH, VOLL_AB } from "../src/winrate.js";
import { grossesBild } from "../src/daten.js";

test("Klassen an den Grenzen", () => {
  assert.equal(wrKlasse(GUT), "wr gut");
  assert.equal(wrKlasse(GUT - 0.1), "wr");
  assert.equal(wrKlasse(SCHWACH), "wr");
  assert.equal(wrKlasse(SCHWACH - 0.1), "wr schwach");
  assert.equal(wrKlasse(null), "wr leer");
  assert.equal(seite(undefined), "");
});

test("Toenung waechst mit dem Abstand von 50 und ist gedeckelt", () => {
  assert.deepEqual(ton(50), { richtung: "", staerke: 0 });
  assert.deepEqual(ton(50 + VOLL_AB / 2), { richtung: "plus", staerke: 0.5 });
  assert.deepEqual(ton(50 - VOLL_AB), { richtung: "minus", staerke: 1 });
  assert.deepEqual(ton(5), { richtung: "minus", staerke: 1 });
  assert.ok(ton(52).staerke < ton(58).staerke);
  assert.deepEqual(ton(null), { richtung: "", staerke: 0 });
});

test("grosses Bild kommt von Metacoach, mit Varianten und ohne X", () => {
  assert.equal(grossesBild("OP17-039"), "https://meta.nahobinoco.com/fiesta/bilder/OP17-039.jpg");
  assert.equal(grossesBild("XOP12-040"), "https://meta.nahobinoco.com/fiesta/bilder/OP12-040.jpg");
  assert.equal(grossesBild("P-001"), "https://meta.nahobinoco.com/fiesta/bilder/P-001.jpg");
  assert.equal(grossesBild("OP01-001_p1"), "https://meta.nahobinoco.com/fiesta/bilder/OP01-001_p1.jpg");
  for (const schlecht of ["Mobile", "../x", "OP17-039.jpg", "", null, "op17-039"]) {
    assert.equal(grossesBild(schlecht), null, String(schlecht));
  }
});

import { fokusOrdnen, matrixOrdnen, sortAusText } from "../src/winrate.js";

const L = (id, w, l) => ({ id, w, l });
// Nach Partien geordnet, wie satz.leader: A 100, B 90, C 80, D 70 Partien.
const FELD = [L("A", 50, 50), L("B", 54, 36), L("C", 32, 48), L("D", 42, 28)];

test("Matrix nach Partien laesst die Reihenfolge, nimmt nur die Top", () => {
  assert.deepEqual(matrixOrdnen(FELD, 3, "partien").map((e) => e.id), ["A", "B", "C"]);
});

test("Matrix nach Winrate ordnet nur innerhalb der Top", () => {
  assert.deepEqual(matrixOrdnen(FELD, 3, "wr").map((e) => e.id), ["B", "A", "C"]);
  assert.deepEqual(matrixOrdnen(FELD, 4, "wr").map((e) => e.id), ["B", "D", "A", "C"]);
  assert.deepEqual(matrixOrdnen(FELD, 4, "wr_auf").map((e) => e.id), ["B", "D", "A", "C"]);
});

test("Gleiche Winrate behaelt die Partienfolge", () => {
  assert.deepEqual(matrixOrdnen([L("X", 5, 5), L("Y", 1, 1)], 2, "wr").map((e) => e.id), ["X", "Y"]);
});

test("Fokus nach Partien und nach Winrate in beide Richtungen", () => {
  const z = [{ id: "P", w: 30, m: 50 }, { id: "Q", w: 70, m: 100 }, { id: "R", w: 20, m: 50 }, { id: "S", w: 35, m: 70 }];
  assert.deepEqual(fokusOrdnen(z, "partien").map((x) => x.id), ["Q", "S", "P", "R"]);
  assert.deepEqual(fokusOrdnen(z, "wr").map((x) => x.id), ["Q", "P", "S", "R"]);
  assert.deepEqual(fokusOrdnen(z, "wr_auf").map((x) => x.id), ["R", "S", "P", "Q"]);
  assert.equal(z[0].id, "P");   // Eingabe bleibt unveraendert
});

test("Sortwahl aus der Adresse", () => {
  assert.equal(sortAusText("wr"), "wr");
  assert.equal(sortAusText("wr_auf"), "wr_auf");
  assert.equal(sortAusText(null), "partien");
  assert.equal(sortAusText("<script>"), "partien");
});
