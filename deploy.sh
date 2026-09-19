#!/usr/bin/env bash
# ============================================================
# HRMate — One-Shot VPS Deployment Script
# GD Foods Mfg. (I) Pvt. Ltd. · Khadur Sahib Unit
# ============================================================
set -euo pipefail

# HRMate lives ONLY on this domain. (hr.flavorflow.co.in is reserved for the
# upcoming new app — see Caddyfile.)
DOMAIN="gdfoods.duckdns.org"
OLD_DOMAIN="hr.flavorflow.co.in"
BRANCH="arena/01a0b810-hrmate"
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

# Ensure .env file exists and has MOBILE_JWT_SECRET
if [ ! -f .env ]; then
  info "Creating default .env file..."
  cat << EOF > .env
NODE_ENV=production
PORT=3000
HRMATE_DB=/app/data/hrmate.db
HRMATE_DOMAIN=${DOMAIN}
HRMATE_RP_ID=${DOMAIN}
HRMATE_ORIGIN=https://${DOMAIN}
MOBILE_JWT_SECRET=hrmate_mobile_jwt_production_secret_2026_gdfoods_khadur_sahib
EOF
else
  if ! grep -q "MOBILE_JWT_SECRET" .env; then
    echo "MOBILE_JWT_SECRET=hrmate_mobile_jwt_production_secret_2026_gdfoods_khadur_sahib" >> .env
  fi
  # Domain migration: an .env written by an older deploy still points at the
  # old domain. Rewrite it so passkeys / cookies / origin checks use ${DOMAIN}.
  if grep -q "$OLD_DOMAIN" .env; then
    warn "Migrating .env from ${OLD_DOMAIN} to ${DOMAIN}"
    cp .env ".env.bak.$(date +%Y%m%d%H%M%S)"
    sed -i "s/${OLD_DOMAIN//./\\.}/${DOMAIN}/g" .env
  fi
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
# Caddy runs inside docker compose and re-reads ./Caddyfile on (re)start, so it
# already picked up the new config above. Ask it to re-validate anyway so a
# typo in the Caddyfile shows up here instead of as a silent outage.
if docker compose exec -T caddy caddy validate --config /etc/caddy/Caddyfile >/dev/null 2>&1; then
  info "Caddyfile OK — serving https://${DOMAIN}"
else
  warn "Caddy could not validate the Caddyfile — check: docker compose logs caddy"
fi
if command -v systemctl &>/dev/null && systemctl is-active --quiet caddy; then
  # A host-level Caddy (from an older setup) would fight for ports 80/443.
  warn "A host-level caddy service is also running — HRMate's Caddy is the docker one."
fi

echo ""
echo -e "${GREEN}==============================================================${NC}"
echo -e "${GREEN}  🎉 HRMate deployed successfully on VPS!${NC}"
echo -e "${GREEN}  🌐 URL: https://${DOMAIN}${NC}"
echo -e "${YELLOW}  ℹ  ${OLD_DOMAIN} no longer serves HRMate (temporary 302 → ${DOMAIN})${NC}"
echo -e "${YELLOW}     It is free for the new app — see the last block in Caddyfile.${NC}"
echo -e "${GREEN}==============================================================${NC}"
