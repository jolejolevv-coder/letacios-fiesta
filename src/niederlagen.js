/**
 * Verloren gegen: die Partien eines Spielers, gruppiert nach dem Leader des Gegners.
 *
 * Grundlage sind nur die aufgezeichneten Partien (der Schnappschuss trägt die letzten
 * neun, dazu kommen Partien aus Replays). Das Ergebnis ist also ein Ausschnitt.
 */

/** Anzahl Zeilen, die die Spielerseite zeigt. */
export const NIEDERLAGEN_ZEILEN_MAX = 8;

/**
 * Je Gegnerleader: Niederlagen, Siege, Anteil an allen Niederlagen (0 bis 100) und das
 * erste Replay einer Niederlage (`replay`) mit dem eigenen Leader dieser Partie (`replayLeader`). Nur Leader mit mindestens einer Niederlage, absteigend
 * nach Niederlagen, bei Gleichstand nach mehr Partien, dann nach Kennung.
 * Partien ohne Gegnerleader zählen nicht.
 */
export function niederlagenNachLeader(partien) {
  const je = new Map();
  let verloren = 0;
  for (const p of partien || []) {
    if (!p || !p.gegner_leader) continue;
    const z = je.get(p.gegner_leader) || { leader: p.gegner_leader, siege: 0, niederlagen: 0, replay: null, replayLeader: null };
    if (p.gewonnen) {
      z.siege += 1;
    } else {
      z.niederlagen += 1;
      verloren += 1;
      if (!z.replay && p.replay) { z.replay = p.replay; z.replayLeader = p.eigener_leader || null; }
    }
    je.set(p.gegner_leader, z);
  }
  return [...je.values()]
    .filter((z) => z.niederlagen > 0)
    .map((z) => ({ ...z, partien: z.siege + z.niederlagen, anteil: (100 * z.niederlagen) / verloren }))
    .sort((a, b) => b.niederlagen - a.niederlagen || b.partien - a.partien || a.leader.localeCompare(b.leader));
}
