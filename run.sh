#!/usr/bin/env bash
set -e

DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" >/dev/null 2>&1 && pwd )"
cd "$DIR"

echo "=========================================================="
echo " Starting HP iLO 4 Command Center"
echo " Target iLO Server: 192.168.8.53"
echo " Home LAN Access:   http://192.168.8.124:8000"
echo " Local Access:      http://localhost:8000"
echo "=========================================================="

python3 -m uvicorn app:app --host 0.0.0.0 --port 8000
