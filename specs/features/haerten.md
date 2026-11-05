## Goal
Die Seite soll bei fehlenden oder kaputten Daten nicht mehr schwarz werden. Links auf Spieler und Replays sollen beim Neuladen erhalten bleiben, und die Bedienelemente sollen auf dem Handy gut zu treffen sein. Grundlage ist das Impeccable Audit vom 06.11.2026 (harden und adapt).

## Scope
In scope (Nummern aus dem Audit):
- P0-1: Error Boundary um den Inhalt jedes Reiters (der Schlüssel ist der Reiter) und eine zweite als letzte Stufe um die App. Kopf und Reiterleiste bleiben dabei bedienbar.
- P1-1: Scheitert ein Abruf von Verzeichnis oder Datensatz, bleibt die normale Hülle mit Kopf, Reitern und Quellenwahl stehen. Der Fehler erscheint im Inhalt, mit einem Text für Besucher statt „run python3 aktualisieren.py“.
- P1-2: `/player?id=` und `/replay?p=` bleiben in der Adresse stehen. Kein doppelter Verlaufseintrag.
- P1-3: Ein Fehler beim Entsperren (WebCrypto fehlt, schluessel.json kaputt) zeigt eine Meldung. Keine leere Seite und kein Knopf, der für immer auf „Checking“ steht.
- P2-1: Fehlgeschlagene Abrufe bleiben nicht im Zwischenspeicher, damit ein neuer Versuch wirklich neu lädt.
- P2-2: Ein Netzfehler bei schluessel.json wird nicht als „keine Verschlüsselung“ gemerkt.
- P2-3: Ein leerer Datensatz zeigt „No games in this range“ statt einem endlosen „Loading“.
- P2-4 bis P2-6: Schutz gegen fehlende Felder in Bestenliste (`spieler`), Mulligan (`gegner`, `wr_*`) und Kaizoku Spielerdaten (`decks`, `gegner`).
- P2-9 teilweise: `role="alert"` an Fehlermeldungen, `aria-live` an den Ladetexten, `document.title` je Reiter.
- P2-10 (adapt): Bedienelemente auf Handybreite (bis 760 px) mindestens 44 px hoch: `.knopf`, `.feld`, `.schalter button`, `.sitzwahl button`, `.leiste-knopf`, `.dreh`, `.voreinstellung .knopf`.

Out of scope:
- P2-7 (Replay Log) und P2-8 (Speicher bei 30 Tagen). Das ist Leistung, also eher `/impeccable optimize`.
- Alle P3 Punkte, auch das im localStorage gemerkte Passwort (P3-5). Das ist eine Sicherheitsentscheidung, die du gesondert triffst.
- Neues Design und neue Texte über die Fehlermeldungen hinaus.

## Acceptance criteria
- [x] Ein absichtlich geworfener Renderfehler in einem Reiter zeigt eine Meldung mit Link zurück. Kopf und Reiter bleiben bedienbar, der Wechsel in einen anderen Reiter funktioniert.
- [x] Fehlt der Standarddatensatz (lokal per 404 simuliert), sind Leaderboard, Player und Changelog trotzdem erreichbar, und die Quellenwahl ist sichtbar.
- [x] Nach dem Klick auf einen Spieler steht `?id=` in der Adresse. Neu laden zeigt denselben Spieler, Zurück führt zur Bestenliste. Dasselbe gilt für `?p=` bei Replays.
- [x] Ohne `crypto.subtle` (lokal simuliert) erscheint eine verständliche Meldung statt einer leeren Seite.
- [x] Ein einmal gescheiterter Abruf wird beim nächsten Versuch neu geholt (Test in `tests/daten.test.js`).
- [x] Ein leerer Zeitraum zeigt „No games in this range“.
- [x] Bestenliste ohne `spieler`, Mulligan ohne `gegner` und ein Kaizoku Spieler ohne `decks` stürzen nicht ab (Tests oder lokale Fixtures).
- [x] Auf 375 px Breite sind alle genannten Bedienelemente mindestens 44 px hoch (per `getBoundingClientRect` geprüft), ohne waagerechtes Scrollen.
- [x] `npm test` und `npx vite build` laufen grün.

## Implementation plan
Phase 1 (harden): Error Boundaries, Hülle bei Ladefehler, Adresse für Spieler und Replay, Entsperren mit Fehlerpfad, Zwischenspeicher, leere Zustände und Feldschutz, alert und title. Tests in `tests/daten.test.js`.
Phase 2 (adapt): Touchgrößen im Handyblock von `src/index.css`.
Phase 3: lokale Prüfung aller Abnahmekriterien in der Vorschau (Port 5181), danach ein Commit auf `claude/haerten`, PR erst nach deinem OK.

## Open questions
- Text der Fehlermeldungen: Ich schlage englische Kurztexte im Stil der Seite vor, etwa „This part of the page failed to load.“ mit „Back to Decklists“.
