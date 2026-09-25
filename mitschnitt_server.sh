#!/usr/bin/env bash
#
# Die Bestenliste per Mitschnitt holen und ins Repo legen. Laeuft taeglich auf dem
# Bazzite, siehe specs/features/bestenliste-mitschnitt.md.
#
# Der echte Spielclient ruft die Bestenliste ab, tcpdump hoert mit, und
# bestenliste_einbauen.py wertet aus. Der eigene Laeufer bekommt seit dem Clientupdate
# 2.6.1 keine Antwort mehr, der Client schon.
#
#     ./mitschnitt_server.sh            # holen, auswerten, pruefen, pushen
#     ./mitschnitt_server.sh --pruefen  # dasselbe, aber nichts pushen
#
# Gestartet wird es von mitschnitt.timer, um 05:30 und zum Nachfassen um 06:30 UTC.
#
# Sicherheitsregeln, im Code unten jeweils an ihrer Stelle:
#   * tcpdump zeichnet nur Pakete VOM Spielserver auf. Die Anmeldung mit dem Passwort
#     geht in die andere Richtung und landet nie auf der Platte.
#   * Kein blinder Klick. Vor jedem Klick muss das Bildschirmfoto dem Referenzbild
#     der Klickstelle entsprechen (werkzeuge/bildschirm.py), sonst Abbruch.
#   * Keine Tastatureingabe ins Spiel.
#   * Wird die Sitzung gerade benutzt oder laeuft das Spiel schon, faellt der Lauf aus.
#   * Die pcap wird in jedem Fall geloescht, auch beim Abbruch.
#   * Nur die verschluesselte Fassung geht ins Repo.
#
set -uo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
WERKZEUGE="$HIER/werkzeuge"
SPIEL_DIR="${OPBOUNTY_SPIEL:-$HOME/Downloads/Builds_Linux/OPTCGSim_Data/StreamingAssets/OPBounty/linux}"
SPIEL_NAME="OPBounty.x86_64"
ARBEIT="$HOME/mitschnitt/lauf"
PCAP="$ARBEIT/bestenliste.pcap"
# Der Timer startet zweimal am Tag, der zweite Termin ist das Nachfassen. Gelingt der
# erste, legt er diese Marke an, und der zweite endet sofort.
ERLEDIGT="$HOME/mitschnitt/erledigt_$(date -u +%F)"
FOTO="$ARBEIT/foto.png"

SERVER_PORT=4694          # Spielserver, siehe werkzeuge/pcap_enet.py
START_FRIST=300           # Sekunden vom Start bis zur offenen Bestenliste; das Update
                          # samt Neustart dauerte im Probelauf rund eine Minute
SEITEN=5                  # Top 100, 20 Spieler je Seite
BLAETTER_PAUSE=4          # Sekunden je Seite, im Probelauf ausreichend
NACHLADE_PAUSE=5          # nach einem Klick, bis die naechste Maske steht
MAX_KLICKS_JE_STELLE=2    # nie oefter auf dieselbe Maske klicken, etwa beim Anmelden
LEERLAUF_SEKUNDEN=30      # so lange darf sich die Maus vor dem Start nicht bewegen
# Hierhin wird die Maus vor jedem Foto geschoben, damit kein Knopf im Hover steht.
# Rechts am Rand liegt in keiner der Masken ein Knopf.
MAUS_PARK_X=1850
MAUS_PARK_Y=600

NUR_PRUEFEN=0
[ "${1:-}" = "--pruefen" ] && NUR_PRUEFEN=1

TCPDUMP_PID=""

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

tcpdump_stoppen() {
  # Gestoppt wird ueber die PID des sudo Prozesses: sudo reicht SIGINT an tcpdump
  # weiter, und tcpdump schreibt die Datei sauber zu Ende.
  [ -z "$TCPDUMP_PID" ] && return 0
  kill -INT "$TCPDUMP_PID" 2>/dev/null
  wait "$TCPDUMP_PID" 2>/dev/null
  TCPDUMP_PID=""
}

aufraeumen() {
  spiel_beenden
  tcpdump_stoppen
  rm -f "$PCAP"
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
git pull -q --ff-only || abbrechen "git pull ging nicht, der Checkout hat eigene Aenderungen"

sagen "Mitschnitt starten"
rm -f "$PCAP"
sudo -n tcpdump -i any -n -s 0 -U -Z "$(id -un)" -w "$PCAP" \
  "udp and src port $SERVER_PORT" > "$ARBEIT/tcpdump.log" 2>&1 &
TCPDUMP_PID=$!
sleep 2
kill -0 "$TCPDUMP_PID" 2>/dev/null || abbrechen "tcpdump startet nicht: $(tail -1 "$ARBEIT/tcpdump.log")"

sagen "Spiel starten"
( cd "$SPIEL_DIR" && nohup "./$SPIEL_NAME" > "$ARBEIT/spiel.log" 2>&1 & )

# Welche Maske zeigt eines der Spielfenster? Setzt FENSTER und STELLE, oder laesst
# STELLE leer, wenn keines einen bekannten Knopf zeigt.
maske_erkennen() {
  FENSTER="" STELLE=""
  local w
  for w in $(fenster_liste); do
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

declare -A KLICKS=()
OFFEN=0
FRIST=$((SECONDS + START_FRIST))
while [ "$SECONDS" -lt "$FRIST" ]; do
  maske_erkennen
  case "$STELLE" in
    naechste_seite)
      OFFEN=1; break ;;
    bestenlisten|anmelden|hinweis_schliessen)
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

sagen "Bestenliste offen, blaettern"
for ((seite = 2; seite <= SEITEN; seite++)); do
  foto_machen "$FENSTER"
  python3 "$WERKZEUGE/bildschirm.py" pruefe "$FOTO" naechste_seite || \
    abbrechen "Next Page vor Seite $seite nicht zu sehen"
  klicken "$FENSTER" naechste_seite
  sleep "$BLAETTER_PAUSE"
done

spiel_beenden
tcpdump_stoppen

# --- Auswerten und ablegen --------------------------------------------------
sagen "Auswerten"
export OPBOUNTY_WERKZEUGE="$WERKZEUGE"
python3 bestenliste_einbauen.py "$PCAP"
EINBAU=$?
rm -f "$PCAP"
[ "$EINBAU" = 0 ] || abbrechen "bestenliste_einbauen.py ist gescheitert"
python3 "$WERKZEUGE/plausibel.py" public/bestenliste.json.gz || \
  abbrechen "nicht plausibel, nichts gepusht, der alte Stand bleibt"
[ -f public/bestenliste.json.gz.enc ] || \
  abbrechen "keine verschluesselte Fassung, fehlt ~/.fiesta_passwort?"

if [ "$NUR_PRUEFEN" = 1 ]; then
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
