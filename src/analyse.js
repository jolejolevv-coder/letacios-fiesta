/* Replay Analyse aus Metacoach (specs/features/replay-analyse.md): haengt die Noten und
   die Siegchance an die Schritte des Viewers. Reine Funktionen, getestet in
   tests/analyse.test.js.

   Die Analyse kennt keine Namen und keine Laufnummern. Verankert wird ueber die
   Reihenfolge im Log: der n te Angriff ist der n te Schritt mit "attacking", das Ende
   von Halbzug n ist der n te Schritt mit "End Turn". Spieler 1 und 2 der Analyse sind die
   Spielernummern im Log; zugeordnet wird ueber den Leader, im Mirror ueber den Sitz. */

const ANGRIFF = /\battacking\b/;
const ZUGENDE = /End Turn/i;
export const FEHLERNOTEN = ["inaccuracy", "mistake", "blunder"];
export const NOTEN = ["best", "excellent", "good", "inaccuracy", "mistake", "blunder"];

export function ankerBauen(schritte) {
  const angriffe = [];
  const zugEnden = [];
  let erster = null;
  schritte.forEach((s, i) => {
    if (s.wer && ANGRIFF.test(s.text)) angriffe.push(i);
    if (ZUGENDE.test(s.text)) {
      if (erster === null && s.wer) erster = s.wer;
      zugEnden.push(i);
    }
  });
  return { angriffe, zugEnden, erster };
}

/* Spielernummer der Analyse -> Name im Viewer. */
export function spielerZuordnen(analyse, leader, erster) {
  const namen = Object.keys(leader);
  const aus = {};
  for (const nr of ["1", "2"]) {
    const s = analyse.spieler?.[nr];
    if (!s) continue;
    const passend = namen.filter((n) => leader[n] === s.leader);
    if (passend.length === 1) aus[nr] = passend[0];
    else if (passend.length === 2 && erster) {
      aus[nr] = s.first ? erster : passend.find((n) => n !== erster);
    }
  }
  return aus;
}

/* Die Entscheidungen mit dem Schritt, an dem sie stehen. Mulligans stehen am Anfang. */
export function markenBauen(analyse, anker) {
  return (analyse.entscheidungen || [])
    .map((e) => {
      let schritt = null;
      if (e.art === "mulligan") schritt = 0;
      else if (e.angriff !== null && e.angriff !== undefined) schritt = anker.angriffe[e.angriff] ?? null;
      return { ...e, schritt };
    })
    .filter((e) => e.schritt !== null)
    .sort((a, b) => a.schritt - b.schritt);
}

/* Die Kurve aus Sicht von `nr` ("1" oder "2"): je Halbzug Schritt und Siegchance. */
export function kurveBauen(analyse, anker, nr) {
  return (analyse.kurve || [])
    .map((k) => ({
      schritt: anker.zugEnden[k.hz] ?? null,
      wert: nr === "2" ? 100 - k.v1 : k.v1,
      T: k.T,
      wer: String(k.wer),
    }))
    .filter((k) => k.schritt !== null);
}

/* Der naechste oder vorige Fehler von `ab` aus; null, wenn keiner mehr kommt. */
export function fehlerSuchen(marken, ab, richtung) {
  const fehler = marken.filter((m) => FEHLERNOTEN.includes(m.note));
  if (richtung > 0) return fehler.find((m) => m.schritt > ab)?.schritt ?? null;
  const frueher = fehler.filter((m) => m.schritt < ab);
  return frueher.length ? frueher[frueher.length - 1].schritt : null;
}
