#!/usr/bin/env bash
# ============================================================
# HRMate — one-shot VPS deploy script
# Does everything:
#   1. Remove the old Nginx site (port 80/443)
#   2. Install Docker + Compose
#   3. Clone the repo
#   4. Build & launch HRMate behind Caddy (auto HTTPS)
#
# Usage (on the VPS):
#   curl -fsSL https://raw.githubusercontent.com/manjotkhehra025-cloud/HRMate/arena/01a04984-hrmate/deploy.sh | sudo bash
# ============================================================
set -euo pipefail

DOMAIN="gdfoods.duckdns.org"
BRANCH="arena/01a04984-hrmate"
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

info "Step 1/4 — Removing old Nginx site"
if systemctl is-active --quiet nginx 2>/dev/null; then
  systemctl stop nginx
fi
systemctl disable nginx 2>/dev/null || true
apt-get purge -y nginx nginx-common nginx-full nginx-core 2>/dev/null || true
rm -rf /etc/nginx /var/www/html /var/www/* 2>/dev/null || true
apt-get autoremove -y >/dev/null 2>&1 || true
apt-get autoclean -y >/dev/null 2>&1 || true
info "Nginx removed."

info "Step 1b/4 — Ensuring swap memory (build needs RAM)"
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

info "Step 2/4 — Installing Docker + Compose"
if ! command -v docker >/dev/null 2>&1; then
  apt-get update -y
  apt-get install -y docker.io docker-compose-v2
  systemctl enable --now docker
else
  info "Docker already installed."
fi
if ! docker compose version >/dev/null 2>&1; then
  fail "docker compose plugin missing — install with: apt-get install -y docker-compose-v2"
fi
info "Docker ready: $(docker --version)"

info "Step 3/4 — Cloning HRMate"
if [ -d "$INSTALL_DIR/.git" ]; then
  info "Existing checkout found — pulling latest."
  cd "$INSTALL_DIR"
  git fetch origin
  git checkout "$BRANCH"
  git pull origin "$BRANCH"
else
  rm -rf "$INSTALL_DIR"
  git clone "$REPO" "$INSTALL_DIR"
  cd "$INSTALL_DIR"
  git checkout "$BRANCH"
fi

info "Step 4/4 — Building & launching"
docker compose up -d --build

info "Waiting for containers to start..."
sleep 5
docker compose ps

echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}  HRMate deployed! 🎉${NC}"
echo -e "${GREEN}  URL: https://${DOMAIN}${NC}"
echo ""
echo -e "  Logs:  cd ${INSTALL_DIR} && docker compose logs -f"
echo -e "  NOTE:  It can take 1-2 min for Caddy to get the SSL cert."
echo -e "${GREEN}================================================${NC}"
