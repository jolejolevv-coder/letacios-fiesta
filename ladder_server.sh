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
export DISPLAY="${DISPLAY:-:0}"
export OPBOUNTY_WERKZEUGE="${OPBOUNTY_WERKZEUGE:-$BASIS/werkzeuge}"

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

# --- Fenster finden ---------------------------------------------------------
WID="$(xdotool search --name "$FENSTER" 2>/dev/null | head -1)"
if [ -z "$WID" ]; then
  echo "Kein Fenster '$FENSTER'. Das Spiel muss laufen und angemeldet sein." >&2
  exit 1
fi
eval "$(xdotool getwindowgeometry --shell "$WID")"   # X Y WIDTH HEIGHT
sagen "Fenster $WID, ${WIDTH}x${HEIGHT} an ${X},${Y}"

klick() {   # klick <anteil_x> <anteil_y>
  local px py
  px=$(awk -v a="$X" -v b="$WIDTH" -v f="$1" 'BEGIN{printf "%d", a + b*f}')
  py=$(awk -v a="$Y" -v b="$HEIGHT" -v f="$2" 'BEGIN{printf "%d", a + b*f}')
  xdotool mousemove "$px" "$py" click 1
}

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
# taeglich, und die letzte Sitzung hat sie irgendwo stehen lassen. Danach vorwaerts
# durch alle Seiten. Jeder Klick loest eine eigene Anfrage aus.
xdotool windowactivate --sync "$WID" 2>/dev/null || xdotool windowraise "$WID"
sleep 1
for _ in $(seq "$SEITEN"); do klick "$ZURUECK_X" "$ZURUECK_Y"; sleep 0.8; done
sagen "auf Seite 1 zurueckgesetzt"
for i in $(seq $((SEITEN - 1))); do
  klick "$VOR_X" "$VOR_Y"
  sagen "Seite $((i + 1)) angefragt"
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
