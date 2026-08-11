#!/bin/bash
# Wrapper for Flathub / Electron2.BaseApp (zypak).
# Install as $FLATPAK_DEST/bin/asgardex and set command: asgardex
set -euo pipefail

export TMPDIR="${XDG_RUNTIME_DIR}/app/${FLATPAK_ID}"

# electron-builder layout varies slightly by productName/name casing
for bin in \
  /app/asgardex/asgardex \
  /app/asgardex/ASGARDEX \
  /app/ASGARDEX/asgardex \
  /app/ASGARDEX/ASGARDEX; do
  if [ -x "$bin" ]; then
    exec zypak-wrapper "$bin" "$@"
  fi
done

echo "asgardex: Electron binary not found under /app/asgardex or /app/ASGARDEX" >&2
ls -la /app /app/asgardex /app/ASGARDEX 2>/dev/null || true
exit 1
