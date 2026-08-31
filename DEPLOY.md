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
git checkout arena/01a04984-hrmate   # or main after merge
```

---

## 4. (Recommended) Generate your own VAPID keys for push

```bash
docker run --rm node:20-bookworm-slim npx web-push generate-vapid-keys
```

Copy the output and edit `docker-compose.yml`:

```yaml
environment:
  NEXT_PUBLIC_VAPID_PUBLIC_KEY: "PASTE_PUBLIC_KEY"
  VAPID_PRIVATE_KEY: "PASTE_PRIVATE_KEY"
```

> Leave these blank to use the bundled demo keys while testing.

---

## 5. Launch

```bash
docker compose up -d --build
```

Check logs:

```bash
docker compose logs -f
```

Then open **https://gdfoods.duckdns.org** in your browser. 🎉

First run will take a minute or two while:
1. The image builds (compiles better-sqlite3 + Next.js).
2. Caddy obtains the SSL certificate from Let's Encrypt.

---

## 6. Update the app later

```bash
cd /opt/hrmate
git pull
docker compose up -d --build
```

Your SQLite data lives in the `hrmate_data` Docker volume, so it persists across
rebuilds. Back it up with:

```bash
docker run --rm -v hrmate_data:/data -v $(pwd):/backup alpine tar czf /backup/hrmate-backup.tar.gz -C /data .
```

---

## 7. Post-deploy setup (do this once in the UI)

1. Log in as super admin: `admin@hrmate.com` / `admin123` (change it!).
2. **Admin → Factory Settings** → set your real factory coordinates + geofence
   radius (use "Use my current location" while standing at the factory).
3. **Admin → Users** → create your real team.
4. Ask each user to **Profile & Security → Add passkey** and **Enable notifications**
   (on an HTTPS origin, push + passkeys both work fully).

---

## Troubleshooting

| Problem | Fix |
|---------|-----|
| Passkey login fails | Ensure `HRMATE_RP_ID` / `HRMATE_ORIGIN` match your exact domain in `docker-compose.yml`, then `docker compose up -d` again. |
| No HTTPS / cert error | Confirm port 80 is open to the internet and DuckDNS resolves to this VPS IP. Caddy needs port 80 for the HTTP-01 challenge. |
| Push notifications don't arrive | Must be on HTTPS; check the browser console and that you clicked "Enable notifications". |
| Site not reachable | `docker compose ps`, verify both `hrmate` and `hrmate-caddy` are running; check GCP firewall for 80/443. |
