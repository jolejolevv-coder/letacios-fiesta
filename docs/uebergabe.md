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

Annahmen Phase 1: ein neues EB Set ersetzt das alte EB (OP17+EB05 wird OP17+EB06); zum
Format zählen die neuen Sets mit mindestens 5 % am Starttag; erkannt wird nur über
Deckkarten; der Event Schlüssel bleibt `..._op17eb05_event` bis Phase 3.

Bazzite: Update Notice v2.7.7 blockierte die Bestenliste seit 27.10. früh. Am 28.10.
`seen_update_notice_v` auf 2.7.7 gesetzt (Sicherung `uinf.tres.bak_2026-10-28`) und
`mitschnitt.service` neu gestartet. Laut Notice läuft das alte Format jetzt in der Special
Queue (`mode_1`).

## Formatwechsel, 26.10.2026

OPBounty hat am 26.10. mittags die normale Queue (`mode_0`) auf OP17 plus EB05 umgestellt.
Live seit PR 7 (374d741): Satz
„OP17 + EB05 Standard“ (`Roh_mode_0_op17eb05`, alle Bereiche, ab `FORMAT_START` 2026-10-27)
ganz oben und als Startsatz der Seite. EB05 Queue und `Stats_Special_Queue` sind entfernt. Das Heroines Event
bleibt, gebaut aus dem neuen Satz (`Roh_mode_0_op17eb05_event`, PR 8). OP17 Sätze heißen „OP17 format (old)“. Wochensätze des Spiels
fehlen bis 03.11. (`WOCHE_AB`, PR 9), „Last Week 3B Bounty“ zählt nur neue Tage. Die Rohdaten reichten
am 26.10. bis zum 25.10., der neue Satz erscheint also frühestens mit dem Lauf vom 28.10.

Nächste Schritte: Ab 28.10. live prüfen, ob der Satz da ist
und der EB05 Anteil im Log über 30 % liegt und das Heroines Event darunter steht. Danach Phase 1 von tcgcsv (Kartendaten).

## Stand 24.10.2026

Gemergt: PR 2 (Schutz gegen verdeckte Namen in `werkzeuge/plausibel.py`, Grenze 6 verdächtige
Namen) und PR 3 (Zähler zeigen sofort den Endwert, `src/zaehler.js`). Die Ursache der kaputten
Namen am 23. und 24.10. war die Update Notice im Spiel. Der Wert `seen_update_notice_v` in
`~/.local/share/godot/app_userdata/OPBounty/uinf.tres` auf dem Bazzite steht auf 2.7.4. Der Lauf
von 17:02 mit Commit 0d028e5 ist sauber online. Kommt eine neue Spielversion, blockt
`plausibel.py` den Push. Dann den Wert auf die neue Version setzen, den Tagesmarker
`~/mitschnitt/erledigt_<datum>` löschen und neu laufen lassen.

Unversioniert im Worktree `trusting-knuth-88e5d4` liegt `specs/features/zuordnung-leaderzahl.md`,
noch ohne Freigabe: Eine user_id wird über den Abdruck nur vergeben, wenn die Zahl der
Leader passt. Damit bekommt Rang 1 MircoMorscio wieder die Id 17751 (`mirco4thewin`), die er
vom 12. bis 22.10. hatte. Empfehlung: als harte Bedingung, nicht nur als Tiebreak.

## EB05 Queue, abgeschlossen 24.10.2026

Branch `claude/eb05-queue`: Sätze „EB05 Queue“ (alle Partien von `mode_1` seit 10.10.) und
„EB05 Heroines Event“ (nur die 25 Leader aus `eb05_leader.json`), dazu 55 Kartenbilder aus
dem Sim in `bilder_nachtrag/` (Werkzeug `werkzeuge/bilder_nachtragen.py`). EB05-026 und
OP18-091 fehlen auch im Sim. Rangliste und Replays für EB05 hat der Nutzer gestrichen, die
Bounty im Replay ist ohnehin nicht die Queue Bounty.

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

0. PR 10, dann PR 11 mergen (nur mit OK des Nutzers), danach Lauf der Action prüfen:
   Formatsatz, Heroines Event, `format.zustand.json` im Cache. Dann Selbstlauf Phase 2
   (tcgcsv Kartendaten, vor dem 20.11.).
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
