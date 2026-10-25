#!/bin/sh
# Avvia Playwright MCP: il browser che Claude Code comanda per vedere e provare l'app.
# Nell'ambiente cloud usa il Chromium già installato (senza sandbox); in locale quello di Playwright.
CHROME=/opt/pw-browsers/chromium-1194/chrome-linux/chrome
if [ -x "$CHROME" ]; then
  exec npx -y @playwright/mcp@0.0.83 --headless --isolated --no-sandbox --executable-path "$CHROME" "$@"
fi
exec npx -y @playwright/mcp@0.0.83 --isolated "$@"
