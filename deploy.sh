#!/usr/bin/env bash
# ============================================================
# HRMate — One-Shot VPS Deployment Script
# GD Foods Mfg. (I) Pvt. Ltd. · Khadur Sahib Unit
# ============================================================
set -euo pipefail

DOMAIN="hr.flavorflow.co.in"
FALLBACK_DOMAIN="gdfoods.duckdns.org"
BRANCH="arena/01a056d6-hrmate"
REPO="https://github.com/manjotkhehra025-cloud/HRMate.git"
INSTALL_DIR="/opt/hrmate"

# Terminal Colors
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

info()  { echo -e "${GREEN}[HRMate]${NC} $1"; }
warn()  { echo -e "${YELLOW}[!]${NC} $1"; }
fail()  { echo -e "${RED}[X]${NC} $1"; exit 1; }

# Check root privilege
if [ "$(id -u)" -ne 0 ]; then
  fail "Please run as root (e.g. sudo bash deploy.sh or curl | sudo bash)"
fi

info "Step 1/5 — Checking and allocating swap memory for safe compilation"
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
  info "Swap already active."
fi

info "Step 2/5 — Preparing codebase in ${INSTALL_DIR}"
if [ ! -d "$INSTALL_DIR/.git" ]; then
  info "Cloning fresh repository..."
  mkdir -p "$INSTALL_DIR"
  git clone -b "$BRANCH" "$REPO" "$INSTALL_DIR"
else
  info "Updating existing repository..."
  cd "$INSTALL_DIR"
  git config --global --add safe.directory "$INSTALL_DIR"
  git fetch origin "$BRANCH"
  git reset --hard "origin/$BRANCH"
fi

cd "$INSTALL_DIR"

# Ensure .env file exists
if [ ! -f .env ]; then
  info "Creating default .env file..."
  cat << 'EOF' > .env
NODE_ENV=production
PORT=3000
HRMATE_DB=/app/data/hrmate.db
PRIMARY_DOMAIN=hr.flavorflow.co.in
FALLBACK_DOMAIN=gdfoods.duckdns.org
EOF
fi

# Ensure data directory permissions
mkdir -p data
chmod 777 data

info "Step 3/5 — Building and restarting Docker containers"
docker compose down || true
docker compose up -d --build --remove-orphans

info "Step 4/5 — Verifying container health"
sleep 5
docker compose ps

info "Step 5/5 — Verifying Caddy HTTPS reverse proxy"
if command -v systemctl &>/dev/null && systemctl is-active --quiet caddy; then
  systemctl reload caddy || true
fi

echo ""
echo -e "${GREEN}==============================================================${NC}"
echo -e "${GREEN}  🎉 HRMate deployed successfully on VPS!${NC}"
echo -e "${GREEN}  🌐 Primary URL:  https://${DOMAIN}${NC}"
echo -e "${GREEN}  🌐 Fallback URL: https://${FALLBACK_DOMAIN}${NC}"
echo -e "${GREEN}==============================================================${NC}"
