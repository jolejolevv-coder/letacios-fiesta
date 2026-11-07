# Feedback: Verbesserungsvorschläge per Textfeld

Stand 06.11.2026, freigegeben am 06.11.2026 (Secret WEB3FORMS_KEY angelegt).

## Goal
Die rund zehn Nutzer schicken einen Verbesserungsvorschlag mit einem Textfeld auf der Seite ab,
ohne Konto und ohne Discord; der Betreiber bekommt ihn als E-Mail.

## Scope
- In scope: Knopf „Suggest an improvement“ im Fuß jeder Seite, aufklappendes Textfeld mit
  „Send“; Versand über Web3Forms (kostenlos, 250 Nachrichten im Monat) als Mail an die bei
  Web3Forms hinterlegte Adresse; automatisch mitgeschickt: Reiter, Leader, Datensatz, Stand
  der Daten, Adresse der Seite.
- Out of scope: Discord, Kontaktfeld, Kategorien, Anhänge, eigener Server oder Worker,
  Übersicht der Vorschläge auf der Seite.

## Entscheidungen
- Ziel ist Mail an den Betreiber (Nutzer 06.11.2026). Die Adresse steht nur bei Web3Forms,
  nie im Repo.
- Der Zugangsschlüssel von Web3Forms kommt als Secret `WEB3FORMS_KEY` in die Action und wird
  dort in `feedback.json.gz` geschrieben, die wie alle Daten mit dem Seitenpasswort
  verschlüsselt ausgeliefert wird. Der Schlüssel steht so weder im Repo noch im offenen Code
  der Seite; lesen kann ihn nur, wer das Passwort hat. Er erlaubt ohnehin nur, Mails an den
  Betreiber zu schicken.

## Acceptance criteria
- [x] Im Fuß jeder Seite steht „Suggest an improvement“; ein Klick klappt ein Textfeld (bis
      2.000 Zeichen) mit „Send“ und „Cancel“ auf. Leeres Feld: „Send“ ist deaktiviert.
- [x] Nach dem Senden steht „Thanks, sent.“ und das Feld leert sich. Scheitert der Versand
      (Netz, Web3Forms, kein Schlüssel), steht eine klare Meldung und der Text bleibt stehen.
- [x] Die Mail enthält den Text und darunter Reiter, Leader, Datensatz, Stand und Adresse.
- [x] Fehlt `WEB3FORMS_KEY` in der Action, baut die Seite trotzdem; der Knopf fehlt dann.
- [x] Bei 1280 und 390 px kein seitliches Scrollen; das Feld ist am Handy bedienbar
      (16 px Schrift, Tippziele ab 44 px).
- [x] Node Tests für den Aufbau der Nachricht und die Prüfungen; Build grün.
- [ ] Ein Probeversand nach dem Merge kommt als Mail an (prüft der Nutzer).

## Ergebnis Phase 1 (06.11.2026)
Lokal mit Testschlüssel und abgefangenem Versand geprüft: leeres Feld deaktiviert „Send“;
Erfolg zeigt „Thanks, sent.“ und schließt das Feld; Fehler des Dienstes zeigt die Meldung und
der Text bleibt. Die Nachricht trägt Reiter, Leader, Datensatz, Stand und Adresse. Kein
seitliches Scrollen bei 1280 und 390 px. Tests: `tests/feedback.test.js` (5),
`tests/test_feedback_schluessel.py` (2); npm test 118 grün, Build grün.

## Implementation plan
Phase 1: `src/feedback.js` (Nachricht bauen, prüfen, senden; Test), Schritt in der Action, der
`public/feedback.json.gz` aus dem Secret schreibt, Komponente im Fuß von `App.jsx`, Prüfung bei
1280 und 390 px mit einem Testschlüssel ohne echten Versand.
Phase 2: Nutzer legt den Schlüssel bei Web3Forms an und trägt ihn als Secret ein; nach dem Merge
ein Probeversand. Changelog, Übergabe.

Tradeoffs: Die Nachrichten laufen über einen fremden Dienst in den USA; für Vorschläge ohne
persönliche Daten vertretbar. Ein eigener Cloudflare Worker mit Email Routing käme ohne fremden
Dienst aus, ist für zehn Nutzer aber zu viel Einrichtung. Wer das Passwort hat, könnte den
Schlüssel auslesen und Mails schicken; bei Missbrauch erzeugt der Nutzer einen neuen.

## Open questions
- Keine.
