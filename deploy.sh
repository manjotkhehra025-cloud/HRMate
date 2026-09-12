#!/usr/bin/env bash
# ============================================================
# HRMate — one-shot VPS deploy script
# ============================================================
set -euo pipefail

DOMAIN="gdfoods.duckdns.org"
BRANCH="arena/01a056d6-hrmate"
REPO="https://github.com/manjotkhehra025-cloud/HRMate.git"
INSTALL_DIR="/opt/hrmate"

# Colors
GREEN='\033[0;32m'; YELLOW='\033[1;33m'; RED='\033[0;31m'; NC='\033[0m'
info()  { echo -e "${GREEN}[HRMate]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[X]${NC} $1"; exit 1; }

if [ "$(id -u)" -ne 0 ]; then
  fail "Please run as root (use: sudo bash deploy.sh)"
fi

info "Step 1/4 — Ensuring swap memory"
SWAP_SIZE="${SWAP_SIZE:-2G}"
if ! swapon --show | grep -q swap; then
  if [ ! -f /swapfile ]; then
    fallocate -l "$SWAP_SIZE" /swapfile || dd if=/dev/zero of=/swapfile bs=1M count=2048 status=none
    chmod 600 /swapfile
    mkswap /swapfile >/dev/null
  fi
  swapon /swapfile
  grep -q '/swapfile' /etc/fstab || echo '/swapfile none swap sw 0 0' >> /etc/fstab
  info "Swap enabled ($SWAP_SIZE)."
else
  info "Swap already enabled."
fi

info "Step 2/4 — Updating HRMate repository"
cd "$INSTALL_DIR"
git config --global --add safe.directory "$INSTALL_DIR"
git fetch origin "$BRANCH"
git reset --hard "origin/$BRANCH"

info "Step 3/4 — Rebuilding Docker containers"
docker compose down || true
docker compose up -d --build

info "Step 4/4 — Checking container status"
sleep 5
docker compose ps

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  HRMate deployed successfully! 🎉${NC}"
echo -e "${GREEN}  URL: https://${DOMAIN}${NC}"
echo -e "${GREEN}================================================${NC}"
