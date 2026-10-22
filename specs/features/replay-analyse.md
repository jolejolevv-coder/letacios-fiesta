# Replay Analyse im Viewer (Metacoach Phase 6e)

Spec vom 22.10.2026; Weg 2 freigegeben am selben Tag (der Bazzite rechnet und pusht). Gehört zu
`~/Downloads/meta-coach/specs/features/phase6-book.md` (6e: dieselben Werte im Replay Viewer
von Fiesta).

## Goal

Der Replay Viewer von Fiesta zeigt zu einer Partie, was OPBounty in seiner Analyse zeigt:
Siegchance beider Spieler über die Partie, eine Note für jede Entscheidung beider Spieler und
die Accuracy je Spieler, gerechnet von Metacoach.

## Was es heute gibt

* Fiesta: die Action holt die Replays der Spielerseiten (`replays_holen.py`), dampft sie ein
  (Klartext, Checkpoints, Bewegungen; ohne Laufnummern) und verschlüsselt sie in `dist`. Die
  Replays liegen bewusst nicht im öffentlichen Repo, auch nicht verschlüsselt (Daten fremder
  Spieler).
* Metacoach auf dem Bazzite: Wertnetz für 53 Leader, Book für 59 Leader, Spielbewertung mit
  Noten und Accuracy (`tools/spielbewertung.py`), alles für die aktive Meta.

## Vorschlag

1. **Weg der Daten:** Die Action fragt je Replay bei Metacoach an,
   `GET https://meta.nahobinoco.com/api/export/analyse?pfad=Replays/...`, mit einem eigenen
   Schlüssel (Secret in GitHub und Datei auf dem Bazzite, nur lesen, nur Pfade unter
   `Replays/`). Metacoach holt das Log selbst über denselben öffentlichen Speicher wie Fiesta,
   liest es mit `tools/zug_lager.py`, bewertet beide Spieler und gibt ein kleines JSON zurück.
   Die Action legt es neben das Replay in ihren Zwischenspeicher und verschlüsselt es mit in
   `dist`. Im Repo liegt nichts davon.
   Tradeoff: der Bau hängt für die Analyse am Bazzite. Ist er nicht erreichbar, erscheint das
   Replay ohne Analyse, der Bau läuft weiter. Eine Analyse wird einmal gerechnet und nicht
   neu, außer das Book der Meta ändert sich deutlich (siehe Open questions).
2. **Umfang:** nur Replays der aktiven Meta, deren beide Leader ein Book haben. Ältere Replays
   und seltene Leader zeigen den Viewer wie heute. Mihawk bleibt draußen.
3. **Inhalt je Replay:** Siegchance je Halbzug aus Sicht beider Spieler (Wertnetz); je
   Entscheidung Art, Zug, Lage, Wahl, beste Option, Verlust und Note (wie 6d, für beide
   Spieler); Accuracy und Zahl der Noten je Spieler; Hinweise zu gespielten Karten ohne Note.
   Verankert wird über die Reihenfolge im Log (n ter Angriff, n tes End Turn), weil das
   eingedampfte Replay keine Laufnummern trägt.
4. **Anzeige im Viewer:** über dem Brett eine Kurve der Siegchance mit der Stelle des
   aktuellen Schritts; am Schritt eines Angriffs oder einer Verteidigung die Note als Wort mit
   Verlust; oben Accuracy beider Spieler; ein Schalter "nur Fehler", der zu inaccuracy, mistake
   und blunder springt. Im Stil von Fiesta, ohne neues Design (Entscheidung vom 20.10.2026,
   das Design bleibt). Schätzungen sind als solche beschriftet.

## Out of scope

* Analyse fremder Logs, die jemand einfügt, wie bei OPBounty ("Analyse game").
* Metacoach öffentlich machen; der Exportweg gibt nur die Analyse einzelner Replays heraus.
* Neue Noten oder Grenzen; es gelten die aus 6d.

## Acceptance criteria

* [ ] Der Exportweg antwortet nur mit gültigem Schlüssel, nur für `Replays/` Pfade, und mit
      höchstens einer Anfrage je Pfad und Tag.
* [ ] Für jedes Replay der aktiven Meta auf einer Spielerseite liegt nach dem Bau eine
      Analyse vor, sofern beide Leader ein Book haben.
* [ ] Die Noten eines eigenen Replays stimmen mit "Mein Spiel" in Metacoach überein.
* [ ] Der Viewer zeigt Kurve, Noten am Schritt, Accuracy und den Schalter, am Handy ohne
      Scrollen zur Seite; ohne Analyse sieht er aus wie heute.
* [ ] Fällt der Bazzite aus, baut die Action trotzdem und der Viewer zeigt die Replays.
* [ ] Tests auf beiden Seiten (Export in Metacoach, Einbau und Viewer in Fiesta).

## Implementation plan

1. Metacoach: Analyse eines einzelnen Logs (Bausteine aus 6d wiederverwenden),
   Exportroute mit Schlüssel, Tests.
2. Fiesta: `replays_holen.py` fragt die Analyse ab und legt sie in den Zwischenspeicher;
   Secret in GitHub (trägt der Nutzer selbst ein).
3. Fiesta Viewer: Kurve, Noten, Accuracy, Schalter; Tests.
4. Abnahme an einem eigenen Replay gegen "Mein Spiel".

## Open questions

* Wird eine Analyse neu gerechnet, wenn das Book nachts wechselt? Vorschlag: nein, sie
  trägt das Datum ihres Wertnetzes; neu nur auf Wunsch.

## Stand 22.10.2026 (Weg 2)

* Statt der Exportroute rechnet `~/Downloads/meta-coach/tools/fiesta_analyse.py` auf dem Bazzite:
  Liste aus der veröffentlichten `spieler.json.gz.enc`, Logs aus dem Korpus von Metacoach, sonst
  über `replays_holen.laden` (nur 59 von 651 lagen im Korpus), Analyse je Replay verschlüsselt
  nach `public/analyse/<dateiname>.enc` im Servercheckout, Commit und Push wie die Bestenliste.
  Nachtschritt `fiesta` nach `spielbewertung`. Jede Analyse wird einmal gerechnet.
* Erster Lauf: 651 Replays der Seite, 358 analysiert, 289 ohne Log im Speicher (auch Fiesta
  selbst liefert für sie 404), 3 ohne Sieger, 1 zu kurz; 1,4 MB.
* Viewer: `src/analyse.js` (Anker über die Reihenfolge, Zuordnung über Leader, im Mirror über
  den Sitz; Tests in `tests/analyse.test.js`) und `ReplayAnalyse` in `src/App.jsx`: Accuracy
  beider Spieler, Kurve der Siegchance mit Markern, Note am Schritt, Sprung zum vorigen und
  nächsten Fehler. Lagen in der Analyse auf Englisch.
* Im Repo nur `.enc`; `public/analyse/*.json.gz` steht in `.gitignore`.
