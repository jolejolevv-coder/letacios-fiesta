// Der Leser src/zuglager.js gegen die Referenz aus Metacoach (tests/referenz/README.md):
// gleiche Zuege, Angriffe, Antworten, Boards, Hand und Mulligan wie zug_lager.partie_lesen.
// Die Logs liest der Test aus dem Ordner von OPTCGSim; fehlen sie, wird uebersprungen.
import { test } from "node:test";
import assert from "node:assert/strict";
import { auswerten, crc32, eigeneNummer, partieLesen, pyStrip, spielerZuordnung, zeilenTrennen } from "../src/zuglager.js";
import * as H from "./referenz_hilfen.js";

const grund = H.logsFehlen() || H.kartenFehlen();

test("20 Referenzlogs: Zuglager wie in Python", { skip: grund }, () => {
  const events = H.eventsLesen();
  for (const e of H.index().logs) {
    const [ergebnis, zeilen] = partieLesen(H.logLesen(e.id), { id: e.id, timestamp: e.id.slice(0, 10) }, events);
    assert.equal(ergebnis, "ok", e.id);
    const { namen, ...partie } = zeilen[0];
    assert.equal(Object.keys(namen).length, 2);
    // Ueber JSON, damit undefined und fehlende Felder wie in Python gleich zaehlen.
    assert.deepEqual(JSON.parse(JSON.stringify(partie)), H.referenz(e.id, "zuglager"), e.id);
  }
});

test("Die eigene Seite ist die mit der Starthand vor dem Mulligan", { skip: grund }, () => {
  const events = H.eventsLesen();
  for (const e of H.index().logs) {
    const [, [p]] = partieLesen(H.logLesen(e.id), { id: e.id, timestamp: e.id.slice(0, 10) }, events);
    assert.equal(eigeneNummer(p), e.nr, e.id);
  }
});

// Ein kleines, erfundenes Log fuer die Grenzfaelle ohne echte Daten.
const LOG = [
  "[A​#1] Leader is Rocks D. Xebec [<link=\"OP17-039\">OP17-039</link>]",
  "[B#2] Leader is Kaido [OP17-058]",
  "RZ1|PLY|1|A​#1|OP17-039",
  "RZ1|CHK|1|1|40|5|0|5|10|0|0|0|1|0",
  "RZ1|CHK|2|2|40|5|0|5|10|0|0|0|1|0",
  "[A​#1] Life: 5",
  "[B#2] Life: 5",
  "[A​#1] Hand before Mulligan: [OP17-040, OP17-043]",
  "[A​#1] Hand: [OP17-040, OP17-043]",
  "[A​#1] Draw 1 Don",
  "RZ1|CHK|3|1|40|5|0|5|9|1|0|0|1|0",
  "[A​#1] End Turn",
  "[B#2] Draw 2 Don",
  "[B#2] End Turn",
  "[A​#1] Draw 2 Don",
  "[A​#1] End Turn",
  "[B#2] Draw 2 Don",
  "[B#2] Concedes!",
].join("\r\n");

test("Kleines Log: Zuordnung, Sieger per Concede, Zuege", () => {
  const roh = zeilenTrennen(LOG);
  const zu = spielerZuordnung(roh);
  assert.deepEqual(zu, { "A​#1": 1, "B#2": 2 });
  const info = auswerten(roh, zu);
  assert.equal(info.sieger, "A​#1");
  assert.equal(info.art, "concede");
  assert.equal(info.erster, "A​#1");
  const [g, [p]] = partieLesen(LOG, { id: "probe", timestamp: "2026-10-22T10" });
  assert.equal(g, "ok");
  assert.equal(p.tag, "2026-10-22");
  assert.equal(p.erster, 1);
  assert.equal(p.sieger, 1);
  assert.deepEqual(p.leader, { 1: "OP17-039", 2: "OP17-058" });
  assert.equal(p.zuege.length, 3);         // der letzte Zug ohne Plays und Angriffe faellt weg
  assert.deepEqual(p.mulligan["1"].hand_vor, ["OP17-040", "OP17-043"]);
  assert.equal(eigeneNummer(p), 1);
});

test("Kaputte und unvollstaendige Logs geben einen Grund statt eines Fehlers", () => {
  assert.equal(partieLesen("", { id: "x" })[0], "keine zwei spieler");
  assert.equal(partieLesen("hallo\nwelt", { id: "x" })[0], "keine zwei spieler");
  const ohneSieger = LOG.replace("[B#2] Concedes!", "");
  assert.equal(partieLesen(ohneSieger, { id: "x" })[0], "kein sieger");
  const kaputt = LOG.replace("RZ1|CHK|3|1|40|5|0|5|9|1|0|0|1|0", "RZ1|CHK|3|1|40|5|x|5|9|1|0|0|1|0");
  assert.equal(partieLesen(kaputt, { id: "x" })[0], "log kaputt");
});

test("Python Helfer: strip, Zeilenenden, crc32", () => {
  assert.equal(pyStrip("  x 　"), "x");
  assert.equal(pyStrip("﻿x"), "﻿x");      // kein Leerraum in Python
  assert.deepEqual(zeilenTrennen("a\r\nb\rc\nd\n"), ["a", "b", "c", "d"]);
  assert.equal(crc32("123456789"), 0xcbf43926);
});
