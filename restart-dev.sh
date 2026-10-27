#!/usr/bin/env bash
set -euo pipefail
export PATH="/home/shivanshc/.local/node/bin:/usr/bin:/bin"
cd /home/shivanshc/ASM-Qvoyant/qvoyant-asm-frontend
pkill -f '[v]ite' || true
sleep 1
nohup npm run dev >/tmp/vite-5174.log 2>&1 &
echo "pid=$!"
sleep 5
echo "=== listen ==="
ss -tlnp | grep 5174 || echo "NOT LISTENING"
echo "=== log ==="
tail -n 30 /tmp/vite-5174.log
echo "=== ip ==="
hostname -I
