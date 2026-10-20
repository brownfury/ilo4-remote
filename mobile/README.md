# 📱 iLO 4 Remote - Mobile Application (Android & iOS)

> *"A small effort for the homelab and HPE community to give our trusted Gen8 and Gen9 servers the reliable mobile experience they deserve."*
> — Dibya Mahakur ([@brownfury](https://github.com/brownfury))

---

## 📖 The Story Behind This Project

For years, owners of **HPE ProLiant Gen8 and Gen9 servers** (like the ML350, DL380, and DL360) have been stuck with an abandoned, non-functional official HP iLO app on modern iOS and Android versions. Typing in a host address and credentials almost always ends in infinite hangs, silent failures, or SSL handshake aborts.

**iLO 4 Remote** was built to solve this:
- **Direct-to-Hardware**: Speaks directly to your iLO 4 over local Wi-Fi or VPN using native HTTPS REST (`/rest/v1`).
- **Zero Configuration Needed on the Host**: No agents, daemons, or middleman servers required.
- **Universal Compatibility**: Works out-of-the-box on both Android smartphones and iPhones/iPads.
- **Production & Homelab Ready**: Supports power cycling, Sea of Sensors thermal monitoring, cooling fan duty cycles, diagnostic logs, and raw REST exploration.

---

## 📦 Direct Downloads

- 🍏 **Apple iOS (IPA)**: [Download `ilo4-remote-v1.0.2.ipa`](https://github.com/brownfury/ilo4-remote/releases/download/v1.0.2/ilo4-remote-v1.0.2.ipa)
- 🤖 **Android (APK)**: [Download `ilo4-remote-v1.0.2.apk`](https://github.com/brownfury/ilo4-remote/releases/download/v1.0.2/ilo4-remote-v1.0.2.apk)

---

## 🛠️ Building the Mobile App Locally

### Prerequisites
- Node.js 18+ & npm
- JDK 17 (Adoptium Temurin)
- Android SDK (API 33+)
- Xcode (for iOS builds on macOS)

### Quick Build
```bash
# 1. Install dependencies
cd mobile
npm install

# 2. Sync web assets into native platform directories
npx cap sync

# 3. Build Android APK
cd android
./gradlew assembleDebug

# Output APK:
# android/app/build/outputs/apk/debug/app-debug.apk

# 4. Open iOS project in Xcode (macOS only)
cd ../ios/App
open App.xcworkspace
```

---

## 📄 License
MIT License. Free and open source for the community.
