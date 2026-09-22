# Werkzeuge

Kopien aus `xebec-mirror-sim/tools`. Sie liegen hier, damit der taegliche Lauf auf
GitHub ohne dieses zweite Projekt auskommt.

Sie sprechen das Spielprotokoll (ENet ueber UDP, Port 4694):

- `enet_paket.py`      Pakete bauen, inklusive `pfad_anmelden` (siehe unten)
- `enet_strom.py`      Pakete zerlegen, Fragmente zusammensetzen
- `pcap_enet.py`       Mitschnitte lesen, nur noch fuer die Analyse gebraucht
- `bestenliste_lesen.py`  Godot-Varianten lesen, Zeilen deuten
- `bestenliste_holen.py`  der Laeufer: verbinden, anmelden, fuenf Seiten, trennen

- `methoden_aus_pck.py`    RPC-Nummern aus dem Spielpaket herleiten
- `version_nachziehen.py` alle versionsabhaengigen Werte pruefen und setzen
- `takt_messen.py`        einen Abruf versuchen und die Pause davor festhalten
                          (liegt bereit, laeuft aber nicht, siehe Spec)

## Nach einem Clientupdate

Jedes Update von OPBounty verschiebt die Methodennummern und die Pruefsumme, und die
Beschaffung der Bestenliste laeuft danach ins Leere. Die Nummer einer Methode ist ihr
Index in der SORTIERTEN Liste aller `@rpc` Namen, die Pruefsumme der MD5 darueber;
beides steht im pck des Clients und muss nicht aus einem Mitschnitt geholt werden.

**1. Gemerkt wird es von selbst.** Die Action fragt den Spielserver taeglich nach
seiner Version und vergleicht sie mit der im Code. Weichen sie ab, steht in der
Zusammenfassung des Laufs "Neue Spielversion". Selbst nachsehen geht ueberall, auch
ohne Spielpaket:

    python3 werkzeuge/version_nachziehen.py --nur-server

**2. OPBounty einmal starten.** Der Client aktualisiert sich dabei selbst, und erst
danach stehen die neuen Nummern im pck. Vorher waeren es die von gestern; das Werkzeug
verweigert deshalb die Arbeit, solange Server und pck nicht dieselbe Version nennen.

**3. Vergleichen, dann setzen.** Der erste Aufruf zeigt nur, der zweite schreibt, und
zwar in beide Kopien der Werkzeuge, hier und im Simulatorprojekt:

    python3 werkzeuge/version_nachziehen.py
    python3 werkzeuge/version_nachziehen.py --schreiben

**4. Committen und pushen.** Danach laeuft der naechste Lauf der Action wieder gegen
die richtigen Nummern.

Ohne `--schreiben` endet der Befehl mit 1, sobald etwas abweicht, und mit 2, wenn das
pck noch hinterherhinkt. Er taugt damit auch als Pruefung in einem Skript.

**Der Kern, warum es funktioniert:** `pfad_anmelden` meldet den eigenen Knoten beim
Server an, bevor irgendetwas anderes gesendet wird. Ohne das nimmt der Server die
Bestenlistenanfrage zwar an und bestaetigt sie sogar, kann die Antwort danach aber
niemandem zustellen. Die lange Fehlersuche steht in
`specs/features/bestenliste.md`.

Aenderungen gehoeren ins Simulatorprojekt und werden hierher kopiert, nicht
umgekehrt.
