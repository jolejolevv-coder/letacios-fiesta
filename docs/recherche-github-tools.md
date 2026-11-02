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

### Wie er die Aufrufe technisch macht

Aus `ingest/http.py`, `normalize.py` und `kaizoku_curves.py`:

* **Kennung:** `User-Agent: optcg-data ingest (+https://github.com/alexfrey317/optcg-data; daily snapshot)`, dazu `Accept: application/json` und `Accept-Encoding: gzip`. Er gibt sich also offen als Bot mit Link aus, keine Browser oder App Tarnung, keine Cookies.
* **Verhalten:** Timeout 120 Sekunden, bis zu 5 Wiederholungen bei 429, 500, 502, 503, 504 und bei Netzfehlern, Wartezeit ab 2 Sekunden verdoppelt bis 60, `Retry-After` wird beachtet. Gespeicherte Stände werden nur neu geholt, wenn sich das Datum im Manifest ändert.
* **Was er aus den Antworten behält:**
  * Tagesstatistik: je Leader Partien, Siege, Matchups mit Partien, Siegen, Erst und Zweitplatzierung.
  * Decklisten: die besten und meistgespielten Listen mit Partien, Siegen und Anzahl der Piloten.
  * Wochendaten: Kartenstatistik, gängige Starthand, Techkarten je Matchup.
  * Kurve: Zug für Zug je Leader, `curve_lw_<Datum>.json`, nur Modus 0, bis Zug 12.
  * Spielerzweig: Partien, Siege, Siegquote, Münzwurf, Decks und Matchups je Spieler.
* **Gewichtung:** Er rechnet die gewichtete Siegquote von Kaizoku mit einem Anteil von 0,35 nach.
* **Wichtig für uns:** Alles davon außer `card_data.json` ist durch unsere Regel gesperrt. Sie lässt sich nur durch den Nutzer lockern, und dann am besten gestuft: erst die statischen Dateien des CDN (kein Konto, kein Spielerbezug), den Spielerzweig `search` und `player-stats` nicht, weil er einzelne Personen abfragt und beim Vorbild "mit Erlaubnis" steht, die wir nicht haben.

## Replay Viewer: seiner gegen unseren

Quelle für seinen: `g.astro` und `ReplayPicker.astro` im Repo. Sein Stylesheet (Farben, Schrift, Rastermaße, Handylayout) steht in keiner dieser Dateien und wurde nicht gelesen. Zum Aussehen kann ich deshalb nichts Belegtes sagen, nur zur Funktion.

| Punkt | Seiner | Unserer (`src/replay.js`, `Replay` in `src/App.jsx`) |
|---|---|---|
| Einstieg | Zwei Leader wählen, Tausch Knopf, vier Gruppen nach Sieger und Zugreihenfolge, fünf Beispielpartien je Gruppe | Über die Spielerseite: Partie antippen, "Watch replay". Dazu der Reiter "Analyze my replay" für eigene Logs |
| Datenbasis | Bündel je Leaderpaar mit vorgerechneten Zügen, 9.013 Partien im Oktober, nur hohe Bounty | Replays aus Firestore mit Log aus dem Storage, im Browser gelesen |
| Brett | Feste Maße (Matte 710 × 500, Karte 100 × 138), Karten absolut gesetzt: Charakter, Leader, Stage, Deck, Trash, Leben, DON!! Deck und Kostenbereich, gedrehte Karten | Brett mit Zonen, Hand, Board, Trash, Leben, Stand je Zugende |
| Karteninfo | Anzeigen für DON!! Anzahl, Powerwechsel mit Vorzeichen, Gegenwehr (Counter) als "+N", Kampfpower, Statusmarken | Angriffspfeile (`replay-angriffspfeile.md`), Power im Kampf |
| Ereignisprotokoll | Zehn Ereignisse bis zum aktuellen, Arten farblich getrennt, Sitzabzeichen P1 und P2, Kartenvorschaubilder im Text | Ereignisliste ("Events") auf und zuklappbar |
| Bedienung | Schieberegler, Pfeiltasten, Leertaste, j und k, Umschalt für ganze Züge, Pos1 und Ende, Wischen auf dem Handy | Knöpfe für Anfang, zurück, Abspielen, vor, Ende, Tempo ½ bis mehr, Zoomstufen, auf dem Handy je ein Umschalter, 44 Pixel große Knöpfe |
| Handkarten | Umschalter "Hands" mit Merkung im Browser, Flip der Seiten, Vorschau (Peek) | Eigene Seite unten, Hand sichtbar |
| Auswertung | Keine | Genauigkeit, Zug für Zug Rat, nächstbeste Karte (`ReplayAnalyse`, `zuglager.js`) |
| Extras | "Copy for sim" für die Deckliste | Link auf das Rohlog |
| Namen | Spielernamen werden nicht gezeigt | Spielernamen sichtbar |

Was sich übernehmen ließe, ohne seinen Code: die Auswahl nach Leaderpaar mit vier Gruppen und die Umschalter für Hände und Seitentausch, die Tastaturbedienung, "Copy for sim". Was er nicht hat und wir haben: die Auswertung und die Verbindung zur Spielerseite. Zum Aussehen müsste man sein Stylesheet lesen, die Adresse dazu fehlt mir (wahrscheinlich ein globales CSS im `site/` Ordner).

## Woher er das Format hat

Aus `run.py`, `kaizoku.py`, `opbounty.py`, `normalize.py` und `meta.json` gelesen. Nicht gelesen: `carry.py`, `opbounty_stats.py`, `cards.json`.

* **Kein Formatwissen, nur Vorgaben von außen.** Es gibt keine Liste erlaubter Sets und keine Prüfung der Legalität. EB05 kommt in keiner gelesenen Datei vor, OP17 nur als Anfang des Kaizoku Datensatznamens.
* **Kaizoku:** Der Datensatz steht fest im Code: `DATASET = "op17_lw_p"` (Umgebungsvariable `KAIZOKU_DATASET` überschreibt), daraus `SET = "op17"` und die Tagesdateien `op17_y_p`. Ein neues Set heißt: den Wert von Hand ändern. Fehlt der Schlüssel im Manifest, überspringt er still.
* **OPBounty:** Er fragt `GET /api/stats/sets` und nimmt den Satz mit Namen `lw`, sonst den ersten. `lw` heißt im Manifest `Stats_lw.json` (Quelle `s3`). Die Bedeutung ist nicht belegt (bei Kaizoku im Kommentar "last week, private lobbies").
* **Modi:** `mode_0` ist Standard, `mode_1` die Vorabqueue ("Special" bei OPBounty). Die Vorabqueue baut er nur aus OPBounty Zahlen, 14 Tage, Top 2.000.
* **Formatwechsel:** Es gibt keine Erkennung. Eine Ladder Rücksetzung steht in `meta.json` als `ladderResets: ["2026-10-26"]`, abgeleitet in `carry.py` (nicht gelesen). Ein Wechseldatum speichert er nicht.
* **Leader:** Gefiltert wird nur nach der Form der Kartennummer, nicht nach Set.

Folge für uns: Unsere Formaterkennung aus CDN `mode_0` (`format-aus-cdn.md`, Satz "OP17 + EB05 Standard" ab 29.10., neue Sets ab 5 % am Starttag) ist weiter als seine. Von ihm lässt sich dafür nichts übernehmen. Lehrreich ist nur, dass beide Quellen, Kaizoku und OPBounty, ihren Datensatz selbst benennen (`op17_lw_p`, `lw`). Ein Abgleich mit unserem Formatsatz wäre eine Wache: ändert sich der Name, ist ein neues Format wahrscheinlich.

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
