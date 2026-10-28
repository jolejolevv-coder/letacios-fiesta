# Selbstlauf: was Fiesta braucht, um ohne Handarbeit zu laufen

Entwurf vom 28.10.2026, wartet auf Freigabe. Bestandsaufnahme nach dem Formatwechsel, bei
dem drei Dinge gleichzeitig Handarbeit brauchten: Startdatum des Formats, Update Notice
auf dem Bazzite, Ausfall der Statistik von OPBounty.

## Goal

Fiesta erkennt die wiederkehrenden Brüche selbst (Formatwechsel, Clientupdate, Ausfall
einer Quelle) und reagiert ohne Eingriff; wo das nicht geht, meldet es sich, bevor die
Seite alt aussieht.

## Bestand: was schon von allein läuft

- Action „Veroeffentlichen“ täglich 06:20 UTC und nach jedem Push; Daten, Bilder,
  Spielerdaten, Replays, Verschlüsselung.
- Spielversion: die Action zieht Methodennummern und Prüfsumme selbst nach
  (`werkzeuge/version_nachziehen.py`).
- Bestenliste: der Bazzite fotografiert stündlich 07 bis 21:30 UTC, `plausibel.py` blockt
  kaputte Namen, die Wache der Action wird rot, wenn die Bestenliste älter als 30 h ist.
- Kartenbilder: tcgcsv, offene Karten werden jeden Lauf neu versucht (`img/offen.txt`).
- Update Notice: ab PR 10 setzt der Mitschnitt `seen_update_notice_v` selbst.

## Lücken, nach Dringlichkeit

1. **Formatwechsel von Hand.** `FORMAT_START`, `FORMAT_NAME`, `WOCHE_AB` und die
   Umbenennung „format (old)“ sind Konstanten. Der nächste Wechsel kommt mit OP18 am
   20.11.2026. Vorschlag: Der Lauf erkennt ein neues Set am Anteil seiner Karten in den
   Replays der normalen Queue (Grenze wie heute 30 %, Kartenpräfix aus tcgcsv), merkt sich
   den Starttag in einer Datei im Cache und leitet Namen und Wochengrenze daraus ab. Die
   Konstanten bleiben nur als Überschreibung.
2. **Abhängigkeit von der Statistik von OPBounty.** Seit 26.10. tot. Mit
   `format-aus-replays` kommt der Formatsatz aus den Replays. Die übrigen Sätze (OP17 old,
   Wochensätze, 3B) hängen weiter am CDN. Vorschlag: Die Wache meldet, wenn
   `regular/timestamps.json` älter als 48 h ist, und die Wochensätze kommen ebenfalls aus den
   Replays, wenn das CDN steht.
3. **Zugang zu Firestore.** Die Secrets `OPBOUNTY_*` stammen aus dem Spielpaket. Ändert ein
   Update Schlüssel oder Dienstkonto, fallen Spielerdaten, Replays und der neue Formatsatz
   gleichzeitig aus. Vorschlag: Der Bazzite vergleicht nach `spieldatei.py` die Werte im
   Paket mit einem Fingerabdruck der Secrets und meldet eine Abweichung; setzen bleibt bei
   dir (`secrets_setzen.py`), weil es Zugangsdaten sind.
4. **Event Satz mit festem Ende.** `eb05_leader.json` hat kein Ablaufdatum. Vorschlag: Feld
   `bis` in der Datei, danach verschwindet der Satz von selbst.
5. **Meldungen kommen nur als rote Action.** Vorschlag: eine Zusammenfassung je Lauf in
   der Seite (Changelog Bereich „Status“) oder eine Mail über GitHub bei jeder Warnung,
   nicht nur bei Fehlern.
6. **Bazzite als einzelner Punkt.** Strom, Bildschirm, Spiel. Bleibt so; die Wache deckt
   es ab. Vorschlag nur: der Mitschnitt schickt bei drei Abbrüchen in Folge das letzte
   Foto als Anhang der Warnung mit, damit die Ursache sofort sichtbar ist.
7. **Kartendaten.** Phase 1 von `kartenquelle-tcgcsv` ist offen; neue Sets brauchen
   Namen, Kosten und Counter vor dem Release. Gehört vor den 20.11.

## Scope

In scope: Punkte 1 bis 5 und 7, je als eigene Phase. Out of scope: Punkt 6 über die
Meldung hinaus, ein zweiter Rechner für den Mitschnitt.

## Acceptance criteria

- [ ] Ein simulierter Wechsel auf OP18 in Testdaten erzeugt den neuen Satz, den alten mit
      „(old)“ und die Wochengrenze, ohne Codeänderung.
- [ ] Steht das CDN länger als 48 h, steht eine Warnung in der Zusammenfassung der Action.
- [ ] Ein abweichender Firestore Zugang im Spielpaket wird gemeldet, nicht still genutzt.
- [ ] Der Event Satz verschwindet nach seinem `bis` Datum.
- [ ] Phase 1 tcgcsv ist live vor dem 20.11.2026.

## Implementation plan

Phase 1: Formaterkennung aus den Replays (Punkt 1), mit Tests für den OP18 Fall.
Phase 2: Kartendaten tcgcsv (Punkt 7).
Phase 3: Wache für CDN und Firestore Zugang, Event Ablauf (Punkte 2 bis 4).
Phase 4: Meldungen (Punkt 5).

## Open questions

- Soll der neue Formatsatz beim Wechsel automatisch Startsatz der Seite werden? Vorschlag: ja.
- Wohin sollen Warnungen gehen: nur GitHub, oder zusätzlich Mail oder Discord?
