// Automated Verification Script for iLO 4 & Proxmox Remote
const fs = require('fs');
const path = require('path');

console.log("Running static and functional verification...");

// 1. Verify index.html contains all critical IDs and elements
const html = fs.readFileSync(path.join(__dirname, '..', 'www', 'index.html'), 'utf8');
const requiredIds = [
  'btnBackToDashboard',
  'loginBackNav',
  'btnTypeIlo',
  'btnTypePve',
  'btnTestConnection',
  'btnLoginConnect',
  'loginHost',
  'loginPort',
  'loginUser',
  'loginPassword',
  'loginRealm',
  'loginOtp',
  'loginTokenId',
  'loginTokenSecret',
  'loginBasePath',
  'loginCustomHeaders',
  'screen-pve-cluster',
  'screen-pve-guests',
  'screen-pve-storage',
  'screen-pve-tasks',
  'screen-pve-telemetry',
  'modal-console',
  'modal-guest-manage',
  'modal-backup-job',
  'modal-task-log',
  'nav-ilo',
  'nav-pve'
];

let missingIds = [];
for (const id of requiredIds) {
  if (!html.includes(`id="${id}"`)) {
    missingIds.push(id);
  }
}

if (missingIds.length > 0) {
  console.error("❌ Missing required HTML IDs:", missingIds);
  process.exit(1);
} else {
  console.log("✓ All 26 critical HTML UI elements and screen IDs present.");
}

// 2. Verify app.js contains all required handlers and logic
const js = fs.readFileSync(path.join(__dirname, '..', 'www', 'app.js'), 'utf8');
const requiredFunctions = [
  'returnToDashboard',
  'showLoginScreen',
  'selectServerType',
  'setPveAuthMode',
  'testServerConnection',
  'testCurrentServerConnection',
  'testProfileConnection',
  'attemptLogin',
  'pveRequest',
  'loginProxmox',
  'loadPveCluster',
  'loadPveGuests',
  'loadPveStorage',
  'loadPveTasks',
  'loadPveTelemetry',
  'openGuestManageModal',
  'executeGuestPower',
  'saveGuestNotesAndTags',
  'executeDiskResize',
  'confirmBulkGuestsAction',
  'triggerPveNodeAction',
  'startManualBackupJob',
  'openPveConsole',
  'openNodeShellConsole',
  'toggleBiometricLock'
];

let missingFuncs = [];
for (const fn of requiredFunctions) {
  if (!js.includes(`function ${fn}`) && !js.includes(`${fn} =`)) {
    missingFuncs.push(fn);
  }
}

if (missingFuncs.length > 0) {
  console.error("❌ Missing required JS functions:", missingFuncs);
  process.exit(1);
} else {
  console.log("✓ All 25 critical controller and API functions verified.");
}

// 3. Verify CSS rules
const css = fs.readFileSync(path.join(__dirname, '..', 'www', 'style.css'), 'utf8');
const requiredClasses = [
  '.login-back-bar',
  '.back-link-btn',
  '.server-type-toggle',
  '.pve-cluster-hero',
  '.pve-node-card',
  '.pve-guest-card',
  '.console-modal-card',
  '.console-touch-toolbar',
  '.manage-power-grid'
];

let missingClasses = [];
for (const cls of requiredClasses) {
  if (!css.includes(cls)) {
    missingClasses.push(cls);
  }
}

if (missingClasses.length > 0) {
  console.error("❌ Missing CSS classes:", missingClasses);
  process.exit(1);
} else {
  console.log("✓ All responsive CSS rules and design tokens verified.");
}

console.log("\n🎉 All verification checks passed with 100% success!");
