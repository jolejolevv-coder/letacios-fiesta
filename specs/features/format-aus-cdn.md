# Formatsatz nur aus dem CDN

Entwurf vom 02.11.2026. Erst als Mischung aus CDN und Replays freigegeben, am selben Tag vom
Nutzer auf reines CDN geändert („lass all die Replay Data weg … mach nur das neue CDN Data“).
Ersetzt `format-aus-replays.md` für Formatsatz und Formaterkennung.

## Goal

Der Satz des aktuellen Formats und die Formaterkennung lesen nur noch CDN `mode_0`, ab dem
29.10.2026; der Code dafür aus den Replays entfällt.

## Was gemessen ist (02.11.2026)

| Tag | CDN mode_0 | EB05 CDN | Replays | EB05 Replays |
|---|---|---|---|---|
| 27.10. | 16.088 | 31 % | 7.313 | 56 % |
| 28.10. | 14.426 | 33 % | 6.493 | 58 % |
| 29.10. | 3.076 | 60 % | 953 | 51 % |
| 30.10. | 2.732 | 63 % | 766 | 58 % |
| 31.10. | 2.357 | 67 % | 750 | 70 % |
| 01.11. | 1.130 | 70 % | 895 | 66 % |

Am 27. und 28.10. mischte `mode_0` beide Kartenpools. Seit v2.7.8 (29.10.) spielen Spieler
mit eingebetteter Sim in `mode_1`, `mode_0` ist sauber und hat etwa dreimal so viele Partien
wie die Replays.

## Entscheidungen des Nutzers (02.11.2026)

- Umfang: nur Formatsatz und Formaterkennung. Spielerseiten (`frische_partien.py`), der
  Reiter Replays und Metacoach bleiben bei den Replays.
- Start 29.10.2026. Die Mischtage 27. und 28.10. fallen weg.
- Steht das CDN still, bleibt der Satz auf dem letzten Stand und die Action meldet
  `::warning::`, sobald der jüngste Tag in `mode_0` mehr als zwei Tage alt ist.

## Scope

In scope:
- `format_satz`: alle CDN Tage in `mode_0` ab dem Formatstart, auch der jüngste
  (unvollständige) Tag, über alle Bountybereiche addiert. Hand, Kopien und Dauer sind dabei.
- Formaterkennung über die Decklisten des CDN je Tag, Schwellen wie bisher (5 % Umstellungstag,
  30 % Folgetag). Der alte Satz entsteht ebenso aus den CDN Tagen.
- Zustand: ein gespeicherter Start vor dem 29.10. für das laufende Format wird auf den
  29.10. gezogen; das Feld `cdn_ab` fällt weg.
- Name ohne „(from replays)“, auch beim Heroines Event.
- Gelöscht: Replay Funktionen und Konstanten in `aktualisieren.py`, die Firestore Importe,
  die Zugangsdaten im Schritt „Daten und Bilder holen“ und der Zwischenspeicher
  `tage/replay_start.zwischen.gz` (räumt der Lauf weg).
- Tests ohne Netz.

Out of scope: Spielerseiten, Replays, Metacoach, die übrigen Sätze.

## Acceptance criteria

- [x] Probelauf gegen das echte CDN: Tage 29.10. bis 01.11., 9.295 Partien (gleich der Summe
      der Tabelle), EB05 64 %, 90 Leader.
- [x] Tage vor dem Start zählen weder im Satz noch in der Erkennung (Test).
- [x] Ein simulierter Wechsel auf OP18 legt den alten Satz aus CDN Tagen ab (Test).
- [x] Warnung ab drei Tagen Stillstand, keine bis zwei (Test).
- [x] Fällt das CDN aus, entfällt der Satz mit `::warning::`, der Lauf geht weiter.
- [x] Python Tests, `npm test` und `npx vite build` laufen durch.
- [ ] Nach dem nächsten Lauf der Action zeigt die Seite den Satz ab 29.10. ohne Zusatz.

## Implementation plan

Phase 1 (gebaut): Umbau, Tests, Probelauf.
Phase 2: Lauf der Action nach dem Merge prüfen.

## Tradeoffs

Eine Quelle statt zwei: weniger Code, Hand und Kopien für alle Tage, etwa dreimal so viele
Partien. Dafür hängt der Satz ganz am Export von OPBounty; steht er still, altert der Satz und
nur die Warnung meldet es. Der jüngste Tag ist beim Export unvollständig und wächst am
nächsten Tag nach.

## Open questions

- Keine.
