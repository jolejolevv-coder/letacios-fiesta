/* Welche Partien zeigt die Spielerseite? (specs/features/spielerseite-verlauf.md, Nachtrag)

   Nur Partien mit beiden Leadern. Fehlt einer, hat der Spieler ohne Sim Sync gespielt (am
   Handy oder mit "play anyway"); dann kennt der Server das Deck nicht, und ein Replay gibt es
   fuer solche Partien praktisch nie. Die Daten bleiben vollstaendig, der Reiter Decklists
   braucht sie weiter. */

/** Hat die Partie beide Leader? */
export function istKomplett(p) {
  return Boolean(p && p.eigener_leader && p.gegner_leader);
}

/** { sichtbar: Partien mit beiden Leadern, ausgeblendet: Zahl der uebrigen }. */
export function partienTeilen(partien) {
  const alle = Array.isArray(partien) ? partien : [];
  const sichtbar = alle.filter(istKomplett);
  return { sichtbar, ausgeblendet: alle.length - sichtbar.length };
}
