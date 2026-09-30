// Tests fuer die Angriffspfeile in src/replay.js, siehe
// specs/features/replay-angriffspfeile.md. Aufruf: npm test
//
// Die Partien sind von Hand gebaut, im Format der eingedampften Replays:
//   { p: [nummer, name, leader] }                  Spieler
//   { m: [nummer, karte, vonZone, vonPlatz, nachZone, nachPlatz, 0] }   Bewegung
//   { t: "Klartext", k: [Kartennummern] }          Ereigniszeile
//   { c: [nummer, deck, hand, brett, life, donDeck, aktiv, trash, stage, gerastet] }
// Zonen: 1 Hand, 2 Charakter, 6 Trash.
import { test } from "node:test";
import assert from "node:assert/strict";
import { schritteBauen } from "../src/replay.js";

const A = "Anna#1";
const B = "Bert#2";
const XEBEC = "OP17-039";
const MIHAWK = "OP14-020";
const SHIKI = "OP17-048";
const PERONA = "OP12-034";
const KIKU = "OP14-023";

// Echte Logs beginnen mit einem Checkpoint je Spieler (Deck, Hand, Brett, Life, ...).
// Erst damit gibt es beide Seiten im Stand.
const spieler = (leaderA = XEBEC, leaderB = MIHAWK) => [
  { p: [1, A, leaderA] },
  { p: [2, B, leaderB] },
  { c: [1, 45, 5, 0, 5, 10, 0, 0, 0, 0] },
  { c: [2, 45, 5, 0, 5, 10, 0, 0, 0, 0] },
];
const aufsBrett = (nr, karte, platz = 0) => ({ m: [nr, karte, 1, 0, 2, platz, 0] });
const inDenTrash = (nr, karte, platz) => ({ m: [nr, karte, 2, platz, 6, 0, 0] });
const zeile = (t, k = []) => ({ t, k });

/** Den ersten Schritt, dessen Text den Ausschnitt enthaelt, ab `ab`. */
function schritt(schritte, ausschnitt, ab = 0) {
  const i = schritte.findIndex((s, j) => j >= ab && s.text.includes(ausschnitt));
  assert.ok(i >= 0, `Schritt "${ausschnitt}" fehlt`);
  return i;
}

test("einfacher Angriff: Charakter auf Leader, bis einschliesslich Ergebniszeile", () => {
  const { schritte } = schritteBauen([
    ...spieler(),
    zeile(`[${A}] Anfang`),
    aufsBrett(1, SHIKI),
    zeile(`[${A}] Shiki [${SHIKI}] attacking Dracule Mihawk [${MIHAWK}]`, [SHIKI, MIHAWK]),
    zeile(`Shiki [${SHIKI}][7000] vs Dracule Mihawk [${MIHAWK}][5000]`, [SHIKI, MIHAWK]),
    zeile(`Dracule Mihawk [${MIHAWK}] hit for 1 damage`, [MIHAWK]),
    zeile(`[${A}] End Turn`),
  ]);
  const i = schritt(schritte, "attacking");
  const erwartet = { von: { wer: A, platz: 0 }, auf: { wer: B, platz: "leader" } };
  assert.deepEqual(schritte[i].angriff, erwartet);
  assert.deepEqual(schritte[i + 1].angriff, erwartet, "beim vs noch da");
  assert.deepEqual(schritte[i + 2].angriff, erwartet, "bei der Ergebniszeile noch da");
  assert.equal(schritte[i + 3].angriff, null, "danach weg");
  assert.equal(schritte[0].angriff, null, "vor dem Angriff kein Pfeil");
});

test("Leader auf Leader", () => {
  const { schritte } = schritteBauen([
    ...spieler(),
    zeile(`[${A}] Rocks D. Xebec [${XEBEC}] attacking Dracule Mihawk [${MIHAWK}]`, [XEBEC, MIHAWK]),
    zeile(`Dracule Mihawk [${MIHAWK}] Attack Fails`, [MIHAWK]),
  ]);
  assert.deepEqual(schritte[0].angriff, {
    von: { wer: A, platz: "leader" },
    auf: { wer: B, platz: "leader" },
  });
  assert.equal(schritte[0].stand[A].leaderGerestet, true);
});

test("Spiegel: dieselbe Leadernummer auf beiden Seiten", () => {
  // `k` fuehrt die Nummer nur einmal, das Ziel muss aus dem Text kommen.
  const { schritte } = schritteBauen([
    ...spieler(MIHAWK, MIHAWK),
    zeile(`[${A}] Dracule Mihawk [${MIHAWK}] attacking Dracule Mihawk [${MIHAWK}]`, [MIHAWK]),
  ]);
  assert.deepEqual(schritte[0].angriff, {
    von: { wer: A, platz: "leader" },
    auf: { wer: B, platz: "leader" },
  });
});

test("Block: die Spitze springt auf den Blocker", () => {
  const { schritte } = schritteBauen([
    ...spieler(),
    zeile(`[${B}] Aufbau`),
    aufsBrett(2, KIKU),
    zeile(`[${A}] Rocks D. Xebec [${XEBEC}] attacking Dracule Mihawk [${MIHAWK}]`, [XEBEC, MIHAWK]),
    zeile(`[${B}] Kikunojo [${KIKU}] Blocks`, [KIKU]),
    zeile(`[${B}] Kikunojo [${KIKU}] Destroyed`, [KIKU]),
    inDenTrash(2, KIKU, 0),
    zeile(`[${A}] naechster Schritt`),
  ]);
  const i = schritt(schritte, "Blocks");
  assert.deepEqual(schritte[i].angriff.auf, { wer: B, platz: 0, geblockt: true });
  assert.deepEqual(schritte[i].angriff.von, { wer: A, platz: "leader" });
  assert.equal(schritte[i + 2].angriff, null);
});

test("doppelte Karte beim Angreifer: jeder Angriff nimmt den naechsten aktiven Platz", () => {
  const { schritte } = schritteBauen([
    ...spieler(),
    zeile(`[${A}] Aufbau`),
    aufsBrett(1, SHIKI, 0),
    aufsBrett(1, SHIKI, 1),
    zeile(`[${A}] Shiki [${SHIKI}] attacking Dracule Mihawk [${MIHAWK}]`, [SHIKI, MIHAWK]),
    zeile(`Dracule Mihawk [${MIHAWK}] Attack Fails`, [MIHAWK]),
    zeile(`[${A}] Shiki [${SHIKI}] attacking Dracule Mihawk [${MIHAWK}]`, [SHIKI, MIHAWK]),
  ]);
  const erster = schritt(schritte, "attacking");
  const zweiter = schritt(schritte, "attacking", erster + 1);
  assert.equal(schritte[erster].angriff.von.platz, 0);
  assert.equal(schritte[zweiter].angriff.von.platz, 1);
});

test("doppelte Karte beim Ziel: der gerestete Platz", () => {
  // Bert greift mit Perona an und restet sie, dann legt er eine zweite Perona VOR sie.
  // Die gerestete steht jetzt auf Platz 1, die frische auf Platz 0.
  const { schritte } = schritteBauen([
    ...spieler(),
    zeile(`[${B}] Aufbau`),
    aufsBrett(2, PERONA, 0),
    zeile(`[${B}] Perona [${PERONA}] attacking Rocks D. Xebec [${XEBEC}]`, [PERONA, XEBEC]),
    zeile(`Rocks D. Xebec [${XEBEC}] Attack Fails`, [XEBEC]),
    zeile(`[${B}] noch ein Zug`),
    aufsBrett(2, PERONA, 0),
    zeile(`[${A}] Aufbau`),
    aufsBrett(1, SHIKI, 0),
    zeile(`[${A}] Shiki [${SHIKI}] attacking Perona [${PERONA}]`, [SHIKI, PERONA]),
  ]);
  const i = schritt(schritte, "Shiki");
  assert.deepEqual(schritte[i].stand[B].board, [PERONA, PERONA]);
  assert.equal(schritte[i].angriff.auf.platz, 1);
});

test("zerstoertes Ziel bleibt als Geist bis zum Kampfende", () => {
  // Das Spiel schreibt die Bewegung in den Trash direkt hinter die Angriffszeile.
  const { schritte } = schritteBauen([
    ...spieler(),
    zeile(`[${B}] Aufbau`),
    aufsBrett(2, KIKU, 0),
    aufsBrett(2, PERONA, 1),
    zeile(`[${B}] Perona [${PERONA}] attacking Rocks D. Xebec [${XEBEC}]`, [PERONA, XEBEC]),
    zeile(`Rocks D. Xebec [${XEBEC}] Attack Fails`, [XEBEC]),
    zeile(`[${A}] Rocks D. Xebec [${XEBEC}] attacking Perona [${PERONA}]`, [XEBEC, PERONA]),
    inDenTrash(2, PERONA, 1),
    zeile(`Rocks D. Xebec [${XEBEC}][6000] vs Perona [${PERONA}][2000]`, [XEBEC, PERONA]),
    zeile(`[${B}] Perona [${PERONA}] Destroyed`, [PERONA]),
    zeile(`[${A}] End Turn`),
  ]);
  const i = schritt(schritte, "attacking Perona");
  const geist = { wer: B, platz: 1, geist: true, karte: PERONA };
  assert.deepEqual(schritte[i].stand[B].board, [KIKU], "vom Brett ist sie weg");
  assert.deepEqual(schritte[i].angriff.auf, geist);
  assert.deepEqual(schritte[i + 1].angriff.auf, geist, "beim vs");
  assert.deepEqual(schritte[i + 2].angriff.auf, geist, "beim Destroyed");
  assert.equal(schritte[i + 3].angriff, null);
});

test("ein Platz davor faellt weg: das Pfeilende rueckt mit", () => {
  const { schritte } = schritteBauen([
    ...spieler(),
    zeile(`[${A}] Aufbau`),
    aufsBrett(1, KIKU, 0),
    aufsBrett(1, SHIKI, 1),
    zeile(`[${A}] Shiki [${SHIKI}] attacking Dracule Mihawk [${MIHAWK}]`, [SHIKI, MIHAWK]),
    zeile(`[${B}] Trigger: Kikunojo weg`),
    inDenTrash(1, KIKU, 0),
    zeile(`Dracule Mihawk [${MIHAWK}] hit for 1 damage`, [MIHAWK]),
  ]);
  const i = schritt(schritte, "hit for");
  assert.deepEqual(schritte[i].stand[A].board, [SHIKI]);
  assert.equal(schritte[i].angriff.von.platz, 0);
});

test("\"is no longer blocked from attacking\" ist kein Angriff und restet nichts", () => {
  const { schritte } = schritteBauen([
    ...spieler(),
    zeile(`[${A}] Aufbau`),
    aufsBrett(1, SHIKI, 0),
    zeile(`[${A}] Shiki [${SHIKI}] is no longer blocked from attacking`, [SHIKI]),
  ]);
  const i = schritt(schritte, "no longer");
  assert.equal(schritte[i].angriff, null);
  assert.equal(schritte[i].stand[A].gerestet.has(0), false);
});

test("End Turn beendet einen Kampf ohne Ergebniszeile", () => {
  const { schritte } = schritteBauen([
    ...spieler(),
    zeile(`[${A}] Rocks D. Xebec [${XEBEC}] attacking Dracule Mihawk [${MIHAWK}]`, [XEBEC, MIHAWK]),
    zeile(`[${A}] End Turn`),
  ]);
  assert.ok(schritte[0].angriff);
  assert.equal(schritte[1].angriff, null);
});
