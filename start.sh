#!/usr/bin/env bash
# AI AutoFill — start.sh
# Usage: ./start.sh [--reinstall]
# Installs all dependencies, frees ports, starts FE + BE, cleans up on Ctrl+C

set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
FE_DIR="$ROOT/frontend"
BE_DIR="$ROOT/backend"
FE_PORT=5173
BE_PORT=4000
BE_PID=""
FE_PID=""

# ── Terminal colours ──────────────────────────────────────────────────────────
BOLD='\033[1m'
DIM='\033[2m'
RED='\033[0;31m'
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[0;33m'
CYAN='\033[0;36m'
NC='\033[0m'

line()  { echo -e "${DIM}  ──────────────────────────────────────${NC}"; }
ok()    { echo -e "  ${GREEN}✓${NC}  $1"; }
info()  { echo -e "  ${BLUE}•${NC}  $1"; }
warn()  { echo -e "  ${YELLOW}!${NC}  $1"; }
err()   { echo -e "  ${RED}✗${NC}  $1" >&2; }
label() { echo -e "\n${BOLD}  $1${NC}"; line; }

# ── Port management ───────────────────────────────────────────────────────────
free_port() {
  local port=$1
  local pids
  pids=$(lsof -ti ":$port" 2>/dev/null || true)
  if [ -n "$pids" ]; then
    warn "Port $port occupied (PID $pids) — killing"
    echo "$pids" | xargs kill -9 2>/dev/null || true
    sleep 0.4
    ok "Port $port freed"
  else
    ok "Port $port is free"
  fi
}

# ── Dependency install ────────────────────────────────────────────────────────
install_if_needed() {
  local dir=$1
  local name=$2
  local force=${3:-0}

  if [ "$force" = "1" ] || [ ! -d "$dir/node_modules" ]; then
    info "Installing $name dependencies..."
    if (cd "$dir" && npm install --silent 2>&1); then
      ok "$name dependencies ready"
    else
      err "$name install failed — check npm output above"
      exit 1
    fi
  else
    ok "$name dependencies already present"
  fi
}

# ── Check Node / npm ──────────────────────────────────────────────────────────
check_requirements() {
  if ! command -v node &>/dev/null; then
    err "Node.js not found. Install from https://nodejs.org"
    exit 1
  fi
  if ! command -v npm &>/dev/null; then
    err "npm not found. It ships with Node.js — reinstall Node."
    exit 1
  fi
  local node_ver
  node_ver=$(node --version | sed 's/v//' | cut -d. -f1)
  if [ "$node_ver" -lt 18 ]; then
    err "Node.js 18+ required (found v$(node --version))"
    exit 1
  fi
  ok "Node $(node --version) / npm $(npm --version)"
}

# ── Cleanup on exit ───────────────────────────────────────────────────────────
cleanup() {
  echo ""
  label "Shutting down"
  [ -n "$FE_PID" ] && kill "$FE_PID" 2>/dev/null && ok "Frontend stopped"
  [ -n "$BE_PID" ] && kill "$BE_PID" 2>/dev/null && ok "Backend stopped"
  free_port $BE_PORT 2>/dev/null || true
  free_port $FE_PORT 2>/dev/null || true
  echo ""
  exit 0
}
trap cleanup SIGINT SIGTERM EXIT

# ── Parse args ────────────────────────────────────────────────────────────────
REINSTALL=0
for arg in "$@"; do
  case $arg in
    --reinstall|-r) REINSTALL=1 ;;
    --help|-h)
      echo ""
      echo "  Usage: ./start.sh [options]"
      echo ""
      echo "  Options:"
      echo "    --reinstall, -r    Force reinstall all node_modules"
      echo "    --help, -h         Show this help"
      echo ""
      exit 0
      ;;
  esac
done

# ── Header ────────────────────────────────────────────────────────────────────
clear
echo ""
echo -e "  ${BOLD}${CYAN}AI AutoFill${NC}"
echo -e "  ${DIM}Intelligent form automation, powered by open-source AI${NC}"
echo ""

# ── Step 1: Requirements ──────────────────────────────────────────────────────
label "Requirements"
check_requirements

# ── Step 2: Dependencies ──────────────────────────────────────────────────────
label "Dependencies"
install_if_needed "$BE_DIR" "Backend" "$REINSTALL"
install_if_needed "$FE_DIR" "Frontend" "$REINSTALL"

# ── Step 3: Ports ─────────────────────────────────────────────────────────────
label "Port Management"
free_port $BE_PORT
free_port $FE_PORT

# ── Step 4: Start backend ─────────────────────────────────────────────────────
label "Starting Servers"
(cd "$BE_DIR" && node server.js 2>&1 | sed 's/^/  [backend] /' ) &
BE_PID=$!
sleep 1

# Verify backend started
if ! kill -0 "$BE_PID" 2>/dev/null; then
  err "Backend failed to start — check logs above"
  exit 1
fi
ok "Backend   http://localhost:$BE_PORT"

# ── Step 5: Start frontend ────────────────────────────────────────────────────
(cd "$FE_DIR" && npm run dev -- --port $FE_PORT 2>&1 | sed 's/^/  [frontend] /' ) &
FE_PID=$!
sleep 3

if ! kill -0 "$FE_PID" 2>/dev/null; then
  err "Frontend failed to start — check logs above"
  exit 1
fi
ok "Frontend  http://localhost:$FE_PORT"

# ── Ready ─────────────────────────────────────────────────────────────────────
echo ""
line
echo -e "  ${BOLD}Ready.${NC} Open ${CYAN}http://localhost:$FE_PORT${NC} in your browser"
echo -e "  ${DIM}Press Ctrl+C to stop all servers${NC}"
line
echo ""

# Keep alive — wait for child processes
wait
