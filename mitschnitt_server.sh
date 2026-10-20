#!/usr/bin/env bash
#
# Die Bestenliste per Mitschnitt holen und ins Repo legen. Laeuft taeglich auf dem
# Bazzite, siehe specs/features/bestenliste-mitschnitt.md.
#
# Der echte Spielclient ruft die Bestenliste ab, das Skript fotografiert jede Seite, und
# bestenliste_einbauen.py --fotos liest sie ab. Bis 2.6.9 hoerte hier tcpdump mit; seit
# OPBounty 2.7 (19.10.2026) kommt die Liste per TLS, siehe den Nachtrag vom 20.10.2026 in
# specs/features/bestenliste-mitschnitt.md.
#
#     ./mitschnitt_server.sh            # holen, auswerten, pruefen, pushen
#     ./mitschnitt_server.sh --pruefen  # dasselbe, aber nichts pushen
#
# Gestartet wird es von mitschnitt.timer, um 05:30 und zum Nachfassen um 06:30 UTC.
#
# Sicherheitsregeln, im Code unten jeweils an ihrer Stelle:
#   * Fotografiert wird nur die geoeffnete Bestenliste, nie die Anmeldemaske.
#   * Kein blinder Klick. Vor jedem Klick muss das Bildschirmfoto dem Referenzbild
#     der Klickstelle entsprechen (werkzeuge/bildschirm.py), sonst Abbruch.
#   * Keine Tastatureingabe ins Spiel.
#   * Wird die Sitzung gerade benutzt oder laeuft das Spiel schon, faellt der Lauf aus.
#   * Die Fotos bleiben nur bis zum naechsten Lauf in ~/mitschnitt/lauf (Rechte 700).
#   * Nur die verschluesselte Fassung geht ins Repo.
#
set -uo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WERKZEUGE="$HIER/werkzeuge"
# Seit dem 19.10.2026 der eigenstaendige Linux Client (OPBounty_Linux.zip, vom Nutzer geladen).
# Der eingebettete aus dem OPTCGSim Build zeigt seit 2.7 "Please update your SIM to v1.44a".
SPIEL_DIR="${OPBOUNTY_SPIEL:-$HOME/Downloads/OPBounty_Linux}"
SPIEL_NAME="OPBounty.x86_64"
# Das Paket neben dem eigenstaendigen Client. Die alte Adresse, von der spieldatei.py lud, gibt
# seit dem 19.10.2026 HTTP 403; neue Versionen kommen als Zip vom Nutzer.
SPIELPAKET="${OPBOUNTY_PAKET:-$SPIEL_DIR/OPBounty.pck}"
ARBEIT="$HOME/mitschnitt/lauf"
# Der Timer startet zweimal am Tag, der zweite Termin ist das Nachfassen. Gelingt der
# erste, legt er diese Marke an, und der zweite endet sofort.
ERLEDIGT="$HOME/mitschnitt/erledigt_$(date -u +%F)"
FOTO="$ARBEIT/foto.png"

START_FRIST=300           # Sekunden vom Start bis zur offenen Bestenliste; das Update
                          # samt Neustart dauerte im Probelauf rund eine Minute
SEITEN=5                  # Top 100, 20 Spieler je Seite
BLAETTER_PAUSE=4          # Sekunden je Seite, im Probelauf ausreichend
NACHLADE_PAUSE=5          # nach einem Klick, bis die naechste Maske steht
MAX_KLICKS_JE_STELLE=2    # nie oefter auf dieselbe Maske klicken, etwa beim Anmelden
START_WARTEN=35           # Sekunden nach dem Start, bis der Update Hinweis von selbst weg ist
FENSTER_ABLAGE_X=600      # wohin das Menuefenster verschoben wird, damit es Klicks annimmt
FENSTER_ABLAGE_Y=200
LEERLAUF_SEKUNDEN=30      # so lange darf sich die Maus vor dem Start nicht bewegen
# Hierhin wird die Maus vor jedem Foto geschoben, damit kein Knopf im Hover steht.
# Rechts am Rand liegt in keiner der Masken ein Knopf.
MAUS_PARK_X=1850
MAUS_PARK_Y=600
# Die 20. Zeile jeder Seite steht unter dem Rand der Liste. Mit dem Mausrad ueber der Liste
# (kein Klick) rueckt sie ins Bild; danach ein zweites Foto, seite_N_b.png.
LISTE_X=960
LISTE_Y=500
RAD_SCHRITTE=5

NUR_PRUEFEN=0
NUR_FOTOS=0               # nur die Seiten fotografieren, ohne Pull, Auswertung und Push
[ "${1:-}" = "--pruefen" ] && NUR_PRUEFEN=1
[ "${1:-}" = "--nur-fotos" ] && NUR_FOTOS=1 && NUR_PRUEFEN=1

EINGESCHALTET=""          # Ausgang, den das Skript selbst eingeschaltet hat

X_FRIST=15                # Sekunden fuer jeden einzelnen X-Aufruf, siehe x_aufruf

sagen() { printf '  %s\n' "$*"; }

# Jeder Aufruf an den X-Server bekommt eine Zeitgrenze. Am 25.09.2026 hing ein
# `import -window` zwoelf Minuten lang, und solange er hing, blockierte er auch jeden
# anderen X-Aufruf. Ohne Grenze haette der Lauf nie geendet und das Spiel nie beendet.
x_aufruf() { timeout "$X_FRIST" "$@"; }
abbrechen() { echo "ABBRUCH: $*" >&2; exit 1; }

# --- Aufraeumen, laeuft bei jedem Ende ------------------------------------------

spiel_beenden() {
  # pgrep -x vergleicht den Prozessnamen, nicht die Befehlszeile. Mit -f traefe es
  # auch die eigene Shell, deren Befehlszeile den Spielnamen enthaelt; genau das hat
  # im Probelauf die SSH Sitzung beendet.
  local pids
  pids="$(pgrep -x "$SPIEL_NAME" || true)"
  [ -z "$pids" ] && return 0
  kill $pids 2>/dev/null
  for _ in 1 2 3 4 5 6 7 8 9 10; do
    pgrep -x "$SPIEL_NAME" >/dev/null || return 0
    sleep 1
  done
  kill -9 $(pgrep -x "$SPIEL_NAME") 2>/dev/null
}

bildschirm_zuruecksetzen() {
  # Nur einen Ausgang wieder abschalten, den dieses Skript selbst eingeschaltet hat.
  [ -z "$EINGESCHALTET" ] && return 0
  x_aufruf xrandr --output "$EINGESCHALTET" --off 2>/dev/null
  EINGESCHALTET=""
}

aufraeumen() {
  spiel_beenden
  bildschirm_zuruecksetzen
}
trap aufraeumen EXIT

# --- Vorbedingungen ---------------------------------------------------------

anzeige_finden() {
  export DISPLAY="${DISPLAY:-:0}"
  if [ -z "${XAUTHORITY:-}" ]; then
    XAUTHORITY="$(ls -t /run/user/"$(id -u)"/xauth_* 2>/dev/null | head -1)"
    export XAUTHORITY
  fi
  x_aufruf xdotool getdisplaygeometry >/dev/null 2>&1 || abbrechen "keine grafische Sitzung auf $DISPLAY"
}

bildschirm_sicherstellen() {
  # Ist der Laptopdeckel zu, schaltet KDE den eingebauten Bildschirm ab, und X meldet
  # keinen einzigen Monitor. Das Spiel sieht dann "screen_count = 0", oeffnet ein
  # 64 x 64 Fenster und bleibt schwarz; so ab dem Neustart am 27.09.2026. Dann den
  # ersten angeschlossenen Ausgang einschalten, fuer die Dauer des Laufs. Das Panel
  # leuchtet hinter dem geschlossenen Deckel, aufraeumen schaltet es wieder ab.
  local monitore ausgang
  monitore="$(x_aufruf xrandr --listmonitors 2>/dev/null | head -1)"
  [ "$monitore" != "Monitors: 0" ] && return 0
  ausgang="$(x_aufruf xrandr --query 2>/dev/null | awk '$2 == "connected" {print $1; exit}')"
  [ -n "$ausgang" ] || abbrechen "kein Monitor aktiv und kein Ausgang angeschlossen"
  sagen "Kein Monitor aktiv, schalte $ausgang ein"
  x_aufruf xrandr --output "$ausgang" --auto || abbrechen "$ausgang laesst sich nicht einschalten"
  EINGESCHALTET="$ausgang"
  sleep 3
  monitore="$(x_aufruf xrandr --listmonitors 2>/dev/null | head -1)"
  [ "$monitore" != "Monitors: 0" ] || abbrechen "$ausgang ist eingeschaltet, X meldet trotzdem keinen Monitor"
}

sitzung_ist_frei() {
  if pgrep -x "$SPIEL_NAME" >/dev/null; then
    sagen "Das Spiel laeuft schon, vermutlich spielt gerade jemand. Heute kein Lauf."
    return 1
  fi
  local vorher nachher
  vorher="$(x_aufruf xdotool getmouselocation 2>/dev/null)"
  sleep "$LEERLAUF_SEKUNDEN"
  nachher="$(x_aufruf xdotool getmouselocation 2>/dev/null)"
  if [ "$vorher" != "$nachher" ]; then
    sagen "Die Maus hat sich bewegt, die Sitzung wird benutzt. Heute kein Lauf."
    return 1
  fi
}

# --- Bausteine --------------------------------------------------------------

fenster_liste() {
  # Alle sichtbaren Spielfenster. Es koennen zwei sein: der Starter laesst sein Fenster
  # mit "Suche nach Updates..." stehen, waehrend das eigentliche Spiel schon laeuft. Im
  # ersten Prueflauf am 25.09.2026 hat das Skript genau dieses Starterfenster
  # fotografiert und fuenf Minuten auf einen Knopf gewartet, den es dort nie gibt.
  # Deshalb wird jedes Fenster geprueft, nicht das erste genommen. Der Name ist genau
  # "OPBounty"; ohne die Anker traefe die Suche auch einen Dateimanager mit
  # "opbounty" im Titel.
  x_aufruf xdotool search --onlyvisible --name '^OPBounty$' 2>/dev/null
}

foto_machen() {
  # Fotografiert wird der ganze Bildschirm, zugeschnitten auf das Fenster. Das Foto
  # eines einzelnen Fensters (`import -window <id>`) hing am 25.09.2026, als das
  # Fenster gerade auf Vollbild wechselte; der ganze Bildschirm ging im Probelauf
  # jedes Mal. getwindowgeometry liefert die Lage des Fensterinhalts ohne Rahmen,
  # dieselben Koordinaten, in denen die Klickstellen stehen.
  local X Y WIDTH HEIGHT WINDOW SCREEN
  eval "$(x_aufruf xdotool getwindowgeometry --shell "$1" 2>/dev/null)" || return 1
  [ -n "${WIDTH:-}" ] || return 1
  x_aufruf xdotool mousemove "$MAUS_PARK_X" "$MAUS_PARK_Y"
  sleep 1
  x_aufruf import -window root -crop "${WIDTH}x${HEIGHT}+${X}+${Y}" +repage "$FOTO" 2>/dev/null
}

klicken() {
  local fenster="$1" stelle="$2" x y
  read -r x y < <(python3 "$WERKZEUGE/bildschirm.py" klick "$stelle")
  sagen "Klick auf $stelle ($x, $y im Fenster)"
  x_aufruf xdotool mousemove --window "$fenster" "$x" "$y" click 1
}

# --- Ablauf -----------------------------------------------------------------

mkdir -p "$ARBEIT" && chmod 700 "$HOME/mitschnitt" "$ARBEIT"
cd "$HIER" || abbrechen "Verzeichnis $HIER fehlt"
[ -x "$SPIEL_DIR/$SPIEL_NAME" ] || abbrechen "Spiel nicht gefunden unter $SPIEL_DIR"

if [ "$NUR_PRUEFEN" = 0 ] && [ -e "$ERLEDIGT" ]; then
  sagen "Heute schon erledigt, nichts zu tun."
  exit 0
fi

anzeige_finden
sitzung_ist_frei || exit 0

# Erst den Stand holen, damit der Push spaeter nicht an einem neueren Commit der
# Action scheitert. Geht das nicht, wird gar nicht erst mitgeschnitten.
if [ "$NUR_FOTOS" = 0 ]; then
  git pull -q --ff-only || abbrechen "git pull ging nicht, der Checkout hat eigene Aenderungen"
fi

# Die Spieldatei selbst laden, bevor der Starter es mit 50 KB/s versucht; siehe
# werkzeuge/spieldatei.py. Ohne aktuelle Datei scheitert der Lauf ohnehin.
python3 "$WERKZEUGE/spieldatei.py" || sagen "Spieldatei nicht nachgezogen, nehme $SPIELPAKET"

bildschirm_sicherstellen

sagen "Spiel starten"
# Direkt mit dem Spielpaket starten. Bis 2.6.9 startete das Programm erst sein eigenes
# Startpaket von 2024, und das startete sich mit --main-pack neu; seit dem Update vom 19.10.2026
# bleibt dieses Startpaket bei "Retrying connection..." haengen. spieldatei.py hat das Paket
# ohnehin schon geladen, und --main-pack ist genau der Aufruf, den das Startpaket selbst macht.
( cd "$SPIEL_DIR" && nohup "./$SPIEL_NAME" --main-pack "$SPIELPAKET" > "$ARBEIT/spiel.log" 2>&1 & )

# Welche Maske zeigt eines der Spielfenster? Setzt FENSTER und STELLE, oder laesst
# STELLE leer, wenn keines einen bekannten Knopf zeigt.
maske_erkennen() {
  FENSTER="" STELLE=""
  local w
  for w in $(fenster_liste); do
    if knopf_im_fenster "$w"; then return 0; fi
    # Seit 2.7 nimmt das kleine Menuefenster Klicks erst an, wenn es einmal verschoben wurde;
    # danach steht es auch wieder im alten Aufbau (Bestenlisten bei 55, 505). Hinweis des
    # Nutzers am 19.10.2026, am selben Abend nachgemessen.
    x_aufruf xdotool windowmove "$w" "$FENSTER_ABLAGE_X" "$FENSTER_ABLAGE_Y" 2>/dev/null
    sleep 2
    if knopf_im_fenster "$w"; then return 0; fi
    # Nichts erkannt: Vollbild neu erzwingen und noch einmal schauen. Das Spiel
    # verkleinert sein Fenster selbst, etwa fuer den Update Hinweis auf 225 x 421, und
    # dann ist dessen Kopfzeile mit dem X abgeschnitten. Im Vollbild zeichnet es oben
    # links, und das X liegt an der Stelle aus dem Probelauf. Ein einfaches --add
    # wirkt nicht, wenn der Fenstermanager den Zustand noch fuer gesetzt haelt,
    # deshalb erst entfernen. Geprueft am 25.09.2026 mit dem Hinweis zu 2.6.2.
    x_aufruf xdotool windowstate --remove FULLSCREEN "$w" 2>/dev/null
    sleep 1
    x_aufruf xdotool windowstate --add FULLSCREEN "$w" 2>/dev/null
    sleep 3
    if knopf_im_fenster "$w"; then return 0; fi
  done
  STELLE=""
}

# Zeigt dieses Fenster einen bekannten Knopf? Setzt dann FENSTER und STELLE.
knopf_im_fenster() {
  foto_machen "$1" || return 1
  STELLE="$(python3 "$WERKZEUGE/bildschirm.py" finde "$FOTO" \
            naechste_seite bestenlisten anmelden hinweis_schliessen)" || return 1
  FENSTER="$1"
}

# Seit 2.7.0 (19.10.2026) zeigt das Spiel nach dem Start rund 20 Sekunden lang seinen Update
# Hinweis und baut dann selbst auf die Anmeldung um. Waehrend dieses Umbaus das Fenster nicht
# anfassen: ein Umschalten auf Vollbild mitten darin liess es zweimal mit einem
# Speicherzugriffsfehler abstuerzen. Deshalb erst warten, dann wie gewohnt erkennen.
sleep "$START_WARTEN"

declare -A KLICKS=()
OFFEN=0
FRIST=$((SECONDS + START_FRIST))
while [ "$SECONDS" -lt "$FRIST" ]; do
  maske_erkennen
  case "$STELLE" in
    naechste_seite)
      OFFEN=1; break ;;
    hinweis_schliessen)
      # Seit 2.7.0 (19.10.2026) hat der Update Hinweis kein X mehr; er verschwindet nach
      # rund 20 Sekunden von selbst. An der alten Stelle des X liegt jetzt eine Lupe, ein Klick
      # dort wuerde die Oberflaeche verkleinern. Also nur warten, die Frist gilt weiter.
      sleep "$NACHLADE_PAUSE" ;;
    bestenlisten|anmelden)
      KLICKS[$STELLE]=$(( ${KLICKS[$STELLE]:-0} + 1 ))
      [ "${KLICKS[$STELLE]}" -gt "$MAX_KLICKS_JE_STELLE" ] && \
        abbrechen "$STELLE bleibt nach $MAX_KLICKS_JE_STELLE Klicks stehen"
      klicken "$FENSTER" "$STELLE"
      sleep "$NACHLADE_PAUSE" ;;
    *)
      sleep 3 ;;
  esac
done
if [ "$OFFEN" != 1 ]; then
  cp -f "$FOTO" "$ARBEIT/letztes_foto.png" 2>/dev/null
  abbrechen "Bestenliste nach $START_FRIST Sekunden nicht offen, letztes Foto in $ARBEIT"
fi

sagen "Bestenliste offen, fotografieren und blaettern"
rm -f "$ARBEIT"/seite_*.png
for ((seite = 1; seite <= SEITEN; seite++)); do
  foto_machen "$FENSTER" || abbrechen "Foto von Seite $seite misslungen"
  cp -f "$FOTO" "$ARBEIT/seite_$seite.png"
  x_aufruf xdotool mousemove --window "$FENSTER" "$LISTE_X" "$LISTE_Y"
  x_aufruf xdotool click --repeat "$RAD_SCHRITTE" 5
  sleep 1
  foto_machen "$FENSTER" && cp -f "$FOTO" "$ARBEIT/seite_${seite}_b.png"
  x_aufruf xdotool mousemove --window "$FENSTER" "$LISTE_X" "$LISTE_Y"
  x_aufruf xdotool click --repeat "$RAD_SCHRITTE" 4
  sleep 1
  foto_machen "$FENSTER"
  [ "$seite" = "$SEITEN" ] && break
  python3 "$WERKZEUGE/bildschirm.py" pruefe "$FOTO" naechste_seite || \
    abbrechen "Next Page vor Seite $((seite + 1)) nicht zu sehen"
  klicken "$FENSTER" naechste_seite
  sleep "$BLAETTER_PAUSE"
done

spiel_beenden
if [ "$NUR_FOTOS" = 1 ]; then
  sagen "--nur-fotos: $SEITEN Seiten in $ARBEIT, fertig"
  exit 0
fi

# --- Auswerten und ablegen --------------------------------------------------
sagen "Auswerten"
export OPBOUNTY_WERKZEUGE="$WERKZEUGE"
python3 bestenliste_einbauen.py --fotos "$ARBEIT"
EINBAU=$?
[ "$EINBAU" = 0 ] || abbrechen "bestenliste_einbauen.py ist gescheitert"
python3 "$WERKZEUGE/plausibel.py" public/bestenliste.json.gz || \
  abbrechen "nicht plausibel, nichts gepusht, der alte Stand bleibt"
[ -f public/bestenliste.json.gz.enc ] || \
  abbrechen "keine verschluesselte Fassung, fehlt ~/.fiesta_passwort?"

if [ "$NUR_PRUEFEN" = 1 ]; then
  # Die frisch verschluesselte Datei wieder auf den Stand im Repo setzen. Sonst liegt
  # eine geaenderte, nicht committete Datei im Checkout und stoert den naechsten Pull.
  git checkout -q -- public/bestenliste.json.gz.enc
  sagen "--pruefen: nicht gepusht"
  exit 0
fi

# Die Marke fuer heute, alte Marken weg.
tag_abhaken() {
  rm -f "$HOME"/mitschnitt/erledigt_*
  touch "$ERLEDIGT"
}

git add -f public/bestenliste.json.gz.enc
if git diff --cached --quiet; then
  sagen "unveraendert, nichts zu pushen"
  tag_abhaken
  exit 0
fi
git -c user.name="ladder" -c user.email="ladder@localhost" \
    commit -q -m "Bestenliste vom $(date +%F), per Mitschnitt"
# Hat die Action inzwischen selbst etwas committet, einmal nachziehen und neu pushen.
if ! git push -q origin HEAD:main 2>/dev/null; then
  git pull -q --rebase && git push -q origin HEAD:main || \
    abbrechen "Push fehlgeschlagen, der Stand liegt in $HIER/public/"
fi
tag_abhaken
sagen "gepusht"
