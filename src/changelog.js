/* Was neu ist, ein Eintrag je Tag, in einfachen Worten fuer Spieler (englisch wie die Seite).
   Neue Eintraege oben. Reine Datenupdates (Bestenliste, Analysen) stehen hier nicht.
   Gepflegt bei jedem Push, der etwas Sichtbares aendert; rueckwirkend am 22.10.2026 aus der
   Git Historie zusammengefasst. */
export const CHANGELOG = [
  {
    tag: "2026-10-22",
    punkte: [
      "New Guide tab: pick a leader, an opponent and your seat, and see in plain sentences how to mulligan, what to play in turns 1 to 7, where to attack, when to counter, and what top players do differently.",
      "New Analyze my replay tab: open the log of one of your own games from OPTCGSim and get the same analysis as on replays, with your accuracy, the win chance over the game and a grade at every decision. The log stays in your browser and is never uploaded.",
      "Replays now come with an analysis: accuracy for both players, the win chance over the whole game, and a grade at every attack, defense and mulligan. Jump straight to the previous or next mistake.",
      "The Analysis tab is now called Mulligan, and it now works by matchup: pick an opponent and a seat to see which opening cards to keep and which hands to mulligan, from real ladder results, for all players or only top players. Old links still work.",
      "New Changelog tab: what changed, one entry per day.",
      "The Mulligan tab now shows only the matchup view; the older all opponents table from OPBounty's public numbers is gone.",
      "The Mulligan tab works on phones: cards as a list with both win rates side by side, no sideways scrolling.",
    ],
  },
  {
    tag: "2026-10-20",
    punkte: [
      "New tab with opening hands: for each leader, which cards players keep or mulligan and how those hands win, plus how many copies of each card the lists run. Shown from 100 games up.",
      "Player pages are back for the leaderboard, with their recent games taken from replays.",
    ],
  },
  {
    tag: "2026-09-30",
    punkte: ["Replays draw an arrow from the attacker to its target, and follow blocks."],
  },
  {
    tag: "2026-09-25",
    punkte: ["The leaderboard updates every day again."],
  },
  {
    tag: "2026-09-21",
    punkte: [
      "Matchups add a set for games from 3,000 bounty up (Last Week 3B Bounty).",
      "Replays show rested cards sideways, and decklists name the player.",
    ],
  },
  {
    tag: "2026-09-02",
    punkte: [
      "The replay board is rebuilt from every card move, so it is exact at every step, including DON attached to each card.",
      "Replays work on phones: both boards on one screen, bigger controls.",
      "The replay viewer is fully in English, and the page no longer flashes white while loading.",
    ],
  },
  {
    tag: "2026-09-01",
    punkte: [
      "Letacios Fiesta opens: decklists, matchups, matchup matrix and power rankings from the OPBounty ladder, behind a password.",
      "Leaderboard with each player's leaders, player pages with decklists and replays, and a replay viewer with the full board.",
    ],
  },
];
