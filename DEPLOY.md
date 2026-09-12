# 🚀 Deploying HRMate to your VPS (dfoods.duckdns.org)

> **Fastest way:** a one-shot script does everything (removes old Nginx, installs
> Docker, clones the repo and launches HRMate behind Caddy with HTTPS).
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/manjotkhehra025-cloud/HRMate/arena/01a056d6-hrmate/deploy.sh | sudo bash
> ```
>
> Read on for the manual, step-by-step instructions.

This guide takes HRMate from this repo to a live, HTTPS-enabled site on your
Google Cloud VPS, served behind **Caddy** (automatic Let's Encrypt certificates)
in **Docker**.

Your DuckDNS domain `dfoods.duckdns.org` already points to your VPS IP — so
Caddy will automatically obtain a valid SSL certificate on first start.

---

## 1. Requirements on the VPS

- A Google Cloud VM (any small e2-micro / e2-small works to start)
- Docker + Docker Compose installed
- Firewall rules allowing **TCP 22 (SSH)**, **80 (HTTP)** and **443 (HTTPS)**

### Install Docker + Compose (Ubuntu/Debian)

```bash
sudo apt-get update
sudo apt-get install -y ca-certificates curl
sudo install -m 0755 -d /etc/apt/keyrings
sudo curl -fsSL https://download.docker.com/linux/ubuntu/gpg -o /etc/apt/keyrings/docker.asc
sudo chmod a+r /etc/apt/keyrings/docker.asc

echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.asc] https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null

sudo apt-get update
sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
sudo systemctl enable --now docker
```

Verify:

```bash
docker --version
docker compose version
```

---

## 2. Open the firewall (Google Cloud)

1. Go to **Google Cloud Console → VPC network → Firewall**.
2. Create rules allowing ingress on:
   - `tcp:22` (SSH)
   - `tcp:80` (HTTP — required for Let's Encrypt)
   - `tcp:443` (HTTPS)

> Your VM's **external IP** should already be what DuckDNS resolves for
> `gdfoods.duckdns.org`. If you change the IP, update the DuckDNS record.

---

## 3. Get the code onto the VPS

```bash
cd /opt
git clone https://github.com/manjotkhehra025-cloud/HRMate.git hrmate
cd hrmate
git checkout arena/01a056d6-hrmate
```

---

## 4. Launch

```bash
docker compose up -d --build
```

Check logs:

```bash
docker compose logs -f
```

Then open **https://gdfoods.duckdns.org** in your browser. 🎉

---

## 5. Update the app later

```bash
cd /opt/hrmate
git pull origin arena/01a056d6-hrmate
docker compose up -d --build
```

Your SQLite data lives in the `hrmate_data` Docker volume, so it persists across
rebuilds.
