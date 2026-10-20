# 🚀 iLO 4 Remote & Command Center

[![GitHub Release](https://img.shields.io/github/v/release/brownfury/ilo4-remote?color=blue&label=Release)](https://github.com/brownfury/ilo4-remote/releases)
[![Platform](https://img.shields.io/badge/Platforms-Android%20%7C%20iOS%20%7C%20Web-10b981.svg)](https://github.com/brownfury/ilo4-remote)
[![Homelab Ready](https://img.shields.io/badge/HPE-ProLiant%20Gen8%20%26%20Gen9-06b6d4.svg)](https://github.com/brownfury/ilo4-remote)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](LICENSE)

An open-source, mobile-first management suite (**Installable Android APK** & **Sideloadable iOS IPA**) plus companion web gateway for **HP Integrated Lights-Out 4 (iLO 4)** servers.

---

## 💡 Why This Exists: A Note from the Creator

> *"I have been using an **HPE ProLiant ML350 Gen9** tower for quite some time now, and I’ve always run into the exact same frustrating problem: the official HP iLO mobile app for iPhone and Android simply doesn't work.*
>
> *The moment you type in your server's hostname or IP, your username, and your password... nothing happens. It either hangs indefinitely, throws a silent error, or refuses to connect altogether due to outdated app runtimes and deprecated TLS handshakes.*
>
> *These 'good old machines'—like the ML350, DL380, and DL360 Gen8/Gen9 series—are absolute workhorses. Whether you are a homelab enthusiast running virtualization clusters, media servers, and experimental labs, or managing them in production-ready environments, they have years of dependable life left.*
>
> *I built **iLO 4 Remote** to fix this once and for all: a modern, snappy, beautiful, and completely open-source application that talks directly to your server's native REST APIs over local Wi-Fi, without needing cloud accounts or broken legacy apps.*
>
> *This is just my small effort for the homelab and sysadmin community. I hope it makes managing your servers as effortless as it should be."*
>
> — **Dibya Mahakur** ([@brownfury](https://github.com/brownfury))

---

## 📥 Download Ready-to-Use Mobile Apps

Download the latest release binaries directly from GitHub:

| Platform | Package | Download Link | Installation Method |
| :--- | :--- | :--- | :--- |
| 🍏 **Apple iOS** | `ilo4-remote-v1.0.2.ipa` (781 KB) | [**Download .IPA**](https://github.com/brownfury/ilo4-remote/releases/download/v1.0.2/ilo4-remote-v1.0.2.ipa) | Sideload via **AltStore**, **SideStore**, **TrollStore**, or **Sideloadly** |
| 🤖 **Android** | `ilo4-remote-v1.0.2.apk` (3.59 MB) | [**Download .APK**](https://github.com/brownfury/ilo4-remote/releases/download/v1.0.2/ilo4-remote-v1.0.2.apk) | Direct install (Enable *Allow from this source*) |

Local copies are also available directly in the repository under [`releases/`](releases/).

---

## ✨ Features Built for Server Owners

### 1. 🔒 Safe Multi-Server Connection Onboarding
- **Zero hardcoded credentials**: Point to any local IP (`192.168.x.x`), local domain (`ilo.lan`), or remote VPN address.
- **Multiple Server Profiles**: Save profiles for all your servers (e.g. *"Home Lab ML350"*, *"Rack DL380"*) and switch between them with one tap.
- **Direct Hardware Mode**: The phone connects straight to `https://<ilo-ip>/rest/v1` over local Wi-Fi without needing an intermediate PC turned on.
- **Gateway Mode**: Optional routing through the lightweight companion web server.

### 2. ⚡ Tactile Power Control Center
- **Circular Glow Power Dial**: Real-time animated status ring (Neon Green = Powered ON, Crimson = Standby/OFF) with live 4-second auto-polling.
- **Instant Power Actions**:
  - **Power ON**: Wake server from standby immediately.
  - **Graceful Shutdown**: Sends clean ACPI power signal to the operating system.
  - **Momentary Power Button**: Virtual physical push button tap.
  - **Force Power OFF**: Emergency instant power cut (with safety confirmation prompt).
  - **Hardware Reset / Reboot**: Cold hardware reboot cycle.
- **Chassis UID Beacon LED**: Toggle the server's blue Unit Identification light right from your pocket.

### 3. 🌡️ HPE Sea of Sensors™ Telemetry
- **46 Real-time Thermal Zones**: Motherboard ambient intake, dual CPU sockets, memory DIMMs, PCIe slots, storage controllers, and chipset temperatures with warning thresholds.
- **8 Cooling Fan Tachometers**: Real-time RPM speed percentages and redundancy status across all chassis cooling fans.
- **Power Supplies**: Real-time status, line voltage, and wattage output per bay.

### 4. 📜 Live Event Logs & Diagnostics
- **Integrated Management Log (IML)**: Hardware diagnostic events, alerts, and historical fault logs.
- **iLO Event Log (IEL)**: Management processor event stream with severity badges (`OK`, `Caution`, `Critical`).

### 5. 🔌 Mobile REST API Explorer
- Searchable browser across 128 native REST endpoints.
- Send `GET`, `POST`, `PATCH`, `DELETE` requests directly from your phone.
- Syntax-highlighted JSON viewer with one-tap clipboard copy.

---

## 🍏 Sideloading the iOS `.ipa`

Because Apple doesn't allow direct third-party `.ipa` installation without sideloading or App Store signing, you can install `ilo4-remote-v1.0.2.ipa` using any standard sideloading method:

```mermaid
graph LR
    A[Download .IPA] --> B[AltStore / SideStore]
    A --> C[Sideloadly (PC/Mac)]
    A --> D[TrollStore (iOS 14-17.0)]
    A --> E[Xcode (Source)]
    B --> F[Installed on iPhone / iPad]
    C --> F
    D --> F
    E --> F
```

- **AltStore / SideStore**: Open AltStore on your phone, tap **+**, choose `ilo4-remote-v1.0.2.ipa`.
- **Sideloadly** (macOS & Windows): Drag the `.ipa` into Sideloadly, plug in your phone, enter your Apple ID, and click **Start**.
- **Xcode (Build from Source)**: Open [`mobile/ios/App/App.xcworkspace`](mobile/ios/App/App.xcworkspace), select your development team under Signing & Capabilities, and press **Run** (`⌘R`).

---

## 🤖 Installing the Android `.apk`

1. Download [`ilo4-remote-v1.0.2.apk`](https://github.com/brownfury/ilo4-remote/releases/download/v1.0.2/ilo4-remote-v1.0.2.apk) directly on your Android phone or transfer via USB.
2. Tap the downloaded file in your notifications or file manager.
3. If prompted, allow installation from unknown sources.
4. Open **iLO 4 Remote**, type your server's IP and credentials, and you're good to go!

---

## 🌐 Optional: Companion Web Dashboard

If you prefer managing your server through a browser on your laptop or wall-mounted dashboard:

```bash
# Start the local server
./run.sh
```

- **Local Access**: `http://localhost:8000`
- **Home LAN Access**: `http://<your-host-ip>:8000` (e.g. `http://192.168.8.124:8000`)

---

## 🛠️ Automated CI/CD (GitHub Actions)

This repository includes a multi-platform workflow ([`.github/workflows/build-and-release.yml`](.github/workflows/build-and-release.yml)):
- Whenever a version tag is pushed (e.g., `git tag v1.0.3 && git push origin v1.0.3`), GitHub cloud runners (`ubuntu-latest` and `macos-14`) automatically compile the **Android APK** with Gradle and the **Apple iOS IPA** with Xcode, attaching both binaries to a new GitHub Release.

---

## 🤝 Contributing

Contributions from the homelab and HPE server community are warmly welcomed!
- Feel free to open issues for feature requests (e.g., Virtual Media mounting, Fan curves, iLO 5/6 support).
- Pull requests are always appreciated.

---

## 📄 License

Distributed under the [MIT License](LICENSE). Free for personal, educational, and commercial use.
