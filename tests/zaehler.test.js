// Tests fuer den Zaehler in der Kennzeile (src/zaehler.js).
import { test } from "node:test";
import assert from "node:assert/strict";
import { animieren, zahlText } from "../src/zaehler.js";

test("Format wie bisher: Tausender, Nachkommastellen, Suffix", () => {
  assert.equal(zahlText(42490), "42,490");
  assert.equal(zahlText(53.44, 1, " %"), "53.4 %");
  assert.equal(zahlText(0.5), "1");
  assert.equal(zahlText(0, 1, " %"), "0.0 %");
});

test("Hochgezaehlt wird nur bei einem echten Wechsel", () => {
  const normal = { reduziert: false, versteckt: false };
  assert.equal(animieren({ ...normal, alt: 42490, neu: 20944 }), true);
  assert.equal(animieren({ ...normal, alt: 53.4, neu: 53.4 }), false);
});

test("Reduzierte Bewegung und verborgener Tab springen sofort", () => {
  assert.equal(animieren({ reduziert: true, versteckt: false, alt: 1, neu: 2 }), false);
  assert.equal(animieren({ reduziert: false, versteckt: true, alt: 1, neu: 2 }), false);
});
