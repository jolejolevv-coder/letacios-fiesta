## Goal

Zu jeder Partie aus den Spielerprofilen das Replay zeigen.

## Warum nicht alle Replays da sind, gemessen am 02.09.2026

Kurz: **es gibt sie nicht.** Wir holen bereits alles, was auf dem Server liegt.

Zahlen des Laufs vom 02.09.2026, 95 Spieler:

    851  Partien in den Profilen
    101  ohne berechenbaren Pfad   -> "selfdc/selfdc" (kein Sieger) oder Deck leer
    750  mit Pfad, davon 718 eindeutig
    305  Replay vorhanden und geholt
    413  Replay nicht vorhanden

### Die Pfadformel ist nicht schuld

Sie ist aus dem Spielcode nachgebaut und stimmt mit `get_uploaded_replay_path`
ueberein, inklusive der eigenwilligen Wochenformel und der abgeschnittenen Bounty.
Gegenprobe: die 305 vorhandenen Replays treffen exakt.

### Belege, dass die 413 wirklich fehlen

1. **Vollindex des Storage.** Alle 1.307.507 Replaydateien aufgelistet und nach dem
   Bountypaar durchsucht, ueber alle Wochen, Modi und Leaderpaarungen hinweg. Kein
   Treffer.
2. **Firestore-Sammlung `Replays`.** Das Spiel fuehrt dort einen Metadatenindex mit
   dem echten `path`, den es selbst benutzt, wenn der berechnete Pfad nicht passt.
   Alle 413 abgefragt: null Treffer. Gegenprobe an nachweislich vorhandenen
   Replays: 30 von 40 gefunden, die Methode findet also, was da ist.
3. **Nachbarsuche im Ordner.** Bis Abstand 200 gibt es fuer 235 der Faelle
   ueberhaupt Kandidaten; 677 davon heruntergeladen und gegen die Spielernamen
   geprueft: kein einziger passt.

### Warum das Spiel nur einen Teil hochlaedt

Aus `finish_current_match` und `upload_replay` im Spielcode. Hochgeladen wird nur,
wenn **alle** Bedingungen gelten:

- der eigene Client ist `room_leader` (nur eine der beiden Seiten laedt hoch),
- die Partie ist kein Turnierspiel,
- das Ergebnis enthaelt weder "invalid" noch "early" noch "cancelled",
- die lokale Logdatei ist ueberhaupt vorhanden (`get_log_by_code`).

Faellt eine davon aus, entsteht nie eine Datei. Das erklaert die Groessenordnung:
gut die Haelfte der Partien in den Profilen hat kein Replay.

### Zwei Eigenheiten, die beim Suchen Zeit kosten

- **Der Zeitstempel im Firestore-Eintrag ist die Uploadzeit, nicht der Spielbeginn.**
  Er liegt um die Spieldauer spaeter. Wer mit dem Startzeitpunkt exakt sucht, findet
  nichts, auch wenn das Replay da ist.
- **Zwei Dateinamensformate.** Bis 2026-W24 mit angehaengtem Zeitstempel
  (`..._2500_2300_2026-01-23T23:52:50.log`), ab 2026-W25 ohne. Fuer aktuelle Wochen
  ist nur die kurze Form relevant, `get_legacy_uploaded_replay_path` deckt die alte ab.

### Was daraus folgt

Die Toleranz der Nachbarsuche bleibt bei 2. Weiter aufzumachen bringt nichts:
zwischen Abstand 2 und dem naechsten Kandidaten klafft eine Luecke, und die
Kandidaten dahinter sind nachweislich fremde Partien.

Die Siegerbestimmung folgt jetzt `_winner_player_index` aus dem Spielcode, inklusive
"dc" und "selfdc" als Niederlage und "kein Sieger" als eigenem Fall.

