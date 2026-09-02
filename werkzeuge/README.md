# Werkzeuge

Kopien aus `xebec-mirror-sim/tools`. Sie liegen hier, damit der taegliche Lauf auf
GitHub ohne dieses zweite Projekt auskommt.

Sie sprechen das Spielprotokoll (ENet ueber UDP, Port 4694):

- `enet_paket.py`      Pakete bauen, inklusive `pfad_anmelden` (siehe unten)
- `enet_strom.py`      Pakete zerlegen, Fragmente zusammensetzen
- `pcap_enet.py`       Mitschnitte lesen, nur noch fuer die Analyse gebraucht
- `bestenliste_lesen.py`  Godot-Varianten lesen, Zeilen deuten
- `bestenliste_holen.py`  der Laeufer: verbinden, anmelden, fuenf Seiten, trennen

**Der Kern, warum es funktioniert:** `pfad_anmelden` meldet den eigenen Knoten beim
Server an, bevor irgendetwas anderes gesendet wird. Ohne das nimmt der Server die
Bestenlistenanfrage zwar an und bestaetigt sie sogar, kann die Antwort danach aber
niemandem zustellen. Die lange Fehlersuche steht in
`specs/features/bestenliste.md`.

Aenderungen gehoeren ins Simulatorprojekt und werden hierher kopiert, nicht
umgekehrt.
