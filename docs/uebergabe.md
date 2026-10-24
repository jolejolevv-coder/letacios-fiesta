# Übergabe Letacios Fiesta

Stand 24.10.2026 spätabends. Neue Sitzungen lesen zuerst diese Datei und `specs/roadmap.md`, dann
bei Bedarf `README.md`, `PRODUCT.md` und `DESIGN.md`.

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
* Im Event Satz will der Nutzer nur Winrates gegen Heroines sehen, ohne Rückfrage zu Details.
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

1. Branch `claude/eb05-event-heroines` (Commit 27e734c, nicht gepusht): Im Event Satz gelten
   alle Winrates nur gegen die 25 Event Leader, Decklisten weiter über alle Gegner mit Hinweis.
   Tests grün, lokal geprüft (Robin 1.152 Partien, 53,6 %). Wartet auf Ok zum Push und PR.
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
