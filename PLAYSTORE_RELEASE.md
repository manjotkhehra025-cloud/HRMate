# 📱 Google Play Store Release Guide for HRMate

This guide explains how to generate the signed **Android App Bundle (`.aab`)** and **Release APK (`.apk`)** for **HRMate (`https://gdfoods.duckdns.org`)** to publish directly onto the **Google Play Store**.

---

## 🔑 Pre-Configured Android Signing Keystore

A production PKCS12 release keystore has already been created, placed in `android/app/hrmate-release.keystore`, and configured in the Android project and CI/CD workflow:

| Field | Value |
|---|---|
| **Keystore File** | `hrmate-release.keystore` (in repo root & `android/app/`) |
| **Download URL** | `https://gdfoods.duckdns.org/hrmate-release.keystore` |
| **Key Alias** | `hrmate` |
| **Keystore Password** | `hrmatepassword123` |
| **Key Password** | `hrmatepassword123` |
| **Package Name / Application ID** | `org.duckdns.gdfoods.twa` |
| **SHA-256 Fingerprint** | `6F:60:81:B7:30:2E:37:6A:3F:A8:D7:A2:21:C4:C4:79:8E:E9:F5:26:B3:3E:F5:AC:B4:47:C6:DA:FA:7A:07:DF` |

---

## 🚀 Method 1: Automatic Build via Codemagic CI/CD (Recommended)

The repository includes a ready-to-use `codemagic.yaml` with a native Gradle Android project in `android/`:

1. Open your [Codemagic Dashboard](https://codemagic.io/apps).
2. Select the **HRMate** repository.
3. Click **Start new build** → select workflow **HRMate Android Release Build (APK & AAB)**.
4. Codemagic will build in ~1 minute:
   - `app-release.aab` *(Android App Bundle for Google Play Store upload)*
   - `app-release.apk` *(Signed release APK for direct Android installation & testing)*
5. Download artifacts from the build page or your notification email (`manjotkhehra025@gmail.com`).

---

## 💻 Method 2: Local Gradle Build (On your computer / VPS)

If building locally:

```bash
cd android
chmod +x gradlew
./gradlew bundleRelease assembleRelease
```

Artifacts generated:
- Bundle: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## 🌐 Method 3: 1-Click Instant Build via PWABuilder

1. Open **[PWABuilder.com](https://www.pwabuilder.com/)** in your browser.
2. Enter your URL: `https://gdfoods.duckdns.org` and click **Start**.
3. Click **Package for Stores** → Select **Android**.
4. In the settings form:
   - **Package ID**: `org.duckdns.gdfoods.twa`
   - **App Name**: `HRMate`
   - **Short Name**: `HRMate`
   - **Theme / Splash Color**: `#1E6FE0`
   - **Signing key**: Upload `hrmate-release.keystore` (or generate new).
5. Click **Generate Package** and download the `.zip`.

---

## 🔒 Full-Screen Verification (Digital Asset Links)

Google Play Trusted Web Activity (TWA) uses Digital Asset Links verification so HRMate runs in **100% full-screen native mode without a browser URL bar**:

The live endpoint is pre-configured and active:
- URL: `https://gdfoods.duckdns.org/.well-known/assetlinks.json`
- Includes package `org.duckdns.gdfoods.twa` with SHA-256 fingerprint `6F:60:81:B7:30:2E:37:6A:3F:A8:D7:A2:21:C4:C4:79:8E:E9:F5:26:B3:3E:F5:AC:B4:47:C6:DA:FA:7A:07:DF`.

*Note: If you enable Google Play App Signing in Play Console, Google may generate an additional Play Signing key certificate. Simply add that SHA-256 fingerprint to `public/.well-known/assetlinks.json` alongside the existing one.*

---

## 📦 Uploading to Google Play Console

1. Log into **[Google Play Console](https://play.google.com/console)**.
2. Click **Create App**:
   - App name: **HRMate**
   - Default language: **English**
   - App type: **App**
   - Free / Paid: **Free**
3. Complete the Initial Setup steps (Content rating, Privacy Policy, Target audience).
4. Go to **Production** (or **Testing → Internal testing**) → Click **Create new release**.
5. Upload the signed `app-release.aab` file.
6. Enter release name (e.g., `1.0.0 (1)`) and release notes.
7. Click **Save** → **Review Release** → **Start rollout to Production**! 🎉
