/**
 * Bekannte Partien einer Deckliste, aufgeteilt nach dem Leader des Gegners.
 *
 * Die Decklisten der Quelle tragen nur Gesamtzahlen, nicht je Gegner. Was wir je Gegner
 * wissen, sind die aufgezeichneten Partien der Spieler aus der Bestenliste (der Schnappschuss
 * trägt die letzten neun je Spieler, dazu kommen Partien aus Replays). Das ist ein Ausschnitt,
 * und die Seite sagt es.
 */
import { deckSchluessel } from "./daten.js";

/** Anzahl Gegnerleader, die die Rückseite einer Liste zeigt. */
export const BILANZ_ZEILEN_MAX = 8;

/**
 * {Listenschlüssel: [{gegner_leader, gewonnen}]} aus den Partien aller Spieler.
 * Der Schlüssel ist derselbe wie bei "Played by" (`deckSchluessel`).
 */
export function partienJeListe(spielerAlle) {
  const index = new Map();
  const spieler = spielerAlle && spielerAlle.spieler;
  if (!spieler) return index;
  for (const eintrag of Object.values(spieler)) {
    for (const p of (eintrag && eintrag.partien) || []) {
      if (!p || !p.gegner_leader) continue;
      const schluessel = deckSchluessel(p.deck, p.eigener_leader);
      if (!schluessel) continue;
      if (!index.has(schluessel)) index.set(schluessel, []);
      index.get(schluessel).push({ gegner_leader: p.gegner_leader, gewonnen: !!p.gewonnen });
    }
  }
  return index;
}

/**
 * Je Gegnerleader Siege und Niederlagen, absteigend nach Partien, bei Gleichstand nach
 * mehr Niederlagen, dann nach Kennung.
 */
export function bilanzNachLeader(partien) {
  const je = new Map();
  for (const p of partien || []) {
    if (!p || !p.gegner_leader) continue;
    const z = je.get(p.gegner_leader) || { leader: p.gegner_leader, siege: 0, niederlagen: 0 };
    if (p.gewonnen) z.siege += 1;
    else z.niederlagen += 1;
    je.set(p.gegner_leader, z);
  }
  return [...je.values()].sort(
    (a, b) => b.siege + b.niederlagen - (a.siege + a.niederlagen)
      || b.niederlagen - a.niederlagen || a.leader.localeCompare(b.leader));
}
