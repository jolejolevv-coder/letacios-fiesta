#!/usr/bin/env bash
#
# Die Bestenliste vom laufenden Spielclient abgreifen. Laeuft auf dem Heimserver.
#
# Warum ueberhaupt so: die Liste wird auf dem Server des Spiels berechnet und ist
# ueber die Datenbank nicht erreichbar. Ein eigener Laeufer, der die Anfrage selbst
# stellt, ist gescheitert (Begruendung in specs/features/bestenliste.md). Bleibt der
# echte Client: er fragt, tcpdump hoert mit, der Leser wertet aus.
#
# Voraussetzung ist deshalb ein **angemeldeter Client mit offener Bestenliste**. Der
# Klick auf "Anmelden" hat als einziger nie funktioniert, der Rest schon. Das Fenster
# bleibt also stehen; das Skript blaettert nur darin.
#
#     ./ladder_server.sh            # abgreifen, auswerten, ablegen
#     ./ladder_server.sh --pruefen  # dasselbe, aber nichts pushen
#
set -uo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASIS="$(dirname "$HIER")"
export OPBOUNTY_WERKZEUGE="${OPBOUNTY_WERKZEUGE:-$BASIS/werkzeuge}"

# DISPLAY und XAUTHORITY aus der laufenden Grafiksitzung ziehen. Der systemd-Timer
# startet ohne diese Umgebung, und der XAUTHORITY-Pfad ist bei jeder Anmeldung neu
# (`/run/user/1000/xauth_...`). Fest verdrahtet braeche er nach jedem Reboot. Deshalb
# aus dem Prozessumfeld eines langlebigen Sitzungsprozesses lesen.
sitzungsumfeld() {
  local pid
  for muster in "plasmashell" "plasma_session" "OPBounty"; do
    pid="$(pgrep -u "$(id -u)" -x "$muster" 2>/dev/null | head -1)"
    [ -z "$pid" ] && pid="$(pgrep -u "$(id -u)" -f "$muster" 2>/dev/null | head -1)"
    [ -n "$pid" ] && [ -r "/proc/$pid/environ" ] || continue
    local d x
    d="$(tr "\0" "\n" < "/proc/$pid/environ" | sed -n "s/^DISPLAY=//p" | head -1)"
    x="$(tr "\0" "\n" < "/proc/$pid/environ" | sed -n "s/^XAUTHORITY=//p" | head -1)"
    if [ -n "$d" ]; then
      export DISPLAY="$d"
      [ -n "$x" ] && export XAUTHORITY="$x"
      return 0
    fi
  done
  return 1
}
if [ -z "${DISPLAY:-}" ] || ! xdotool getdisplaygeometry >/dev/null 2>&1; then
  sitzungsumfeld || true
fi
export DISPLAY="${DISPLAY:-:0}"

PORT=4694
FENSTER='^OPBounty$'
PCAP="$(mktemp /tmp/ladder-XXXXXX.pcap)"
NUR_PRUEFEN=0
[ "${1:-}" = "--pruefen" ] && NUR_PRUEFEN=1

# Lage der beiden Knoepfe, als Anteil der Fenstergroesse. Fest verdrahtete Pixel
# brechen bei jeder anderen Aufloesung; Godot skaliert die Oberflaeche mit.
VOR_X=0.9422; VOR_Y=0.8862      # "Next Page"
ZURUECK_X=0.8136; ZURUECK_Y=0.8862   # "Prev Page"

# Wie viele Seiten die Liste hat. Zwanzig Spieler je Seite, hundert insgesamt.
SEITEN=5

sagen() { printf '  %s\n' "$*"; }
ende() { rm -f "$PCAP"; }
trap ende EXIT

# --- Zur Bestenliste navigieren --------------------------------------------
# Das Spiel wird vom Loginscreen aus bis zur offenen Bestenliste durchgeklickt, egal
# in welchem der bekannten Zustaende es steht. Jeder Bildschirm wird am Screenshot
# erkannt, danach genau ein Schritt gemacht und neu geprueft. Bei einem unbekannten
# Bild (z.B. eine laufende Partie) wird abgebrochen statt blind geklickt.
#
# Startbefehl aus dem laufenden Prozess abgelesen; --main-pack zeigt auf das Paket im
# Nutzerprofil, nicht das neben der Binaerdatei.
SPIEL_BIN="$HOME/Downloads/Builds_Linux/OPTCGSim_Data/StreamingAssets/OPBounty/linux/OPBounty.x86_64"
SPIEL_PCK="$HOME/.local/share/godot/app_userdata/OPBounty/OPBounty.pck"
SCHIRM=/tmp/ladder-schirm.png

klick() {   # klick <anteil_x> <anteil_y>   (nutzt X,Y,WIDTH,HEIGHT der Bestenliste)
  local px py
  px=$(awk -v a="$X" -v b="$WIDTH" -v f="$1" 'BEGIN{printf "%d", a + b*f}')
  py=$(awk -v a="$Y" -v b="$HEIGHT" -v f="$2" 'BEGIN{printf "%d", a + b*f}')
  xdotool mousemove "$px" "$py" click 1
}

klick_abs() {   # klick_abs <x> <y>   absolute Bildpunkte, mit kurzem Halten
  xdotool mousemove "$1" "$2"; sleep 0.3
  xdotool mousedown 1; sleep 0.12; xdotool mouseup 1
}

fenster_id() { xdotool search --name "$FENSTER" 2>/dev/null | head -1; }

rgb() {   # rgb <bild> <x> <y>  ->  "R G B" (0..255)
  magick "$1" -format \
    "%[fx:int(p{$2,$3}.r*255)] %[fx:int(p{$2,$3}.g*255)] %[fx:int(p{$2,$3}.b*255)]" \
    info: 2>/dev/null
}

spiel_starten() {
  if [ ! -x "$SPIEL_BIN" ]; then
    echo "Spiel nicht gefunden: $SPIEL_BIN" >&2
    return 1
  fi
  sagen "starte das Spiel"
  setsid nohup "$SPIEL_BIN" --main-pack "$SPIEL_PCK" >/tmp/opbounty.log 2>&1 </dev/null &
  local _
  for _ in $(seq 45); do [ -n "$(fenster_id)" ] && break; sleep 1; done
  sleep 6   # Loginmaske laden lassen
  [ -n "$(fenster_id)" ]
}

# Zustand erkennen. Setzt WID,X,Y,WIDTH,HEIGHT und gibt einen Namen aus.
#   absent       kein Fenster
#   leaderboard  gross, blauer "Next Page"-Knopf unten rechts
#   menu         klein und hoch (Hauptmenue mit WANTED-Poster)
#   login        klein und niedrig (Anmeldemaske)
#   unknown      gross ohne Bestenliste (z.B. laufende Partie) oder unklar
# Setzt die globalen WID,X,Y,WIDTH,HEIGHT und ZUSTAND. NICHT ueber $(...) aufrufen:
# das liefe in einer Subshell und die Zuweisungen verpufften. Also `zustand; z=$ZUSTAND`.
zustand() {
  local r g b
  WID="$(fenster_id)"
  X=""; Y=""; WIDTH=""; HEIGHT=""
  if [ -z "$WID" ]; then ZUSTAND=absent; return; fi
  eval "$(xdotool getwindowgeometry --shell "$WID" 2>/dev/null)"
  import -window root "$SCHIRM" 2>/dev/null
  if [ "${WIDTH:-0}" -ge 1600 ]; then
    # "Next Page" ist im Standardlayout blau. Gemessen: srgb(31,64,104).
    read -r r g b <<<"$(rgb "$SCHIRM" 1808 918)"
    if [ "${b:-0}" -ge 90 ] && [ "${b:-0}" -gt $(( ${r:-0} + 30 )) ]; then
      ZUSTAND=leaderboard
    else
      ZUSTAND=unknown
    fi
    return
  fi
  # Kleines Fenster: nur die EXAKTEN Groessen als Login bzw. Menue anerkennen. Zwischen-
  # und Ladezustaende (z.B. ein 500x500-Splash direkt nach dem Start) werden bewusst als
  # "loading" behandelt und abgewartet, NICHT geklickt. Ein Klick auf der falschen Groesse
  # landet sonst irgendwo, im schlimmsten Fall auf "Play Standard" und reiht ein Match ein.
  if [ "${WIDTH:-0}" -le 320 ] && [ "${HEIGHT:-0}" -ge 560 ] && [ "${HEIGHT:-0}" -le 700 ]; then
    ZUSTAND=menu
  elif [ "${WIDTH:-0}" -le 320 ] && [ "${HEIGHT:-0}" -ge 360 ] && [ "${HEIGHT:-0}" -le 480 ]; then
    ZUSTAND=login
  else
    ZUSTAND=loading
  fi
}

# Warten, bis das Menue seine endgueltige Anordnung zeigt. Direkt nach dem Schliessen
# der Bestenliste ist das Poster kurz eingeklappt und die Knoepfe sitzen woanders. Das
# creme WANTED-Poster (gemessen srgb(245,228,204)) an seiner festen Stelle ist das
# Signal, dass das Layout steht.
menue_gesetzt() {
  local i px py r g b
  px=$(( X + WIDTH * 489 / 1000 )); py=$(( Y + HEIGHT * 437 / 1000 ))
  for i in $(seq 10); do
    import -window root "$SCHIRM" 2>/dev/null
    read -r r g b <<<"$(rgb "$SCHIRM" "$px" "$py")"
    if [ "${r:-0}" -ge 210 ] && [ "${g:-0}" -ge 185 ] && [ "${b:-0}" -ge 150 ]; then
      return 0
    fi
    sleep 1
  done
  return 1
}

# Anmelden. Vorbedingung: das kleine Login-Fenster steht (225x421).
#
# Zwei feste Regeln, beide aus Schaden gelernt:
#   * Nur MAXIMIERT anmelden. Klein rendert die Maske versetzt und Eingaben verpuffen.
#   * Abgeschickt wird per ENTER, nie per Mausklick. Direkt unter "Anmelden" liegen
#     "Login with Discord" und "Link Patreon Account"; ein danebengehender Klick oeffnet
#     einen OAuth-Fluss im Browser. Enter kann das nicht.
# In sich geschlossen, damit die Hauptschleife nicht in den maximierten Login (der sich
# als "unknown" liest) zurueckfaellt.
anmelden() {
  local i
  wmctrl -i -r "$WID" -b add,maximized_vert,maximized_horz 2>/dev/null
  for i in $(seq 8); do
    eval "$(xdotool getwindowgeometry --shell "$WID" 2>/dev/null)"
    [ "${WIDTH:-0}" -ge 1600 ] && break
    sleep 1
  done
  [ "${WIDTH:-0}" -ge 1600 ] || { sagen "Login liess sich nicht maximieren"; return 1; }
  sleep 2                                   # Maske voll rendern lassen
  xdotool windowactivate --sync "$WID" 2>/dev/null
  xdotool key --window "$WID" Return        # sendet das Formular ab
  sagen "Anmeldung abgeschickt, warte auf das Menue"
  for i in $(seq 15); do
    eval "$(xdotool getwindowgeometry --shell "$WID" 2>/dev/null)"
    [ "${WIDTH:-0}" -lt 1600 ] && return 0  # wieder klein = angemeldet, im Menue
    sleep 2
  done
  return 1                                   # blieb gross: Anmeldung nicht durch
}

navigieren() {
  [ -z "$(fenster_id)" ] && { spiel_starten || return 1; }
  local versuch unbekannt=0 z
  for versuch in $(seq 16); do
    zustand; z="$ZUSTAND"
    sagen "Zustand: $z (${WIDTH:-?}x${HEIGHT:-?})"
    case "$z" in
      leaderboard)
        return 0 ;;
      login)
        anmelden || { unbekannt=$(( unbekannt + 1 ))
          [ "$unbekannt" -ge 3 ] && { echo "Anmeldung mehrfach gescheitert, gebe auf." >&2; return 1; }
          sleep 2; } ;;
      menu)
        xdotool windowactivate --sync "$WID" 2>/dev/null
        menue_gesetzt || { sagen "Menue-Layout unklar, warte statt blind zu klicken"; sleep 2; continue; }
        # "Bestenlisten" ist der obere linke Knopf, bei etwa (0.244, 0.81). Nur bei
        # sauberer Menuegroesse (durch zustand geprueft) sitzt der Klick sicher; "Play
        # Standard" liegt 66px tiefer und wuerde ein Match einreihen.
        klick_abs "$(( X + WIDTH * 244 / 1000 ))" "$(( Y + HEIGHT * 810 / 1000 ))"
        sleep 4 ;;
      absent)
        spiel_starten || return 1 ;;
      loading)
        # Splash oder Uebergang. Abwarten, niemals hier klicken.
        unbekannt=$(( unbekannt + 1 ))
        [ "$unbekannt" -ge 8 ] && { echo "Bleibt im Ladezustand, gebe auf." >&2; return 1; }
        sleep 3 ;;
      unknown|*)
        # Grosser Bildschirm, aber nicht die Bestenliste (z.B. eine laufende Partie).
        # Nicht klicken, ein paarmal abwarten, dann aufgeben.
        unbekannt=$(( unbekannt + 1 ))
        [ "$unbekannt" -ge 4 ] && { echo "Unbekannter Bildschirm, gebe auf." >&2; return 1; }
        sleep 3 ;;
    esac
  done
  return 1
}

if ! navigieren; then
  echo "Konnte die Bestenliste nicht oeffnen. Der alte Stand bleibt erhalten." >&2
  exit 1
fi
eval "$(xdotool getwindowgeometry --shell "$WID")"   # X Y WIDTH HEIGHT der Liste
sagen "Bestenliste offen, Fenster ${WIDTH}x${HEIGHT} an ${X},${Y}"

# --- Mitschnitt starten -----------------------------------------------------
# tcpdump darf ohne Passwort laufen, dafuer steht eine eigene sudoers-Zeile.
#
# Zwei Fallstricke, beide auf dem Server gemessen:
#   * `mktemp` legt die Datei als der aufrufende Nutzer an. tcpdump stuft aber per
#     Vorgabe auf den Systemnutzer `tcpdump` herab (`-Z`) und darf dann nicht mehr
#     in die fremde Datei schreiben; es stirbt sofort mit "Permission denied".
#     Deshalb den Namen behalten, die Datei aber vorher loeschen.
#   * `-Z "$(id -un)"` laesst tcpdump auf den eigenen Nutzer herabstufen statt auf
#     `tcpdump`. Sonst gehoert das fertige pcap dem Nutzer `tcpdump` und laesst sich
#     hinterher nicht mehr aufraeumen (die sudoers-Zeile erlaubt nur tcpdump, kein rm).
rm -f "$PCAP"
sudo -n tcpdump -i any -n -s 0 -Z "$(id -un)" -w "$PCAP" "udp port $PORT" >/dev/null 2>&1 &
TCPDUMP_PID=$!
for _ in $(seq 20); do [ -s "$PCAP" ] && break; sleep 0.2; done
sleep 1
if ! kill -0 "$TCPDUMP_PID" 2>/dev/null; then
  echo "tcpdump laeuft nicht. 'sudo -n /usr/bin/tcpdump' pruefen." >&2
  exit 1
fi
sagen "Mitschnitt laeuft"

# --- Blaettern --------------------------------------------------------------
# Erst zurueck an den Anfang, egal wo die Liste gerade steht: das Skript laeuft
# taeglich, und die letzte Sitzung hat sie irgendwo stehen lassen.
xdotool windowactivate --sync "$WID" 2>/dev/null || xdotool windowraise "$WID"
sleep 1
for _ in $(seq "$SEITEN"); do klick "$ZURUECK_X" "$ZURUECK_Y"; sleep 0.8; done
sagen "auf Seite 1 zurueckgesetzt"

# Vorwaerts durch die Seiten 2 bis $SEITEN, dann rueckwaerts zurueck. Der Umweg ist
# noetig, weil Seite 1 beim Oeffnen schon steht: ein "Prev" darauf loest keine neue
# Anfrage aus, also faenge tcpdump die Top 20 sonst nie ein. Der Rueckweg fragt sie
# auf dem letzten Klick neu an. Doppelt gesehene Seiten schaden nicht, die Namen
# werden beim Auswerten entdoppelt.
for i in $(seq $((SEITEN - 1))); do
  klick "$VOR_X" "$VOR_Y"
  sagen "Seite $((i + 1)) angefragt"
  sleep 1.5
done
for i in $(seq $((SEITEN - 1)) -1 1); do
  klick "$ZURUECK_X" "$ZURUECK_Y"
  sagen "Seite $i erneut angefragt"
  sleep 1.5
done
sleep 2

# sudo reicht das Signal an tcpdump weiter, deshalb reicht ein einfaches kill.
# Ein `sudo pkill` waere hier falsch: die sudoers-Zeile erlaubt nur tcpdump.
kill -INT "$TCPDUMP_PID" 2>/dev/null
wait "$TCPDUMP_PID" 2>/dev/null
sagen "Mitschnitt fertig, $(du -h "$PCAP" | cut -f1)"

# --- Auswerten --------------------------------------------------------------
cd "$HIER" || exit 1
if ! python3 bestenliste_einbauen.py "$PCAP"; then
  echo "Auswertung fehlgeschlagen. Stand das Fenster auf der Bestenliste?" >&2
  exit 1
fi

ANZAHL="$(python3 - <<'PY'
import gzip, json
d = json.loads(gzip.open("public/bestenliste.json.gz", "rb").read())
print(sum(1 for e in d["spieler"] if e.get("stand") == d["stand"]))
PY
)"
sagen "$ANZAHL Spieler von heute"
if [ "${ANZAHL:-0}" -lt 50 ]; then
  echo "Nur $ANZAHL frische Spieler, das ist zu wenig. Nichts gepusht." >&2
  exit 1
fi

# --- Ablegen ----------------------------------------------------------------
# Nur die verschluesselte Fassung geht ins Repo. Das Repo ist oeffentlich, und in
# der Liste stehen Namen und Werte von hundert echten Leuten.
if [ "$NUR_PRUEFEN" = "1" ]; then
  sagen "--pruefen: nicht gepusht"
  exit 0
fi
git add -f public/bestenliste.json.gz.enc
if git diff --cached --quiet; then
  sagen "unveraendert, nichts zu pushen"
  exit 0
fi
git -c user.name="ladder" -c user.email="ladder@localhost" \
    commit -q -m "Bestenliste vom $(date +%F)"
if git push -q origin HEAD:main 2>/dev/null; then
  sagen "gepusht"
else
  echo "Push fehlgeschlagen: dem Server fehlt das Schreibrecht am Repo." >&2
  echo "Der Stand liegt trotzdem in $HIER/public/." >&2
  exit 1
fi
