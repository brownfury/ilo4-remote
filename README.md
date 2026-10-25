# ilo4-remote (iLO 4 & Proxmox VE Remote)

A lightweight, native mobile app (Android APK and sideloadable iOS IPA) for managing **HP iLO 4** servers and **Proxmox VE** hypervisor clusters directly over your local network, VPN, or reverse proxy.

---

### Overview

Originally built to manage HP ProLiant Gen8/Gen9 servers without relying on outdated vendor mobile apps or clunky desktop web UIs, this tool has evolved into a unified homelab and datacenter management client combining **bare-metal BMC telemetry (HP iLO 4)** and **full virtualization control (Proxmox VE)** in a single native application.

All communication is direct client-side HTTPS. Requires zero cloud accounts, zero middleman web servers, and zero telemetry daemons.

---

### Features

#### HP iLO 4 BMC Management
- **Direct HTTPS Connection**: Connects straight to iLO 4 (`https://<ilo-ip>/rest/v1/`) without any proxy, gateway, or python service. Handles iLO's default self-signed SSL certificates safely at the native OS layer.
- **Power Control**: Check live power state, turn on, graceful ACPI shutdown, momentary virtual power button press, cold boot, and force off.
- **UID Beacon**: Toggle chassis blue UID LED.
- **Sea of Sensors (46 Points)**: Reads all thermal sensors across CPUs, DIMMs, system board, and storage, with live duty cycles for all cooling fans.
- **Hardware Telemetry**: Overall health rollup, dual CPU details, installed RAM, and redundant power supply status.
- **Integrated Logs**: Browse Integrated Management Log (IML) and iLO Event Log (IEL) entries with timestamps and severity tags.
- **REST API Explorer**: Built-in interactive requester to query any of the 120+ iLO 4 endpoints directly and inspect live JSON responses.

#### Proxmox VE Hypervisor & Cluster Management
- **Cluster & Node Overview**: Real-time fleet dashboard with quorum status, online/offline node indicators, and aggregate CPU usage, RAM allocation, and storage capacities.
- **Guest List & Inspection**: Unified listing of QEMU Virtual Machines and LXC Containers with live status badges (running, stopped, paused), CPU % gauges, memory allocation, and configured tags.
- **Guest Power & Management**: Direct power controls (Start, Graceful Shutdown, Force Stop, Hard Reboot, Pause/Resume), inline tag editor, description/notes editor, and container root disk resizing (e.g. `+5G` on `rootfs`).
- **Fleet Bulk Operations**: One-tap "Start All Guests" and "Stop All Guests" across the cluster.
- **Node Controls & Wake-on-LAN**: Trigger Host Reboot, Host Shutdown, and Wake-on-LAN (WoL) magic packets for offline nodes.
- **Resource & Storage Monitoring**: High-level storage pool views (ZFS pools, LVM-thin pools, directory storages, NFS, Ceph) with usage progress bars and content type filtering.
- **vzdump Backup & Restore**: View backup archives and manifests, edit backup notes, trigger manual backup jobs (snapshot/suspend/stop mode with ZSTD/GZIP compression), and initiate direct restorations from mobile.
- **Task History & Host Journal**: Cluster-wide task history with status pills (OK/ERR), task summary log inspector, and live searchable host systemd journal / syslog reader.
- **Hardware Telemetry & S.M.A.R.T.**: CPU package and core temperature readouts, physical storage disk health (`PASSED`), drive wearout %, and S.M.A.R.T. attribute tables.
- **Interactive Consoles**: Embedded noVNC graphical console for running VMs and interactive xterm.js shell directly on host nodes with mobile touch toolbar (ESC, TAB, CTRL+C, CAD, arrows, fullscreen, and clipboard paste).

#### Security, Networking & Profiles
- **Authentication Modes**: Connect via standard credentials with Linux PAM or Proxmox PVE realms, TOTP / 2FA authenticator codes, or API Tokens (`PVEAPIToken=USER@REALM!TOKENID=UUID`).
- **Connection Routing**: Connect directly via LAN, VPN, or reverse proxy setups with custom HTTP port, subpath prefix (e.g. `/pve`), and custom HTTP headers (e.g. Cloudflare Access credentials).
- **Persistent Profiles**: Saved profiles persist safely in native OS storage (`NSUserDefaults` on iOS, `SharedPreferences` on Android via `@capacitor/preferences`). Auto-connect on launch jumps directly into your active dashboard.
- **Multi-Server Manager**: Save and switch between unlimited iLO 4 and Proxmox VE servers from Settings with individual connection test buttons.
- **Live Connection Testing**: Test reachability, authentication, and round-trip latency before saving or switching servers.
- **Biometric App Lock**: Optional Face ID / Fingerprint / Passcode protection on app launch.

---

### Live Screenshots

| Power & Server Status | Sea of Sensors (46 Points) | Integrated Management Log |
| :---: | :---: | :---: |
| <img src="images/screenshot_power.jpg" width="260" alt="Power Dashboard" /> | <img src="images/screenshot_sensors.jpg" width="260" alt="Sea of Sensors" /> | <img src="images/screenshot_iml_log.jpg" width="260" alt="IML Log" /> |

| iLO Event Log | REST API Explorer | Server Settings & Auto-Connect |
| :---: | :---: | :---: |
| <img src="images/screenshot_ilo_events.jpg" width="260" alt="iLO Event Log" /> | <img src="images/screenshot_rest_api.jpg" width="260" alt="REST API Explorer" /> | <img src="images/screenshot_settings.jpg" width="260" alt="Server Connection Settings" /> |

---

### Downloads

Pre-built binaries from the automated GitHub Actions CI/CD pipeline:

- **Android (APK)**: [ilo4-remote-v1.0.5.apk](https://github.com/brownfury/ilo4-remote/releases/download/v1.0.5/ilo4-remote-v1.0.5.apk) (~3.6 MB)
- **iOS (Sideloadable IPA)**: [ilo4-remote-v1.0.5.ipa](https://github.com/brownfury/ilo4-remote/releases/download/v1.0.5/ilo4-remote-v1.0.5.ipa) (~800 KB)

Source releases and checksums are available on the [Releases page](https://github.com/brownfury/ilo4-remote/releases).

---

### Installation

#### Android
1. Download the `.apk` on your phone.
2. Open the file and allow installation from your browser or file manager if prompted.
3. Open the app, select your Server Type (HP iLO 4 or Proxmox VE), enter your host IP, port, and credentials.

#### iOS
Because iOS does not support loose sideloading out of the box without signing, use your preferred tool:

- **AltStore / SideStore**: Download the `.ipa` on device, tap "+", and install.
- **Sideloadly**: Connect via USB, drag the `.ipa` onto Sideloadly, provide your Apple ID for ad-hoc signing, and click Start.
- **TrollStore**: Directly open and install if on a supported iOS version.
- **Xcode**: Open `mobile/ios/App/App.xcworkspace`, select your connected device, pick your personal team under Signing, and hit Run (`Cmd+R`).

---

### Changelog

#### v1.0.5
- **Proxmox VE Hypervisor Integration**:
  - Full cluster & node overview with quorum monitoring and aggregate CPU, RAM, and Storage gauges.
  - VM (QEMU) & LXC container inspection with live search, type/status filter chips, and tag badges.
  - Direct guest power controls (Start, Graceful ACPI Shutdown, Force Stop, Hard Reboot, Pause/Resume).
  - LXC root disk resizing (`/resize` endpoint) directly from mobile.
  - Guest notes/descriptions and tag management.
  - Fleet bulk operations: "Start All Guests" and "Stop All Guests".
  - Host node controls: Reboot Host, Shutdown Host, and Wake-on-LAN (WoL) triggers.
  - Storage pools overview (ZFS, LVM-thin, Directory, NFS, Ceph).
  - vzdump backup manifests viewer, backup note editor, manual backup job trigger, and restore wizard.
  - Cluster task history with status pills and full task summary log reader.
  - Host systemd journal and syslog viewer with live search filtering.
  - Hardware telemetry: CPU package temperatures, drive health, wearout %, and S.M.A.R.T. readouts.
  - Interactive consoles: noVNC console for VMs and xterm.js host shell with mobile touch toolbar (ESC, TAB, CAD, arrows, clipboard paste).
- **Authentication & Security Enhancements**:
  - Standard user/pass with Linux PAM or Proxmox PVE realms, plus optional TOTP/2FA code input.
  - API Token authentication (`PVEAPIToken=USER@REALM!TOKENID=UUID`).
  - Biometric App Lock (Face ID / Fingerprint / Passcode).
  - Advanced connection routing (custom port, reverse proxy subpaths, and custom HTTP request headers).
- **Navigation & Usability Fixes**:
  - Added dedicated "Back to Active Session" navigation on the login screen.
  - Added "⚡ Test Connection" action to verify host reachability, credentials, and latency without switching sessions.
  - Top alert feedback banner with auto-scroll and detailed SSL/network error diagnostics.
  - Username realm normalization (prevents duplicate `@pam` when entering credentials).
  - Multi-server profile uniqueness and persistent credential switching across phone reboots.

#### v1.0.4
- Persistent credentials across restarts in native device storage.
- Auto-connect on launch support.
- Streamlined mobile packaging and iOS sideloadable IPA builds.

#### v1.0.3
- Native self-signed SSL trust layer for iLO 4 self-signed certificates.
- Multi-server profile switching.
- Direct RESTful API explorer.

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
npx cap copy

# Build Android debug APK:
cd android
JAVA_HOME=/path/to/jdk-17 ./gradlew assembleDebug
# Output binary: android/app/build/outputs/apk/debug/app-debug.apk

# Build iOS project:
cd ../ios/App
open App.xcworkspace
```

Automated builds for both platforms run via GitHub Actions (`.github/workflows/build-and-release.yml`). Pushing a tag (`git tag vX.Y.Z && git push origin vX.Y.Z`) compiles both targets automatically.

---

### Security & Privacy

All credentials and server addresses are stored strictly on-device in native protected storage (`NSUserDefaults` / `SharedPreferences`). The app never contacts any cloud servers, telemetry endpoints, or third-party APIs. All network traffic is strictly between your phone and your server's IP.

---

### License

MIT. Free to use, modify, and distribute.
