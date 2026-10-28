/* Was neu ist, ein Eintrag je Tag, in einfachen Worten fuer Spieler (englisch wie die Seite).
   Neue Eintraege oben. Reine Datenupdates (Bestenliste, Analysen) stehen hier nicht.
   Gepflegt bei jedem Push, der etwas Sichtbares aendert; rueckwirkend am 22.10.2026 aus der
   Git Historie zusammengefasst. */
export const CHANGELOG = [
  {
    tag: "2026-10-28",
    punkte: [
      "OP17 + EB05 Standard and EB05 Heroines Event are back, counted from game replays since October 27, because OPBounty stopped publishing its statistics on October 26. Replays cover about half of all games and carry no mulligan data, so those columns stay empty for now.",
    ],
  },
  {
    tag: "2026-10-27",
    punkte: [
      "No more mixed formats: the weekly sets Last Week Standard, 1B and 2B are hidden until November 3, when their week holds only the new format. Until then, OP17 + EB05 Standard shows the new meta with the days played so far.",
      "Last Week 3B Bounty counts only days in the new format and appears with the first one.",
    ],
  },
  {
    tag: "2026-10-26",
    punkte: [
      "OPBounty's normal queue now plays OP17 plus EB05. New data set OP17 + EB05 Standard at the top of the list: every game of the new format from October 27 on, all bounty ranges. It fills up from the first full day of data.",
      "The OP17 sets are now called OP17 format (old) and show the format before the switch.",
      "The weekly sets still mix old and new format until November 3 and say so in their name. Last Week 3B Bounty counts only days in the new format.",
      "The EB05 Queue and its weekly set are gone, now that EB05 is part of the normal queue.",
      "EB05 Heroines Event stays: it now filters the new OP17 + EB05 Standard set to the 25 event leaders, with every win rate counted only against them. It sits right below the new set.",
    ],
  },
  {
    tag: "2026-10-24",
    punkte: [
      "All card images now come from one source in sharper quality, and new cards get their image as soon as it is published.",
      "New data set EB05 Queue: every game of OPBounty's EB05 queue since October 10, all bounty ranges. The weekly set that was called Special Queue is now EB05 Queue, last week.",
      "New data set EB05 Heroines Event: the EB05 queue with only the 25 leaders allowed at the event, and matchups only against those leaders.",
      "EB05 Heroines Event: every win rate, including going first and second, now counts only games against the 25 event leaders. Deck list stats still count all opponents, the Decks tab says so.",
      "The numbers above each leader and on player pages are right from the first moment, instead of counting up from zero. They still count when you switch leaders, unless your device asks for reduced motion.",
    ],
  },
  {
    tag: "2026-10-22",
    punkte: [
      "Tap a card in an open deck list, in the Guide or in the Mulligan tab to see it large and read its text.",
      "The matrix shows win rates in color again, green for winning and red for losing, stronger the further from 50 %. Tap a leader to see only its matchups, and sort by win rate or games.",
      "Guide: every turn and the mulligan can flip to show the evidence, with the next best play, the attack line and the defense by life.",
      "New look for every tab: Fiesta now reads like the quick reference card of Metacoach, with numbered rows, small card strips with the full list on the back, a calmer matrix, the top three leaders per player on the leaderboard and the Analyze tab leading with your win chance and decisions.",
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
