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

## OFFEN seit dem 09.09.2026: 2.6.1 bricht die Beschaffung

Der Client aktualisiert sich selbst und ist zwischen dem 08. und dem 09.09.2026 von
2.5.5 auf **2.6.1** gegangen. Genau dort endet die Datenreihe: der letzte Commit heisst
"Bestenliste vom 2026-09-08". Der Lauf blieb trotzdem gruen, weil der Holschritt
`continue-on-error` traegt; das meldet seit dem 21.09. ein eigener Wachjob.

Drei der vier versionsgebundenen Werte sind nachgezogen und belegt:

**Versionszeichenkette**, 2.5.5 auf 2.6.1. Nachzusehen im laufenden Client:

    strings ~/Library/Application\ Support/Godot/app_userdata/OPBounty/OPBounty.pck \
      | grep -oE '"2\.[0-9]+\.[0-9]+"'

**Pfadpruefsumme**, `c102025c5f763c7f3ab733d81e9d6825` auf
`8de5e6c99ea8a8c55a484c9b3492ce26`. Die muss man nicht raten: der Server meldet
`root_main/Main` seinerseits an und schickt die Pruefsumme dabei mit. Sichtbar mit

    python3 werkzeuge/bestenliste_holen.py --seiten 1 --uebersicht

unter "lesbare Zeichenketten".

**Methodennummern.** Godot vergibt sie ueber den Index in der sortierten Liste der
@rpc Methoden des Knotens. 2.6.1 hat fuenf Methoden hinzugefuegt, vier davon sortieren
vor `login_request`, alle fuenf vor den uebrigen:

    login_request                 0x27 -> 0x2b
    request_arena_stats           0x40 -> 0x45
    request_filtered_leaderboard  0x46 -> 0x4b
    request_upgrades              0x60 -> 0x65
    update_auto_config            0x85 -> 0x8a

Das ist nicht geraten. Seit 2.6.1 steht der GDScript Quelltext im Klartext im pck,
`werkzeuge/methoden_aus_pck.py` liest die Liste aus und rechnet die Nummern. Der Lauf
prueft sich selbst, indem er zusaetzlich den alten Stand rekonstruiert: dabei kommt
fuer `request_filtered_leaderboard` genau die 0x46 aus dem Mitschnitt vom 01.09.2026
heraus. Stimmt diese Probe, stimmen Liste und Sortierung.

**Am 21.09.2026 aus einem Mitschnitt des echten Clients bestaetigt:**

    Pfadanmeldung  byteweise identisch mit unserer, inklusive Pruefsumme
    0x65 (101)  request_upgrades            2 Argumente
    0x8b (139)  update_my_leaderboard_info  3 Argumente
    0x4b ( 75)  request_filtered_leaderboard 4 Argumente, dann je Seite
    0x45 ( 69)  request_arena_stats         2 Argumente

Zwei Korrekturen kamen dabei heraus. Erstens sendet der Client seine EIGENE
Pruefsumme, nicht die des Servers; beide melden `root_main/Main` an und schicken dabei
verschiedene Werte, weil ihre Methodenlisten verschieden sind. Zweitens ist der Vorlauf
`update_my_leaderboard_info` 0x8b und nicht `update_auto_config` 0x8a; die
Rueckrechnung ueber den alten Textauszug hatte sich hier um eins vertan, weil der Name
im alten Auszug fehlt und damit aus der rekonstruierten Liste fiel.

Die Pruefsumme ist der MD5 ueber die aneinandergehaengten sortierten Methodennamen.
Das ist gegen den Mitschnitt geprueft und macht sie herleitbar.

**Es reicht trotzdem nicht.** Mit allen drei Werten bleibt die Anfrage unbeantwortet.
Geprueft wurden vier Varianten, je in eigener Sitzung: kurze Form mit und ohne den
Vorlauf beim Bestenlistensystem, lange Form mit Pfad `root_main/Main` und mit
`root_main`. Keine liefert eine Seite, es kommen nur Sechsbytepakete zurueck.

Eine Beobachtung fuer den naechsten Anlauf: nach vier unbekannten Aufrufen in derselben
Sitzung antwortet der Server ueberhaupt nicht mehr. Wer Nummern durchprobiert, misst ab
dem fuenften Kandidaten nur noch sich selbst und braucht je Kandidat eine eigene Sitzung.

**Zweiter Mitschnitt, 21.09.2026, nur die Anmeldung.** Sie steht als
`login_request` 0x2b mit acht Argumenten auf Knoten 1, also genau unsere Nummer. Ein
Unterschied ist trotzdem da, im zweiten Argument, der Spielernummer: der Laeufer
kodiert sie kompakt in drei Byte (`42 67 7f`), der Client laenger; unser Paket ist 85,
seines 84 Byte. Das allein erklaert es aber nicht. Geprueft und beides ohne Erfolg:

1. Das aufgezeichnete Anmeldepaket WOERTLICH eingespielt, statt es zu bauen.
2. Die Reihenfolge des Clients uebernommen, also erst anmelden und den eigenen Knoten
   danach registrieren. Im zweiten Mitschnitt kommt vor der Anmeldung keine einzige
   Pfadanmeldung vor, der Client macht das spaeter.

**Was jetzt fehlt, ist ein VOLLSTAENDIGER Mitschnitt.** Der erste begann bei einem schon
angemeldeten Client, der zweite endete nach der Anmeldung. Gebraucht wird eine einzige
Aufnahme ueber die ganze Strecke: tcpdump starten, DANN den Client starten, anmelden,
Bestenliste oeffnen, blaettern, tcpdump beenden. Erst daraus laesst sich die komplette
Reihenfolge lesen, und genau an einer Reihenfolge hing es schon am 02.09.2026.

**Alte Notiz, erledigt:** Der Mitschnitt vom 21.09. begann bei einem bereits
angemeldeten Client, das Anmeldepaket ist also nicht darin. Unsere Anmeldung mit
`login_request` 0x2b bleibt unbeantwortet, und ohne sie beantwortet der Server auch
nichts danach. Die Nummer selbst ist auf demselben Weg hergeleitet wie die drei
bestaetigten, das Verdaechtige ist also eher die Argumentliste.

**Naechster Schritt ist ein zweiter Mitschnitt, diesmal MIT der Anmeldung:** tcpdump
starten, dann den Client frisch starten und einloggen, danach die Bestenliste oeffnen.

    sudo tcpdump -i any -s 0 -w ~/Downloads/opbounty-2.6.1.pcap \
      'udp and host 34.235.236.170'

Dann im Client die Bestenliste oeffnen, eine Seite blaettern, tcpdump beenden.
Auswertung mit `werkzeuge/pcap_enet.py`.

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
