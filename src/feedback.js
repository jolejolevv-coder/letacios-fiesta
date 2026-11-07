/* Verbesserungsvorschlaege per Textfeld (specs/features/feedback.md).

   Versand ueber Web3Forms, das jede Nachricht als Mail an den Betreiber schickt. Der
   Zugangsschluessel kommt aus feedback.json.gz, die die Action aus dem Secret WEB3FORMS_KEY
   schreibt und wie alle Daten mit dem Seitenpasswort verschluesselt. */

export const FEEDBACK_DATEI = "feedback.json.gz";
export const MAX_ZEICHEN = 2000;
const ADRESSE = "https://api.web3forms.com/submit";
const BETREFF = "Letacios Fiesta: suggestion";
const ABSENDER = "Letacios Fiesta";

/** Leerer Text oder Meldung, warum der Text so nicht geht. */
export function pruefen(text) {
  const t = String(text ?? "").trim();
  if (!t) return "Please write something first.";
  if (t.length > MAX_ZEICHEN) return `Please keep it under ${MAX_ZEICHEN} characters.`;
  return "";
}

/** Der Text der Mail: der Vorschlag, darunter, wo der Nutzer gerade war. Leere Angaben fehlen. */
export function nachrichtBauen(text, kontext = {}) {
  const zeilen = [
    ["Tab", kontext.reiter],
    ["Leader", kontext.leader],
    ["Data set", kontext.satz],
    ["Data of", kontext.stand],
    ["Page", kontext.adresse],
  ].filter(([, wert]) => wert).map(([name, wert]) => `${name}: ${wert}`);
  return String(text ?? "").trim() + (zeilen.length ? "\n\n---\n" + zeilen.join("\n") : "");
}

/** Den Schluessel aus der geladenen Datei, oder "" wenn er fehlt. */
export function schluesselAus(datei) {
  const s = datei && typeof datei.schluessel === "string" ? datei.schluessel.trim() : "";
  return s;
}

/**
 * Schickt den Vorschlag ab. Wirft einen Error mit einer Meldung fuer den Nutzer, wenn der
 * Versand scheitert; dann soll der Text stehen bleiben.
 */
export async function senden(schluessel, text, kontext, holen = fetch) {
  const fehler = pruefen(text);
  if (fehler) throw new Error(fehler);
  if (!schluessel) throw new Error("Sending is not set up right now.");
  let antwort;
  try {
    antwort = await holen(ADRESSE, {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        access_key: schluessel,
        subject: BETREFF,
        from_name: ABSENDER,
        message: nachrichtBauen(text, kontext),
      }),
    });
  } catch {
    throw new Error("Could not send. Check your connection and try again.");
  }
  let daten = null;
  try {
    daten = await antwort.json();
  } catch {
    daten = null;
  }
  if (!antwort.ok || !daten || daten.success !== true) {
    throw new Error("Could not send right now. Please try again later.");
  }
}
