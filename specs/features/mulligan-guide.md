# Mulligan Guide

Spec vom 20.10.2026. Anlass: OPBounty 2.7 bringt eine Spielanalyse mit "Matchup Book". Sie
rechnet beim Server von OPBounty, nur über ein angemeldetes Spielkonto und mit Tageskontingent.
Für Fiesta kommt sie deshalb nicht in Frage. Ein großer Teil dessen, was ein Book zeigt, steckt
aber schon in den öffentlichen Tagesdateien, die `aktualisieren.py` jeden Morgen lädt und bisher
wegwirft.

## Goal

Je Leader zeigt Fiesta, welche Karten in der Starthand behalten werden und wie gut der Leader
mit ihnen gewinnt, getrennt nach first und second, im gewählten Zeitraum und Bountybereich.

## Was ich vorgefunden habe

* **Quelle.** Jede Tagesdatei vom CDN (`stats/raw/<tag>/mode_<n>/<bounty>/statsNNNN.json`) trägt
  neben `decklists` und `leaders_presence` auch `cards_presence`, je Leader:
  * `subject_mulligan`: die Karten, dazu je Karte `subject_keep_first|second`,
    `subject_mulligan_first|second`, `subject_wins_in_hand_first|second`,
    `subject_losses_in_hand_first|second`.
  * `subject` mit Anzahl ("2xOP17-041"), dazu `subject_matches` und `subject_wins`: wie oft der
    Leader mit genau so vielen Kopien dieser Karte gespielt hat und wie oft er damit gewann.
* **Bedeutung**, nachgelesen im Client (`Scenes/stats.gd`, `fill_mulligan_info`):
  * Keep und Mulligan zählen je Karte in der **ersten** Starthand, ob diese Hand behalten oder
    weggemischt wurde. Es ist eine Entscheidung über die ganze Hand, nicht über die Karte.
  * Sieg und Niederlage "in hand" zählen je Karte in der Hand, mit der wirklich gespielt wurde:
    die behaltene erste Hand oder die neue Hand nach dem Mulligan.
  * Die Zahlen in den Tagesdateien rechnet der Server von OPBounty. Dass er genauso zählt wie der
    Client, ist plausibel, aber nicht belegt. In der Probe vom 18.10. (Xebec, 2000 bis 3000
    Bounty) stehen bei OP17-054 68 Keeps, aber nur 20 Partien "in hand". Diese Lücke ist noch
    nicht erklärt.
* **Kein Gegner.** Die Kartenwerte gibt es je Leader und Sitz, nicht je Matchup. Je Gegner gibt
  es nur die Winrate einer ganzen Liste (`decklists[].lists[].opponents`).
* **Größe.** Für einen Tag und eine Bountystufe (18.10., 2000 bis 3000) sind es 4 KB gepackt,
  neben 21 KB für die bisherige Tagesdatei. Bei 30 Tagen und vier Stufen rund 0,5 MB mehr.

## Scope

**In scope**

1. `aktualisieren.py` behält beim Zusammenführen `cards_presence` und schreibt je Leader einen
   kurzen Block `karten` in die Tagesdateien und die fertigen Sätze:
   * je Karte acht Zähler: keep, mulligan, wins in hand und losses in hand, jeweils für first
     und second,
   * je Karte mit Anzahl die Partien und Siege.
2. `daten.js` addiert diese Blöcke über die gewählten Tage und Bountystufen, wie es das schon
   für die Winrates tut.
3. Ein neuer Reiter **Analysis** (Pfad `/analysis?leader=...`) zeigt für den gewählten Leader den Abschnitt **Opening hand**,
   für first und second nebeneinander:
   * je Karte die Keep Rate: Anteil behaltener erster Hände, in denen die Karte lag,
   * die Winrate mit der Karte in der Starthand,
   * die Zahl der Partien und den Standardfehler, wie bei allen anderen Winrates auf der Seite.

   Sortiert wird nach der Winrate in der Hand. Karten unter einer Mindestzahl an Partien werden
   ausgegraut, wie in der Matrix.
4. Ein zweiter, eingeklappter Abschnitt **Copies**: je Karte die Winrate des Leaders mit 1, 2, 3
   oder 4 Kopien.
5. Auf der Seite ein Satz, was die Zahlen bedeuten: dass Keep eine Entscheidung über die ganze
   Hand ist, dass die Werte aus den öffentlichen Statistiken von OPBounty kommen und dass sie für
   den Leader gegen alle Gegner gelten.
6. Tests: Zusammenführen mehrerer Teile, Addieren über Tage in `daten.js`, Keep Rate und
   Winrate mit Nenner null.

**Out of scope**

* Der Analysedienst von OPBounty und alles, was ein Spielkonto braucht.
* Werte je Gegner (gibt es in den Daten nicht).
* Eine eigene Bewertung "gute oder schlechte Hand". Fiesta zeigt Zahlen; die Bewertung je Zug
  kommt in einem eigenen Schritt aus Metacoach (Punkt 3 vom 20.10.).

## Acceptance criteria

* [ ] Für Xebec am 18.10. (2000 bis 3000 Bounty) stimmen die angezeigten Zähler mit der
      Tagesdatei vom CDN überein, von Hand an drei Karten geprüft.
* [ ] Wechsel von Zeitraum und Bountystufe ändert die Zahlen wie bei den Winrates; nichts wird
      doppelt gezählt.
* [ ] Die Tagesdateien wachsen um höchstens ein Viertel.
* [ ] Lesbar am Handy (390 Pixel), ohne seitliches Scrollen der ganzen Seite.
* [ ] Tests grün (`npm test`, `python3 -m unittest discover -s tests`).

## Implementation plan

1. `aktualisieren.py`: `cards_presence` zusammenführen und eindampfen, Tests, ein Lauf von Hand
   für 30 Tage.
2. `daten.js`: Blöcke addieren, Tests.
3. Oberfläche: Reiter Analysis mit Opening hand und Copies, Handy prüfen.
4. Abnahme gegen die Tagesdatei, Push, Action prüfen.

## Entscheidungen vom 20.10.2026

* Eigener Reiter **Analysis**, nicht unter Decklists.
* Mindestzahl **100 Partien** je Karte, darunter grau.

## Abweichung bei der Umsetzung (20.10.2026)

Mit den Kopienwerten wuchsen die Tagesdateien um rund 50 Prozent (Kopien 26 KB, Starthand 7 KB
je Datei). Die Kopien stehen deshalb nur in den fertigen Sätzen (`saetze/`), nicht in den
Tagesdateien (`FORMAT = 3`). Für einen frei gewählten Zeitraum zeigt der Reiter nur die
Starthand und sagt das bei Copies.

## Open questions

* **Die Lücke zwischen Keep und "in hand"** (68 gegen 20 im Beispiel). Ich prüfe sie in Schritt 1
  an mehreren Tagen. Wenn sie sich nicht erklären lässt, zeigt die Seite nur Verhältnisse
  innerhalb jeder Zählung, nie eine Zählung geteilt durch die andere.
