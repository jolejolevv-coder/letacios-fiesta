# Bestenliste

## Goal

Die Top 100 der Western Rangliste auf der Seite zeigen, je Spieler seine Bilanz und die
Leader, die er spielt, und seine letzten Replays verlinken.

## Was sich gegenueber der ersten Fassung geaendert hat

Die erste Fassung wollte die Rangfolge aus Firestore lesen. **Das geht nicht.** Drei
Kandidaten wurden geprueft und alle drei fallen aus:

- `Leaderboard`, 6152 Dokumente, ist tot. Rang 1 traegt Score 2 und Bounty 500.
- `PublicUsers.Position.Western` ist kein Rang. Auf der 1 liegen etliche Spieler, es ist
  der Standardwert fuer jeden ohne Partie.
- `Users` nach `Bounty` absteigend liefert einen Spieler ueber 500 und danach eine Mauer
  aus genau 500.

Der Grund steht im Spielcode: `request_filtered_leaderboard` und `send_leaderboard` sind
RPCs. Die Rangfolge rechnet der Server und schickt sie ueber die Spielverbindung. In der
Datenbank liegt sie nicht.

Der Weg ist deshalb ein anderer: **ein eigener, schlanker Client spricht das Spielprotokoll
und stellt dieselbe Anfrage wie das Spiel.**

## Datenquelle

    ENet ueber UDP, Port 4694, unverschluesselt und unkomprimiert

Anfrage, 24 Byte Nutzlast, aus dem Mitschnitt vom 01.09.2026:

    00 01 46 04                    Aufruf, Knoten 1, Methode 0x46, vier Argumente
    04000000 00000000              leader   = ""
    04000000 00000000              country  = ""
    0214                           limit    = 20
    02 0N                          page     = 1 bis 5

Antwort `send_leaderboard`, Knoten 2, Methode 104, rund 22 KB je Seite, ueber ENet in
etwa siebzehn Fragmente zerlegt. Darin ein Feld aus 20 Zeilen zu je neun Werten. Die
Zuordnung stammt nicht aus Vermutung, sondern aus `update_leaderboard` im Spielcode:

    0 Loginname   1 Anzeigename   2 Bounty   3 Rang   4 user_id
    5 is_marine   6 Discord-Kennung   7 Land   8 Leaderaufstellung (gzip in base64)

Uebernommen werden Loginname, Anzeigename, Bounty, Rang, user_id und die
Leaderaufstellung. Aus letzterer werden Partienzahl und Spielzeit gerechnet, denn die
Zeile selbst traegt keine.

Die `user_id` schliesst die Kette zu den Replays: sie zeigt auf `PublicUsers/<id>`, dort
stehen die letzten neun Partien, und daraus laesst sich der Storagepfad bilden.

## Scope

In scope:

- Nur **Western**, genau 100 Plaetze.
- Rang, Name, Bounty, user_id, Leaderaufstellung mit Sitzsplit, Partien, Spielzeit.
- Replaylinks aus `PublicUsers/<user_id>.Public_matches`.

Out of scope:

- Eastern, Webcam, Arena, und der zusammengefuehrte Reiter "Standard, All Countries".
- Marine-Flag und Land. Nicht gebraucht; Land war ohnehin nur bei 67 von 100 gesetzt.
- Eine Partienhistorie ueber die neun Eintraege im Profil hinaus. Die gibt es nicht.
- Jede Form von Schreibzugriff, jede Spielhandlung, jedes Betreten einer Warteschlange.

## Personenbezug

Es geht um rund hundert echte Menschen. Vier Regeln:

- **Die Discord-Kennung wird verworfen.** Der Server schickt sie bei jedem Abruf ungefragt
  mit. Sie steht nirgends in der Oberflaeche und ist direkt personenbeziehbar. Ein Test
  prueft das Ergebnis dagegen.
- Gelesen wird nur `PublicUsers`, nie `Users`.
- Gezeigt wird nichts, was der Client nicht jedem Spieler zeigt.
- Die Seite bleibt hinter dem Passwort.

## Anmeldung und Konto

Der Spielserver verlangt Benutzername und Passwort ueber die Spielverbindung:

    login_request.rpc_id(1, user, n, password, version, discord_id, roles, batsu_roles, 0)

Der Laeufer meldet sich mit dem Zweitkonto des Nutzers an, nicht mit einem Hauptkonto.
Zugangsdaten als Repository Secret, in keiner Datei und in keiner Logzeile. Der `version`
String muss zum Server passen und wird beim Bruch als solcher gemeldet, nicht umgangen.

## Bekannte Bruchstellen

Das ist kein einmaliger Bau. Ein Spielupdate kann den `version` String aendern und die
Methodennummern verschieben, weil sie aus der Reihenfolge der Methoden im Skript
entstehen. Beides bricht laut, nicht leise: falsche Nummer heisst keine Antwort. Der
Laeufer meldet das und liefert die alte Datei weiter, statt eine leere zu schreiben.

## Was am eigenen Laeufer gescheitert ist, und was daran belegt ist

Stand 01.09.2026. Der Laeufer ist gebaut und kommt weit, aber nicht ans Ziel.

**Es funktioniert:** Verbindungsaufbau mit Sitzungskennung im Paketkopf, Bestaetigungen,
Zusammensetzen der Fragmente, Herzschlag, Trennen. Die Anmeldung geht durch, der Server
antwortet woertlich mit "Login successful!". Der Pfadabgleich laeuft in beide Richtungen.

**Es funktioniert nicht:** `request_filtered_leaderboard` bleibt unbeantwortet.

**Und das ist der Punkt, der die Suche beendet:** die Anfrage geht **byteweise identisch**
raus wie die des Spielclients. Nicht verglichen gegen das, was der Code zu senden glaubt,
sondern gegen einen tcpdump-Mitschnitt des eigenen Laeufers. Auch die Reihenfolge stimmt:
Methode 39, dann 96, 133, 70 und 64, alle in derselben Form und ueber denselben Knoten.

Damit liegt es nicht an den Paketen, sondern an einem Zustand auf dem Server.

Der Reihe nach ausgeschlossen, jeder Punkt gemessen, nicht vermutet:

| Verdacht | Ergebnis |
|---|---|
| Sitzungskennung im Kopf fehlt | war ein echter Fehler, behoben, nicht die Ursache |
| `data` im CONNECT ist Null statt Peer-Kennung | war ein echter Fehler, behoben, nicht die Ursache |
| erster Aufruf braucht den Knotenpfad | war ein echter Fehler, behoben, nicht die Ursache |
| Pfadbestaetigung fehlt | gebaut, laeuft, nicht die Ursache |
| falscher Knoten (`root_main` gegen `root_main/Main`) | beide probiert, kurz und lang |
| falsche Knotennummer (1, 88, 89) | alle probiert |
| Anmeldung beim Bestenlistensystem fehlt (96, 133) | nachgebaut, nicht die Ursache |
| Begleitaufruf 64 fehlt | nachgebaut, nicht die Ursache |
| Firebase-Anmeldung fehlt vorher | nachgebaut, **widerlegt**: es ist das geteilte Dienstkonto aus dem Spielpaket, es verknuepft nichts mit einem Spieler |

Wer hier weitermacht, faengt bitte nicht bei dieser Liste an. Der naechste sinnvolle Schritt
waere, den echten Client zu instrumentieren, nicht weitere Pakete zu raten.

**Der Mitschnittweg funktioniert dagegen vollstaendig** und hat am 01.09.2026 zweimal eine
taggenaue Top 100 geliefert. Er ist bis auf Weiteres der Weg.

## Acceptance criteria

- [ ] Der ENet-Baukasten erzeugt die aufgezeichnete Anfrage **byteweise identisch**.
      Gegen den Mitschnitt geprueft, ohne eine einzige Verbindung.
- [ ] Der Leser holt aus einem Mitschnitt 100 Spieler mit Raengen 1 bis 100. *(erfuellt)*
- [ ] Kein `discord` Feld im Ergebnis. *(erfuellt, per Test)*
- [ ] Der Laeufer verbindet, meldet an, holt fuenf Seiten und trennt sauber.
- [ ] Er betritt keine Warteschlange und sendet keinen anderen RPC als Anmeldung,
      Bestenliste und Trennung.
- [ ] Zugangsdaten stehen in keiner Datei des Repos und in keiner Logzeile.
- [ ] `public/bestenliste.json.gz` wird geschrieben und wie die uebrigen verschluesselt.
- [ ] Neuer Reiter unter `/leaderboard`, 100 Zeilen, je Zeile aufklappbar.
- [ ] Auf 375 Pixel Breite laeuft nichts ueber den Rand.
- [ ] Faellt die Bestenliste aus, laeuft der Rest der Seite weiter.

## Implementation plan

**Phase 1, ENet ohne Netz.** Pakete bauen und lesen: Kopf, Befehlskette, Bestaetigungen,
Fragmente. Godots Variantenkodierung in beide Richtungen. Abnahme ist der Selbsttest gegen
den Mitschnitt: die selbst gebaute Anfrage muss Byte fuer Byte der aufgezeichneten
entsprechen. Bis hierher wird nichts verbunden.

**Phase 2, Verbindung.** Handschlag, Anmeldung, Herzschlag, Trennen. Erst hier faellt das
erste echte Paket.

**Phase 3, Laeufer.** Fuenf Seiten holen, entschluesseln, JSON schreiben, Discord-Kennung
verwerfen. Fehlerpfad: bei Bruch die alte Datei behalten und melden.

**Phase 4, Replays.** Aus `PublicUsers/<user_id>.Public_matches` die Pfade rechnen und
pruefen, ob der Storage sie ohne Anmeldung herausgibt.

**Phase 5, Anzeige und taeglicher Lauf.** Reiter, Secret, Schritt in die Action.

## Open questions

- Gibt der Storage die Replaydateien ohne Anmeldung heraus? Entscheidet, ob Phase 4 nur
  verlinkt oder die Logs mit ausliefern muss.
- Das Firestore-Profil meldet fuer FabaniniOvert unter Western 101 zu 48, also 149
  Partien; die Leaderaufstellung aus der Bestenliste summiert sich auf 124. Die
  Bezugsraeume sind verschieden. Welcher welcher ist, ist offen, und bis dahin werden
  beide Zahlen getrennt gefuehrt statt gleichgesetzt.
- Wie oft aendert sich der `version` String in der Praxis?
