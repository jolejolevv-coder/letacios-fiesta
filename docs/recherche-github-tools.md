# Recherche: Wege zu mehr OPBounty Daten

Stand 02.11.2026. Gelesen wurde nur auf GitHub und im Web. Nichts heruntergeladen, nichts ausgeführt, niemand kontaktiert. Gesucht wurde nach OPBounty, OPTCGSim, One Piece TCG replay, optcg stats, scraper, apibounty, firebase, firestore.

Fragestellung nach Klärung mit dem Nutzer: nicht neue Quellen zum Einbauen, sondern was uns mehr Daten aus den OPBounty Quellen bringt, die wir schon anzapfen.

## Ergebnis

1. Es gibt kein Werkzeug, das mehr Replays liefert. Die Grenze setzt der Client mit seinen Upload Bedingungen (nur Lobbyleiter, Log gefunden), nicht unser Zugriff. Bei den CDN Dateien liefert der Server nur, was er exportiert.
2. Ein einziger Fund zeigt Wege zu Daten, die wir nicht haben: das Repo `alexfrey317/optcg-data`. Es ist ein Dritter, der dieselben OPBounty Daten täglich sammelt und als statische Seite veröffentlicht. Sein Quellcode zeigt eine **Web API von OPBounty** (Host `stats.tcgmatchmaking.com`), die mehr liefert als unsere Bestenliste per OCR.
3. Diese Web API ist der einzige Weg, der sich lohnt zu prüfen. Alles andere ist nicht nötig oder passt nicht zu den Regeln.

## Was optcg-data hat und wir nicht

Alles hier ist aus dem Quellcode und der README von `optcg-data` gelesen, nicht selbst gegen die API geprüft.

| Daten | Wo bei ihm | Haben wir heute |
|---|---|---|
| Ladder mit 10.000 Spielern (Seiten zu 200), Modus `mode_0` Standard und `mode_1` Spoiler Queue | `GET /api/leaderboard/{mode}?page=&per_page=` | Nein. Wir lesen per OCR die oberen Plätze von Bildschirmfotos |
| Spieler eines bestimmten Leaders (Piloten je Leader) | `GET /api/leaderboard/mode_0?leader=CODE` | Nein. Das ist auch der Hebel für `specs/features/zuordnung-leaderzahl.md` |
| Decklisten je Leader und Set | `GET /api/decklists/{set}/{leader}` | Nein. Wir haben nur Decks aus Replays |
| Leader Statistik und Matchups je Set | `GET /api/leaders/{set}`, `/api/matchups/{set}`, `/api/stats/sets` | Teilweise. CDN Rohdateien liefern Matchups je Tag, Modus und Bountybereich |
| Leaderboard Meta | `GET /api/leaderboard/meta` | Nein |
| Bountyverlauf je Spieler | Eigene Tagesdateien im Repo `data/history/bounty/<id>.json` | Nein. Aus unseren Fotos gewinnen wir ihn nur für die obersten Plätze |
| Spielerprofile (Feldmaske `Western`, `Position`) | `PublicUsers/<id>` | Ja, wir lesen `PublicUsers` bereits |
| Partien ohne Log (Leader, Bounty, Sieger, Deckhash, Pfad zum Log) | Firestore `Replays` | Ja, wir haben sie in Firestore selbst |

Zugang laut seinem Code: `POST /auth/session` ohne Zugangsdaten liefert ein Token, das danach als Bearer Header auf die GET Aufrufe geht. Seine Aufrufe sind auf zwei Sekunden Abstand gezogen. Er nennt als Grenze rund 12 Anfragen je Burst und IP.

## Ist das Leaderboard besser als unsere OCR?

Voraussichtlich ja, aber nicht belegt.

* **Dafür:** exakte Zahlen statt Texterkennung, also kein Plausibilitätsschutz nötig. Tiefe bis Platz 10.000 statt der oberen Plätze. Filter nach Leader. Kein Bazzite, kein Mitschnitt, keine Update Notice. Es ist ein Webdienst und kein Eingriff in den Client oder dessen TLS Verbindung.
* **Dagegen und offen:**
  1. Es ist nicht bekannt, ob dieselbe Rangliste wie im Client gemeint ist. Wir führen die westliche Ladder (`Western`). Ob `mode_0` dort dieselbe Liste ergibt, muss ein Vergleich am selben Tag zeigen.
  2. Die Bedingungen des Dienstes sind nicht gelesen. Wir dürfen den Betreiber nicht fragen. Das Repo sagt nur, es werde "mit Erlaubnis" genutzt, und das gilt für ihn, nicht für uns.
  3. Das Rate Limit ist eng. Ein täglicher Lauf mit wenigen Dutzend Anfragen passt, etwas Größeres nicht.
  4. Die Schnittstelle ist undokumentiert und kann sich ohne Ankündigung ändern. Die OCR bleibt dafür als Rückfall sinnvoll.

Vorgeschlagener Prüfschritt, nur auf Freigabe des Nutzers: ein einzelner Probeaufruf von `/api/leaderboard/mode_0` und ein Vergleich der obersten 100 Plätze mit unserer OCR Liste desselben Tages. Weicht die Liste ab oder fehlt `Western`, ist das Thema erledigt.

## Was nicht zu den Regeln passt

* **Firestore mit der im Client eingebauten Anmeldung:** Laut Quellcode von `optcg-data` (`opbounty_matches.py`) nutzt er "a shared client sign-in that ships inside the app". Das heißt, eine im Client steckende Anmeldung wird herausgezogen und wiederverwendet. Das ist ein Eingriff in den Client und wird von uns nicht übernommen. Die `Replays` Abfrage selbst entspräche dem, was wir schon tun (nur `PublicUsers` und `Replays`).
* **Seine Matchdateien (`data/matches/public/YYYY-MM-DD.json.gz` ab 22.08.2026):** Zusammenfassungen derselben Replays, die wir schon haben. Sie bringen keine zusätzlichen Partien, und das Repo hat keine Lizenz. Nicht übernehmen.
* **Kaizoku:** Sein Code ruft dort ein Manifest, bis zu sechs Dateien und mehrere Spielerabfragen ab. Das geht über `card_data.json` hinaus und bleibt bei uns tabu.

## Weitere Funde, nicht nötig

| Fund | Warum nicht |
|---|---|
| Limitless TCG API (Turniere) | Turnierdaten, keine OPBounty Daten. Wäre eine neue Quelle, nicht mehr Daten aus der jetzigen. Bei Bedarf später prüfen |
| `op-leaderboard.com`, `optcg.one`, `onepiece.gg` | Turnier und Metaseiten ohne API. Kein Bezug zur Sim Ladder |
| `Coko7/vegapull`, `buhbbl/punk-records`, `apitcg`, `arjunkai/optcg-api`, `OnePieceTCGEngCardList` | Nur Kartendaten. Wir haben tcgcsv und Kaizoku |
| DuelVoyager, `BAA-Studios/MOOgiwara` | Eigene Simulatoren mit eigener Spielerschaft. Im Repo nur Doku beziehungsweise Stand Juni 2023 |
| `TheCardGoat/tcg-engines`, `oKarismatic/TCGAnalysisFramework`, `rosian22/TCGRankingTracker` | Regelengine, KI Gerüst, leeres Gerüst |
| OPTCGSim | Kein öffentliches Repo. Verteilung über Discord und Dropbox |

## Empfehlung

1. Die Web API von `stats.tcgmatchmaking.com` prüfen, zuerst mit einem einzelnen Probeaufruf (siehe oben). Hält der Vergleich, ersetzt sie die OCR der Bestenliste und liefert zusätzlich Piloten und Decklisten je Leader.
2. Die OCR als Rückfall behalten.
3. `optcg-data` selbst nicht einbinden und nichts davon übernehmen, vor allem nicht den Firestore Weg.
4. Für mehr Replays gibt es nichts. Es bleibt bei Firestore `Replays` mit rund 30 % Abdeckung.

## Grenzen dieser Recherche

* Von den 42 Repos zum GitHub Thema `one-piece-tcg` wurden nur die ersten 20 gelesen.
* Die Angaben zur Web API stammen aus dem Quellcode eines Dritten. Kein Aufruf, keine Bedingungen, keine `robots.txt` gelesen.
* Letzte Commit Daten stammen meist von den Themenseiten.
