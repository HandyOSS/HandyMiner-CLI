cd -- "$(dirname "$0")"
printf '\e[8;40;140t' && sudo node --max-old-space-size=8196 ./miner/dashboard.js
