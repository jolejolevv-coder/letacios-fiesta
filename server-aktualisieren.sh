#!/usr/bin/env bash
# Taegliche Auffrischung auf dem Homeserver (192.168.178.182).
#
# Holt die neuen Tage und die fertigen Saetze, legt fehlende Kartenbilder an und schiebt
# das Ergebnis ins Repo. Den Bau und die Veroeffentlichung uebernimmt danach die
# GitHub Action, ausgeloest durch diesen Push.
#
# Der Server braucht dafuer nur python3 und git. Node wird hier nicht gebraucht.
set -euo pipefail

REPO="${REPO:-$HOME/letacios-fiesta}"
cd "$REPO"

git pull --rebase --quiet

python3 aktualisieren.py \
  --ziel public \
  --tage 30 \
  --bounty 25_1000,1000_2000,2000_3000 \
  --bilder

if git diff --quiet -- public; then
  echo "$(date '+%F %T')  nichts Neues"
  exit 0
fi

git add public
git -c user.name="fiesta-server" -c user.email="fiesta@nahobinoco.com" \
    commit --quiet -m "Daten vom $(date '+%F')"
git push --quiet
echo "$(date '+%F %T')  geschoben"
