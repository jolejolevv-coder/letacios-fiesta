# Übergabe Letacios Fiesta

Stand 28.10.2026. Neue Sitzungen lesen zuerst diese Datei und `specs/roadmap.md`, dann
bei Bedarf `README.md`, `PRODUCT.md` und `DESIGN.md`.

## Stand 28.10.2026

Ins Archiv `docs/uebergabe-archiv-2026-10-28.md` verschoben (Statistikquellen, Abdeckung der Replays, Upload Bedingungen, Bazzite Update Notice).

## Stand 29.10.2026

OPBounty 2.7.8: CDN schreibt wieder seit 29.10. 02:27 UTC, 27. und 28.10. nachgeliefert
(mode_0: 16.088 und 12.921 Partien, EB05 Anteil 31 und 33 %, Replays 56 bis 59 %). Grund
vermutlich: Spieler mit eingebetteter Sim landen vorläufig in der OP17 Queue, mode_0 mischt
also beide Kartenpools. Formatsatz bleibt bei den Replays (Empfehlung, Nutzer hat nicht
widersprochen). Neu: Entwurf `specs/features/update-log.md` (Update Kanal per Folgen in eigenen
Server, eigener Bot, Action liest per REST). Spec freigegeben, Folgen eingerichtet, Action bleibt täglich.
Phase 1 gebaut auf Branch `claude/update-log` (150 Tests grün). Offen: Bot und Secrets
`DISCORD_BOT_TOKEN`, `DISCORD_KANAL_ID` durch den Nutzer nach `docs/discord-bot-anleitung.md`,
PR 13 gemergt, Lauf grün. Filter auf gespiegelte Nachrichten auf Branch
`claude/update-log-filter`. Prüfen mit der nächsten echten Meldung von OPBounty.

## Stand 02.11.2026

Seit v2.7.8 (29.10.) ist CDN mode_0 sauber (EB05 60 bis 70 %), eingebettete Sim spielt in
mode_1. Entscheidung des Nutzers am 02.11.: Formatsatz und Formaterkennung nur noch aus CDN
mode_0 ab 29.10., Replay Code dafür gelöscht (Spec `specs/features/format-aus-cdn.md`).
Spielerseiten, Reiter Replays und Metacoach bleiben bei den Replays. Steht das CDN länger als
zwei Tage, warnt die Action, der Satz bleibt stehen. Gebaut auf Branch `claude/format-aus-cdn`,
Tests grün, Probelauf: 29.10. bis 01.11., 9.295 Partien, EB05 64 %. Offen: Push und Merge nach
OK des Nutzers, danach den Lauf der Action prüfen. Annahme: der gespeicherte Start 27.10. wird
beim Lesen auf 29.10. gezogen. Update Log: seit 29.10. keine neue Meldung von OPBounty.

## Redesign 02.11.2026

Branch `claude/website-redesign-bc8edc`. Nutzer wählte nach der Vergleichsseite
(`.impeccable/vorschau/richtungen.html`, gitignored) Richtung B Linear / Raycast, alle Reiter,
nur dunkel, am Handy untere Leiste. Spec `specs/features/redesign.md` freigegeben, v0 freigegeben.
Alle fünf Phasen gebaut: Tokens und Geist, Rahmen mit Pillen und unterer Leiste, alle Ansichten
bei 1280 und 390 px geprüft (kein seitliches Scrollen), ⌘K Palette (`Palette` in App.jsx, Logik
in `src/leadersuche.js`, Test `tests/leadersuche.test.js`), Doku und Changelog. Tests und Build
grün. Committet auf dem Branch, nicht gepusht; Push und Merge nur mit Ok des Nutzers.
Vorschau: launch.json Eintrag `redesign` (`.impeccable/review/vite.redesign.mjs`, Port 5181,
Daten aus dem Hauptcheckout). `.impeccable/config.json` (Hook Ausnahmen) bleibt uncommittet.

Annahmen: Palette öffnet den Leader in Decks, Matchups, Matrix (als Fokus), Mulligan und Guide im
selben Reiter, aus allen anderen in Decklists. Text 3 `#7c828d` hat 5.16 auf Grund, aber nur 4.25
auf `--flaeche-2`; dort steht er kaum. Schriften laden latin 83 KB statt vorher 130 KB; das CSS
wächst gzip um etwa 1 KB.

## Feinschliff nach Bewertung 02.11.2026

Redesign ist live (PR 17, fe1ff70). Bewertung ergab 7.2 von 10. Auftrag des Nutzers: Bewertung so
lange wiederholen und nachbessern, bis jede der fünf Dimensionen mindestens 9 hat. Arbeit auf dem
Branch `claude/website-redesign-bc8edc` (auf main vorgespult). Lokal schon geändert: Zählkreise
neutral, Leadertitel 32 px, Kacheln ab sieben in zwei Reihen zu vier, am Handy zwei Spalten.
Danach umgesetzt: Akzent aus Schrittnummern und Rückseitenetiketten, doppelter Leadername am
Handy weg, Winrate Skala (30 bis 70 %, Strich bei 50) in Kopfkacheln und in den Tafeln Decklists
und Matchups, Leaderkopf mit sechs Kacheln (Win rate breit vorn, Siege und Niederlagen unter
Games), `--text-3` heller (#878d98, Kontrast auf Fläche 2 über 4.5), Bounty immer mit einer
Nachkommastelle. Zweite Bewertung: alle fünf Dimensionen 9. Tests und Build grün.

Annahmen: Wins und Losses als eigene Kacheln entfallen, die Zahlen stehen unter Games. Der äußere
Rahmen bleibt (bewusste Hülle wie bei Linear).

## Entscheidung 29.10.2026

`mitschnitt.timer` läuft auf Wunsch nur noch einmal am Tag, 05:30 UTC (vorher stündlich
nachfassen bis 21:30 UTC). Auf dem Bazzite aktiv, alte Datei in `/tmp/mitschnitt.timer.bak`.
Fällt der Termin aus, fehlt die Bestenliste des Tages.

## Nächste Schritte

0. PR 10 und PR 11 am 28.10. gemergt, Lauf 40647237206 grün: 8.829 Replays, First/Second
   bei 7.724, EB05 56 %, Event 24 von 25 Leadern, `format.zustand.json` geschrieben. Als
   Nächstes Selbstlauf Phase 2 (Kartendaten, vor dem 20.11.): gebaut auf Branch
   `claude/tcgcsv-daten` (PR 12), Kaizoku zuerst, tcgcsv füllt Lücken, Warnung „Karten ohne
   Daten“. Danach Selbstlauf Phase 3 (Wachen für CDN und Firestore Zugang, Event Ablauf `bis`).
1. Kartenquelle tcgcsv: Phase 2 (Bilder) ist live seit PR 6 (c887775). Erster Lauf der
   Action: 2.218 Bilder ersetzt, 49 noch nicht von tcgcsv (`img/offen.txt`, Vorverkauf OP18
   und alte Promos), 16 ganz ohne Bild (OP18-065, OP18-091, P-087 bis P-151). Als Nächstes
   Phase 1 (Daten aus tcgcsv, Kaizoku als Ersatz) in einer frischen Sitzung bauen.
2. Freigabe für `zuordnung-leaderzahl.md` holen (hart oder nur Tiebreak), dann in
   `spieler_daten.py` bauen und gegen die Liste vom 24.10. nachrechnen.
3. Offen aus der Designkritik, nur auf Wunsch: Signalfarben bei Winrates ohne Partienzahl im
   Ladder, Umbruch der Kartenleiste am Handy, gleichnamige Leader.

## Werkzeuge dieser Sitzung

Firestore Abfragen auf Replays gehen lokal mit `firestore.Db()` und
`frische_partien.replays_suchen(db, ende, tage)`. Das CDN liefert Rohdateien unter
`stats/raw/<key>`, den Index unter `stats/files.json`. Zum Entschlüsseln fehlt im lokalen
Python das Paket `cryptography`, Node mit `crypto` geht.

## Was es ist

Private Statistikseite für OPTCG auf fiesta.nahobinoco.com. Sie ist statisch auf GitHub Pages
(Repo `jolejolevv-coder/letacios-fiesta`, öffentlich), und alle Daten sind mit AES-GCM hinter
einem Passwort verschlüsselt (`verschluesseln.py`, `src/daten.js`). Die Oberfläche ist englisch.
Die Action „Veroeffentlichen“ baut bei jedem Push. Ein Push braucht das Ok des Nutzers, außer er
sagt „push direkt“.

## Datenwege

* **Ladder:** Seit dem 20.10.2026 kommt sie per Bildschirmfoto und OCR aus dem Spielclient auf dem
  Bazzite. Das Speicherauslesen ist blockiert und wird nie vorgeschlagen. Der Timer läuft
  stündlich um :30 UTC. Der Servercheckout liegt unter `~/opbounty-ladder/seite`, nie von Hand
  verändern.
* **Replay Analysen:** Metacoach rechnet sie nachts (`meta-coach/tools/fiesta_analyse.py`) und
  pusht sie verschlüsselt nach `public/analyse/`. Rund 290 Replays haben im Speicher von
  OPBounty kein Log und bleiben ohne Analyse.
* **Guide (Book) und Wertnetz:** Sie kommen NICHT aus dem Repo, sondern direkt von Metacoach
  (`https://meta.nahobinoco.com/fiesta/book/...`, `/fiesta/netz/...`, verschlüsselt mit dem
  Passwort von Fiesta). Der Abruf läuft über `metacoachHolen` in `src/daten.js`.
* **Große Kartenbilder** kommen von Metacoach über `/fiesta/bilder/<nr>.jpg` (`grossesBild` in
  `src/daten.js`).
* **Counter Werte der Karten** setzt `aktualisieren.py` in `karten.json.gz` (Feld `c`).

## Reiter

* Decks, Matchups, Matrix, Ranking, Ladder, Mulligan, Guide, Analyze my replay und Changelog.
* **Matrix:** Fokus auf einen Leader (`?leader=`) und Sortierung (`&sort=wr`).
* **Farben:** Seegrün `--gewinnt` und Ziegelrot `--verliert`, die Tönung wächst mit dem Abstand
  von 50 %.
* **Guide:** „Show evidence“ je Zug mit Advice, Next best und Hold.
* **Analyze my replay:** rechnet im Browser (`src/zuglager.js`, `src/wertnetz.js`,
  `src/spielbewertung.js`). Gegen 20 Prüfpartien in `tests/referenz/` ist es deckungsgleich mit
  Python.
* **Kartenvorschau:** ein Tipp auf eine Karte in offener Deckliste, im Guide oder im Mulligan.
* **Changelog:** ein englischer Eintrag je Tag mit sichtbarer Änderung in `src/changelog.js`,
  gepflegt bei jedem Push.

## Design

Seit dem 02.11.2026 „Werkzeug“ (Linear / Raycast), eigenes Gesicht statt der Spielhilfe aus
Metacoach. Quellen der Wahrheit sind
`DESIGN.md` und `.impeccable/design.json`. Der Sombrero bleibt strohgelb.

## Lokal prüfen ohne Passwort

`npx vite --config .impeccable/review/vite.review.mjs` (Port 5180), mit entschlüsselten Daten aus
`.impeccable/vorschau/oeffentlich`. Das Passwort aus `~/.fiesta_passwort` wird nie eingetippt
und nie ausgegeben.

## Tests

`npm test` (53 Tests) und `npx vite build`.

## Zuletzt behoben

* Die Spielerseite stürzte bei einer Partie mit unbekanntem Leader ab. Abgefangen in `Bild`.
* Die Liste im Mulligan ragte am Handy über den Rand. Behoben mit grid-cols-1 und min-w-0.

## Regeln

* Nicht den Entwickler von OPBounty kontaktieren.
* Nur PublicUsers lesen.
* Nie `standalone` setzen.
* Keine Gedankenstriche in Texten.
* Mihawk OP14-020 ignorieren.

## Stand 02.11.2026, Bestenliste per Web API

Spec `specs/features/bestenliste-web-api.md` (freigegeben). Phase 0 und 1 gebaut auf Branch
`claude/recherche-github-tools-69b80a`: `bestenliste_api.py`, Schalter `--api` in
`bestenliste_einbauen.py`, 12 Tests. `playerId` der API ist die `user_id`. Offen: Phase 2
(Parallelbetrieb, Vergleich gegen die OCR Liste), Entscheidung wo der Abruf läuft
(Empfehlung Bazzite), dann Phase 3 Umschalten. Replay Gefühl und Kaizoku Daten haben
Entwürfe in `specs/features/`. Recherche: `docs/recherche-github-tools.md`.

Entscheidung 02.11.2026: Der Abruf der Bestenliste läuft in der GitHub Action. Phase 2 gebaut:
Schritt "Bestenliste Web API gegen OCR" in `veroeffentlichen.yml`, Skript
`werkzeuge/bestenliste_vergleich.py` (nur Zahlen im Log, weil das Repo öffentlich ist).
Nach dem Merge eine Woche die Zusammenfassungen der täglichen Läufe lesen, dann Phase 3
(Umschalten). Der Schritt braucht `SEITEN_PASSWORT`, das es schon gibt. Nicht geprüft: ob
GitHub Runner von der API geblockt werden (erster Lauf zeigt es).

## Stand 02.11.2026 abends, Phase 3 gebaut

Bestenliste: Action holt zuerst per Web API (`bestenliste_einbauen.py --api`), bei Fehlern bleibt die OCR Liste. Offen: Merge von PR 19 (nur dort läuft die Action), erster Lauf zeigt, ob GitHub Runner zugelassen sind, sonst Abruf auf dem Bazzite. Als Nächstes laut Nutzer: Spielerseite mit Bountyverlauf aus der API und den Decks, gegen die der Spieler verloren hat (Spec nötig). Analyse: docs/analyse-optcg-data-seite.md.

## Stand 02.11.2026 spät

PR 19 gemerged, erster Lauf mit Web API grün (100 Spieler, 100 mit user_id; 88 mit Spielerdaten, vorher 73; 74 Spieler mit Replays, 235 Replays im Bestand). PR 20: Winrate aus API Summen, Zeitspalte ausgeblendet ohne Daten, Kartenbilder zuerst vom CDN static.dotgg.gg (WebP, preconnect), Rückfall auf eigene JPG. Als Nächstes: Spec Spielerseite (Bountyverlauf aus API, Niederlagen gegen Decks).

## Verworfen am 02.11.2026

Bilanz je Gegnerleader (Spielerseite und Decklisten): Quelle liefert je Liste nur Summen, Ausschnitt aus Spielerpartien reicht dem Nutzer nicht. PR 21 geschlossen, nichts gemerged.

## Kaizoku Stufe A (02.11.2026)

`kaizoku_holen.py` holt manifest, stats und decklist von cdn.cardkaizoku.com (Datensatz op17_lw_p, 3 Abrufe, 0,4 s Abstand) nach `public/kaizoku.json.gz` (nicht im Repo, 97 KB gepackt). Reiter Kaizoku in der App. Decklisten tragen die Bilanz je Gegnerleader. Offen: Stufe B (Hände, Kurve, Matchuptech), Stufe C nur nach Ok; Anzeige im Browser mit echten Daten noch nicht angesehen.
