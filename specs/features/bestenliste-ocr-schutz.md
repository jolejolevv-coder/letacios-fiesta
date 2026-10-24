# Bestenliste: kein Push bei verdeckten Namen

Entwurf vom 24.10.2026, Grenze 6 am 24.10.2026 freigegeben und gebaut.

## Goal

`werkzeuge/plausibel.py` lehnt eine Bestenliste ab, wenn auffällig viele gelesene Namen
nach Bildfehlern aussehen. So bleibt der letzte gute Stand online, statt dass verstümmelte
Namen mit falschen oder fehlenden Profilen erscheinen.

## Warum

Am 23.10.2026 kam OPBounty 2.7.3. Seitdem zeigte das Spiel bei jedem Start links oben eine
„UPDATE NOTICE“. Sie verdeckte auf allen fünf Seiten den Anfang der ersten acht Namen. Die
OCR las daraus etwa `| pstisx` statt AnestisX und `feoMorscio` statt MircoMorscio. Die
Prüfung vor dem Push sah nur auf Anzahl, Stand und Ränge und ließ das zwei Tage lang
durch. Dadurch fehlte 8 bis 9 der Top 10 die user_id und damit die Spielerseite mit den
Replays. Zwei Spieler bekamen über den Abgleich von Leader und Winrate ein falsches Profil.

Am 24.10.2026 ist die Notice behoben. Dafür steht in `uinf.tres` auf dem Bazzite jetzt
`seen_update_notice_v = "2.7.3"`. Beim nächsten Update kommt sie wahrscheinlich wieder.

## Messung

Ein Name gilt als **verdächtig**, wenn er ein Zeichen außerhalb von `A-Z a-z 0-9 _ . # -`
und Leerzeichen enthält oder kürzer als drei Zeichen ist. Gezählt wurde auf den
veröffentlichten Listen, also nach `namen_zuordnen`:

| Stand | verdächtig | ohne user_id | Top 10 ohne user_id |
|---|---|---|---|
| 20.10. | 2 | 26 | 1 |
| 21.10. | 2 | 34 | 1 |
| 22.10. | 4 | 35 | 2 |
| 23.10. (Notice) | 18 | 60 | 9 |
| 24.10. (Notice) | 19 | 64 | 8 |
| 24.10. Prüflauf ohne Notice | 2 | 40 | ‑ |

Verdächtig sind an sauberen Tagen etwa `KF`, `Maki!367` und `bunbun+6190`. Das sind echte
Namen oder kleine Lesefehler.

## Scope

- In scope: eine neue Regel in `pruefen()` in `werkzeuge/plausibel.py`, eine Konstante für
  die Grenze und Tests in `tests/test_plausibel.py`.
- Out of scope: die Notice automatisch wegklicken, die OCR verbessern, die Zuordnung über
  Leader und Winrate in `spieler_daten.py` verschärfen.

## Acceptance criteria

- [x] Mit mehr als `MAX_VERDAECHTIG` verdächtigen Namen gibt `pruefen()` einen Grund
      zurück. Der Grund nennt die Zahl und bis zu fünf Beispiele.
- [x] Mit genau `MAX_VERDAECHTIG` geht die Liste durch.
- [x] Echte Namen mit Leerzeichen, `#`, `-`, `_` und `.` gelten nicht als verdächtig
      (`UPS Employee`, `jiji#6654`, `-Pablo-`, `madoka_hk`).
- [x] Bestehende Tests bleiben grün. `python3 -m unittest discover -s tests` läuft durch.
- [x] Ein Abbruch in `mitschnitt_server.sh` meldet „nicht plausibel“, wie bisher.

## Implementation plan

Phase 1: Konstante, Hilfsfunktion `verdaechtig(name)` und Regel in `pruefen()`, mit Tests.
Phase 2: Lokal gegen die Listen vom 20. bis 24.10. prüfen. Die vom 23. und 24.10. fallen
durch, die anderen gehen durch.

## Open questions

- Keine. Die Grenze ist 6, freigegeben am 24.10.2026. Nachlauf: 20. bis 22.10. gehen durch, 23.10. (18) und 24.10. (19) fallen durch.
