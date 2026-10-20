# ilo4-remote

A lightweight, native-feeling mobile app (Android APK and iOS IPA) and companion web dashboard for managing HP iLO 4 servers.

---

### Background

I run an HP ProLiant ML350 Gen9 tower in my home setup. Like many people who keep Gen8 and Gen9 hardware around for homelabs or small production workloads, these servers are reliable, quiet workhorses with plenty of compute and RAM.

The problem has always been remote management on mobile. The official "HP iLO Mobile" app on both iOS and Android hasn't been properly maintained in years. On modern phones, you type in your host, username, and password, tap connect, and literally nothing happens—it either hangs on a black screen or silently fails due to outdated TLS and networking stacks in the old app bundle.

HP's web interface works fine on a desktop browser, but it's miserable to navigate on a phone when you just want to power on a box from the couch, check temperatures after a heavy job, or see why a fan suddenly ramped up.

I wrote this project to solve that annoyance. It talks directly to the iLO 4 RESTful API (`/rest/v1`), requires no cloud accounts or third-party services, and runs cleanly on both Android and iOS.

---

### What it does

- **Power control**: Check power status (with live polling), turn on, ACPI graceful shutdown, momentary button press, cold boot, and force off.
- **UID LED**: Toggle the chassis blue beacon light.
- **Thermal and fans**: Reads all 46 Sea of Sensors temperature points and displays duty cycles for all 8 cooling fans.
- **Hardware telemetry**: Health rollup, dual CPU details, installed memory, and power supply status.
- **Event logs**: View Integrated Management Log (IML) and iLO Event Log (IEL) entries with timestamps and severity.
- **REST explorer**: A built-in requester to query any of the 120+ iLO 4 endpoints directly.
- **Multi-server support**: Save multiple profiles (e.g., lab server, backup box) and switch between them.

---

### Downloads

Pre-built binaries from the GitHub Actions build pipeline:

- **Android (APK)**: [ilo4-remote-v1.0.3.apk](https://github.com/brownfury/ilo4-remote/releases/download/v1.0.3/ilo4-remote-v1.0.3.apk) (~3.6 MB)
- **iOS (Sideloadable IPA)**: [ilo4-remote-v1.0.3.ipa](https://github.com/brownfury/ilo4-remote/releases/download/v1.0.3/ilo4-remote-v1.0.3.ipa) (~780 KB)

Source releases and checksums are on the [Releases page](https://github.com/brownfury/ilo4-remote/releases).

---

### Installation

#### Android
1. Download the `.apk` on your phone.
2. Open the file and allow installation from your browser or file manager if prompted.
3. Open the app, enter your iLO IP address (e.g. `192.168.1.50`), username, and password.

#### iOS
Because iOS does not support loose sideloading out of the box without signing, use your preferred tool:

- **AltStore / SideStore**: Download the `.ipa` on device, tap "+", and install.
- **Sideloadly**: Connect via USB, drag the `.ipa` onto Sideloadly, provide your Apple ID for ad-hoc signing, and click Start.
- **TrollStore**: Directly open and install if on a supported iOS version.
- **Xcode**: Open `mobile/ios/App/App.xcworkspace`, select your connected device, pick your free personal team under Signing, and hit Run (`Cmd+R`).

---

### How it connects

The mobile app has two operating modes:

1. **Direct Mode (Default)**:
   Your phone sends authenticated HTTPS requests directly to `https://<ilo-ip>/rest/v1/` over your local Wi-Fi or VPN. It authenticates against `/rest/v1/SessionService/Sessions` to obtain a session token and executes all calls client-side. No intermediate computer or service is required.

2. **Gateway Mode (Optional)**:
   If you have a machine on your network running the Python companion service (`app.py`), the mobile app can route requests through it instead (`http://<gateway-ip>:8000`). This is useful if you want a browser dashboard accessible on your home network at the same time.

Your credentials remain stored in your phone's local storage and are never transmitted anywhere other than your server.

---

### Running the Web Gateway (Optional)

If you also want the web dashboard:

```bash
# Clone the repository
git clone https://github.com/brownfury/ilo4-remote.git
cd ilo4-remote

# Install Python requirements
pip install -r requirements.txt

# Start the server (binds to 0.0.0.0:8000)
./run.sh
```

Then open `http://<your-machine-ip>:8000` from any browser on your network.

---

### Building from source

#### Prerequisites
- Node.js 18+
- JDK 17
- Android SDK (command-line tools or Android Studio)
- Xcode (if building for iOS locally on macOS)

#### Build commands

```bash
cd mobile
npm install
npx cap sync

# Build Android debug APK:
cd android
./gradlew assembleDebug
# Output binary: android/app/build/outputs/apk/debug/app-debug.apk

# Build iOS project:
cd ../ios/App
open App.xcworkspace
```

Automated builds for both platforms are defined in `.github/workflows/build-and-release.yml`. Pushing a tag (`git tag vX.Y.Z && git push origin vX.Y.Z`) compiles both targets in GitHub Actions.

---

### License

MIT. Free to use, modify, and distribute.
