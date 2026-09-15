# HRMate Native Android Build Guide

HRMate includes a native Android application wrapper in `/android` built with hardware acceleration, native biometrics prompt bridge, GPS/Location manager bridge, camera file chooser, and zero-browser controls.

---

## 🛠️ Requirements
- **JDK**: Java 17 (OpenJDK or Oracle)
- **Android SDK**: API 34 (Android 14) with Build-Tools 34.0.0
- **Keystore**: Preconfigured at `android/app/hrmate-release.keystore`
  - Keystore Password: `hrmatepassword123`
  - Key Alias: `hrmate`
  - Key Password: `hrmatepassword123`

---

## 🚀 One-Command Build (Release APK + Play Store AAB)

From the repository root:
```bash
./scripts/build-android.sh
```

Or inside the `android` folder:
```bash
cd android
chmod +x ./gradlew
./gradlew clean assembleRelease bundleRelease
```

---

## 📦 Generated Outputs

1. **Signed Release APK (Direct Device Installation):**
   ```
   android/app/build/outputs/apk/release/app-release.apk
   ```

2. **Signed Google Play Store Bundle (AAB):**
   ```
   android/app/build/outputs/bundle/release/app-release.aab
   ```

---

## 💻 Building via Android Studio
1. Open Android Studio.
2. Select **Open** and choose the `HRMate/android` folder.
3. Allow Gradle to sync.
4. Go to **Build** → **Generate Signed Bundle / APK...**
5. Select either **Android App Bundle** (for Play Store) or **APK** (for direct phone install).
6. Point to `android/app/hrmate-release.keystore` with credentials `hrmatepassword123`.
7. Select **Release** and click **Finish**.
