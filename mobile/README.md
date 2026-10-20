# ilo4-remote (mobile)

Capacitor-based native mobile application for Android and iOS.

---

### Structure

- `www/`: Mobile web application assets (HTML, CSS, vanilla JS controller).
- `android/`: Native Android project with Gradle wrapper, Capacitor Android runtime, and network security configuration.
- `ios/`: Native Xcode workspace (`App.xcworkspace`) with Podfile and Capacitor iOS runtime.

---

### Prerequisites

- Node.js 18 or newer
- JDK 17 (Temurin or OpenJDK)
- Android SDK (API level 33+)
- Xcode 15+ (for local iOS builds on macOS)

---

### Development & Build

```bash
# 1. Install dependencies
npm install

# 2. Sync web assets into native platform projects
npx cap sync

# 3. Build Android APK
cd android
./gradlew assembleDebug

# Output APK path:
# android/app/build/outputs/apk/debug/app-debug.apk

# 4. Open iOS project in Xcode
cd ../ios/App
open App.xcworkspace
```

---

### CI/CD

Automated builds run on tag pushes via `.github/workflows/build-and-release.yml` using GitHub-hosted `ubuntu-latest` and `macos-14` runners.
