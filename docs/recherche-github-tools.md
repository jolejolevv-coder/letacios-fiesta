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

## Vergleich der Ranglisten, 02.11.2026

Seine Seite (Stand 01.11., "Last updated 2026-11-01") gegen unsere entschlüsselte Bestenliste (Stand 02.11., 100 Spieler), jeweils die ersten 40 Plätze. Gelesen wurde seine Seite im Web, seine API nicht aufgerufen.

* **Es ist dieselbe Ladder.** Gleiche Namen, gleiche Bountywerte auf die Zahl genau, zum Beispiel BRefe 3.444,5 gegen 3.445, Paul Hartale 3.240,5 gegen 3.240, Ponina 3.104,8 gegen 3.105, MircoMorscio 3.080,7 gegen 3.081, elmatador 3.007,4 gegen 3.007, cal206 2.982,4 gegen 2.982. Die Reihenfolge weicht ab, weil ein Tag dazwischen liegt.
* **Unsere OCR macht Namensfehler.** Bei seinen Namen steht, was OPBounty führt, bei uns, was die Texterkennung liest:

| Seine Seite | Unsere Liste |
|---|---|
| a1A1 | alAl |
| Salva1 | Salval |
| Jioh | vioh |
| currygravy2 | currygravy |
| HyperK | Hyperk |
| Typo Vampire | TypoVampire |
| Kakashiha | kakashiha |

  Die Verwechslungen sind 1/l/I, J/v, fehlende Ziffern am Ende, Leerzeichen und Groß und Kleinschreibung. Für eine Zuordnung über `user_id` oder Namen ist das ein Problem, die Zahlen selbst stimmen.
* **Tiefe:** Wir haben 100 Spieler, er 10.000 (Standard). Dazu je Spieler Partien, Siegquote und die häufigsten Leader mit Quote und Partienzahl. Unsere Liste zeigt je Spieler zwar Leader, aber die Partienzahl je Leader steht dort nicht in den obersten Feldern, die ich geprüft habe.
* **Herkunft:** Er zeigt Länder, "All countries". Unsere Liste führt die westliche Ladder, die Namen stimmen trotzdem überein. Die Abgrenzung "westlich" macht bei uns also vermutlich eine Auswahl der Region, und seine API liefert alles.
* **Grenze des Vergleichs:** Ein Stichtag Abstand, nur 40 Plätze, und seine Daten sind nicht gegen die API selbst geprüft. Gegen die API muss der Vergleich noch laufen, bevor man die OCR ersetzt.

Fazit: Die Web API ist genauer (keine Namensfehler) und tiefer (10.000 statt 100). Das Ergebnis des Vergleichs spricht für sie.

## Was er von Card Kaizoku abruft

Alles aus dem Quellcode (`ingest/sources/kaizoku.py`, `kaizoku_players.py`, `run.py`, Workflow `daily.yml`). Nicht gelesen: `ingest/http.py` (Header), `normalize.py`.

| Was | Adresse | Wie oft |
|---|---|---|
| `card_data.json` | `GET https://cdn.cardkaizoku.com/card_data.json` | 1 je Lauf |
| Manifest | `GET https://cdn.cardkaizoku.com/manifest.json?t=0` | 1 je Lauf |
| Wochenstände aus dem Manifest: `stats`, `decklist`, `cardstats`, `leaderboard`, `matchuptech`, `hands` für den Datensatz `op17_lw_p` | `GET https://cdn.cardkaizoku.com/<Pfad aus manifest.simStats.files>?v=<Datum>` | wöchentlich, bei Datumswechsel |
| Tagesdateien Statistik und Decklisten je Set | `GET https://cdn.cardkaizoku.com/stats/stats_<SET>_y_p_<YYYYMMDD>.json` und `.../stats/decklist_<SET>_y_p_<YYYYMMDD>.json` | täglich, Rückblick 12 Tage, 2 Anfragen je fehlendem Tag |
| Spielersuche | `POST https://api.cardkaizoku.com/search` mit `{"searchTerm": Name, "playerId": Name}` | nur für neue oder geänderte Namen, 7 Tage Pause bei Fehlschlag |
| Spielerstatistik | `GET https://api.cardkaizoku.com/player-stats?playerId=<id>&startDate=<>&endDate=<>` (28 Tage) | 1 je gefundenem Spieler, bis zu 1.000 Spieler aus der Ladder |

* **Zugang:** im Code kein Schlüssel und keine Anmeldung. Abstand zwischen Aufrufen 0,4 Sekunden, 4 Arbeiter. Der Workflow läuft täglich 08:00 UTC, ein Kommentar sagt, die Spielerabrufe seien "rate limited and can take an hour".
* **Was daraus entsteht:** Winrates und Decklisten je Leader, Kartenstatistik, Matchupdaten, je Spieler die genauen Decks, Münzwurf, Matchups und Leader. Beim Spielerzweig steht im Code "used with permission".
* **Bewertung nach unseren Regeln:** Erlaubt ist bei uns nur `card_data.json`. Alles andere in der Tabelle geht darüber hinaus und bleibt für uns tabu: Manifest, Wochenstände, Tagesdateien und beide Spielerabrufe. Der Spielerzweig ist zudem eine Abfrage von Daten einzelner Spieler. Nichts davon übernehmen.

## Sein Replay Player (Study Games)

Beschrieben nach der Seite und dem Quellcode auf GitHub, nichts ausgeführt.

* **Bedienung:** Seite `/replays/` fragt zwei Leader ab (die 32 meistgespielten, mit Tausch Knopf). Für das Paar zeigt sie vier Gruppen: jeweils Leader A oder B gewinnt als Erster oder Zweiter. In jeder Gruppe stehen fünf abgeschlossene Partien mit hohem Bounty, mit Datum, Bounty beider Seiten und "N turns · lethal / conceded / ended at N life". Stand: 9.013 Partien vom 02.10. bis 31.10. Spielernamen werden nicht gezeigt.
* **Einzelpartie `/replays/g/`:** Spielfeld beider Seiten (Charakter, Leader, Stage, Deck, Trash, Leben, DON!! Deck und Kostenbereich, gedrehte Karten, Powerwerte, Angriff und Ziel hervorgehoben, Handansicht), dazu ein Ereignisprotokoll (Draw, DON, Play, Attack, Battle, Damage, Blocked, Counter, Trash, Mulligan, Effect, End turn, Concede) mit Schieberegler und Tastatur oder Wischbedienung, und "Copy for sim" für die Deckliste.
* **Technik:** Astro, statische Seite auf Cloudflare Pages, Viewer in reinem TypeScript (`g.astro` 445 Zeilen, 46 KB), Datenbündel je Leaderpaar `/replays/data/<A>__<B>.json` mit bereits gelesenen Zügen. Das Combat Log wird in `src/lib/replayParse.ts` im Browser gelesen. Kartenbilder von OnePiece.gg.
* **Lizenz:** keine. Rechtlich heißt das: alle Rechte vorbehalten. Wir übernehmen daraus keinen Code.
* **Für uns:** Wir haben bereits ein Replay Gerüst (`src/replay.js`, Reiter Replays, "Analyze my replay" mit `src/zuglager.js`). Was ihm voraus ist, ist die Auswahl: Leaderpaar mit Tausch Knopf, vier Gruppen nach Sieger und Zugreihenfolge, fünf Beispielpartien je Gruppe, und die Spielfeldansicht mit Ereignisprotokoll. Das lässt sich als Idee nachbauen, ohne seinen Code zu kopieren. Ein Spec dazu liegt noch nicht vor (`specs/features/` wäre der Ort).

## Was nicht zu den Regeln passt

* **Firestore mit der im Client eingebauten Anmeldung:** Laut Quellcode von `optcg-data` (`opbounty_matches.py`) nutzt er "a shared client sign-in that ships inside the app". Das heißt, eine im Client steckende Anmeldung wird herausgezogen und wiederverwendet. Das ist ein Eingriff in den Client und wird von uns nicht übernommen. Die `Replays` Abfrage selbst entspräche dem, was wir schon tun (nur `PublicUsers` und `Replays`).
* **Seine Matchdateien (`data/matches/public/YYYY-MM-DD.json.gz` ab 22.08.2026):** Zusammenfassungen derselben Replays, die wir schon haben. Sie bringen keine zusätzlichen Partien, und das Repo hat keine Lizenz. Nicht übernehmen.
* **Kaizoku:** Siehe Abschnitt oben. Alles außer `card_data.json` geht darüber hinaus und bleibt bei uns tabu.

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
2a. Den Replay Player nach seinem Vorbild selbst bauen (Auswahl nach Leaderpaar, vier Gruppen, Spielfeld mit Protokoll), ohne seinen Code zu übernehmen. Zuerst ein Spec in `specs/features/`.
3. `optcg-data` selbst nicht einbinden und nichts davon übernehmen, vor allem nicht den Firestore Weg.
4. Für mehr Replays gibt es nichts. Es bleibt bei Firestore `Replays` mit rund 30 % Abdeckung.

## Grenzen dieser Recherche

* Von den 42 Repos zum GitHub Thema `one-piece-tcg` wurden nur die ersten 20 gelesen.
* Die Angaben zur Web API stammen aus dem Quellcode eines Dritten. Kein Aufruf, keine Bedingungen, keine `robots.txt` gelesen.
* Letzte Commit Daten stammen meist von den Themenseiten.
