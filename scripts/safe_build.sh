#!/usr/bin/env bash
set -Eeuo pipefail

ROOT="/root/plug-fusion"
WEB="$ROOT/web"
LOG="$ROOT/.last-build.log"

echo "== env =="
command -v node >/dev/null && node -v || echo "node not found"
command -v npm  >/dev/null && npm -v  || echo "npm not found"
echo

# Stelle sicher, dass index.html auf /src/main.jsx zeigt (nicht auf index.jsx)
if [ -f "$WEB/index.html" ]; then
  if grep -q 'src="/src/index.jsx"' "$WEB/index.html"; then
    sed -i 's#src="/src/index.jsx"#src="/src/main.jsx"#' "$WEB/index.html"
  fi
fi

# Vorhandene dist säubern (kein Crash, wenn nicht vorhanden)
rm -rf "$WEB/dist" || true

# Dependencies nur installieren, wenn node_modules fehlt
cd "$WEB"
if [ ! -d node_modules ]; then
  echo "[INFO] Installing dependencies…"
  npm i --no-audit --no-fund
fi

# Memory-Limit für esbuild/vite (hilft auf VPS)
export NODE_OPTIONS="${NODE_OPTIONS:-"--max-old-space-size=2048"}"

echo "[INFO] Building Vite app (Log: $LOG)…"
set -o pipefail
if ! npm run build |& tee "$LOG"; then
  echo
  echo "[FAIL] Build error. Siehe Log: $LOG"
  exit 1
fi

cd "$ROOT"
# Static-Link neu setzen
rm -rf server/public || true
ln -sfn "$WEB/dist" "$ROOT/server/public"

echo "[INFO] Reload PM2…"
pm2 reload all 2>/dev/null || pm2 restart all 2>/dev/null || true

echo "[DONE] Build & Deploy ok. Log: $LOG"
