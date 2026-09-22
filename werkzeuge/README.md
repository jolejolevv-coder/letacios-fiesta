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
Index in der SORTIERTEN Liste aller `@rpc` Namen, die Pruefsumme der MD5 darueber.

**Das erledigt sich von selbst, es ist nichts zu tun.** Die Action fragt den
Spielserver taeglich nach seiner Version. Weicht sie von der im Code ab, laedt sie das
Spielpaket von der oeffentlichen Adresse, aus der sich auch der Client bedient, leitet
alle Werte daraus ab, schreibt sie und pusht den Commit. Der naechste Schritt desselben
Laufs nutzt schon die neuen Nummern.

Moeglich ist das, weil das Paket ohne Anmeldung herunterladbar ist; die Adresse steht
im Paket selbst, in `download_update_wl`. Es braucht also keinen Spielclient und
niemanden, der ihn startet.

Von Hand nachsehen oder nachziehen, falls die Action meldet, dass es nicht geklappt hat:

    python3 werkzeuge/version_nachziehen.py --nur-server      # nur fragen, ohne Paket
    python3 werkzeuge/version_nachziehen.py --laden           # Paket holen, vergleichen
    python3 werkzeuge/version_nachziehen.py --laden --schreiben

Ohne `--laden` wird das lokal installierte Paket gelesen, das aber nur auf dem Rechner
mit dem Spielclient aktuell ist. Ohne `--schreiben` endet der Befehl mit 1, sobald
etwas abweicht, und mit 2, wenn das Paket aelter ist als das, was der Server will.

**Der Kern, warum es funktioniert:** `pfad_anmelden` meldet den eigenen Knoten beim
Server an, bevor irgendetwas anderes gesendet wird. Ohne das nimmt der Server die
Bestenlistenanfrage zwar an und bestaetigt sie sogar, kann die Antwort danach aber
niemandem zustellen. Die lange Fehlersuche steht in
`specs/features/bestenliste.md`.

Aenderungen gehoeren ins Simulatorprojekt und werden hierher kopiert, nicht
umgekehrt.
