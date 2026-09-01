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
      img/                  rund 2200 Kartenbilder
    aktualisieren.py    holt und baut alles unter public/
    dist/               das fertige Ergebnis, nur dieses kommt auf den Server

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
und holt den Rest von der offiziellen Kartenseite. Auf einem Server ohne Spiel laeuft es
also genauso, der erste Lauf dauert dann nur laenger.

## Veroeffentlichen

Aufteilung: **der Homeserver frischt die Daten auf, GitHub Pages liefert aus.** Damit muss
der Mac nie laufen, und wenn der Server aus ist, bleibt der letzte Stand online.

    Homeserver, taeglich   server-aktualisieren.sh  ->  git push
    GitHub Action          baut bei jedem Push      ->  GitHub Pages

### Einmalig bei GitHub

1. Repo anlegen, den Ordner hineinschieben, Branch `main`.
2. Settings, Pages, Source auf "GitHub Actions" stellen.
3. Fuer die eigene Domain `public/CNAME` mit dem Hostnamen anlegen, etwa
   `ladder.nahobinoco.com`, und bei Namecheap einen CNAME auf `<benutzer>.github.io`
   zeigen lassen.

### Einmalig auf dem Server

```bash
ssh <benutzer>@<serverip>
ssh-keygen -t ed25519 -C "fiesta-server" -f ~/.ssh/fiesta -N ""
cat ~/.ssh/fiesta.pub
```

Den Schluessel im Repo unter Settings, Deploy keys eintragen, **mit Schreibrecht**. Dann:

```bash
printf 'Host github.com\n  IdentityFile ~/.ssh/fiesta\n' >> ~/.ssh/config
git clone git@github.com:<benutzer>/letacios-fiesta.git ~/letacios-fiesta
cd ~/letacios-fiesta && ./server-aktualisieren.sh
```

Der erste Lauf holt rund 2200 Kartenbilder von der offiziellen Kartenseite und dauert
entsprechend. Danach kommen nur noch neue dazu.

### Zeitplan auf dem Server

```
crontab -e
```

```
23 6 * * * cd $HOME/letacios-fiesta && ./server-aktualisieren.sh >> aktualisieren.log 2>&1
```

Das Skript bricht ab, wenn sich nichts geaendert hat, es gibt also keine leeren Commits.

### Ohne Server

Geht auch: in `.github/workflows/veroeffentlichen.yml` den auskommentierten Schritt
"Daten holen" aktivieren und einen `schedule` ergaenzen. Dann darf der Server aber nicht
mehr pushen, sonst schreiben zwei Stellen dieselben Dateien.

### Was im Repo liegt

Die Daten unter `public/` werden mitversioniert, weil der Server sie dorthin schiebt. Das
sind rund 21 MB Kartenbilder einmalig und etwa 250 KB je Tag, der dazukommt. Tage ausserhalb
des Fensters raeumt das Skript selbst weg.

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
