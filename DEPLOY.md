# 🚀 Deploying HRMate to your VPS (gdfoods.duckdns.org)

> **Fastest way:** a one-shot script does everything (removes old Nginx, installs
> Docker, clones the repo and launches HRMate behind Caddy with HTTPS).
>
> ```bash
> curl -fsSL https://raw.githubusercontent.com/manjotkhehra025-cloud/HRMate/arena/01a0b810-hrmate/deploy.sh | sudo bash
> ```
>
> Read on for the manual, step-by-step instructions.

This guide takes HRMate from this repo to a live, HTTPS-enabled site on your
Google Cloud VPS, served behind **Caddy** (automatic Let's Encrypt certificates)
in **Docker**.

Your DuckDNS domain `gdfoods.duckdns.org` already points to your VPS IP — so
Caddy will automatically obtain a valid SSL certificate on first start.

> **Domain note (Sept 2026):** HRMate is served **only** on
> `https://gdfoods.duckdns.org`. It has been **moved off `hr.flavorflow.co.in`**,
> which is now reserved for a different, new app. See
> [Domain move: hr.flavorflow.co.in → gdfoods.duckdns.org](#6-domain-move-hrflavorflowcoin--gdfoodsduckdnsorg)
> at the end of this guide for what changed and what your users need to do.

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
git checkout arena/01a0b810-hrmate
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
git pull origin arena/01a0b810-hrmate
docker compose up -d --build
```

Your SQLite data lives in the `hrmate_data` Docker volume, so it persists across
rebuilds.

---

## 6. Domain move: hr.flavorflow.co.in → gdfoods.duckdns.org

HRMate used to answer on both `hr.flavorflow.co.in` (primary) and
`gdfoods.duckdns.org` (fallback). It now lives **only on `gdfoods.duckdns.org`**;
`hr.flavorflow.co.in` is free for the new app.

### What the move changes

| Item | Effect |
|------|--------|
| **Data** | Nothing to migrate — same VPS, same `hrmate_data` volume (SQLite DB + published APKs). |
| **TLS certificate** | Caddy already holds a certificate for `gdfoods.duckdns.org`; no new issuance needed. |
| **Sessions** | Cookies are per-domain → everyone signs in once more on the new address. |
| **Passkeys / Face ID / fingerprint (WebAuthn)** | A passkey is bound to the domain it was created on. Passkeys created on `hr.flavorflow.co.in` **will not appear** on `gdfoods.duckdns.org`. Users log in with their password once and add a new passkey from **Profile → Passkeys** (the old, dead entries can be deleted there). Passkeys that were already created on `gdfoods.duckdns.org` keep working. |
| **Android biometric unlock** | Token lives in the app's storage for the old origin → log in once with password, then re-enable biometric unlock. |
| **Push notifications** | Subscriptions are per-origin → users tap **Enable notifications** again on the new address. |
| **Installed PWA** | Was installed from the old origin → uninstall and re-add to home screen from `https://gdfoods.duckdns.org`. |
| **Android APK** | `android/` now hard-codes `https://gdfoods.duckdns.org` (v1.0.6, versionCode 6). **Build it and roll it out to staff** (`/download` page) — see below. |

### ⚠️ Roll out the new APK *before* the new app goes live on hr.flavorflow.co.in

Older APK builds (≤ 1.0.5) open `https://hr.flavorflow.co.in` on start. Right now
that address answers with a **temporary 302 redirect** to `gdfoods.duckdns.org`
(last block in `Caddyfile`), so old installs keep working during the transition.
The moment the new app takes over `hr.flavorflow.co.in`, any phone still on an
old HRMate APK would open **the new app inside the HRMate shell**. So:

1. Build the 1.0.6 APK (`cd android && ./gradlew assembleRelease`, or Android Studio).
2. Publish it: `sudo bash /opt/hrmate/scripts/publish-apk.sh app-release.apk 1.0.6 6`
3. Have staff update from `https://gdfoods.duckdns.org/download`.
4. Only then hand `hr.flavorflow.co.in` to the new app.

### Handing hr.flavorflow.co.in to the new app

- **New app on the same VPS:** ports 80/443 belong to HRMate's Caddy container,
  so the new app must be published through it. Replace the `hr.flavorflow.co.in`
  block at the bottom of `Caddyfile` with the new app's config, e.g.

  ```caddyfile
  hr.flavorflow.co.in {
  	reverse_proxy newapp:PORT
  }
  ```

  (put the new app's container on the `hrmate_net` network, or point at
  `host.docker.internal:PORT`), then `docker compose restart caddy`.
- **New app somewhere else:** delete that block, `docker compose restart caddy`,
  and repoint the `hr.flavorflow.co.in` DNS record to the new host.

Nothing else in HRMate references `hr.flavorflow.co.in` any more.
