# 📱 Google Play Store Release Guide for HRMate

This guide explains how to generate the signed **Android App Bundle (`.aab`)** and **Release APK (`.apk`)** for **HRMate (`https://gdfoods.duckdns.org`)** to publish directly onto the **Google Play Store**.

---

## 🌟 Method 1: 1-Click Instant Build via PWABuilder (Recommended & Easiest)

You can generate the complete signed Google Play Store `.aab` package in **under 2 minutes** without installing Android Studio:

1. Open **[PWABuilder.com](https://www.pwabuilder.com/)** in your browser.
2. Enter your URL: `https://gdfoods.duckdns.org` and click **Start**.
3. It will test your PWA score (Manifest, Service Worker, HTTPS are all 100% verified ✓).
4. Click **Package for Stores** → Select **Android**.
5. In the settings form:
   - **Package ID**: `com.gdfoods.hrmate` (or your preferred package name)
   - **App Name**: `HRMate`
   - **Short Name**: `HRMate`
   - **Theme / Splash Color**: `#1E6FE0`
   - **Signing key**: Select *"Create new"* (or upload your existing keystore if you have one).
6. Click **Generate Package**.
7. Download the `.zip` file. Inside you will find:
   - `app-release-bundle.aab` *(This is the file you upload to Google Play Console)*
   - `assetlinks.json` *(Contains your SHA-256 fingerprint)*
   - `signing.keystore` *(Keep this safe for future updates!)*

---

## 🛠️ Method 2: Command-Line Build with Google Bubblewrap

If you prefer building from your computer terminal:

### Prerequisites:
- Node.js installed
- Java JDK 17+ and Android SDK

### Steps:
```bash
# 1. Install Google's official Bubblewrap CLI
npm install -g @bubblewrap/cli

# 2. Initialize from your live domain
bubblewrap init --manifest=https://gdfoods.duckdns.org/manifest.json

# 3. Build signed Android App Bundle (.aab) and APK (.apk)
bubblewrap build
```

This will output:
- `app-release-bundle.aab` (For Google Play Console)
- `app-release-signed.apk` (For direct installation on Android devices)

---

## 🔒 Full-Screen Verification (Digital Asset Links)

Google Play Trusted Web Activity (TWA) requires domain verification so the app runs in **100% full-screen native mode** (without any browser address bar).

1. In your **Google Play Console**, go to:  
   **Release → Setup → App Integrity → App Signing**.
2. Copy the **SHA-256 certificate fingerprint**.
3. Edit `public/.well-known/assetlinks.json` on your server and replace the fingerprint:
   ```json
   [
     {
       "relation": ["delegate_permission/common.handle_all_urls"],
       "target": {
         "namespace": "android_app",
         "package_name": "com.gdfoods.hrmate",
         "sha256_cert_fingerprints": [
           "YOUR_PLAY_STORE_SHA256_FINGERPRINT_HERE"
         ]
       }
     }
   ]
   ```
4. Verify by opening `https://gdfoods.duckdns.org/.well-known/assetlinks.json` in your browser.

---

## 🚀 Publishing on Google Play Console

1. Log into **[Google Play Console](https://play.google.com/console)**.
2. Click **Create App**:
   - App name: **HRMate**
   - Default language: **English** (or Punjabi / Hindi)
   - App type: **App**
   - Free / Paid: **Free**
3. Go to **Production → Create new release**.
4. Upload `app-release-bundle.aab`.
5. Fill in the Store Listing (Screenshots, Short description, Privacy Policy).
6. Click **Review and Release** → Submit for review! 🎉
