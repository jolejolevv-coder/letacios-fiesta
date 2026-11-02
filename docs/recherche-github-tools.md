# Recherche: Werkzeuge und Datenquellen für mehr OPBounty Daten

Stand 02.11.2026. Gelesen wurde nur auf GitHub und im Web. Nichts heruntergeladen, nichts ausgeführt, niemand kontaktiert. Gesucht wurde nach OPBounty, OPTCGSim, One Piece TCG replay, optcg stats, scraper, apibounty, firebase, firestore und nach öffentlichen Web und API Quellen allgemein.

## Ergebnis in drei Sätzen

Es gibt kein Werkzeug, das uns mehr Replays liefert, als wir ohnehin lesen. Genau ein Fund ist inhaltlich stark, nämlich `alexfrey317/optcg-data`, aber er arbeitet zum Teil mit Methoden, die gegen unsere Regeln laufen, und hat keine Lizenz. Brauchbar und regelkonform ist vor allem die Limitless API für Turnierdecklisten.

## Tabelle der Funde

| Fund | Liefert | Aktualität und Pflege | Zugang | Vereinbar mit unseren Regeln? | Urteil |
|---|---|---|---|---|---|
| `alexfrey317/optcg-data` (Site optcg-data.pages.dev) | Ladder mit 10.000 Spielern, Bounty, Leader, Decklisten je Leader, Matchups, Spielerprofile, Archiv von Partien ohne Log (Leader, Bounty, Sieger, Deckhash, Pfad zum Log). Täglich als Dateien im Repo, Partien ab 22.08.2026 | Sehr aktiv, Bot Commit vom 01.11.2026, 133 Commits, täglicher Lauf 09:00 UTC. Keine Lizenz | Siehe Abschnitt unten. Drei Wege: anonyme Web API von stats.tcgmatchmaking.com, Firestore `Replays` und `PublicUsers` mit einem Konto, CloudFront Aggregate | Gemischt. Der Firestore Weg nutzt laut Quellcode eine im Client eingebaute gemeinsame Anmeldung, das ist ein Eingriff in den Client und fällt bei uns aus. Die anonyme Web API verletzt keine unserer Regeln, ist aber unsicher (siehe unten). Das Repo behauptet "used with permission", das gilt für sie, nicht für uns, und wir dürfen nicht nachfragen | Nur als Vergleich und Ideengeber lesen. Nicht kopieren, nicht einbinden |
| Limitless TCG API (`play.limitlesstcg.com/api`) | Turniere (`/tournaments?game=OP`), Details, Standings mit Decklisten, Pairings mit Sieger. Game Id `OP`, Plattformen `SIM` und `CAM`, Formate `STANDARD` und `EXTRA`. Rund 60 Turniere von 05.10. bis 01.11.2026 | Lebendig, Daten von dieser Woche | REST, JSON, laut Doku für Turnierdaten kein API Schlüssel nötig, Rate Limit gilt | Ja. Öffentliche Schnittstelle, keine Zugangsdaten, kein Client, kein Kontakt | Nutzen. Siehe Empfehlung |
| `stats.tcgmatchmaking.com` | Zeigt im Titel "OPBounty, Tournaments and More". Leaderboard mit rund 31.000 Spielern. Die Seite ist per JavaScript gerendert, das Gelesene zeigt keine Daten. Dahinter steckt die Web API, die optcg-data nutzt | Läuft | Anonyme Sitzung per `POST /auth/session`, danach Bearer Token auf `GET /api/leaderboard/mode_0`, `/api/decklists/...`, `/api/matchups/...`. Laut Quellcode von optcg-data rund 12 Anfragen je Burst und IP | Unklar. Nicht verboten, aber es ist der Webauftritt von OPBounty, und die Betreiber geben Rate Limits vor. Wir dürfen nicht nachfragen | Nur auf Entscheidung des Nutzers prüfen, siehe Abschnitt Entscheidung |
| `op-leaderboard.com` | Leader Rangliste, Meta, Matchups, Decklisten aus Turnieren | Aktiv | Nur HTML, clientseitig gerendert, keine API sichtbar. Quelle laut About: Limitless API | Daten aus Turnieren, nicht aus der Sim Ladder. Scraping ohne Nutzen, die Quelle selbst ist offen | Nicht nötig, direkt Limitless nehmen |
| `optcg.one` | 3.142 Karten, 4.866 Turnierdecklisten, Meta Tierliste, "Daily sync" | Aktiv, jüngster Meta Artikel 04.06.2026 | Nur HTML, keine API oder Doku gesehen | Keine Nutzungsbedingungen gesehen. Wäre Scraping einer fremden Seite | Nicht scrapen. Nur im Auge behalten |
| `onepiece.gg` (DotGG) | News, Karten, Decks, Turnier Meta | Aktiv | Nur HTML, Daten werden nachgeladen. Bedingungen vom 23.08.2026 schließen Wiederverwendung nicht ausdrücklich aus, beanspruchen aber alle Rechte | Scraping nicht sinnvoll | Nein |
| `apitcg.com` und `apitcg/one-piece-tcg-data` | Kartendaten, Preise, Bilder. Kein Spiel, keine Decklisten | Repo zuletzt 01.09.2025, API monatlich 1.000 Anfragen kostenlos | REST mit Schlüssel, Repo offen ohne Lizenz | Kartendaten haben wir aus tcgcsv und Kaizoku | Nein |
| `Coko7/vegapull`, `buhbbl/punk-records`, `coko7/vegapull-records` | Kartendaten und Packs, scrapt onepiece-cardgame.com | Aktiv, Oktober 2026 | Rust CLI, GPL 3.0, Datensatz AGPL 3.0, Inhalte © Bandai | Regelkonform, bringt aber keine Spieldaten | Nein, wir haben tcgcsv. Höchstens später als Notfallquelle für Kartendaten |
| `nemesis312/OnePieceTCGEngCardList`, `arjunkai/optcg-api`, `sstockdev/optcgdb` | Kartenlisten, Preise | Stand 2024 bis 2026, `optcgdb` archiviert | Statische JSON, Cloudflare API, TCGplayer | Regelkonform | Nein |
| `DuelVoyager` (`NoahSullivan25/duelvoyager-one-piece-tcg-simulator`) und `BAA-Studios/MOOgiwara` | Eigene Simulatoren mit Ranglisten, Statistik, Replays. Im Repo nur Doku, kein Code. MOOgiwara zuletzt Juni 2023 | DuelVoyager aktiv | Eigene Spielerschaft, keine öffentliche Datenschnittstelle | Andere Spielerschaft als OPBounty | Nein, kein Bezug zu OPBounty Daten |
| `TheCardGoat/tcg-engines`, `oKarismatic/TCGAnalysisFramework`, `rosian22/TCGRankingTracker` | Regelengine, KI Coaching Gerüst, leeres Next.js Gerüst | Teils aktiv | Code | Nicht relevant | Nein |

Zu OPTCGSim selbst: Es gibt kein öffentliches GitHub Repository. Verteilung läuft über Discord und Dropbox. Es gibt dazu also nichts zu lesen oder zu nutzen.

## Genauer zu optcg-data

Das Repo gehört einem Dritten, der dieselbe Aufgabe wie wir löst, und liefert damit die beste Vergleichsfläche.

* **Inhalt:** `data/latest/` (Spieler, Leader, Karten, Decklisten je Leader, `meta.json`), `data/history/bounty/<id>.json`, `data/matches/public/YYYY-MM-DD.json.gz` ab 22.08.2026, `data/stats/` (im Listing bis 30.09.).
* **Matchsatz:** `idx, ts, dur, mode, p1 und p2 {id, nick, b, delta, status, leader, deck}, winner`. Es sind Zusammenfassungen. Vollständige Replays oder Logs liegen nicht im Repo. Die Zugspalte `handles/` (Zugreihenfolge) fehlt öffentlich.
* **Wie die Daten entstehen (laut README und Quellcode, nicht geprüft):**
  1. Web API von `stats.tcgmatchmaking.com` mit anonymer Sitzung (Ladder, Decklisten, Matchups, Spieler je Leader).
  2. Firestore `Replays` und `PublicUsers` im Projekt von OPBounty, mit einem Konto. Der Quellcode sagt, die App liefere eine gemeinsame Client Anmeldung mit, und man nutze dieselbe. Das ist genau die Art, die wir ausschließen: eine im Client steckende Anmeldung herausziehen und wiederverwenden.
  3. Die öffentlichen CloudFront Aggregate, die wir schon lesen.
* **Lizenz:** keine. Die Daten sind Ableitungen von OPBounty Daten. Eine Weiterverwendung der Dateien ohne Lizenz ist rechtlich offen.
* **Widerspruch im Repo:** Schwelle für Spielernamen 1.000 laut Code, 1.900 laut README. Die Sorgfalt beim Datenschutz ist unklar.
* **Nutzen für uns:** Die Matchdateien wären eine zweite, unabhängige Stichprobe. Doch sie enthalten nur Replays, die ohnehin in Firestore liegen, also im selben Rahmen wie unsere Abdeckung von rund 30 %. Mehr Partien bringt das nicht.

## Entscheidung für den Nutzer

Eine Frage bleibt offen, und ich habe sie nicht selbst entschieden: Ob wir die anonyme Web API von `stats.tcgmatchmaking.com` für die Bestenliste und Decklisten nutzen. Dafür spricht, dass sie ohne Zugangsdaten läuft, keine Client Funktion berührt und uns OCR und den Bazzite für die Bestenliste ersparen könnte. Dagegen spricht, dass wir den Betreiber nicht fragen dürfen, dass es ein Webdienst ist, dessen Bedingungen wir nicht gelesen haben, und dass das Rate Limit eng ist (rund 12 Anfragen je Burst). Zusätzlich ist offen, ob die Rangliste dort dieselbe wie im Client ist. Ich habe die API nicht aufgerufen, weil das Ausführen nicht erlaubt war. Wenn du sie freigibst, wäre der nächste Schritt ein einzelner Probeaufruf von dir oder mit deinem Ok, gegen unsere OCR Liste vom selben Tag gehalten.

## Empfehlung

1. **Limitless API nutzen**, für Turnierdecklisten und Pairings im Format `OP`, Plattform `SIM`. Das ist die einzige regelkonforme, dokumentierte Quelle mit Spielerdecklisten und Matchdaten. Klein anfangen: `/tournaments?game=OP`, dann nur Turniere mit `SIM`. Zu prüfen sind vorher Nutzungsbedingungen und Rate Limit auf der Seite. Der Nutzen ist begrenzt: Es sind Turniere, keine Ladder.
2. **`optcg-data` nicht einbinden und nichts davon übernehmen.** Es bringt keine zusätzlichen Replays, der Firestore Weg verletzt unsere Regel gegen Eingriffe in den Client, und eine Lizenz fehlt. Als Vergleich der eigenen Zahlen ist es nützlich (Ladder, Leader Winrates, Decklisten je Leader), mit Blick auf Abweichungen.
3. **Für mehr Replays bleibt es bei dem, was wir haben:** `Replays` in Firestore mit rund 30 % Abdeckung. Nichts im Netz ersetzt das. Die Grenze setzt der Client mit seinen Upload Bedingungen (nur Lobbyleiter, Log gefunden), und die ist von außen nicht zu ändern.
4. **Kartendaten:** keine Änderung. tcgcsv und `card_data.json` von Kaizoku genügen. Kaizoku nicht weiter scrapen, auch wenn `optcg-data` zusätzliche Dateien dort abruft.
5. **Alles andere in der Tabelle:** nicht nutzen.

## Grenzen dieser Recherche

* GitHub Themenseiten zeigten nur 20 von 42 Repos zu `one-piece-tcg`. Die übrigen 22 wurden nicht gelesen.
* Letzte Commit Daten stammen meist von den Themenseiten, nicht aus den Commit Listen.
* Die API von Limitless wurde nur auf Struktur gelesen. Nutzungsbedingungen, Rate Limit Zahlen und Inhalt der Standings für `SIM` sind nicht geprüft.
* `stats.tcgmatchmaking.com` wurde nicht selbst aufgerufen. Alles dazu stammt aus dem Quellcode von `optcg-data` und ist unverifiziert.
* Keine `robots.txt` und keine Bedingungen von Webseiten außer `onepiece.gg` gelesen.
* `optcgapi.com/about` lieferte 404, die Seite ist ohne Auskunft geblieben.
