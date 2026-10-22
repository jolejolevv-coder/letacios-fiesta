# Eigenes Replay analysieren ("Analyze my replay")

Spec vom 22.10.2026, freigegeben am selben Tag (Bau nach `book-auf-fiesta.md`).

## Goal

Ein Fiesta Nutzer lädt das Log einer eigenen Partie und bekommt Noten, Accuracy und
Siegchance wie im Replay Viewer, gerechnet im Browser.

## Entscheidungen vom 22.10.2026

* **Im Browser rechnen** (Wahl des Nutzers): Fiesta lädt das Wertnetz (etwa 1 MB) und das Book
  des Leaders (etwa 400 KB), beide verschlüsselt direkt von Metacoach unter `/fiesta/netz/…`
  und `/fiesta/book/…` (siehe `book-auf-fiesta.md`), nicht aus dem Repo, und liest das Log mit
  einem Leser in JavaScript. Das Log verlässt den Browser nie.
* **Dem Nutzer sagen, woher das Log kommt**: das Log liegt im lokalen Client. Die Seite erklärt
  den Weg Schritt für Schritt, bevor sie nach der Datei fragt:
  * OPTCGSim speichert jede Partie selbst: am Mac unter
    `~/Library/Application Support/com.Batsu.OPTCGSim/CombatLogs/AutoSaved/`, unter Windows unter
    `C:\Users\<Name>\AppData\LocalLow\Batsu\OPTCGSim\CombatLogs\AutoSaved\` (in der
    Adressleiste des Explorers `%USERPROFILE%\AppData\LocalLow\Batsu\OPTCGSim\CombatLogs`
    eingeben; `AppData` ist sonst versteckt). Hergeleitet am 22.10.2026: OPTCGSim ist ein Unity
    Spiel mit Firma "Batsu" und Produkt "OPTCGSim" (`app.info` im Spielpaket), und Unity legt seine
    Daten unter Windows nach `LocalLow\<Firma>\<Produkt>`; vor dem Bau einmal an einem Windows
    Rechner bestätigen lassen.
  * Oder im Spiel "Download Log" und die Datei hier ablegen; oder das Log einfügen.
  * OPBounty nennt im eigenen Client "Profile › Match History › OPEN"; ob sich dort ein Log
    speichern lässt, vor dem Bau prüfen.

## Plan (Entwurf)

1. Wertnetz als ONNX oder als kleine eigene Rechnung in JavaScript (zwei verdeckte Schichten,
   Einbettungen), Abgleich mit Python an 1.000 Lagen auf 0,1 Punkte.
2. Leser `src/zuglager.js` als Übertragung von `tools/zug_lager.py`, Test gegen dieselben Logs
   (gleiche Züge, Angriffe, Antworten, Boards).
3. Bewertung wie `tools/spielbewertung.py` (Noten, Accuracy), Anzeige wie `ReplayAnalyse`.
4. Seite "Analyze my replay" mit Anleitung, Dateiwahl, Einfügen.

## Open questions

* Windows Pfad vom Nutzer am 22.10.2026 so akzeptiert.
