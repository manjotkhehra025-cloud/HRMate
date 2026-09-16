# 📱 HRMate 100% Native Android App & Google Play Store Guide

HRMate Android is built as a **100% Native Full-Screen Android Application** (`in.flavorflow.hrmate`), without any Chrome URL bar, browser controls, or external tab redirects.

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
| **Package Name / Application ID** | `in.flavorflow.hrmate` |
| **Keystore Management** | Codemagic Environment Group `hrmate_release` |
| **Key Alias** | `hrmate3` |
| **Status** | Managed securely in CI/CD environment (never committed to git) |

---

## 🚀 How to Build Signed APK & Play Store AAB

### Method 1: 1-Click Codemagic CI/CD Build (Recommended)
1. Open your **[Codemagic Dashboard](https://codemagic.io/apps)**.
2. Select **HRMate**.
3. Run workflow **HRMate Native Android Prod (Release APK & AAB)**.
4. Download your artifacts:
   - `app-prod-release.apk` *(Install directly on your Android phone)*
   - `app-prod-release.aab` *(Upload to Google Play Console)*

---

## 📦 Publishing to Google Play Console
1. Log into **[Google Play Console](https://play.google.com/console)**.
2. Click **Create App** → App Name: **HRMate**, Free.
3. Complete Store Listing & Content Rating questionnaires.
4. Go to **Production** (or **Testing → Internal Testing**) → **Create new release**.
5. Upload `app-prod-release.aab`.
6. Submit for Google Review!
