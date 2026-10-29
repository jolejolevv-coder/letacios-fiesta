# Übergabe Letacios Fiesta

Stand 28.10.2026. Neue Sitzungen lesen zuerst diese Datei und `specs/roadmap.md`, dann
bei Bedarf `README.md`, `PRODUCT.md` und `DESIGN.md`.

## Stand 28.10.2026

OPBounty veröffentlicht seit dem 26.10. 18:28 UTC keine Statistik mehr (Rohdateien und
fertige Sätze stehen still). Deshalb fehlen „OP17 + EB05 Standard“ und das Heroines Event
weiter. Die Replays in Firestore laufen und zeigen die Umstellung (27.10.: 57 % EB05 in
`game_mode` 0). Gebaut (PR 10, Branch `claude/format-aus-replays`): Formatsatz und Heroines
Event aus den Replays, First/Second aus den Logs, erster Lauf rund 7 Minuten. Dazu
`werkzeuge/notice_setzen.py`: der Mitschnitt setzt `seen_update_notice_v` vor jedem Start
selbst. `specs/features/selbstlauf.md` ist freigegeben (Startsatz automatisch, Warnungen
nur über GitHub). Phase 1 Formaterkennung gebaut (PR 11, Branch `claude/formaterkennung`,
auf PR 10 aufgesetzt): Zustand in `public/tage/format.zustand.json`, neue `OP`/`EB` Sets ab
5 % am Umstellungstag und 30 % am Folgetag, alter Satz als „format (old)“ im Cache,
`verzeichnis.start` öffnet den Formatsatz.

Annahmen Phase 1: nach OP17 + EB05 kommt OP18 ohne neues EB (Nutzer, 28.10.: EB Sets
kommen nur alle paar Sets, EB05 Heroines war eine Ausnahme fürs Event; das nächste EB
frühestens nach OP19 oder OP20). Ein neues EB käme zum OP dazu; zum
Format zählen die neuen Sets mit mindestens 5 % am Starttag; erkannt wird nur über
Deckkarten; der Event Schlüssel bleibt `..._op17eb05_event` bis Phase 3.

Statistikquellen geprüft (28.10.): Der Client 2.7.7 liest dieselben CDN Adressen wie wir,
einen neuen Ort gibt es nicht. Firestore `Matches` ist seit 22.07.2025 tot (letzter
`match_index` 5043131, gelesen nur mit Feldmaske ohne Namen). Bleibt: `Replays`.
Gezählt wird beim Server: nach jeder Partie schickt der Client `send_match_info` per RPC an
den Spielserver. Ein Rückweg für globale Statistik (`request_global_stats`,
`receive_global_data`) steht noch im Paket, wird aber nirgends aufgerufen. Der Export des
Servers aufs CDN ist am 26.10. stehen geblieben; einen anderen Ausgang gibt es im Client nicht.
Abdeckung der Replays (Modus 0, Replays je Tag durch Partien laut CDN, gemessen 28.10.):
Juli bis Mitte August 40 bis 42 %, September 36 bis 37 %, Anfang Oktober 33 %, 17. bis 22.10.
nur 17 bis 20 %, 23. bis 25.10. wieder 28 bis 37 %. Ab 27.10. ohne Vergleich (7.231 Replays
am 27.10., vorher rund 4.200 je Tag). Skript: Scratchpad `abdeckung.py`, nicht im Repo.
Upload laut Client 2.7.7 nur, wenn: Spieler ist Lobbyleiter (`room_leader`, je Partie einer),
kein Turnier, Ergebnis bestätigt (nicht cancelled, invalid, early, pending, unresolved), beide
Leader bekannt, und das Combat Log der OPTCGSim (`CombatLogs/AutoSaved`, über `simPath`) des
Lobbyleiters wird gefunden und besteht die Prüfung (`win` gesetzt, Integrität nicht invalid).
Upload über einen Ausgang mit Wiederholung, erst Storage, dann Firestore `Replays`.

Bazzite: Update Notice v2.7.7 blockierte die Bestenliste seit 27.10. früh. Am 28.10.
`seen_update_notice_v` auf 2.7.7 gesetzt (Sicherung `uinf.tres.bak_2026-10-28`) und
`mitschnitt.service` neu gestartet. Laut Notice läuft das alte Format jetzt in der Special
Queue (`mode_1`).

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

## Entscheidungen des Nutzers am 24.10.2026

* PR 4 (EB05) ist gemergt und live geprüft: beide Sätze und 55 Bilder.
* Im Event Satz will der Nutzer nur Winrates gegen Heroines sehen. Gebaut und live (PR 5).
* Kartenpipeline: eine Quelle statt vieler. Gewählt tcgcsv, Kaizoku nur als Ersatz für Daten.
* Car D. Kaizoku (cardkaizoku.com/matchhistory) bekommt Partien direkt vom Sim, auch private
  Lobbys. Replays über `POST api.cardkaizoku.com/match-replay` nur mit Patreon (403
  `patreon_required`). Empfehlung: nicht scrapen, Kaizoku nach Datenzugang fragen. Offen.

* Grenze 6 im Plausibilitätsschutz, weil saubere Tage 2 bis 4 verdächtige Namen haben und
  Tage mit der Notice 18 bis 19.
* Die Zählanimation beim Leaderwechsel bleibt, nur der erste Wert steht sofort.
* Für die EB05 Queue reichen ihm am Ende Decklists und Matchup Matrix nach Winrate,
  Rangliste und Replays gestrichen. Zuerst wollte er Rangliste, Decks, Statistik und Replays. Grund: Etwa
  am 7.11.2026 ist ein Event mit EB05 Decks, auf dem nur die 25 Leader der Liste erlaubt sind.
  Ein Filter nur mit diesen Leadern in der EB05 Meta ist ausdrücklich gewünscht.

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

Seit dem 22.10.2026 „Spielhilfe“ aus Metacoach, freigegeben nach einer Vorschau
(`.impeccable/vorschau/`, lokal mit entschlüsselten Daten, gitignored). Quellen der Wahrheit sind
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
