#!/usr/bin/env bash
#
# Die Bestenliste holen und ins Repo legen. Laeuft taeglich per systemd-Timer.
#
# **Seit dem 02.09.2026 ohne Spielclient.** Der eigene Laeufer spricht das
# Spielprotokoll selbst: verbinden, eigenen Knoten anmelden, anmelden, fuenf Seiten,
# trennen. Kein Spielfenster, kein Klicken, kein tcpdump, kein X-Server noetig.
#
# Warum das vorher nicht ging, und was der Unterschied ist:
#
#   Der Laeufer hat nie seinen EIGENEN Knoten beim Server angemeldet. Er hat nur die
#   Anmeldungen des Servers bestaetigt. Der Server nahm die Bestenlistenanfrage
#   daraufhin auf ENet-Ebene an und bestaetigte sie sogar mit einem ACK, konnte die
#   Antwort danach aber niemandem zustellen: er kannte den Knoten nicht, auf dem
#   `send_leaderboard` beim Client liegt. Deshalb sah es monatelang so aus, als
#   wuerde eine byteweise identische Anfrage einfach ignoriert. Ein Byte-Vergleich
#   der Anfrage konnte das nie zeigen, weil der Unterschied nicht in der Anfrage lag,
#   sondern in einem Aufruf davor. Die Loesung steht in `enet_paket.pfad_anmelden`.
#
#     ./ladder_server.sh            # holen, auswerten, ablegen, pushen
#     ./ladder_server.sh --pruefen  # dasselbe, aber nichts pushen
#
set -uo pipefail

HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
BASIS="$(dirname "$HIER")"
export OPBOUNTY_WERKZEUGE="${OPBOUNTY_WERKZEUGE:-$BASIS/werkzeuge}"

NUR_PRUEFEN=0
[ "${1:-}" = "--pruefen" ] && NUR_PRUEFEN=1

sagen() { printf '  %s\n' "$*"; }

cd "$HIER" || exit 1

# --- Holen und auswerten ----------------------------------------------------
# Ohne Argument holt bestenliste_einbauen.py die Liste ueber den Laeufer. Der
# Bestand wird fortgeschrieben: faellt ein Lauf aus, bleiben die alten Werte stehen,
# statt dass die Liste Loecher bekommt.
if ! python3 bestenliste_einbauen.py; then
  echo "Bestenliste holen fehlgeschlagen. Der alte Stand bleibt erhalten." >&2
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
