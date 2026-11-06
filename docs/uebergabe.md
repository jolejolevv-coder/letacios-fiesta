# Übergabe Letacios Fiesta

Stand 06.11.2026. Neue Sitzungen lesen zuerst diese Datei und `specs/roadmap.md`, dann
bei Bedarf `README.md`, `PRODUCT.md`, `DESIGN.md` und `AGENTS.md`. Ältere Abschnitte stehen in
`docs/uebergabe-archiv-2026-10-28.md` und `docs/uebergabe-archiv-2026-11-06.md` (nur per grep lesen).

## Stand 06.11.2026

Alle PRs bis 37 sind gemergt, PR 21 wurde geschlossen (verworfen). Am 06.11. dazu:

* PR 33 `claude/polish`: Bounty am Handy vollständig, Touchziele, Schriftgrößen auf der Skala (Spec `specs/features/polish.md`).
* PR 35 `claude/bilder-leistung`: kleine Kartenbilder und Leaderbild aus eigener 120 px Datei, Vorabruf der Startdaten (`src/vorab.js`, `vite.vorab.js`), seltene Reiter als eigener Chunk (`src/Selten.jsx`), gsap erst bei Bedarf. Decklists Handy 86 Punkte, LCP 4,1 s; Ziel 90 und 2,5 s nicht erreicht (Specs `bilder-leistung.md`, `ladepfad-handy.md`).
* PR 36 `claude/replay-pfade`: Seit etwa W43 legt der Client Replays als `<Verlierer>_<Hash>.log` ab, das Wochenetikett weicht ab. `spieler_daten.py` holt den echten Pfad jetzt aus Firestore `Replays` (wie der Client), `replays_holen.py` zählt je Woche („je Woche gefunden“ im Action Log) und trägt fehlende Replays aus; die Seite zeigt dort keinen Knopf. Erster Lauf: 121 neu statt 32. Nur etwa jede fünfte neue Partie wird überhaupt hochgeladen.
* PR 34 und 37: Doku, Archiv und Rückblicke.

Einzelheiten zu diesen Runden stehen in `docs/uebergabe-archiv-2026-11-06.md` (Nachtrag beim Merge von PR 34).

Offen: ein Replay vom 05.11. oder später auf der Live Seite öffnen (hinter dem Passwort, prüft der Nutzer); Replaybrett und Handygröße der verschobenen Reiter mit echtem Replay prüfen.

## Ingame Namen 06.11.2026 (Branch `pi/ingame-namen`, nicht gepusht)

Spec `specs/features/ingame-namen.md`, freigegeben (Gedächtnis im Repo, Schwelle 95 %).
Phase 1: `frische_partien.py` merkt gelernte Ingame Namen in `ingame_namen.json.gz.enc` (Repo
Wurzel, nur verschlüsselt, schreibt nur bei Änderung). Konflikte zweier Belege sperren den
Namen. Neuer Workflow Schritt „Gedaechtnis der Ingame Namen sichern“ am Ende von `bauen`
committet die Datei (pull rebase autostash, continue on error). Lokaler Probelauf: 24 Namen,
zweiter Lauf „unveraendert“. Phase 2: Bounty im Replay Dokument ist nicht die Bounty der
Bestenliste (100 bis 900 darunter, springt), Precision 0, Phase 3 entfällt
(`werkzeuge/ingame_bounty_messung.py`). Offen: Push und PR nach OK, danach nach einigen Läufen
prüfen, ob die Zeile „Gedaechtnis“ und „Partien aus Replays für N Spieler“ wächst (Ziel 36).

## Spielerseite Verlauf 06.11.2026 (Branch `pi/spielerseite-verlauf`, nicht gepusht)

Spec `specs/features/spielerseite-verlauf.md`, freigegeben. `spieler_daten.py`: `verlauf_aus()`
übernimmt `Graph.y`, `gewertet()` lässt Partien ohne Sieger und Siege unter 60 s weg
(`MIN_MATCH_TIME = 60` im Spielpaket, nicht 15 wie bei optcg-data). Seite: `BountyVerlauf` in
App.jsx, Punkte aus `src/verlauf.js`. Offen: Push und PR nach OK. Aus der optcg-data Analyse
noch offen, Nutzer unentschieden: Bountyänderung je Partie (Feld 20, 21), Archiv der Profilzeilen
über Läufe, Profilzeitstempel, Hinweis auf den Saisonreset vom 27.10. Leader aus der Starthand
raten lehnte der Nutzer ab. Annahme: lokale Prüfung über `vite.review.mjs`; die Vorschaudaten
in `.impeccable/vorschau/oeffentlich` sind jetzt Stand 06.11. mit Verlauf.

## Nächste Schritte

1. Nächster Leistungshebel am Handy, falls gewünscht: Leaderbild aus `?leader=` vor dem Satz oder eine Kopfdatei des Satzes (siehe `specs/features/ladepfad-handy.md`).
2. Selbstlauf: Phase 1 (Formaterkennung, PR 11) und Phase 2 (Kartendaten aus Kaizoku und tcgcsv,
   PR 12) sind gemergt. Offen laut `specs/features/selbstlauf.md`: Phase 3 (Wachen für CDN und
   Firestore Zugang, Event Ablauf `bis`) und Phase 4 (Meldungen). Die Wache nach Quelle kam mit
   PR 27, ob Phase 3 damit fertig ist, ist nicht geprüft.
3. Nach dem nächsten Action Lauf die Zeile „je Woche gefunden“ ansehen; kippt die neueste Woche auf 0, hat der Client das Namensschema wieder gewechselt.
4. Spielerseite mit Bountyverlauf aus der API (Spec `specs/features/` nötig, früher vom Nutzer
   gewünscht, kein Stand im Repo).
5. Nur auf Wunsch: Signalfarben im Ladder ohne Partienzahl, Umbruch der Kartenleiste am Handy,
   gleichnamige Leader.

## Offene Fragen

* Bazzite: X11 Pakete behalten oder Mitschnitt auf Wayland? Systemupdate steht seit 27.10. (Entscheidung des Nutzers, Stand 04.11.).
* Update Log: laufen Bot und Secrets (`docs/discord-bot-anleitung.md`)? Stand im Repo: Phase 2
  gebaut, letzte Prüfung 29.10. ohne Meldung von OPBounty.
* Bestenliste Web API: Phase 3 ist live; wurde die Beobachtungswoche der Läufe ausgewertet?

## Zusammenfassung älterer Entscheidungen (Details im Archiv)

* **Altlasten (06.11.):** Das Thema Zuordnung der user_id über die Leaderzahl ist gestrichen,
  Branch `claude/log-formatsatz` gelöscht.

* **Bestenliste:** Die Action holt zuerst per Web API (`bestenliste_einbauen.py --api`), die OCR
  Liste vom Bazzite bleibt Rückfall. Die Wache kennt die Quelle (`bestenliste_quelle`).
  Vergleich gegen OCR: `werkzeuge/bestenliste_vergleich.py`.
* **Format:** Formatsatz und Formaterkennung nur noch aus CDN mode_0 ab 29.10. (PR 16).
* **Kaizoku:** kein eigener Reiter, sondern Quellen in der Datensatzwahl (`KAIZOKU_QUELLEN` in
  `src/daten.js`): EB05 und OP17 Standard, alle Spieler sowie top 20 (OP17 auch top 10).
  Dateien `kaizoku_<datensatz>.json.gz` und `..._b.json.gz`, gitignored. Kaizoku kommt nicht in
  den Guide, nur `tech` wird in Matchups gebraucht. Neue Quelle = Eintrag in `KAIZOKU_QUELLEN`,
  `DATENSAETZE` (`kaizoku_holen.py`) und `ZIELE` (`kaizoku_wochen.py`).
* **Design:** Redesign „Werkzeug“ und Signatur (Leaderfarben, Girlande) sind gemergt (PR 17, 18, 23).
* **Verworfen:** Bilanz je Gegnerleader als Spielerabschnitt (PR 21 geschlossen).

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

`npm test` (96 Tests), Python Tests mit `python3 -m unittest discover -s tests -p "test_*.py"` und `npx vite build`.

## Zuletzt behoben

* Die Spielerseite stürzte bei einer Partie mit unbekanntem Leader ab. Abgefangen in `Bild`.
* Die Liste im Mulligan ragte am Handy über den Rand. Behoben mit grid-cols-1 und min-w-0.

## Regeln

* Nicht den Entwickler von OPBounty kontaktieren.
* Nur PublicUsers lesen.
* Nie `standalone` setzen.
* Keine Gedankenstriche in Texten.
* Mihawk OP14-020 ignorieren.
