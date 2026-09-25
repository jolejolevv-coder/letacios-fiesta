# Bestenliste taeglich per Mitschnitt auf dem Bazzite

Entwurf vom 25.09.2026, noch nicht freigegeben. Vorgeschichte in
`specs/features/bestenliste.md`, Abschnitt "OFFEN seit dem 09.09.2026" und
"Ergebnis der Beobachtung, 25.09.2026".

## Goal

Die Rangliste auf fiesta.nahobinoco.com wird jeden Tag ohne Zutun frisch, indem der
echte Spielclient auf dem Bazzite die Bestenliste abruft und ein Mitschnitt die Antwort
aufzeichnet, weil der eigene Laeufer seit dem Clientupdate 2.6.1 keine Antwort mehr
bekommt.

## Warum dieser Weg

Der Laeufer schickt byteweise dieselben Pakete wie der Client und bekam trotzdem an vier
Tagen in Folge keine Antwort, bei Ruhe auf dem Konto und passender Spielversion. Jede
bisherige Reparatur hielt nur bis zum naechsten Clientupdate. Der Mitschnitt hat am
01.09. und am 21.09.2026 jeweils eine vollstaendige Top 100 geliefert. Er haengt nicht am
Protokoll, weil das Spiel selbst spricht, sondern an der Oberflaeche des Spiels.

Tradeoff, bewusst eingegangen: statt Protokollwissen, das bei jedem Update bricht, eine
Klickautomatisierung, die bricht, wenn ein Update die Knoepfe verschiebt. Der zweite
Bruch ist sichtbar (Bildvergleich schlaegt fehl) und mit neuen Referenzbildern in
Minuten behoben, der erste hat jeweils Tage gekostet.

## Was schon da ist, am 25.09.2026 nachgesehen

* Spiel unter `~/Downloads/Builds_Linux/OPTCGSim_Data/StreamingAssets/OPBounty/linux/`
  (`OPBounty.x86_64`), Spielstand unter `~/.local/share/godot/app_userdata/OPBounty/`.
* Die Anmeldung ist in `uinf.tres` gespeichert, und zwar mit dem Zweitkonto, das auch
  der Laeufer nutzt. Gelesen wurde nur, dass die Felder gefuellt sind, nicht ihr Inhalt.
* Zuletzt gestartet am 02.09. mit Version 2.5.5. Das Spiel muss sich beim ersten Start
  auf 2.6.1 aktualisieren.
* Grafische Sitzung auf seat0 (X11, Autologin, siehe NoMachine Einrichtung), `xdotool`
  und `tcpdump` installiert, `tcpdump` per sudo ohne Passwort erlaubt.
* Checkout des Repos unter `~/opbounty-ladder/seite`, Remote per SSH mit dem Deploy Key
  des Servers (Schreibrecht).
* `bestenliste_lesen.py` wertet nur Pakete vom Server aus (`nur_server=True`).

## Scope

**In scope**

* Ein Skript `mitschnitt_server.sh` im Repo, das auf dem Bazzite laeuft: Mitschnitt
  starten, Spiel starten, Bestenliste oeffnen und blaettern, Spiel beenden, auswerten,
  Mitschnitt loeschen, verschluesselte Datei pushen.
* Bildvergleich vor jedem Klick gegen Referenzausschnitte, abgelegt im Repo.
* systemd Timer als Benutzerdienst, einmal am Tag.
* In der Action den Laeuferschritt abschalten, damit sich nicht zwei Anmeldungen mit
  demselben Konto in die Quere kommen. Die Wache bleibt.

**Out of scope**

* Weitere Arbeit am eigenen Laeufer. Er bleibt im Repo liegen, wird aber nicht mehr
  aufgerufen.
* Ranglisten ausser Western. Bereits vorhandene Filter der Seite bleiben unveraendert.
* Firestore als Quelle, am 21.09.2026 widerlegt.
* Irgendein Klick ausserhalb der Bestenliste: kein Match, keine Warteschlange, kein
  Shop, keine Einstellungen.

## Sicherheitsregeln, nicht verhandelbar

* **Kein Passwort im Mitschnitt.** tcpdump zeichnet nur Pakete vom Spielserver auf
  (Filter auf den Quellport des Servers). Die Anmeldung geht in die andere Richtung und
  landet damit gar nicht erst auf der Platte. Zusaetzlich: Mitschnitt in einem
  Verzeichnis mit Rechten 700, nach dem Auswerten sofort geloescht, auch im Fehlerfall.
* **Kein blinder Klick.** Vor jedem Klick muss der Bildschirmausschnitt der Referenz
  entsprechen. Weicht er ab, wird nicht geklickt, das Spiel beendet und der Lauf
  abgebrochen.
* **Keine Tastatureingabe ins Spiel,** nur Klicks auf gepruefte Stellen.
* **Nicht in eine laufende Nutzung hineinklicken.** Ist die Sitzung in den letzten
  Minuten benutzt worden (Maus oder Tastatur), wartet der Lauf oder faellt fuer den Tag
  aus.
* Nur die verschluesselte Datei geht ins Repo, wie bisher.

## Acceptance criteria

- [x] Ein Mitschnitt nur mit Serverpaketen liefert ueber `bestenliste_einbauen.py`
      100 Spieler mit den Raengen 1 bis 100. *(25.09.2026, Phase 1)*
- [x] Der Mitschnitt enthaelt das Kontopasswort nicht. *(25.09.2026, Phase 1)* Geprueft per Suche nach dem
      Passwort in der Datei, ohne es auszugeben.
- [x] Nach jedem Lauf, gelungen oder nicht, liegt keine pcap mehr auf dem Server.
- [x] Das Spiel aktualisiert sich selbst; angemeldet wird per Klick auf "Anmelden"
      mit dem gespeicherten Konto, Entscheidung des Nutzers vom 25.09.2026.
- [x] Jeder Klick ist durch einen Bildvergleich abgesichert. Ein Test mit
      absichtlich falschem Referenzbild bricht vor dem ersten Klick ab.
- [x] Laeuft das Spiel nach dem Lauf noch, wird es beendet. Kein Spielprozess bleibt
      zurueck.
- [x] Unter 90 frischen Spielern wird nichts gepusht, der alte Stand bleibt.
- [x] Ein gelungener Lauf pusht `public/bestenliste.json.gz.enc`, der Push loest die
      Action aus, und die Seite zeigt die Liste vom selben Tag.
- [ ] Drei Tage in Folge frische Rangliste ohne Eingriff, die Wache bleibt gruen.
- [x] Der Laeuferschritt ist aus der Action entfernt, der Rest der Action laeuft
      unveraendert.
- [x] Tests fuer Bildvergleich und Plausibilitaetspruefung laufen lokal gruen.
- [x] README und `specs/features/bestenliste.md` beschreiben den neuen Weg und wie man
      nach einem Clientupdate neue Referenzbilder aufnimmt.

## Implementation plan

**Phase 1, Probelauf unter Aufsicht.** Von Hand, Schritt fuer Schritt, mit dir per
NoMachine dabei. Spiel starten und pruefen, dass es sich anmeldet und auf 2.6.1
aktualisiert. Mitschnitt nur mit Serverpaketen aufnehmen, Bestenliste von Hand oeffnen
und blaettern, auswerten. Die beiden ersten Abnahmekriterien pruefen. Dabei die
Klickpositionen und Referenzausschnitte aufnehmen. Abbruchpunkt: liefert der Mitschnitt
nur mit Serverpaketen keine 100 Spieler, geht es nicht weiter, bevor wir neu
entschieden haben.

**Phase 2, Skript.** `mitschnitt_server.sh` mit Bildvergleich, Abbruchpfaden,
Aufraeumen per `trap`, Plausibilitaetspruefung und Push. Tests fuer Bildvergleich und
Plausibilitaet. Ein Lauf mit `--pruefen` (nichts pushen) unter Aufsicht, dann einer mit
Push.

**Phase 3, taeglicher Betrieb.** systemd Timer, Laeuferschritt aus der Action, Wache
mit Hinweis auf das Serverlog statt auf den Laeufer. Drei Tage beobachten, dann
Retrospektive in `specs/roadmap.md`.

## Ergebnis Phase 1, 25.09.2026

Probelauf von 15:05 bis 15:11, also rund sechs Minuten samt Update. Bestanden.

* **Mitschnitt:** Filter `udp and src port 4694`, 4484 Pakete, rund 490 KB. Der Leser
  findet fuenf Seiten, `bestenliste_einbauen.py` baut daraus 100 Spieler, Raenge 1 bis
  100 lueckenlos, kein Discordfeld. Rang 1 CrossLarper mit 5609,1, genau wie im Spiel
  angezeigt. Das Passwort steht nicht in der Datei, zweimal geprueft (nach der
  Anmeldung und am Ende). Die pcap ist geloescht.
* **Update:** Der Starter laedt die neue Spieldatei selbst, meldet "Download finished!
  Restarting..." und startet sich mit `--main-pack` neu. Danach steht 2.6.1 in der
  Maske. Der erste Prozess beendet sich dabei, das Skript muss also dem Neustart
  folgen und darf nicht auf die PID des Starters warten.
* **Nach dem Update kommen zwei Masken:** ein Update Hinweis mit Schliessen X und
  die Anmeldemaske mit gespeichertem Konto. "Anmelden" muss geklickt werden, das
  Passwort traegt das Spiel selbst ein. Der Nutzer hat am 25.09.2026 entschieden, dass
  dieser Klick automatisiert wird. Ob die Maske auch ohne Update kommt, ist offen: der
  Start vor dem Update meldete im Log "login suceeded!" von allein. Das Skript muss
  deshalb beide Wege erkennen.
* **Fenster:** Im Menue ist das Spielfenster nur 225 Pixel breit und laesst sich nicht
  vergroessern. `xdotool windowstate --add FULLSCREEN` nimmt der Fenstermanager an,
  das Spiel zeichnet aber weiter in seiner Groesse oben links. Das reicht, weil die
  Koordinaten dann ab Bildschirmecke gelten. Beim Oeffnen der Bestenliste waechst das
  Fenster von selbst auf 1920 x 1006. Das Skript setzt das Fenster deshalb vor dem
  ersten Klick fest nach oben links.
* **Klickstellen**, Bildschirmkoordinaten bei Fenster oben links, Referenzausschnitte in
  `~/mitschnitt/referenz/` auf dem Server: Hinweis schliessen (201, 53), Anmelden
  (61, 292), Bestenlisten (55, 533), Next Page (1808, 918), viermal mit vier Sekunden
  Pause. Achtung: 65 Pixel unter "Bestenlisten" liegt "Play Standard", unter
  "Anmelden" liegen die Discord und Patreon Knoepfe.
* **Falle:** `pgrep -f` oder `pkill -f` mit dem Spielnamen trifft auch die eigene Shell,
  deren Befehlszeile denselben Text enthaelt. Im Probelauf hat das die SSH Sitzung
  beendet. Im Skript nur ueber gespeicherte PIDs beenden. tcpdump wird ueber die PID
  des sudo Prozesses mit SIGINT gestoppt.
* Bildvergleich: ImageMagick (`import`) und Pillow sind auf dem Bazzite vorhanden,
  nichts nachzuinstallieren. `xprintidle` fehlt; fuer die Leerlauferkennung braucht
  Phase 2 einen anderen Weg.

Retrospektive Phase 1. Gut lief, zuerst das wichtigste Kriterium (Passwort) zu pruefen,
bevor irgendetwas geklickt wurde. Falsch angenommen hatte ich, dass das Spiel sich nach
dem Start selbst anmeldet; nach einem Update tut es das nicht. Besser spezifizieren:
den Zustand nach einem Update als eigenen Fall, nicht als Randnotiz.

## Ergebnis Phase 2, 25.09.2026

`mitschnitt_server.sh`, `werkzeuge/bildschirm.py`, `werkzeuge/plausibel.py`,
`werkzeuge/klickstellen.json`, `werkzeuge/referenz/`, 18 Tests in `tests/`. Fuenf
Prueflaeufe, der fuenfte ging durch, danach ein Lauf mit Push (Commit `fb533d3`). Jeder
der vier Fehlschlaege hat nichts angeklickt, was er nicht erkannt hat, und danach
aufgeraeumt: kein Spielprozess, keine pcap.

Was die Fehlschlaege gezeigt haben, jeweils im Skript behoben und kommentiert:

1. **Zwei Fenster namens OPBounty.** Der Starter laesst sein Fenster mit "Suche nach
   Updates..." stehen. Das Skript nahm das erste und wartete dort fuenf Minuten. Jetzt
   wird jedes Fenster geprueft.
2. **`import -window <id>` hing zwoelf Minuten** und blockierte dabei jeden anderen
   X Aufruf. Jetzt: ganzer Bildschirm, auf das Fenster zugeschnitten, und jeder X Aufruf
   hat eine Zeitgrenze von 15 Sekunden.
3. **Das Spiel verkleinert sein Fenster selbst**, fuer den Update Hinweis auf 225 x 421,
   und dann fehlt dessen Kopfzeile mit dem X. Jetzt wird Vollbild neu erzwungen
   (entfernen, dann setzen), sobald ein Fenster keinen bekannten Knopf zeigt. Hinweis
   des Nutzers: nach jedem Update muss der Hinweis weggeklickt werden.
4. **"Next Page" behaelt nach dem Klick den Fokus** und wird heller, Abweichung 32,4.
   Jetzt gibt es Varianten je Stelle, hier `naechste_seite__fokus.png`.

Am selben Nachmittag kam das Clientupdate 2.6.2 (Mihawk Bann Queue). Es hat an den
Klickstellen nichts verschoben, der Weg hat das Update also schon einmal ueberstanden.

Das Seitenpasswort liegt wieder als `~/.fiesta_passwort` (600) auf dem Server, sonst
entsteht keine verschluesselte Fassung.

Retrospektive Phase 2. Gut lief, dass jeder Fehlschlag in die sichere Richtung ging und
das letzte Foto die Ursache sofort zeigte. Falsch angenommen hatte ich, dass es genau
ein Spielfenster gibt und dass ein Fensterfoto so zuverlaessig ist wie ein
Bildschirmfoto; im Probelauf hatte ich nur den ganzen Bildschirm fotografiert. Besser
spezifizieren: im Probelauf dieselben Werkzeuge benutzen, die das Skript spaeter nimmt.

## Stand Phase 3, 25.09.2026

`mitschnitt.service` und `mitschnitt.timer` liegen im Repo und sind auf dem Bazzite
eingerichtet (`~/.config/systemd/user/`, Linger an). Erster Lauf 26.09.2026, 05:30 UTC.
Ein Prueflauf in der Umgebung eines systemd Benutzerdienstes (`systemd-run --user`)
ging durch, 1 Minute 39 Sekunden. `sudo -n tcpdump` und die Anzeige funktionieren dort
also auch ohne Terminal. Der Laeuferschritt ist aus der Action, die Wache misst in
Stunden (Grenze 30) und verweist auf das Serverlog.

Offen fuer den Abschluss: drei Tage in Folge frische Liste ohne Eingriff, danach die
Retrospektive. Pruefen per `systemctl --user list-timers mitschnitt.timer` und
`journalctl --user -u mitschnitt.service` auf dem Bazzite oder an der Wache der Action.

## Open questions

- ~~**Uhrzeit.**~~ **Entschieden am 25.09.2026:** passend zum GitHub Lauf. Die Action
  steht auf 06:20 UTC, der Timer deshalb fest auf **05:30 UTC**
  (`OnCalendar=*-*-* 05:30:00 UTC`), im Sommer 07:30, im Winter 06:30 Ortszeit. In
  UTC statt Ortszeit, weil ein Timer auf 07:30 Ortszeit im Winter erst um 06:30 UTC
  liefe, also nach der Action. Der Push des Servers loest die Action ohnehin selbst aus,
  die Seite ist also schon vor dem geplanten Lauf frisch. Das ist auch noetig: GitHub
  startet den geplanten Lauf meist Stunden zu spaet, zuletzt zwischen 11:42 und 11:54
  UTC statt 06:20. Der geplante Lauf ist damit nur noch das Netz, falls der Server
  ausfaellt.
- ~~**Ein Fehlschlag am Tag.**~~ **Entschieden am 25.09.2026:** nachfassen. Der Timer
  startet auch um 06:30 UTC; eine Tagesmarke `~/mitschnitt/erledigt_<datum>` sorgt dafuer,
  dass der zweite Termin nichts tut, wenn der erste geklappt hat.
- **Update Dialog.** Unklar, ob das Spiel beim Update einen Hinweis zeigt, der
  weggeklickt werden muss (`seen_update_notice_v` steht auf 2.5.5). Klaert Phase 1.
- **Bildvergleich.** Welches Werkzeug auf dem Bazzite vorhanden ist (ImageMagick,
  Python mit Pillow), klaert Phase 1. Keine neue Installation ohne deine Freigabe.
- ~~**Blaettern.**~~ **Entschieden am 25.09.2026:** Top 100 reicht, also fuenf Seiten.
