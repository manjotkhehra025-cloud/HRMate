# 📱 HRMate 100% Native Android App & Google Play Store Guide

HRMate Android is built as a **100% Native Full-Screen Android Application** (`com.gdfoods.hrmate`), without any Chrome URL bar, browser controls, or external tab redirects.

---

## 🌟 Native App Features Included
- **Zero Chrome UI**: True full-screen native Android interface (no address bar, no 3 dots menu).
- **Native Hardware Access**:
  - Direct GPS Geolocation permissions auto-handling for Punch In/Punch Out.
  - Native Camera & File Picker dialog for Avatar selfies and document attachments.
  - Push Notification support (`POST_NOTIFICATIONS`).
- **Native UX**:
  - Top progress bar during page transitions.
  - Pull-to-refresh (`SwipeRefreshLayout`).
  - Android Back Button navigation with double-tap exit prevention.
  - Offline retry screen when network connection drops.

---

## 🔑 Production Keystore & Package Details

| Field | Value |
|---|---|
| **Package Name / Application ID** | `com.gdfoods.hrmate` |
| **Keystore File** | `hrmate-release.keystore` (in root & `android/app/`) |
| **Keystore Download URL** | `https://gdfoods.duckdns.org/hrmate-release.keystore` |
| **Key Alias** | `hrmate` |
| **Keystore Password** | `hrmatepassword123` |
| **Key Password** | `hrmatepassword123` |
| **SHA-256 Fingerprint** | `6F:60:81:B7:30:2E:37:6A:3F:A8:D7:A2:21:C4:C4:79:8E:E9:F5:26:B3:3E:F5:AC:B4:47:C6:DA:FA:7A:07:DF` |

---

## 🚀 How to Build Signed APK & Play Store AAB

### Method 1: 1-Click Codemagic CI/CD Build (Recommended)
1. Open your **[Codemagic Dashboard](https://codemagic.io/apps)**.
2. Select **HRMate**.
3. Click **Start new build** on the `arena/01a056d6-hrmate` branch.
4. Download your artifacts:
   - `app-release.apk` *(Install directly on your Android phone - 100% native!)*
   - `app-release.aab` *(Upload to Google Play Console)*

### Method 2: Local Build
```bash
cd android
gradle bundleRelease assembleRelease
```
Outputs:
- Bundle: `android/app/build/outputs/bundle/release/app-release.aab`
- APK: `android/app/build/outputs/apk/release/app-release.apk`

---

## 📦 Publishing to Google Play Console
1. Log into **[Google Play Console](https://play.google.com/console)**.
2. Click **Create App** → App Name: **HRMate**, Free.
3. Complete Store Listing & Content Rating questionnaires.
4. Go to **Production** (or **Testing → Internal Testing**) → **Create new release**.
5. Upload `app-release.aab`.
6. Submit for Google Review!
