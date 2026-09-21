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

## OFFEN seit dem 09.09.2026: 2.6.1 bricht den Laeufer

Am 09.09.2026 blieb `request_filtered_leaderboard` wieder unbeantwortet. Ursache war
das Clientupdate auf 2.6.1 zwischen dem 08. und dem 09.09.

**Am 21.09.2026 aus einem vollstaendigen Mitschnitt geklaert** (tcpdump von vor dem
Clientstart bis nach dem Blaettern, 248 Pakete). Alles Folgende ist gemessen:

- Version `2.6.1`, Pruefsumme `110cfee48f4a1d1809fedd6cd0b42f59` fuer `root_main/Main`.
- Methodennummern des Clients: `login_request` 0x2b, `request_upgrades` 0x65,
  `update_my_leaderboard_info` 0x8b, `request_filtered_leaderboard` 0x4b,
  `request_arena_stats` 0x45. Alle bestaetigt.
- **Die Antwort kommt auf Methode 109, nicht mehr auf 104.** Nachgezogen in
  `bestenliste_lesen.py` und `bestenliste_holen.py`. Veraltete Nummern fallen nicht
  auf, der Leser meldet dann nur einen leeren Mitschnitt.
- **Ein echter Fehler in der langen Aufrufform, behoben.** Die vier Byte vor der
  Methode sind keine Knotennummer, sondern der Byte-Versatz, an dem der Pfad im
  selben Paket beginnt: Godot liest `ofs = node_target & 0x7FFFFFFF` und ab dort die
  Zeichenkette. Der Laeufer hatte die 0x58 aus dem Mitschnitt als feste Nummer
  uebernommen. Jetzt wird der Versatz gerechnet, und unser Anmeldepaket ist byteweise
  identisch mit dem des Clients, 103 Byte, Versatz 88.

**Und damit stehen wir wieder genau da wie am 01.09.2026.** Das Anmeldepaket ist
byteweise identisch, der ENet-Rahmen ist identisch, der Server bestaetigt es auf
Protokollebene, und das Spiel reagiert nicht: kein "Login successful!", keine
Pfadbestaetigung, keine Bestenliste. Auch nicht in der langen Form, auch nicht in der
Reihenfolge des Clients, auch nicht mit woertlich eingespieltem Anmeldepaket.

Was der Server uns dabei schickt und dem echten Client nicht: direkt nach dem
Verbinden einen Aufruf auf `root_main` Methode 0 mit der Zeichenkette "2.6.1", dazu
die Pfadanmeldung fuer `root_main` unter der Nummer 1. Der Mitschnitt des Clients
setzt spaeter ein, deshalb ist offen, ob er das auch bekommt.

Es gilt derselbe Schluss wie beim ersten Mal, siehe den historischen Abschnitt weiter
unten: **nicht weiter Pakete raten.** Der Mitschnittweg funktioniert vollstaendig und
hat am 21.09.2026 wieder eine taggenaue Top 100 geliefert.

    sudo tcpdump -i any -s 0 -w ~/Downloads/bestenliste.pcap 'udp and host 34.235.236.170'
    # Spiel oeffnen, Bestenliste, fuenfmal blaettern, Strg+C
    python3 bestenliste_einbauen.py ~/Downloads/bestenliste.pcap

**Achtung, der Mitschnitt enthaelt das Kontopasswort im Klartext.** Es steht als
drittes Argument in `login_request`. Die pcap gehoert nach dem Einlesen geloescht und
niemals ins Repo.

**Nachtrag vom 21.09.2026, abends: der Laeufer hat EINMAL funktioniert.**
Nach den Korrekturen (Methode 109, Versatz statt Knotennummer) lieferte
`bestenliste_holen.py --seiten 2` zwei Seiten mit 40 Spielern, korrekte Namen und
Bountys. Drei Durchlaeufe unmittelbar danach gaben wieder null Seiten, und der Lauf der
Action am selben Abend ebenfalls.

Ein Treffer auf viele Versuche. Auffaellig ist, wann er kam: nach mehreren Stunden ohne
Verbindung, waehrend alle Fehlschlaege dicht aufeinander folgten. Das deutet eher auf
eine Sperre je Zeitfenster oder je Sitzung als auf falsche Pakete, denn die Pakete waren
in beiden Faellen dieselben.

Das ist EIN Datenpunkt, keine Erklaerung. Deshalb wird jetzt gemessen statt geraten.

**Die Messung laeuft seit dem 21.09.2026.** `werkzeuge/takt_messen.py` macht einen
Abruf und haengt eine Zeile an `~/.opbounty_takt.log`: Zeitpunkt, Pause seit dem
letzten Versuch, Seiten, Spieler, Notiz. Keine Zugangsdaten, und die Datei liegt
ausserhalb des Repos. Getaktet wird ueber den launchd Agenten
`~/Library/LaunchAgents/de.jole.opbounty-takt.plist`, einmal pro Stunde.

    python3 werkzeuge/takt_messen.py            # ein Versuch von Hand
    python3 werkzeuge/takt_messen.py --zeigen   # auswerten
    launchctl unload ~/Library/LaunchAgents/de.jole.opbounty-takt.plist   # abschalten

Auszuwerten ist eine einzige Frage: ist die Pause vor einem Treffer systematisch
laenger als die vor einem Fehlschlag? Faellt das Muster, ist der Laeufer kein
Reparaturfall, sondern ein Taktfall, und die Loesung heisst seltener fragen statt
andere Pakete schicken. Faellt es nicht, ist der eine Treffer Zufall gewesen und es
bleibt beim Mitschnittweg.

Zu bedenken bei der Auswertung: der taegliche Lauf der Action fragt ebenfalls, von
einer anderen Adresse aus. Wenn die Sperre an der Adresse haengt und nicht am Konto,
stoeren sich die beiden nicht.

**Firestore ist KEIN Ersatz. Am 21.09.2026 nachgemessen, nicht vermutet.**
Der Gedanke lag nahe, weil die Action ohnehin Firestore liest und diese Quelle von
Spielversionen unabhaengig waere. Er traegt aber nicht:

- `Users` hat ein Feld `Bounty`, und absteigend sortiert liefert es Platz 1 mit 2856,6
  und danach 99 Spieler mit exakt 500. Das ist ein Startwert, keine Rangliste. Der
  Spieler auf Platz 1 dieser Abfrage kommt in der echten Top 100 gar nicht vor.
- Die echte Liste vom selben Tag laeuft von 5361,9 auf Rang 1 bis 3130,8 auf Rang 100,
  mit 99 verschiedenen Werten bei 100 Spielern.
- `PublicUsers/<id>` traegt gar kein Bountyfeld: dort stehen Cosmetics, Flag, Matches,
  Position, User_id, Webcam, Western und bei manchen Arena und Eastern.

Die Ladderbounty steht also nur in der RPC-Antwort `send_leaderboard`. Damit bleibt
das Spielprotokoll die einzige Quelle, und der Mitschnittweg der einzige Weg, solange
der Laeufer stumm bleibt. Nebenbei: die Abfrage auf `Users` verstoesst ohnehin gegen
die Projektregel, nur `PublicUsers` zu lesen.

## GELOEST am 02.09.2026: der Laeufer funktioniert

**Ursache: der Laeufer hat nie seinen eigenen Knoten beim Server angemeldet.**

Er hat nur die Pfadanmeldungen des Servers bestaetigt, aber selbst nie eine
geschickt. Der Server nahm die Bestenlistenanfrage daraufhin auf ENet-Ebene an und
bestaetigte sie sogar mit einem ACK, konnte die Antwort danach aber niemandem
zustellen: er kannte den Knoten nicht, auf dem `send_leaderboard` beim Client liegt.

Deshalb war die alte Analyse in die Irre gelaufen. Sie hat die Anfrage byteweise
gegen den echten Client verglichen und Gleichheit festgestellt, was stimmte. Der
Unterschied lag nicht in der Anfrage, sondern in einem Aufruf **davor**, den der
Laeufer gar nicht sendete. Ein Byte-Vergleich der Anfrage konnte das nie zeigen.

Gefunden durch zwei Messungen, die vorher nicht gemacht worden waren:

1. **Bestaetigt der Server die Anfrage?** Ja, ACK auf die Folgenummer. Damit war
   ausgeschlossen, dass es an Kanal, Sequenz oder Paketform liegt, und klar, dass
   die Anfrage ankommt und die Anwendung sie verwirft.
2. **Welche Pfadanmeldungen schickt der echte Client?** Ein
   `SIMPLIFY_PATH root_main/Main = id 1` mit Pruefsumme, Client zu Server, vor allem
   anderen. Der Laeufer: keine einzige.

Die Loesung ist `enet_paket.pfad_anmelden()`, byteweise identisch mit dem echten
Client, gesendet als erster Aufruf vor der Anmeldung. Danach beantwortet der Server
alle fuenf Seiten. Belegt: 100 Spieler, Raenge 1 bis 100, kein Discord-Feld.

Die Pruefsumme deckt die Methodenliste des Knotens ab und haengt damit an der
Spielversion, nicht am Konto oder an der Sitzung. Aendert sich die Spielversion,
kann sie neu bestimmt werden muessen; das bricht laut, naemlich als ausbleibende
Antwort.

**Folge fuer den Betrieb:** der Mitschnittweg mit Spielclient, xdotool und tcpdump ist
nicht mehr noetig. Seit dem 02.09.2026 laeuft der Laeufer **im taeglichen Lauf auf
GitHub**, im selben Durchgang und vor den Spielerdaten, die seine user_ids brauchen.
Der Heimserver ist damit ganz raus, sein Timer ist abgeschaltet und die Zugangsdaten
sind dort geloescht.

Die fuenf Protokollwerkzeuge liegen dafuer als Kopie in `werkzeuge/`; Aenderungen
gehoeren ins Simulatorprojekt und werden herkopiert, nicht umgekehrt. Die Action
committet den frischen Stand zurueck ins Repo, weil er der Ausgangsbestand des
naechsten Laufs ist. Ein Push mit dem `GITHUB_TOKEN` loest keinen neuen Lauf aus, es
entsteht also keine Schleife; das ist gemessen, nicht angenommen.

Belegt am 02.09.2026: ausgehendes UDP auf Port 4694 geht von GitHub-Runnern durch, der
Schritt holte dort 100 Spieler.

## Was am eigenen Laeufer gescheitert war (historisch, vor dem 02.09.2026)

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

**Der Mitschnittweg funktionierte dagegen vollstaendig** und hat am 01.09.2026 zweimal eine
taggenaue Top 100 geliefert. Er war bis zum 02.09.2026 der Weg und ist seitdem durch den
Laeufer ersetzt, siehe oben.

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

## Replays: beantwortet am 01.09.2026

**Der Storage gibt die Logs ohne Anmeldung heraus.** Geprueft an einer echten Partie,
sie laedt als vollstaendiges RZ1-Log. Die Seite verlinkt sie also, sie muss nichts
mitliefern. Die Adresse lautet

    https://firebasestorage.googleapis.com/v0/b/opbounty-3623c.firebasestorage.app/o/<Pfad>?alt=media

Der Pfad wird aus `Public_matches` gebildet. Zwei Fallen stecken darin, beide haben
zugeschlagen und beide sind aus dem Spielcode geklaert:

**Die Bounty steht als ganze Zahl im Dateinamen, abgeschnitten statt gerundet.** Der
Client rechnet `int(_bounty_for_match_player(...))`. Aus 3681.3 wird 3681. Mit der
Nachkommastelle antwortet der Storage mit 404.

**Die Wochenangabe ist nicht die ISO-Woche.** Das Spiel rechnet sie selbst:

    week = int((Tag_im_Jahr + 10 - (Wochentag + 1) % 7) / 7)

mit Godots Wochentagszaehlung, in der die Null der Sonntag ist. Fuer den 01.09.2026
ergibt das 35, die echte ISO-Woche waere 36. Wer `isocalendar()` nimmt, bekommt ein
sauberes 404 und sucht den Fehler danach an der falschen Stelle.

Ein 404 heisst hier uebrigens "Pfad falsch", nicht "keine Rechte"; ein 403 waere das
Rechteproblem gewesen. Der Unterschied hat die Suche abgekuerzt.

## Open questions
- Das Firestore-Profil meldet fuer FabaniniOvert unter Western 101 zu 48, also 149
  Partien; die Leaderaufstellung aus der Bestenliste summiert sich auf 124. Die
  Bezugsraeume sind verschieden. Welcher welcher ist, ist offen, und bis dahin werden
  beide Zahlen getrennt gefuehrt statt gleichgesetzt.
- Wie oft aendert sich der `version` String in der Praxis?
