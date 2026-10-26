# Format OP17 plus EB05 in der normalen Queue

Entwurf vom 26.10.2026, am selben Tag freigegeben mit Änderungen des Nutzers (siehe
Entschieden). Gebaut am 26.10.2026.

## Goal

Fiesta zeigt das neue Standardformat (OP17 plus EB05) als eigenen, sauberen Satz ab dem Tag
der Umstellung, damit die Statistik nicht mit dem alten Format vermischt wird.

## Was gemessen ist (26.10.2026)

Laut Nutzer hat OPBounty ein Metaupdate bekommen: Die normale Queue (`mode_0`, Western) ist
jetzt OP17 plus EB05. In den Rohdaten steht davon noch nichts. Der Index reicht bis zum
25.10., und bis dahin hatte `mode_0` jeden Tag 0 % Partien mit EB05 Karten (11.000 bis 18.700
Partien am Tag). Die Umstellung liegt also am 26.10. oder später, die ersten Rohdaten kommen
frühestens am 27.10. Die fertigen Sätze des Spiels heißen unverändert (`Stats_lw`,
`Stats_OP17`, …). Die Bestenliste lief am 26.10. normal, die Update Notice blockt nicht
(`seen_update_notice_v` 2.7.4).

Die EB05 Queue (`mode_1`) hatte bis zum 25.10. 59 bis 74 % EB05.

## Scope

In scope:
- Ein neuer Satz „OP17 + EB05 Standard“ aus den Rohdaten von `mode_0`, alle Bountybereiche,
  ab dem Tag der Umstellung, täglich neu, ganz oben in der Auswahl. Gebaut wie der EB05
  Satz (`roh_satz`), mit eigener Konstante für das Startdatum.
- Das Startdatum wird nicht geraten: der erste Tag in `mode_0`, an dem der EB05 Anteil über
  der Grenze `EB05_MIN_ANTEIL` (30 %) liegt. Bis es diesen Tag gibt, entfällt der Satz still.
- Die fertigen Wochensätze bekommen bis eine Woche nach der Umstellung den Zusatz „mixed
  formats“ im Namen, danach wieder den alten Namen.
- Der Satz „OP17 overall“ heißt „OP17 format (old)“, weil er nur das alte Format zeigt.
- Changelog Eintrag, Tests für die Erkennung des Starttags und die Namen.

Out of scope:
- Änderungen an der EB05 Queue und am Satz „EB05 Heroines Event“. Siehe offene Fragen.
- Bestenliste und OCR auf dem Bazzite.
- Guide, Mulligan und Analysen von Metacoach.

## Acceptance criteria

- [ ] Sobald `mode_0` einen Tag mit EB05 Anteil über 30 % hat, steht „OP17 + EB05 Standard“
      mit Partienzahl ganz oben in der Auswahl, ab genau diesem Tag.
- [ ] Vorher fehlt der Satz, und der Lauf bricht nicht ab.
- [ ] Die Wochensätze tragen bis sieben Tage nach dem Starttag „mixed formats“.
- [ ] Die Sätze von `mode_1` sind unverändert.
- [ ] Python Tests, `npm test` und `npx vite build` laufen durch.

## Implementation plan

Phase 1: `format_start(index)` sucht den Starttag (pro Tag ein Abruf aller Bereiche von
`mode_0`, nur Tage ab dem 26.10., Ergebnis gemerkt in `public/tage/format_start.txt`, damit
nicht jeder Lauf neu sucht). `format_satz` baut den Satz, `satz_reihenfolge` stellt ihn
nach vorn, `ANZEIGE` und eine Namensregel für die Mischwoche. Tests ohne Netz.

Phase 2: Nach dem ersten Lauf mit Daten der Umstellung prüfen, live und in der Vorschau.

## Entschieden (Nutzer, 26.10.2026)

- Die Umstellung kam am 26.10.2026 mittags. Statt der automatischen Erkennung gilt ein
  festes Startdatum, `FORMAT_START = 2026-10-27`, der erste volle Tag. Der Umstellungstag
  selbst mischt beide Formate und bleibt draußen; das kostet einen halben Tag Daten.
- Das Format OP17 gilt als abgeschlossen: „OP17 format (old)“ und
  „OP17 format (old), 1B Bounty“.
- Die EB05 Queue (`Roh_mode_1_eb05`), ihr Wochensatz (`Stats_Special_Queue`) und der Satz
  „EB05 Heroines Event“ entfallen, samt `eb05_leader.json` und dem Hinweis an den
  Decklisten. Damit sind beide offenen Fragen erledigt.
- „Last Week 3B Bounty“ zählt nur Tage im neuen Format, sobald es einen gibt.
- Die Wochensätze des Spiels tragen bis zum 03.11.2026 den Zusatz „mixed formats“.
- Die Seite öffnet mit dem neuen Satz; solange er fehlt, mit dem ersten der Liste.

- Nachtrag am selben Tag: Der Satz „EB05 Heroines Event“ bleibt, gebaut aus dem neuen
  Formatsatz statt aus der EB05 Queue (`Roh_mode_0_op17eb05_event`, Leader aus
  `eb05_leader.json`, Winrates nur gegen Event Leader). Er steht direkt unter dem Formatsatz.

## Tradeoffs

Ein festes Datum ist einfacher und genau, solange der Nutzer den Tag kennt; beim nächsten
Formatwechsel muss es von Hand gesetzt werden. Die Warnung aus `eb05_warnung` bleibt und
meldet im Log, falls der Satz weniger als 30 % Partien mit EB05 hat.

## Open questions

- Keine.
