# Archiv der Übergabe, 28.10.2026

## EB05 Queue, abgeschlossen 24.10.2026

Branch `claude/eb05-queue`: Sätze „EB05 Queue“ (alle Partien von `mode_1` seit 10.10.) und
„EB05 Heroines Event“ (nur die 25 Leader aus `eb05_leader.json`), dazu 55 Kartenbilder aus
dem Sim in `bilder_nachtrag/` (Werkzeug `werkzeuge/bilder_nachtragen.py`). EB05-026 und
OP18-091 fehlen auch im Sim. Rangliste und Replays für EB05 hat der Nutzer gestrichen, die
Bounty im Replay ist ohnehin nicht die Queue Bounty.

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



## Aus der Übergabe verschoben am 02.11.2026

### Stand 28.10.2026

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

