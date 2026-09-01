# Letacios Fiesta

Ladderstatistiken aus OPBounty als eigene Seite. Decklisten und Matchups je Leader, mit
Filtern und dem Sitzsplit, den OPBounty selbst nicht anzeigt. Zeitraeume sind tagesgenau
waehlbar, nicht nur die fertigen Saetze des Clients.

Die Oberflaeche ist englisch, der Code und diese Anleitung sind deutsch.

## Aufbau

    index.html          Einstieg fuer den Build
    src/                React Quelltext
      App.jsx           die ganze Oberflaeche
      daten.js          Laden, Entpacken, Zusammenfuehren
      Sombrero.jsx      die Marke
      index.css         Tailwind und die Farbvariablen
    public/             Daten und Bilder, wandern beim Build nach dist/
      verzeichnis.json.gz   was es an Saetzen und Tagen gibt
      saetze/               die sechs fertigen Saetze des Clients
      tage/                 je Tag, Modus und Bountybereich eine Datei
      img/                  rund 2200 Kartenbilder, je 120 Pixel breit
    aktualisieren.py    holt und baut alles unter public/
    dist/               das fertige Ergebnis, das laedt die Action nach Pages

Stack: React 18, Tailwind 4, GSAP, gebaut mit Vite.

## Woher die Daten kommen

Nicht aus Firestore. Der OPBounty Client laedt sie von einem oeffentlichen CDN, der Pfad
steht im Spielpaket im Klartext:

    https://d2spmnr3w7rm2f.cloudfront.net/stats/regular/timestamps.json   Index der Saetze
    https://d2spmnr3w7rm2f.cloudfront.net/stats/regular/<datei>           die Saetze
    https://d2spmnr3w7rm2f.cloudfront.net/stats/files.json                Index der Tage
    https://d2spmnr3w7rm2f.cloudfront.net/stats/raw/<datum>/mode_<n>/<bounty>/statsNNNN.json

Jede Datei ist base64 verpacktes gzip mit JSON darin. Ein Tag besteht aus mehreren
Teildateien, die zusammengefuehrt werden muessen; genau das macht der Client in
`merge_statlists`.

Das CDN sendet **keinen** `Access-Control-Allow-Origin` Kopf. Ein Browser darf es also
nicht direkt abfragen, auch nicht von deiner Domain. Deshalb holt `aktualisieren.py` alles
serverseitig.

## Bauen

```bash
npm install
python3 aktualisieren.py --tage 30 --bilder
npm run build
```

Danach liegt alles in `dist/`, rund 30 MB, davon 21 MB Bilder und Tagesdaten.

`--bilder` nimmt die Bilder aus einer lokalen OPTCGSim Installation, wenn eine da ist,
und holt den Rest von der offiziellen Kartenseite. In der Action gibt es keine
Installation, dort kommt alles von der Kartenseite; der erste Lauf dauert deshalb rund
eine halbe Stunde, jeder weitere Sekunden.

Je Karte entsteht ein Bild, 120 Pixel breit; im Raster sind sie 46 bis 54 breit, das
deckt auch hohe Bildschirmdichten. Die Kartenseite liefert im Mittel 189 KB je Bild, ein
voller Decklistenreiter waere damit ueber 80 MB gewesen.

## Veroeffentlichen

Die Seite laeuft unter **https://fiesta.nahobinoco.com** auf GitHub Pages. Es ist nichts
zu betreiben: die Action holt taeglich selbst die Daten, baut und veroeffentlicht. Weder
ein Mac noch ein Homeserver muss dafuer laufen.

    .github/workflows/veroeffentlichen.yml
      schedule           taeglich 06:20 UTC
      push auf main      bei jeder Aenderung
      workflow_dispatch  von Hand

Der Lauf holt die Statistiken vom CDN, ergaenzt fehlende Kartenbilder, verschluesselt die
Daten und schiebt das Ergebnis nach Pages. Mit warmem Zwischenspeicher dauert er ein bis
zwei Minuten.

### Was im Repo liegt

Nur Quelltext, 17 Dateien. Keine Statistiken, keine Kartenbilder. Beides haelt die Action
in ihrem Zwischenspeicher, siehe `.gitignore`. Faellt der aus, holt der naechste Lauf
alles neu; das dauert dann rund eine halbe Stunde und heilt sich selbst.

### Passwort

Die Datendateien werden beim Bauen mit AES-256-GCM verschluesselt, der Schluessel kommt
aus PBKDF2 ueber das Passwort. Es liegt als Repository Secret `SEITEN_PASSWORT` und in
keiner Datei. Ohne Passwort laedt die Huelle, aber es gibt nichts zu sehen; die
unverschluesselten Dateien liegen gar nicht erst auf dem Server.

Passwort aendern: das Secret unter Settings, Secrets and variables, Actions ersetzen und
den Workflow einmal von Hand ausloesen. Beim naechsten Aufruf fragt die Seite neu.

Die Kartenbilder bleiben unverschluesselt. Es sind oeffentliche Kartenscans ohne Aussage.

### Einmalig eingerichtet, zum Nachschlagen

    Repo         jolejolevv-coder/letacios-fiesta, oeffentlich
    Pages        Source auf "GitHub Actions"
    Domain       ueber die Pages API gesetzt, nicht ueber eine CNAME Datei im Artefakt
                 (die greift nur beim Bauen aus einem Branch, nicht ueber Actions)
    DNS          CNAME fiesta -> jolejolevv-coder.github.io, bei CLOUDFLARE, nicht bei
                 Namecheap, und auf "DNS only" statt Proxied

### Ein Cron auf einem eigenen Server waere jetzt falsch

Ein frueherer Entwurf liess den Homeserver die Daten holen und pushen. Das ist ersetzt.
Zwei Gruende, warum es nicht mehr passt: das Repo verfolgt die Daten nicht mehr, ein Push
wuerde also nichts mitnehmen, und zwei Schreiber auf denselben Dateien waeren ein
Konflikt ohne Gewinn.

## Filterachsen

    Datum     2024-07-01 bis heute, tagesgenau
    Modus     mode_0 Western, mode_1 Webcam, mode_2 Eastern, mode_3 Arena
    Bounty    25_1000, 1000_2000, 2000_3000, 3000

Vollstaendig ist nur Western. Bei Eastern und Webcam gibt es zuletzt nur `25_1000`, bei
Arena nichts. Und der Bereich `3000` ist praktisch leer, dort liegen zwei bis acht Partien
am Tag; die Masse spielt in `25_1000`.

## Drei Fallstricke, die schon zugeschlagen haben

**Die Partienzahl je Gegner steht in `presence`, nicht in `subject_matches`.** Letzteres ist
leer, obwohl der Name das Gegenteil verspricht. Gegenprobe an OP17-039 gegen OP14-020:
2586 Siege auf 9678 Partien sind 26,7 Prozent, und genau das zeigt der Client.

**Der Bilderkopierer muss ueber die abgelegten Dateien laufen, nicht ueber die eben
geladenen Saetze.** Die Tagesdateien nennen 2187 Karten, die fertigen Saetze nur 800. Wer
nur ueber letztere geht, laesst zwei Drittel der Bilder fehlen.

**Der Sitz ist nicht bei jeder Partie erfasst.** Bei OP14-020 stehen 107.846 Partien
insgesamt, aber nur 73.758 mit bekanntem Sitz. Die Prozentzahlen fuer Going first und
Going second rechnen deshalb auf ihrer eigenen, kleineren Grundgesamtheit.

## Fehlende Bilder

Vier Karten haben nirgends ein Bild, weil ihre Sets neuer sind als der Punk Records
Datensatz: EB05-016, OP18-021, OP18-031 und OP18-078. Die Seite zeigt dort statt eines
kaputten Symbols die Kartennummer. Sobald Punk Records nachzieht, holt der naechste Lauf
sie von selbst.

Kennungen mit vorangestelltem X, etwa `XOP12-040`, meinen dieselbe Karte wie ohne. Fuer die
Anzeige wird das X abgestreift, in den Daten bleibt es stehen.
