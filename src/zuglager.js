/* Zuglager in JavaScript: liest ein OPTCGSim Log wie tools/zug_lager.py in Metacoach
   (Version 3), dazu die Siegerbestimmung aus src/sieger.py und die Zuordnung Name zu
   Spielernummer aus src/replay_format.player_mapping. Grundlage fuer "Analyze my replay"
   (specs/features/eigenes-replay-analysieren.md, Plan 2). Getestet in
   tests/zuglager.test.js gegen die Referenz unter tests/referenz/.

   Die Python Quellen sind die Wahrheit. Abweichungen im Verhalten waeren Fehler; deshalb
   folgen Namen, Reihenfolge der Pruefungen und die Grenzfaelle dem Original Zeile fuer
   Zeile. Zwei Dinge ahmen Python bewusst nach:
     * Zeilen werden wie Pythons universelle Zeilenenden getrennt und mit dessen
       Whitespace Begriff gestrippt (pyStrip), nicht mit trim().
     * Regulaere Ausdruecke mit Punkt tragen das Flag s, weil der Punkt in Python auch
       Zeichen wie U+2028 trifft, in JavaScript ohne s aber nicht.

   Das Log verlaesst den Browser nie: alles hier rechnet auf dem Text im Speicher. */

export const VERSION = 3;
export const MIN_STAENDE = 4;          // Halbzuege; kuerzere Partien sagen nichts (wert_lager)

const TAG = /<[^>]+>/g;
const SPIELER = /^\[(.+?)\] (.*)$/s;
const ANGRIFF = /^.+? \[([A-Z0-9-]+)\] attacking .+? \[([A-Z0-9-]+)\]$/s;
const KAMPF = /^.+? \[([A-Z0-9-]+)\]\[(-?\d+)\] vs .+? \[([A-Z0-9-]+)\]\[(-?\d+)\]$/s;
const TREFFER = /^.+? \[([A-Z0-9-]+)\] hit for (\d+) damage$/s;
const COUNTER_KARTE = /^Discard .+? for Counter (\d+)$/s;
const COUNTER_EVENT = /: Activate Counter$/;
const BUFF_KAMPF = /: Buff .+? \[[A-Z0-9-]+\] (-?\d+) for the Combat$/s;
const BLOCK = /^.+? \[[A-Z0-9-]+\] Blocks$/s;
const HAND = /^Hand: \[(.*)\]$/s;
const HAND_VOR = /^Hand before Mulligan: \[(.*)\]$/s;
const DON_ZIEHEN = /^Draw \d+ (Rested )?Don$/;
const KARTE = /[A-Z]{1,4}\d{0,2}-\d{3}/g;
const TRASH_DURCH_EFFEKT = /: Trash .+? \[([A-Z0-9-]+)\]$/s;

// src/sieger.py
const LEADER_ZEILE = /^\[(.+?)\] Leader is .*?\[([A-Z]{2,4}\d{2}-\d{3})\]/s;
const CONCEDE = /^\[(.+?)\] Concedes!$/s;
const LIFE = /^\[(.+?)\] Life: (\d+)$/s;
const ANGRIFF_SIEGER = /^\[(.+?)\] .*attacking/s;
const TREFFER_SIEGER = /^.+? \[([A-Z]{2,4}\d{2}-\d{3})\] hit for \d+ damage$/s;
const DON_ZUG = /^\[(.+?)\] Draw \d+ Don/s;
const END_TURN = /^\[(.+?)\] End Turn$/s;
const LEADER_IST = /^\[(.+?)\] Leader is/s;

const HAND_Z = 1, CHAR_Z = 2, TRASH_Z = 6, STAGE_Z = 7;
const DON_DECK = 4, DON_FELD = 5, DON_ANGELEGT = 9;
const GESPIELT_NACH = new Set([CHAR_Z, STAGE_Z]);
const CHK_LAENGE = 14;
const BEWEGUNG_LAENGE = 8;

/* ------------------------------------------------------------- Python Helfer */

// Was Pythons str.isspace() als Leerraum zaehlt; trim() in JavaScript nimmt etwa U+FEFF
// dazu und laesst \x1c bis \x1f weg.
const PY_LEER = "\\t\\n\\x0b\\x0c\\r\\x1c-\\x1f \\x85\\xa0\\u1680\\u2000-\\u200a\\u2028\\u2029\\u202f\\u205f\\u3000";
const PY_STRIP = new RegExp(`^[${PY_LEER}]+|[${PY_LEER}]+$`, "g");
const PY_RSTRIP = new RegExp(`[${PY_LEER}]+$`);

export function pyStrip(text) {
  return text.replace(PY_STRIP, "");
}

function pyRstrip(text) {
  return text.replace(PY_RSTRIP, "");
}

/* Pythons int(): Leerraum aussen erlaubt, sonst nur Ziffern. Alles andere wirft wie
   ValueError, und partieLesen macht daraus "log kaputt". */
const GANZZAHL = /^\s*[+-]?\d+\s*$/;
export function pyInt(text) {
  if (!GANZZAHL.test(String(text))) throw new Error("ValueError: " + text);
  return parseInt(text, 10);
}

/* Zeilen wie Pythons Textmodus mit universellen Zeilenenden. */
export function zeilenTrennen(text) {
  const teile = text.split(/\r\n|\r|\n/);
  if (teile.length && teile[teile.length - 1] === "") teile.pop();
  return teile;
}

const ohneTags = (z) => z.replace(TAG, "");

function karten(text) {
  return text.match(KARTE) || [];
}

/* zlib.crc32 als vorzeichenlose Zahl, fuer das Feld "test" wie im Lager. */
const CRC_TAFEL = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

export function crc32(text) {
  const bytes = new TextEncoder().encode(text);
  let c = 0xffffffff;
  for (const b of bytes) c = CRC_TAFEL[(c ^ b) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

const TEST_MOD = 5;
const imTest = (id) => crc32(id) % TEST_MOD === 0;

/* --------------------------------------------------- replay_format.player_mapping */

/* Die Ereignisse wie replay_format.events: Klartext (Zeilen mit "[" am Anfang, ohne
   Auszeichnung) und Checkpoints mit mindestens 14 Feldern. */
function ereignisse(roh) {
  const aus = [];
  for (const zeile of roh) {
    if (zeile.startsWith("[")) aus.push(["txt", pyStrip(ohneTags(zeile))]);
    else if (zeile.startsWith("RZ1|CHK|")) {
      const f = zeile.split("|");
      if (f.length >= CHK_LAENGE) {
        aus.push(["chk", { player: pyInt(f[3]), life: pyInt(f[7]) }]);
        // Die uebrigen Felder prueft Python beim Bau des Checkpoints ebenfalls.
        for (let i = 2; i < CHK_LAENGE; i += 1) pyInt(f[i]);
      }
    }
  }
  return aus;
}

/* Name -> Spielernummer, gemessen: es gewinnt die Zuordnung, unter der die Life Werte der
   Checkpoints zu den Klartextzeilen passen (die "Leader is" Reihenfolge folgt der
   Verbindung, nicht der Nummer). */
export function spielerZuordnung(roh) {
  const ev = ereignisse(roh);
  const namen = [];
  for (const [art, wert] of ev) {
    if (art !== "txt") continue;
    const m = LEADER_IST.exec(wert);
    if (m && !namen.includes(m[1])) namen.push(m[1]);
  }
  if (namen.length < 2) return {};
  const treffer = (zuordnung) => {
    const stand = {};
    let ok = 0;
    for (const [art, wert] of ev) {
      if (art === "chk") {
        stand[wert.player] = wert;
        continue;
      }
      const m = LIFE.exec(wert);
      if (m && Object.hasOwn(zuordnung, m[1])) {
        const c = stand[zuordnung[m[1]]];
        if (c !== undefined && c.life === pyInt(m[2])) ok += 1;
      }
    }
    return ok;
  };
  const a = { [namen[0]]: 1, [namen[1]]: 2 };
  const b = { [namen[0]]: 2, [namen[1]]: 1 };
  return treffer(a) >= treffer(b) ? a : b;
}

/* ---------------------------------------------------------------- sieger.auswerten */

function chkLife(zeile) {
  const f = zeile.split("|");
  const nr = Number.parseInt(f[3], 10);
  const lf = Number.parseInt(f[7], 10);
  if (!GANZZAHL.test(f[3] ?? "") || !GANZZAHL.test(f[7] ?? "")) return null;
  return [nr, lf];
}

function lethalAusCheckpoints(zeilen, spieler, namen, zuordnung) {
  if (Object.keys(zuordnung).length !== 2) return null;
  const stand = {};
  const aktiv = new Set();
  const verlauf = [];
  for (const l of zeilen) {
    if (l.startsWith("RZ1|CHK|")) {
      const w = chkLife(l);
      if (w) {
        const [nr, lf] = w;
        if (lf > 0) aktiv.add(nr);
        if (aktiv.has(nr)) stand[nr] = lf;
      }
    }
    verlauf.push({ ...stand });
  }
  let akt = null;
  let sieger = null;
  zeilen.forEach((l, i) => {
    let m = ANGRIFF_SIEGER.exec(l);
    if (m && Object.hasOwn(spieler, m[1])) {
      akt = m[1];
      return;
    }
    m = TREFFER_SIEGER.exec(pyStrip(l));
    if (!(m && akt)) return;
    const verteidiger = namen.find((n) => n !== akt);
    if (spieler[verteidiger] !== m[1]) return;
    const nr = zuordnung[verteidiger];
    if (nr !== undefined && verlauf[i][nr] === 0) sieger = akt;
  });
  return sieger;
}

export function auswerten(roh, zuordnung) {
  const zeilen = roh.map((l) => pyRstrip(ohneTags(l)));
  const spieler = {};
  for (const l of zeilen) {
    const m = LEADER_ZEILE.exec(l);
    if (m && !Object.hasOwn(spieler, m[1])) spieler[m[1]] = m[2];
  }
  const namen = Object.keys(spieler);
  if (namen.length !== 2) return null;

  let erster = null;
  for (const l of zeilen) {
    const m = DON_ZUG.exec(l);
    if (m && Object.hasOwn(spieler, m[1])) {
      erster = m[1];
      break;
    }
  }
  const halbzuege = zeilen.filter((l) => END_TURN.test(l)).length;
  const aus = { leader: spieler, erster, sieger: null, art: "offen", halbzuege };

  for (let i = zeilen.length - 1; i >= 0; i -= 1) {
    const m = CONCEDE.exec(pyStrip(zeilen[i]));
    if (m && Object.hasOwn(spieler, m[1])) {
      aus.sieger = namen.find((n) => n !== m[1]);
      aus.art = "concede";
      return aus;
    }
  }

  const life = Object.fromEntries(namen.map((n) => [n, 5]));
  let akt = null;
  let tref = null;
  for (const l of zeilen) {
    let m = LIFE.exec(l);
    if (m && Object.hasOwn(life, m[1])) {
      life[m[1]] = pyInt(m[2]);
      continue;
    }
    m = ANGRIFF_SIEGER.exec(l);
    if (m && Object.hasOwn(spieler, m[1])) {
      akt = m[1];
      continue;
    }
    m = TREFFER_SIEGER.exec(pyStrip(l));
    if (m && akt) {
      const verteidiger = namen.find((n) => n !== akt);
      if (spieler[verteidiger] === m[1] && life[verteidiger] === 0) tref = akt;
    }
  }
  if (tref) {
    aus.sieger = tref;
    aus.art = "lethal";
    return aus;
  }
  tref = lethalAusCheckpoints(zeilen, spieler, namen, zuordnung);
  if (tref) {
    aus.sieger = tref;
    aus.art = "lethal_chk";
  }
  return aus;
}

/* --------------------------------------------------------------------- Partie */

/* Liest ein Log Zeile fuer Zeile und haelt den Zustand beider Spieler (zug_lager.Partie). */
class Partie {
  constructor(zuordnung, leader, erster, events) {
    this.nr = zuordnung;
    this.events = events;
    this.leaderVon = {};
    for (const n of Object.keys(zuordnung)) this.leaderVon[zuordnung[n]] = leader[n];
    this.aktiv = erster !== null && Object.hasOwn(zuordnung, erster) ? zuordnung[erster] : 1;
    this.chk = {};
    // Characters als Liste: der Slot im RZ1 Feld ist die Position in der Liste.
    this.board = { 1: [], 2: [] };
    this.hand = { 1: [], 2: [] };
    this.donStart = {};
    this.halbzug = 0;
    this.eigeneZuege = { 1: 0, 2: 0 };
    this.gerestet = { 1: [], 2: [] };
    this.angreiferJetzt = [];
    this.lagen = [];
    this.zuege = [];
    this.angriffe = [];
    this.mulligan = {
      1: { mull: false, hand_vor: null, hand: null },
      2: { mull: false, hand_vor: null, hand: null },
    };
    this.zug = null;
    this.angriff = null;
    this.letzterTrash = null;
  }

  // ------------------------------------------------------------- Zustand
  lage() {
    const stand = { hz: this.halbzug, c: {}, b: {} };
    for (const nr of [1, 2]) {
      const c = this.chk[nr];
      stand.c[String(nr)] = c ? [c[1], c[3], c[0], c[5], c[9], c[6]] : null;
      stand.b[String(nr)] = [...this.board[nr]].sort();
    }
    this.lagen.push(stand);
    return this.lagen.length - 1;
  }

  donFeld(nr) {
    const c = this.chk[nr];
    if (!c || !Object.hasOwn(this.donStart, nr)) return 0;
    return this.donStart[nr] - c[4];
  }

  bewegung(f) {
    const nr = pyInt(f[2]);
    const karte = f[3];
    const src = pyInt(f[4]);
    const srcSlot = pyInt(f[5]);
    const ziel = pyInt(f[6]);
    const slot = pyInt(f[7]);
    if (karte === "Don") {
      this.donBewegung(nr, src, ziel, f);
      return;
    }
    // Spielernummern ausser 1 und 2: wo Python mit KeyError abbricht, wirft hier der
    // Zugriff auf undefined, und partieLesen meldet wie dort "log kaputt".
    if (src === CHAR_Z) {
      const liste = this.board[nr];
      if (srcSlot >= 0 && srcSlot < liste.length && liste[srcSlot] === karte) liste.splice(srcSlot, 1);
      else if (liste.includes(karte)) liste.splice(liste.indexOf(karte), 1);
      if (nr !== this.aktiv && this.zug !== null && ziel === TRASH_Z) this.zug.kos += 1;
      const g = this.gerestet[nr];
      if (g.includes(karte)) g.splice(g.indexOf(karte), 1);
    }
    if (ziel === CHAR_Z) {
      const liste = this.board[nr];
      liste.splice(Math.min(Math.max(slot, 0), liste.length), 0, karte);
    }
    if (src === HAND_Z) {
      const h = this.hand[nr];
      if (h.includes(karte)) h.splice(h.indexOf(karte), 1);
      if (nr === this.aktiv && this.zug !== null && this.angriff === null) {
        if (GESPIELT_NACH.has(ziel)) this.zug.plays.push(karte);
        else if (ziel === TRASH_Z && this.events.has(karte)) {
          // vorlaeufig: steht gleich danach "...: Trash <Karte>", war es eine Kosten
          this.zug.plays.push(karte);
          this.letzterTrash = karte;
        }
      }
    }
    if (ziel === HAND_Z) this.hand[nr].push(karte);
  }

  /* Genutzt ist Don, das im eigenen Zug gerestet, angelegt (5 nach 9) oder zurueckgegeben
     (5 nach 4) wird; das Resten steht nur in Feld 10 der Bewegung 5 nach 5. */
  donBewegung(nr, src, ziel, f) {
    if (nr !== this.aktiv || this.zug === null || src !== DON_FELD) return;
    const gerestet = f.length > 10 && f[10] === "1";
    if (ziel === DON_FELD) this.zug.don_genutzt += gerestet ? 1 : -1;
    else if (ziel === DON_ANGELEGT || ziel === DON_DECK) this.zug.don_genutzt += 1;
  }

  checkpoint(f) {
    const nr = pyInt(f[3]);
    const werte = f.slice(4, 14).map(pyInt);
    // Das Don Deck zu Beginn steht im ersten Checkpoint (10, bei Enel OP15-058 6).
    if (!Object.hasOwn(this.donStart, nr) && werte[4] > 0) this.donStart[nr] = werte[4];
    this.chk[nr] = werte;
  }

  // --------------------------------------------------------------- Zuege
  zugBeginnen() {
    const nr = this.aktiv;
    this.eigeneZuege[nr] += 1;
    this.gerestet[nr] = [];
    this.angreiferJetzt = [];
    this.zug = {
      wer: nr, T: this.eigeneZuege[nr], vor: this.lage(), nach: null,
      hand: null, don: null, plays: [], don_genutzt: 0, don_uebrig: null,
      angriffe: 0, auf_leader: 0, kos: 0,
    };
  }

  donGezogen() {
    if (this.zug !== null && this.zug.hand === null) {
      this.zug.hand = [...this.hand[this.aktiv]];
      this.zug.don = null;
    }
  }

  zugAblegen(nr) {
    if (this.zug.don === null) this.zug.don = this.donFeld(nr);
    this.zug.don_uebrig = Math.max(0, this.zug.don - Math.max(0, this.zug.don_genutzt));
    if (this.zug.hand === null) this.zug.hand = [...this.hand[nr]];
    this.zug.nach = this.lage();
  }

  zugBeenden() {
    this.angriffBeenden();
    const nr = this.aktiv;
    if (this.zug !== null) {
      this.zugAblegen(nr);
      this.zuege.push(this.zug);
    }
    this.gerestet[nr] = [...this.angreiferJetzt];
    this.halbzug += 1;
    this.aktiv = 3 - nr;
    this.zugBeginnen();
  }

  donMerken() {
    if (this.zug !== null && this.zug.hand !== null && this.zug.don === null) {
      this.zug.don = this.donFeld(this.aktiv);
    }
  }

  // ------------------------------------------------------------ Angriffe
  angriffBeginnen(angreifer, ziel) {
    this.angriffBeenden();
    this.donMerken();
    const nr = this.aktiv;
    const gegner = 3 - nr;
    const aufLeader = ziel === this.leaderVon[gegner];
    if (angreifer !== this.leaderVon[nr]) this.angreiferJetzt.push(angreifer);
    if (this.zug !== null) {
      this.zug.angriffe += 1;
      this.zug.auf_leader += aufLeader ? 1 : 0;
    }
    const c = this.chk[gegner] || new Array(10).fill(0);
    this.angriff = {
      wer: nr, T: this.eigeneZuege[nr], ziel: aufLeader ? "leader" : "character",
      gerestet: this.gerestet[gegner].length > 0, vor: this.lage(), nach: null,
      antwort: "nehmen", counter: 0, kampf: null, schaden: 0,
      life_vor: c[3], hand_vor: c[1], hand_karten: [...this.hand[gegner]],
    };
  }

  angriffBeenden() {
    const a = this.angriff;
    if (a === null) return;
    a.nach = this.lage();
    if (a.kampf) {
      const [pAngreifer, pZiel] = a.kampf;
      // Ohne Antwort getroffen haette der Angriff, wenn er die Power des Ziels vor den
      // Countern erreicht. Beim Block ist die Power des Leaders unbekannt: zaehlt mit.
      a.trifft = a.antwort === "blocken" || pAngreifer >= pZiel - a.counter;
    } else {
      a.trifft = null;
    }
    this.angriffe.push(a);
    this.angriff = null;
  }

  verteidigerZeile(rest) {
    const a = this.angriff;
    if (a === null) return;
    if (BLOCK.test(rest)) {
      a.antwort = "blocken";
      return;
    }
    let m = COUNTER_KARTE.exec(rest);
    if (m) {
      a.counter += pyInt(m[1]);
      if (a.antwort === "nehmen") a.antwort = "countern";
      return;
    }
    if (COUNTER_EVENT.test(rest) && a.antwort === "nehmen") {
      a.antwort = "countern";
      return;
    }
    m = BUFF_KAMPF.exec(rest);
    if (m && a.antwort === "countern") a.counter += pyInt(m[1]);
  }

  // -------------------------------------------------------------- Zeilen
  zeile(z) {
    if (z.startsWith("RZ1|CHK|")) {
      const f = z.split("|");
      if (f.length >= CHK_LAENGE) this.checkpoint(f);
      return;
    }
    if (z.startsWith("RZ1|")) {
      const f = z.split("|");
      if (f.length >= BEWEGUNG_LAENGE) this.bewegung(f);
      return;
    }
    const m = SPIELER.exec(z);
    if (!m) {
      this.neutraleZeile(z);
      return;
    }
    const name = m[1];
    const rest = m[2];
    if (!Object.hasOwn(this.nr, name)) return;
    const nr = this.nr[name];
    if (nr === this.aktiv && this.letzterTrash !== null) {
      const t = TRASH_DURCH_EFFEKT.exec(rest);
      const plays = this.zug?.plays;
      if (t && t[1] === this.letzterTrash && this.zug !== null && plays.length
          && plays[plays.length - 1] === this.letzterTrash) {
        plays.pop();
      }
      this.letzterTrash = null;
    }
    if (nr === this.aktiv && this.angriff !== null && this.angriff.kampf) {
      // Der Kampf ist aufgeloest; die naechste Handlung des Angreifers gehoert nicht mehr
      // zum Angriff (Trigger und Life Karten kommen vom Verteidiger).
      this.angriffBeenden();
    }
    if (rest === "End Turn") {
      if (nr === this.aktiv) this.zugBeenden();
      return;
    }
    let h = HAND.exec(rest);
    if (h) {
      this.hand[nr] = karten(h[1]);
      if (this.mulligan[nr].hand === null) this.mulligan[nr].hand = [...this.hand[nr]];
      return;
    }
    h = HAND_VOR.exec(rest);
    if (h) {
      this.mulligan[nr].hand_vor = karten(h[1]);
      return;
    }
    if (rest === "Mulligan") {
      this.mulligan[nr].mull = true;
      return;
    }
    if (nr === this.aktiv && DON_ZIEHEN.test(rest)) {
      this.donGezogen();
      return;
    }
    const a = ANGRIFF.exec(rest);
    if (a && nr === this.aktiv) {
      this.angriffBeginnen(a[1], a[2]);
      return;
    }
    if (nr !== this.aktiv) this.verteidigerZeile(rest);
    else if (rest.startsWith("Deploy ")) this.donMerken();
  }

  neutraleZeile(z) {
    if (this.angriff === null) return;
    const k = KAMPF.exec(z);
    if (k) {
      this.angriff.kampf = [pyInt(k[2]), pyInt(k[4])];
      return;
    }
    const t = TREFFER.exec(z);
    if (t && t[1] === this.leaderVon[3 - this.aktiv]) this.angriff.schaden += pyInt(t[2]);
  }

  /* Die Partie endet mitten im Zug (Aufgabe oder Treffer): den Zug noch ablegen. */
  ende() {
    this.angriffBeenden();
    if (this.zug !== null && (this.zug.plays.length || this.zug.angriffe)) {
      this.zugAblegen(this.aktiv);
      this.zug.letzter = true;
      this.zuege.push(this.zug);
    }
    this.zug = null;
  }
}

/* ------------------------------------------------------------------ partieLesen */

/* Ein Log als Text lesen. Rueckgabe [grund, zeilen] wie zug_lager.partie_lesen und
   _arbeit: "ok" mit einer Zeile, sonst ein Grund ("keine zwei spieler", "kein sieger",
   "keine zuordnung", "zu kurz", "log kaputt") und eine leere Liste.

   eintrag: { id, timestamp, winner_bounty, loser_bounty } wie im Index von Metacoach.
   events: Menge der Kartennummern mit Kategorie Event (aus karten.json, "a": "e"). */
export function partieLesen(text, eintrag, events = new Set()) {
  try {
    return lesen(text, eintrag, events);
  } catch {
    return ["log kaputt", []];
  }
}

function lesen(text, eintrag, events) {
  const roh = zeilenTrennen(text);
  const zuordnung = spielerZuordnung(roh);
  const info = auswerten(roh, zuordnung);
  if (info === null) return ["keine zwei spieler", []];
  if (info.sieger === null) return ["kein sieger", []];
  const namen = Object.keys(zuordnung);
  const leaderNamen = Object.keys(info.leader);
  if (namen.length !== 2 || namen.some((n) => !leaderNamen.includes(n))) return ["keine zuordnung", []];

  const p = new Partie(zuordnung, info.leader, info.erster, events);
  let begonnen = false;
  for (const zeile of roh) {
    const z = pyStrip(ohneTags(zeile));
    if (!begonnen) {
      const s = SPIELER.exec(z);
      if (s && DON_ZIEHEN.test(s[2])) {
        // Der erste Don Zug des First Players eroeffnet Zug 1.
        begonnen = true;
        if (Object.hasOwn(p.nr, s[1])) p.aktiv = p.nr[s[1]];
        p.zugBeginnen();
      }
    }
    p.zeile(z);
  }
  p.ende();
  if (p.eigeneZuege[1] + p.eigeneZuege[2] < MIN_STAENDE) return ["zu kurz", []];
  const sieger = zuordnung[info.sieger];
  const verlierer = 3 - sieger;
  return ["ok", [{
    partie: eintrag.id,
    tag: String(eintrag.timestamp ?? "").slice(0, 10),
    test: imTest(eintrag.id),
    leader: { 1: p.leaderVon[1], 2: p.leaderVon[2] },
    erster: info.erster !== null && Object.hasOwn(zuordnung, info.erster) ? zuordnung[info.erster] : null,
    sieger,
    bounty: { [sieger]: eintrag.winner_bounty ?? null, [verlierer]: eintrag.loser_bounty ?? null },
    lagen: p.lagen,
    zuege: p.zuege,
    angriffe: p.angriffe,
    mulligan: { 1: p.mulligan[1], 2: p.mulligan[2] },
    // Nicht im Python Lager: die Namen zu den Nummern, nur fuer die Anzeige im Browser.
    // Sie bleiben im Speicher der Seite.
    namen: Object.fromEntries(Object.entries(zuordnung).map(([n, nr]) => [nr, n])),
  }]];
}

/* Wessen Log ist es? Nur fuer den eigenen Spieler nennt das Log die Starthand vor dem
   Mulligan ("Hand before Mulligan"). Fehlt sie bei beiden oder steht sie bei beiden,
   bleibt es offen (null). */
export function eigeneNummer(partie) {
  const mit = [1, 2].filter((nr) => partie.mulligan[String(nr)]?.hand_vor);
  return mit.length === 1 ? mit[0] : null;
}
