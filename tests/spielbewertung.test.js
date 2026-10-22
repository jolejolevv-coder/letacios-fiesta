// Noten und Accuracy wie tools/spielbewertung.py, gegen die Referenz der 20 Partien
// (tests/referenz/README.md): gleiche Entscheidungen und Noten, Accuracy auf 0,1, die
// Kurve der Siegchance auf 0,1 Punkte.
import { test } from "node:test";
import assert from "node:assert/strict";
import path from "node:path";
import { accuracy, analyseBauen, kurveBauen, lageEnglisch, note, partieBewerten, Quelle, runden, vergleich } from "../src/spielbewertung.js";
import { netzBauen, werteBerechnen } from "../src/wertnetz.js";
import { partieLesen } from "../src/zuglager.js";
import * as H from "./referenz_hilfen.js";

const TOLERANZ = 0.1;
const grund = H.eingabenFehlen() || H.logsFehlen() || H.kartenFehlen();

function laden() {
  return {
    netz: netzBauen(H.jsonLesen(path.join(H.EINGABEN, "wertnetz.json.gz"))),
    book: H.jsonLesen(path.join(H.EINGABEN, "book_OP17-039.json.gz")),
    werte: H.jsonLesen(path.join(H.EINGABEN, "kartenwerte.json")),
    events: H.eventsLesen(),
  };
}

const sortiert = (liste) => liste.map((x) => JSON.stringify(x)).sort();

test("20 Partien: Entscheidungen, Noten, Accuracy, Hinweise und Kurve wie in Python", { skip: grund }, () => {
  const { netz, book, werte, events } = laden();
  const q = new Quelle(book);
  let entscheidungen = 0;
  for (const e of H.index().logs) {
    const [, [p]] = partieLesen(H.logLesen(e.id), { id: e.id, timestamp: e.id.slice(0, 10) }, events);
    const ref = H.referenz(e.id, "bewertung");
    const b = partieBewerten(p, ref.nr, q, werte.counter, werte.kosten, e.id + ".log");
    const r = ref.bewertung;
    assert.deepEqual(b.noten, r.noten, e.id);
    assert.ok(Math.abs(b.accuracy - r.accuracy) <= TOLERANZ, `${e.id}: ${b.accuracy} gegen ${r.accuracy}`);
    assert.deepEqual(JSON.parse(JSON.stringify(b.entscheidungen)), r.entscheidungen, e.id);
    assert.deepEqual(JSON.parse(JSON.stringify(b.schwerste)), r.schwerste, e.id);
    // Python sortiert gleich wertvolle Hinweise in der Reihenfolge einer Menge (zufaellig).
    assert.deepEqual(sortiert(b.hinweise), sortiert(r.hinweise), e.id);
    assert.equal(b.sitz, e.sitz);
    assert.equal(b.sieg, e.sieg);
    entscheidungen += b.entscheidungen.length;

    const kurve = kurveBauen(p, werteBerechnen(p, netz));
    assert.equal(kurve.length, ref.kurve.length, e.id);
    kurve.forEach((k, i) => {
      const x = ref.kurve[i];
      assert.equal(k.hz, x.hz);
      assert.equal(k.lage, x.lage);
      assert.ok(Math.abs(k.v1 - x.v1) < TOLERANZ && Math.abs(k.v2 - x.v2) < TOLERANZ, `${e.id} Halbzug ${k.hz}`);
    });
  }
  assert.ok(entscheidungen > 100);
});

test("Analyse fuer den Viewer: englische Lagen, ohne Book keine Noten", { skip: grund }, () => {
  const { netz, book, werte, events } = laden();
  const e = H.index().logs[0];
  const [, [p]] = partieLesen(H.logLesen(e.id), { id: e.id, timestamp: e.id.slice(0, 10) }, events);
  const a = analyseBauen(p, werteBerechnen(p, netz), { "OP17-039": book }, werte.counter, werte.kosten, netz.datum);
  const ich = String(e.nr);
  assert.equal(a.spieler[ich].accuracy, e.accuracy);
  assert.equal(a.spieler[String(3 - e.nr)].noten, null);
  assert.ok(a.entscheidungen.every((x) => x.wer === e.nr && !/[äöü]|Gegner|Life,/.test(x.lage)));
  assert.equal(a.modell, netz.datum);
  assert.ok(a.kurve.length > 4);
});

test("Noten, Accuracy und Rundung wie in Python", () => {
  assert.equal(note(0, true), "best");
  assert.equal(note(0.99, false), "excellent");
  assert.equal(note(1, false), "good");
  assert.equal(note(2.49, false), "good");
  assert.equal(note(2.5, false), "inaccuracy");
  assert.equal(note(9.99, false), "mistake");
  assert.equal(note(10, false), "blunder");
  assert.ok(Math.abs(accuracy(0) - 99.9999) < 1e-9);
  assert.equal(accuracy(1000), 0);
  assert.equal(runden(10.125, 2), 10.12);       // Python: genau Halbe zur geraden Ziffer
  assert.equal(runden(2.675, 2), 2.67);         // exakt 2,67499...
  assert.equal(runden(-1.25, 1), -1.2);
  assert.equal(lageEnglisch("Gegnerzug 3, 4 Life"), "opponent turn 3, 4 life");
});

test("Vergleich: zu wenige Faelle oder nur eine Option geben nichts", () => {
  const erlaubt = new Set(["nehmen", "countern"]);
  assert.equal(vergleich({ nehmen: { n: 50, d: 1 }, countern: { n: 9, d: 2 } }, "nehmen", erlaubt), null);
  assert.equal(vergleich({ nehmen: { n: 50, d: 1 } }, "nehmen", erlaubt), null);
  const v = vergleich({ nehmen: { n: 50, d: 1 }, countern: { n: 50, d: 3.5 }, blocken: { n: 50, d: 9 } },
    "nehmen", erlaubt);
  assert.deepEqual(v, { wahl: "nehmen", beste: "countern", verlust: 2.5, note: "inaccuracy",
    optionen: { nehmen: 1, countern: 3.5 } });
});
