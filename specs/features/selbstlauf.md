# Selbstlauf: was Fiesta braucht, um ohne Handarbeit zu laufen

Entwurf vom 28.10.2026, am selben Tag freigegeben. Bestandsaufnahme nach dem Formatwechsel, bei
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

## Entschieden (28.10.2026)

- Der neue Formatsatz wird beim Wechsel automatisch Startsatz der Seite.
- Warnungen gehen nur über GitHub (Zusammenfassung der Action, Mail von GitHub bei Fehlern).
  Phase 4 wird damit klein: keine Mail und kein Discord.

## Phase 1 im Detail: Formaterkennung

- Zustand `public/tage/format.zustand.json` im Cache der Action: Start, Name, Schlüssel, die
  Sets des Formats (heute `OP17`, `EB05`) und die eingefrorenen alten Formatsätze. Fehlt die
  Datei, gelten die Konstanten in `aktualisieren.py`.
- Erkennung je UTC Tag aus den Replays der normalen Queue, die der Lauf ohnehin holt: Anteil
  der Partien mit mindestens einer Karte eines neuen Sets. Neu ist `OPnn` oder `EBnn` mit
  höherer Nummer als im Format. Starter (`ST`), Promos (`P`) und `PRB` zählen nicht.
- Der erste Tag mit mindestens 5 % ist der Umstellungstag und mischt beide Formate. Das neue
  Format beginnt am Tag danach, sobald dieser Tag mindestens 30 % hat.
- Name: ein neues `OP` Set ersetzt das Format (`OP18 Standard`), ein neues `EB` Set kommt dazu
  (`OP18 + EB06 Standard`). Schlüssel `Roh_mode_0_<sets>`, Wochengrenze Start plus 7 Tage.
- Der alte Formatsatz wird beim Wechsel aus seinen Replays bis zum Vortag der Umstellung
  gerechnet, im Cache abgelegt und als „<Name> format (old)“ weiter gezeigt.
- `verzeichnis.json` bekommt `start` mit dem Schlüssel des Formatsatzes; die Seite öffnet ihn.
- Geht der Cache verloren, liest der Lauf ab dem Start aus den Konstanten und erkennt den
  Wechsel erneut. Das kostet einen langen Lauf, aber keine Handarbeit.
