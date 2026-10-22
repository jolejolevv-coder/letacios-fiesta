// Das Wertnetz in JavaScript gegen Python: 1.000 Lagen aus den 20 Referenzpartien, auf
// 0,1 Punkte Siegchance genau (tests/referenz/README.md). Braucht das Netz unter
// tests/referenz/eingaben/ (nicht im Repo); fehlt es, wird uebersprungen.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { lageZeile, netzBauen, zaehlmerkmale } from "../src/wertnetz.js";
import { partieLesen } from "../src/zuglager.js";
import * as H from "./referenz_hilfen.js";

const TOLERANZ = 0.1;           // Punkte Siegchance
const ohneNetz = H.eingabenFehlen();

test("1.000 Lagen: Nummern, Zaehlmerkmale und Siegchance wie in Python", { skip: ohneNetz }, () => {
  const netz = netzBauen(H.jsonLesen(path.join(H.EINGABEN, "wertnetz.json.gz")));
  let n = 0;
  let groesste = 0;
  for (const e of H.index().logs) {
    for (const f of H.referenz(e.id, "netz").faelle) {
      const z = f.eingabe;
      assert.deepEqual(netz.board(z.board_mein), f.nummern.bm);
      assert.deepEqual(netz.board(z.board_gegner), f.nummern.bg);
      assert.equal(netz.leaderNummer(z.leader_mein), f.nummern.lm);
      assert.equal(netz.leaderNummer(z.leader_gegner), f.nummern.lg);
      const x = zaehlmerkmale(z);
      x.forEach((w, i) => assert.ok(Math.abs(w - f.zaehl[i]) < 1e-9, `${e.id} Merkmal ${i}`));
      const abstand = Math.abs(100 * netz.pSieg(z) - 100 * f.p_sieg);
      groesste = Math.max(groesste, abstand);
      n += 1;
    }
  }
  assert.equal(n, 1000);
  assert.ok(groesste < TOLERANZ, `groesster Abstand ${groesste} Punkte`);
});

test("Aus dem eigenen Leser: dieselben Eingaben wie book.lage_zeile", { skip: ohneNetz || H.logsFehlen() || H.kartenFehlen() }, () => {
  const netz = netzBauen(H.jsonLesen(path.join(H.EINGABEN, "wertnetz.json.gz")));
  const events = H.eventsLesen();
  for (const e of H.index().logs) {
    const [, [p]] = partieLesen(H.logLesen(e.id), { id: e.id, timestamp: e.id.slice(0, 10) }, events);
    for (const f of H.referenz(e.id, "netz").faelle) {
      assert.deepEqual(lageZeile(p.lagen[f.lage], f.nr, p, netz.zugNorm), f.eingabe, `${e.id} Lage ${f.lage}`);
    }
  }
});

test("Kleines Netz von Hand: Rechnung, unbekannte Karte und Leader", () => {
  // dim_karte 1, dim_leader 1, n_zaehl 13, Breite 2: e hat 17 Werte.
  const json = {
    datum: "probe", temperatur: 2, dim_karte: 1, dim_leader: 1, breite: 2, max_board: 2, n_zaehl: 13,
    zug_norm: 30, leer: 0, andere: 1, karten: { "OP01-001": 1 }, leader: { andere: 1, "OP17-039": 2 },
    gewichte: {
      karte: { form: [2, 1], werte: [0, 3] },
      leader_mein: { form: [3, 1], werte: [0, 0, 1] },
      leader_gegner: { form: [3, 1], werte: [0, 0, 0] },
      schicht1: { w: { form: [2, 17], werte: [1, 0, 1, ...new Array(14).fill(0), ...new Array(17).fill(0)] },
                  b: { form: [2], werte: [0, -1] } },
      schicht2: { w: { form: [2, 2], werte: [1, 0, 0, 1] }, b: { form: [2], werte: [0, 0] } },
      schicht3: { w: { form: [1, 2], werte: [1, 1] }, b: { form: [1], werte: [0] } },
    },
  };
  const netz = netzBauen(json);
  assert.deepEqual(netz.board(["OP01-001", "XX01-999", "OP01-001"]), [1, 0]);
  assert.equal(netz.leaderNummer("OP99-001"), 1);
  // e[0] = 3 (eine bekannte Karte mein), e[2] = 1 (Leader mein): h1 = [4, 0], logit 4.
  const z = { board_mein: ["OP01-001"], board_gegner: [], leader_mein: "OP17-039", leader_gegner: "OP99-001",
    life_mein: 5, life_gegner: 5, hand_mein: 5, hand_gegner: 5, don_mein_aktiv: 0, don_mein_gerastet: 0,
    zug: 0, deck_mein_rest: 40, don_gegner: 0, first_mein: true };
  assert.ok(Math.abs(netz.pSieg(z) - 1 / (1 + Math.exp(-2))) < 1e-12);
  assert.throws(() => netzBauen({ ...json, gewichte: { ...json.gewichte, schicht2: undefined } }));
});
