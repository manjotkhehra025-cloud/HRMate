#!/usr/bin/env bash
set -e

# ==============================================================================
# HRMate Native Android APK & Google Play AAB Build Automation Script
# ==============================================================================

echo "=========================================="
echo " Starting HRMate Android Native App Build "
echo "=========================================="

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT="$(cd "${SCRIPT_DIR}/.." && pwd)"
ANDROID_DIR="${REPO_ROOT}/android"

cd "${ANDROID_DIR}"

# Ensure gradlew has execute permissions
chmod +x ./gradlew

echo ""
echo "-> Cleaning and Building Signed Release APK & Google Play AAB..."
./gradlew clean assembleRelease bundleRelease --stacktrace

echo ""
echo "=========================================="
echo " BUILD SUCCESSFUL! "
echo "=========================================="
echo "Outputs generated:"
echo "1. Release APK (Direct Install):"
echo "   ${ANDROID_DIR}/app/build/outputs/apk/release/app-release.apk"
echo ""
echo "2. Release AAB (Google Play Store Bundle):"
echo "   ${ANDROID_DIR}/app/build/outputs/bundle/release/app-release.aab"
echo "=========================================="
