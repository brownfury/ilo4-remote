# HPE iLO 4 Remote & Command Center

[![Release](https://img.shields.io/badge/Release-v1.0.0-blue.svg)](https://github.com)
[![Platform](https://img.shields.io/badge/Platforms-Android%20%7C%20iOS%20%7C%20Web-green.svg)](https://github.com)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An open-source mobile app (**Installable Android APK** & **Sideloadable iOS IPA**) and full-scale web management suite for **HP Integrated Lights-Out 4 (iLO 4)** servers (such as HPE ProLiant Gen8 & Gen9).

---

## 📦 What's Included

```
ilo_4_interactive/
├── releases/
│   └── ilo4-remote-v1.0.0.apk        # Ready-to-install Android APK (compiled & tested)
├── mobile/                           # Cross-platform Mobile App (Capacitor + Native Android & iOS)
│   ├── android/                      # Native Android project with Gradle wrapper
│   ├── ios/                          # Native iOS Xcode workspace (App.xcworkspace)
│   └── www/                          # Mobile-optimized OLED touch interface
├── .github/workflows/
│   └── build-and-release.yml         # CI/CD: Automated APK & IPA builds on GitHub Releases
├── app.py                            # Companion FastAPI Web Server & API Gateway
├── ilo_client.py                     # Unified HPE iLO 4 RESTful & RIBCL bridge
├── templates/ & static/              # Web Command Center Dashboard
├── run.sh                            # Gateway startup script
└── LICENSE                           # MIT Open Source License
```

---

## 📱 Mobile App (Android APK & iOS IPA)

Manage and monitor your server directly from your mobile device over local Wi-Fi or via the companion gateway.

### 📥 Install Android APK
- Direct file ready in [`releases/ilo4-remote-v1.0.0.apk`](releases/ilo4-remote-v1.0.0.apk).
- Transfer to your Android phone, tap to install, and connect directly to your iLO 4 controller (`https://192.168.8.53`).

### 🍏 iOS Sideloading (IPA)
- Use **AltStore**, **SideStore**, **TrollStore**, or **Sideloadly** to install the generated `.ipa` directly on iPhone/iPad.
- Or open [`mobile/ios/App/App.xcworkspace`](mobile/ios/App/App.xcworkspace) in Xcode and run directly on your device.

### ✨ Mobile Highlights:
- **Circular Glow Power Dial**: Real-time status ring with auto-polling.
- **Power Actions**: Power ON, Clean ACPI Shutdown, Force OFF (instant cut), Hardware Reset, and Momentary Button Press.
- **Unit Identification (UID) Beacon**: Toggle the blue chassis LED from your phone.
- **HPE Sea of Sensors™**: Live temperatures across 46 zones with thermal alert thresholds.
- **Fan Tachometers**: Real-time RPM percentages across all 8 cooling fans.
- **Power Supplies**: Redundancy state, health, and live output wattage.
- **Event Logs**: Integrated Management Log (IML) and iLO Event Log (IEL) with severity filters.
- **Mobile REST API Explorer**: Search 128 endpoints, send requests with custom JSON payloads, and inspect live responses.

See [mobile/README.md](mobile/README.md) for full mobile documentation and build guides.

---

## 🌐 Web Command Center & API Gateway

In addition to the standalone mobile app, a web gateway is included for home lab dashboards and full RIBCL CLI commands:

- **Local Access**: `http://localhost:8000`
- **Home LAN Access**: `http://192.168.8.124:8000` (accessible from any browser on your home network)
- **Start Gateway**:
  ```bash
  ./run.sh
  ```

---

## 🐙 Publishing to GitHub (Open Source Release)

To publish this project to your GitHub account:

1. Create a new repository on [GitHub](https://github.com/new) named `ilo4-remote` (or your preferred name).
2. Add the remote and push:
   ```bash
   git add .
   git commit -m "feat: initial open-source release of iLO 4 Remote (Android APK, iOS, Web)"
   git remote add origin https://github.com/<your-username>/ilo4-remote.git
   git branch -M main
   git push -u origin main
   ```
3. Create a release tag to trigger the automatic APK & IPA build:
   ```bash
   git tag v1.0.0
   git push origin v1.0.0
   ```
   GitHub Actions will automatically build the Android APK and iOS IPA and publish them under your repository's **Releases** tab for public download!

---

## 📄 License

This project is licensed under the [MIT License](LICENSE).
