#!/usr/bin/env bash
# =============================================================================
# Barrierefreiheit – misst das gebaute `_site` mit axe-core in einem echten
# Browser und scheitert bei einer Verletzung von WCAG 2.2 Stufe A/AA.
#
#   theme/jekyll/a11y.sh                    # messen, Bericht ausgeben
#   theme/jekyll/a11y.sh --site _site       # anderes Verzeichnis messen
#   theme/jekyll/a11y.sh --require-site     # fehlendes _site ist ein Fehler (CI)
#   theme/jekyll/a11y.sh --require-browser  # fehlender Browser ist ein Fehler (CI)
#   theme/jekyll/a11y.sh --no-fail          # Befund meldet, bricht aber nicht ab
#   theme/jekyll/a11y.sh --widths 1280      # nur eine Breite messen (schneller)
#   theme/jekyll/a11y.sh --label learner    # Bericht beschriften (mehrere Bündel)
#
# LIEGT IM PAKET, nicht unter `bin/`: Dieselbe Prüfung läuft in den Schulungs-
# Repos über die zentrale didaktikon-Action, und die kennt nur `theme/`. Wie
# `links.rb` und `contrast.rb` gehört sie damit zum Theme und nicht zur Werkstatt
# dieses Repos. axe-core liegt daneben unter `vendor/axe-core/` – mitgeliefert,
# damit kein Lauf etwas nachladen muss.
#
# WARUM IM BROWSER UND NICHT AM HTML: Die Hälfte dessen, was eine Vorlesehilfe
# vorfindet, entsteht erst dort – das Inhaltsverzeichnis, die Fortschrittskarte,
# die Reiter, das Quiz, die aufgeklappten Menüs. Eine Prüfung am gebauten HTML
# würde genau die Teile nicht sehen, die am ehesten kaputtgehen. Deshalb wird
# jede Seite geladen, das Skript darf laufen, und erst dann wird gemessen.
#
# ZWEI BREITEN, weil die Seite bei 390 Pixeln eine andere ist: Burger-Menü statt
# Leiste, Inhaltsverzeichnis über dem Text, Fortschritt ausgeblendet. Was breit
# sauber ist, muss schmal nicht sauber sein.
#
# WAS DAS WERKZEUG NICHT KANN: Es misst, was sich mechanisch messen lässt – rund
# ein Drittel dessen, was Barrierefreiheit ausmacht. Ob eine Alternative den
# Inhalt eines Bildes wirklich wiedergibt, ob die Reihenfolge der Überschriften
# den Text abbildet, ob eine Simulation ohne Maus zu Ende zu bedienen ist:
# dafür gibt es kein Werkzeug. Grün heißt „kein bekannter Fehler“, nicht
# „barrierefrei“. Siehe docs/theme/barrierefreiheit.md.
#
# BROWSER: gesucht wird in dieser Reihenfolge – $AVD_CHROME, google-chrome,
# google-chrome-stable, chromium, chromium-browser, Chrome unter macOS. Ohne
# Browser wird der Lauf übersprungen (Rückgabe 0), damit `make check` auf einem
# Rechner ohne Chrome nicht scheitert; in der Pipeline erzwingt
# `--require-browser`, dass wirklich gemessen wird.
# =============================================================================
set -euo pipefail
# Aufgerufen wird aus dem Projektverzeichnis (Theme-Repo oder Schulungs-Repo);
# das Skript selbst liegt in `theme/jekyll/`. Es wechselt deshalb NICHT das
# Verzeichnis – `--site` ist relativ zum Aufrufort.
HIER="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

SITE="_site"
BROWSER_PFLICHT=0
SITE_PFLICHT=0
DURCH=()

while [ $# -gt 0 ]; do
  case "$1" in
    --require-browser) BROWSER_PFLICHT=1; shift ;;
    --require-site)    SITE_PFLICHT=1; shift ;;
    --site)            SITE="$2"; shift 2 ;;   # wird unten einmal weitergereicht
    *)                 DURCH+=("$1"); shift ;;
  esac
done

if [ ! -d "$SITE" ]; then
  if [ "$SITE_PFLICHT" = "1" ]; then
    echo "FEHLER: $SITE fehlt – erst bauen (make build)." >&2
    exit 2
  fi
  echo "Barrierefreiheit: übersprungen ($SITE fehlt – 'make build' baut es)."
  exit 0
fi

chrome_finden() {
  if [ -n "${AVD_CHROME:-}" ] && [ -x "$AVD_CHROME" ]; then echo "$AVD_CHROME"; return 0; fi
  for k in google-chrome google-chrome-stable chromium chromium-browser; do
    if command -v "$k" >/dev/null 2>&1; then command -v "$k"; return 0; fi
  done
  local mac="/Applications/Google Chrome.app/Contents/MacOS/Google Chrome"
  if [ -x "$mac" ]; then echo "$mac"; return 0; fi
  return 1
}

if ! CHROME="$(chrome_finden)"; then
  if [ "$BROWSER_PFLICHT" = "1" ]; then
    echo "FEHLER: Kein Chrome/Chromium gefunden. Pfad über AVD_CHROME setzen." >&2
    exit 2
  fi
  echo "Barrierefreiheit: übersprungen (kein Chrome/Chromium gefunden)."
  echo "  Pfad notfalls setzen: AVD_CHROME=/pfad/zu/chrome theme/jekyll/a11y.sh"
  exit 0
fi

if ! command -v node >/dev/null 2>&1; then
  if [ "$BROWSER_PFLICHT" = "1" ]; then echo "FEHLER: node fehlt." >&2; exit 2; fi
  echo "Barrierefreiheit: übersprungen (node fehlt)."
  exit 0
fi

# Der Klient spricht das DevTools-Protokoll über `WebSocket` – global erst ab
# Node 22. Älter wird nicht geraten, sondern gesagt.
NODE_MAJOR="$(node -p 'process.versions.node.split(".")[0]')"
if [ "$NODE_MAJOR" -lt 22 ]; then
  if [ "$BROWSER_PFLICHT" = "1" ]; then
    echo "FEHLER: Node $NODE_MAJOR ist zu alt (nötig: 22+, wegen WebSocket)." >&2
    exit 2
  fi
  echo "Barrierefreiheit: übersprungen (Node $NODE_MAJOR < 22)."
  exit 0
fi

exec node "$HIER/a11y.mjs" --site "$SITE" --chrome "$CHROME" "${DURCH[@]}"
