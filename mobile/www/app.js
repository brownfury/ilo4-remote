// iLO 4 Remote - Secure Mobile Application Controller
// Zero hardcoded credentials. Connect to any local or remote iLO 4 server.

let activeConfig = {
  mode: "direct",
  host: "",
  user: "Administrator",
  password: "",
  token: null
};

let currentPowerState = "Unknown";
let currentUidState = "Off";
let autoPollTimer = null;
let savedProfiles = [];

document.addEventListener("DOMContentLoaded", () => {
  initBottomNav();
  initPowerControls();
  loadProfilesFromStorage();
  
  // Check if we have saved active session credentials
  const lastHost = localStorage.getItem("ilo_active_host");
  const lastUser = localStorage.getItem("ilo_active_user");
  const lastPass = localStorage.getItem("ilo_active_pass");
  const lastMode = localStorage.getItem("ilo_active_mode") || "direct";

  if (lastHost && lastUser && lastPass) {
    activeConfig.host = lastHost;
    activeConfig.user = lastUser;
    activeConfig.password = lastPass;
    activeConfig.mode = lastMode;

    // Populate login fields in case user returns to login screen
    document.getElementById("loginHost").value = lastHost;
    document.getElementById("loginUser").value = lastUser;
    document.getElementById("loginPassword").value = lastPass;
    setLoginMode(lastMode);

    // Auto connect
    attemptLogin(true);
  } else {
    showLoginScreen();
  }

  // Header quick buttons
  document.getElementById("btnHeaderRefresh")?.addEventListener("click", () => {
    refreshAllDashboardData();
    showMobileToast("Refreshed system telemetry");
  });

  document.getElementById("btnHeaderUid")?.addEventListener("click", toggleUid);
  document.getElementById("btnSendApi")?.addEventListener("click", executeApiRequest);
});

/* ---------------- SERVER PROFILES & LOGIN ---------------- */
function loadProfilesFromStorage() {
  try {
    savedProfiles = JSON.parse(localStorage.getItem("ilo_profiles") || "[]");
  } catch (e) {
    savedProfiles = [];
  }
  renderProfilesDropdown();
}

function renderProfilesDropdown() {
  const row = document.getElementById("profileSelectorRow");
  const select = document.getElementById("loginProfileSelect");
  if (!row || !select) return;

  if (savedProfiles.length === 0) {
    row.style.display = "none";
    return;
  }

  row.style.display = "block";
  select.innerHTML = `<option value="">-- Choose Saved Server (${savedProfiles.length}) --</option>` +
    savedProfiles.map((p, i) => `<option value="${i}">${escapeHtml(p.name || p.host)} (${p.mode === 'direct' ? 'Direct' : 'Gateway'})</option>`).join("");

  select.onchange = (e) => {
    const idx = e.target.value;
    if (idx !== "") {
      const p = savedProfiles[idx];
      document.getElementById("loginHost").value = p.host || "";
      document.getElementById("loginUser").value = p.user || "Administrator";
      document.getElementById("loginPassword").value = p.password || "";
      document.getElementById("loginProfileName").value = p.name || "";
      setLoginMode(p.mode || "direct");
    }
  };

  const btnDel = document.getElementById("btnDeleteProfile");
  if (btnDel) {
    btnDel.onclick = () => {
      const idx = select.value;
      if (idx !== "" && confirm("Delete this saved server profile?")) {
        savedProfiles.splice(idx, 1);
        localStorage.setItem("ilo_profiles", JSON.stringify(savedProfiles));
        renderProfilesDropdown();
        showMobileToast("Profile removed");
      }
    };
  }
}

function setLoginMode(mode) {
  activeConfig.mode = mode;
  const btnDirect = document.getElementById("btnModeDirect");
  const btnGateway = document.getElementById("btnModeGateway");
  const lblHost = document.getElementById("lblHostInput");
  const inputHost = document.getElementById("loginHost");

  if (mode === "direct") {
    btnDirect.classList.add("active");
    btnGateway.classList.remove("active");
    lblHost.textContent = "iLO 4 Server IP or Hostname";
    inputHost.placeholder = "e.g. 192.168.8.53 or ilo.local";
  } else {
    btnGateway.classList.add("active");
    btnDirect.classList.remove("active");
    lblHost.textContent = "Gateway URL";
    inputHost.placeholder = "e.g. http://192.168.8.124:8000";
  }
}

function togglePasswordVisibility() {
  const input = document.getElementById("loginPassword");
  const icon = document.getElementById("eyeIcon");
  if (input.type === "password") {
    input.type = "text";
    icon.innerHTML = `<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"></path><line x1="1" y1="1" x2="23" y2="23"></line>`;
  } else {
    input.type = "password";
    icon.innerHTML = `<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"></path><circle cx="12" cy="12" r="3"></circle>`;
  }
}

async function attemptLogin(isAuto = false) {
  const host = document.getElementById("loginHost").value.trim();
  const user = document.getElementById("loginUser").value.trim();
  const pass = document.getElementById("loginPassword").value;
  const profileName = document.getElementById("loginProfileName").value.trim();
  const remember = document.getElementById("chkRememberProfile").checked;
  const feedback = document.getElementById("loginStatusFeedback");
  const btn = document.getElementById("btnLoginConnect");
  const btnText = document.getElementById("loginBtnText");

  if (!host) {
    showLoginFeedback("Please enter an iLO host or IP address", "error");
    return;
  }
  if (!pass) {
    showLoginFeedback("Please enter your iLO password", "error");
    return;
  }

  // Sanitize host format
  let cleanHost = host.replace(/^https?:\/\//i, "").replace(/\/+$/, "");

  activeConfig.host = cleanHost;
  activeConfig.user = user || "Administrator";
  activeConfig.password = pass;
  activeConfig.token = null;

  btnText.textContent = "Connecting to iLO 4...";
  btn.disabled = true;
  showLoginFeedback("Verifying credentials with iLO 4...", "loading");

  const startTime = Date.now();
  try {
    let serverModel = "HPE ProLiant Server";
    
    if (activeConfig.mode === "direct") {
      // Direct REST login to iLO 4
      const token = await directLogin();
      const sys = await iloRequest("/rest/v1/Systems/1");
      serverModel = sys.Model || "ProLiant ML350 Gen9";
      currentPowerState = sys.PowerState || "Unknown";
    } else {
      // Companion gateway mode
      const targetGateway = host.startsWith("http") ? host : `http://${host}`;
      activeConfig.gateway = targetGateway;
      const statusRes = await fetch(`${targetGateway}/api/status`);
      const statusData = await statusRes.json();
      if (statusData.status !== "connected") {
        throw new Error(statusData.error || "Gateway reported iLO connection failure");
      }
      currentPowerState = statusData.power_state || "Unknown";
    }

    const elapsed = Date.now() - startTime;
    showLoginFeedback(`✓ Connected to ${serverModel} (${elapsed}ms)!`, "success");

    // Save profile if requested
    if (remember) {
      localStorage.setItem("ilo_active_host", activeConfig.host);
      localStorage.setItem("ilo_active_user", activeConfig.user);
      localStorage.setItem("ilo_active_pass", activeConfig.password);
      localStorage.setItem("ilo_active_mode", activeConfig.mode);

      // Save into profiles list if name given or update existing
      const pName = profileName || activeConfig.host;
      const existingIdx = savedProfiles.findIndex(p => p.host === activeConfig.host);
      const newP = {
        name: pName,
        host: activeConfig.host,
        user: activeConfig.user,
        password: activeConfig.password,
        mode: activeConfig.mode
      };
      if (existingIdx >= 0) {
        savedProfiles[existingIdx] = newP;
      } else {
        savedProfiles.push(newP);
      }
      localStorage.setItem("ilo_profiles", JSON.stringify(savedProfiles));
      renderProfilesDropdown();
    }

    setTimeout(() => {
      document.getElementById("screen-login").style.display = "none";
      document.getElementById("app-main").style.display = "flex";
      updateHeaderLabels(serverModel, `${elapsed}ms`);
      updatePowerUI(currentPowerState);
      refreshAllDashboardData();
      startAutoPoll();
    }, 600);

  } catch (err) {
    showLoginFeedback(`✗ Connection Failed: ${err.message}`, "error");
    btnText.textContent = "Connect to Server";
    btn.disabled = false;
    showLoginScreen();
  }
}

function showLoginFeedback(msg, type) {
  const el = document.getElementById("loginStatusFeedback");
  if (!el) return;
  el.textContent = msg;
  el.className = `login-feedback ${type}`;
}

function showLoginScreen() {
  stopAutoPoll();
  document.getElementById("app-main").style.display = "none";
  document.getElementById("screen-login").style.display = "flex";
  const btn = document.getElementById("btnLoginConnect");
  const btnText = document.getElementById("loginBtnText");
  if (btn) btn.disabled = false;
  if (btnText) btnText.textContent = "Connect to Server";
}

function disconnectCurrentServer() {
  if (confirm("Disconnect and log out from this server?")) {
    activeConfig.token = null;
    localStorage.removeItem("ilo_active_pass");
    showMobileToast("Disconnected");
    showLoginScreen();
  }
}

function updateHeaderLabels(model, latencyText) {
  document.getElementById("headerHostLabel").textContent = activeConfig.host;
  document.getElementById("headerLatencyLabel").textContent = latencyText;
  document.getElementById("serverModelBadge").textContent = model;
  document.getElementById("headerDot").className = "status-indicator-dot";
  
  // Settings tab details
  document.getElementById("setCurrMode").textContent = activeConfig.mode === "direct" ? "Direct iLO" : "Companion Gateway";
  document.getElementById("setCurrHost").textContent = activeConfig.host;
  document.getElementById("setCurrUser").textContent = activeConfig.user;
}

/* ---------------- HTTP TRANSPORT ENGINE ---------------- */
async function iloRequest(endpoint, method = "GET", body = null) {
  if (activeConfig.mode === "gateway") {
    const base = activeConfig.gateway || `http://${activeConfig.host}`;
    if (endpoint.startsWith("/api/")) {
      const res = await fetch(`${base}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      return await res.json();
    } else {
      const res = await fetch(`${base}/api/rest/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, path: endpoint, body })
      });
      const data = await res.json();
      if (data.status === "error") throw new Error(data.error);
      return data.data;
    }
  } else {
    // Direct mode via HTTPS to iLO
    const base = `https://${activeConfig.host}`;
    if (!activeConfig.token) {
      await directLogin();
    }
    const res = await fetch(`${base}${endpoint}`, {
      method,
      headers: {
        "X-Auth-Token": activeConfig.token,
        "Content-Type": "application/json",
        "Accept": "application/json"
      },
      body: body ? JSON.stringify(body) : undefined
    });

    if (res.status === 401) {
      await directLogin();
      return await iloRequest(endpoint, method, body);
    }
    return await res.json();
  }
}

async function directLogin() {
  const url = `https://${activeConfig.host}/rest/v1/SessionService/Sessions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ UserName: activeConfig.user, Password: activeConfig.password })
  });
  if (!res.ok) {
    throw new Error(`Authentication failed (HTTP ${res.status}). Verify IP and credentials.`);
  }
  const token = res.headers.get("X-Auth-Token") || res.headers.get("x-auth-token");
  if (!token) throw new Error("iLO did not return an X-Auth-Token");
  activeConfig.token = token;
  return token;
}

/* ---------------- TABS & NAVIGATION ---------------- */
function initBottomNav() {
  const items = document.querySelectorAll(".nav-item");
  items.forEach(btn => {
    btn.addEventListener("click", () => {
      items.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".screen-view").forEach(s => s.classList.remove("active"));

      btn.classList.add("active");
      const screenId = btn.getAttribute("data-screen");
      const targetScreen = document.getElementById(screenId);
      if (targetScreen) targetScreen.classList.add("active");

      // Lazy load screen data
      if (screenId === "screen-telemetry") loadTelemetry();
      if (screenId === "screen-sensors") loadSensors();
      if (screenId === "screen-logs") loadLogs("iml");
    });
  });
}

/* ---------------- POWER CONTROLS ---------------- */
function initPowerControls() {
  const btn = document.getElementById("btnBigPower");
  btn?.addEventListener("click", () => {
    if (currentPowerState.toLowerCase() === "on") {
      confirmDangerAction("graceful_shutdown", "Graceful Shutdown");
    } else {
      triggerPowerAction("on", "Power On");
    }
  });
}

function updatePowerUI(state) {
  const pill = document.getElementById("powerStatePill");
  const pillText = document.getElementById("powerPillText");
  const pillDot = document.getElementById("powerPillDot");
  const ring = document.getElementById("powerGlowRing");
  const btn = document.getElementById("btnBigPower");
  const bigText = document.getElementById("bigPowerText");

  const isOn = (state.toLowerCase() === "on");

  if (isOn) {
    pill.className = "power-state-pill on";
    pillText.textContent = "POWERED ON";
    pillDot.className = "status-indicator-dot";
    ring.className = "power-glow-ring on";
    btn.className = "power-toggle-btn is-on";
    bigText.textContent = "TURN OFF";
  } else {
    pill.className = "power-state-pill off";
    pillText.textContent = "STANDBY / OFF";
    pillDot.className = "status-indicator-dot offline";
    ring.className = "power-glow-ring off";
    btn.className = "power-toggle-btn is-off";
    bigText.textContent = "TURN ON";
  }
}

async function triggerPowerAction(action, friendlyName) {
  showMobileToast(`Issuing ${friendlyName}...`);
  try {
    if (activeConfig.mode === "gateway") {
      await iloRequest("/api/power/action", "POST", { action });
    } else {
      const resetMap = {
        on: "On",
        force_off: "ForceOff",
        graceful_shutdown: "PushPowerButton",
        push_power_button: "PushPowerButton",
        reset: "ForceRestart"
      };
      await iloRequest("/rest/v1/Systems/1", "POST", {
        Action: "Reset",
        ResetType: resetMap[action] || "On"
      });
    }
    showMobileToast(`✓ ${friendlyName} executed`);
    setTimeout(pollPowerState, 1500);
  } catch (err) {
    showMobileToast(`✗ Error: ${err.message}`);
  }
}

function confirmDangerAction(action, friendlyName) {
  if (confirm(`Confirm: ${friendlyName}?`)) {
    triggerPowerAction(action, friendlyName);
  }
}

/* ---------------- UID BEACON ---------------- */
async function toggleUid() {
  const newState = (currentUidState.toLowerCase() === "on" || currentUidState.toLowerCase() === "illuminated") ? "off" : "on";
  showMobileToast(`UID Beacon ${newState.toUpperCase()}...`);
  try {
    if (activeConfig.mode === "gateway") {
      const res = await iloRequest("/api/uid/toggle", "POST", { state: newState });
      currentUidState = res.uid_status;
    } else {
      await iloRequest("/rest/v1/Systems/1", "PATCH", {
        IndicatorLED: (newState === "on" ? "Lit" : "Off")
      });
      currentUidState = (newState === "on" ? "ON" : "OFF");
    }
    updateUidUI(currentUidState);
    showMobileToast(`UID LED is now ${currentUidState}`);
  } catch (err) {
    showMobileToast(`UID toggle error: ${err.message}`);
  }
}

function updateUidUI(state) {
  const btn = document.getElementById("btnHeaderUid");
  const isOn = (state.toLowerCase() === "on" || state.toLowerCase() === "illuminated" || state.toLowerCase() === "lit");
  if (isOn) {
    btn?.classList.add("active");
  } else {
    btn?.classList.remove("active");
  }
}

/* ---------------- TELEMETRY ---------------- */
async function loadTelemetry() {
  try {
    const data = (activeConfig.mode === "gateway") 
      ? await iloRequest("/api/system/summary") 
      : { system: await iloRequest("/rest/v1/Systems/1"), manager: await iloRequest("/rest/v1/Managers/1") };

    const sys = data.system || {};
    document.getElementById("telModel").textContent = sys.model || sys.Model || "ProLiant ML350 Gen9";
    document.getElementById("telSerial").textContent = sys.serial_number || sys.SerialNumber || "CZ254307FB";
    document.getElementById("telBios").textContent = sys.bios_version || sys.BiosVersion || "P92 v2.92";
    
    const cpu = sys.processor_summary || sys.ProcessorSummary || {};
    if (cpu.Model) document.getElementById("telCpu").textContent = cpu.Model;

    const mem = sys.memory_summary || sys.MemorySummary || {};
    if (mem.TotalSystemMemoryGiB) document.getElementById("telMemory").textContent = `${mem.TotalSystemMemoryGiB} GiB DDR4 ECC`;

    const mgr = data.manager || {};
    if (mgr.firmware_version || mgr.FirmwareVersion) {
      document.getElementById("telIloVer").textContent = mgr.firmware_version || mgr.FirmwareVersion;
    }

    loadPowerSupplies();
  } catch (e) {
    console.error("Failed to load telemetry:", e);
  }
}

async function loadPowerSupplies() {
  const list = document.getElementById("telPsuList");
  try {
    const data = (activeConfig.mode === "gateway")
      ? await iloRequest("/api/system/power")
      : await iloRequest("/rest/v1/Chassis/1/Power");

    const psus = data.power_supplies || data.PowerSupplies || [];
    if (psus.length === 0) {
      list.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem;">No PSUs detected.</div>`;
      return;
    }

    list.innerHTML = psus.map((psu, i) => `
      <div class="card info-card" style="margin-bottom: 8px;">
        <div class="info-row">
          <span class="info-label">Bay ${psu.Oem?.Hp?.BayNumber || (i + 1)}</span>
          <span class="pill pill-ok">${psu.Status?.Health || 'OK'}</span>
        </div>
        <div class="info-row">
          <span class="info-label">Output</span>
          <span class="info-val font-bold">${psu.LastPowerOutputWatts || 0} Watts</span>
        </div>
      </div>
    `).join("");
  } catch (e) {
    list.innerHTML = `<div style="color: var(--accent-red); font-size: 0.8rem;">Failed to load PSUs</div>`;
  }
}

/* ---------------- SENSORS & FANS ---------------- */
async function loadSensors() {
  const grid = document.getElementById("sensorsGrid");
  const fans = document.getElementById("fansContainer");
  try {
    const data = (activeConfig.mode === "gateway")
      ? await iloRequest("/api/system/thermal")
      : await iloRequest("/rest/v1/Chassis/1/Thermal");

    const temps = data.temperatures || data.Temperatures || [];
    const fanList = data.fans || data.Fans || [];

    grid.innerHTML = temps.map(t => {
      const temp = t.CurrentReading || 0;
      const name = t.Name || `Sensor ${t.Number}`;
      const max = t.UpperThresholdCritical || 80;
      const pct = Math.min(Math.round((temp / max) * 100), 100);
      const isWarm = temp >= (t.UpperThresholdCaution || 50);

      return `
        <div class="sensor-item-mobile">
          <div style="display: flex; justify-content: space-between; font-size: 0.8rem;">
            <span style="font-weight: 600;">${name}</span>
            <span style="color: #38bdf8; font-weight: 700;">${temp}°C</span>
          </div>
          <div class="sensor-bar-bg">
            <div class="sensor-bar-fill ${isWarm ? 'warm' : ''}" style="width: ${pct}%;"></div>
          </div>
        </div>
      `;
    }).join("");

    fans.innerHTML = fanList.map(f => `
      <div class="card" style="padding: 12px; margin: 0; text-align: center;">
        <div style="font-size: 0.75rem; color: var(--text-muted);">${f.FanName || 'Fan'}</div>
        <div style="font-size: 1.2rem; font-weight: 800; color: #38bdf8; margin: 4px 0;">${f.CurrentReading || 0}%</div>
        <div style="font-size: 0.7rem; color: #34d399;">${f.Status?.Health || 'OK'}</div>
      </div>
    `).join("");
  } catch (e) {
    grid.innerHTML = `<div style="color: var(--accent-red);">Failed to load sensors: ${e.message}</div>`;
  }
}

/* ---------------- LOGS ---------------- */
async function loadLogs(type = "iml") {
  const list = document.getElementById("logsList");
  list.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">Loading ${type.toUpperCase()}...</div>`;

  try {
    let entries = [];
    if (activeConfig.mode === "gateway") {
      const data = await iloRequest(`/api/logs/${type}`);
      entries = data.entries || [];
    } else {
      const path = (type === "iml") 
        ? "/rest/v1/Systems/1/LogServices/IML/Entries" 
        : "/rest/v1/Managers/1/LogServices/IEL/Entries";
      const data = await iloRequest(path);
      entries = data.Items || [];
    }

    if (entries.length === 0) {
      list.innerHTML = `<div style="color: var(--text-muted); text-align: center; padding: 20px;">No events recorded.</div>`;
      return;
    }

    list.innerHTML = entries.map(e => `
      <div class="log-item-mobile">
        <div style="display: flex; justify-content: space-between; margin-bottom: 4px;">
          <span class="pill ${e.Severity === 'Critical' ? 'pill-crit' : 'pill-ok'}">${e.Severity || 'OK'}</span>
          <span style="color: var(--text-dim); font-size: 0.72rem;">${e.Created ? new Date(e.Created).toLocaleDateString() : ''}</span>
        </div>
        <div style="color: var(--text-main);">${escapeHtml(e.Message || e.Description || '')}</div>
      </div>
    `).join("");
  } catch (e) {
    list.innerHTML = `<div style="color: var(--accent-red);">Failed to load logs: ${e.message}</div>`;
  }
}

function switchLogsType(type) {
  document.getElementById("btnFilterIML").className = (type === "iml") ? "filter-chip active" : "filter-chip";
  document.getElementById("btnFilterIEL").className = (type === "iel") ? "filter-chip active" : "filter-chip";
  loadLogs(type);
}

/* ---------------- API EXPLORER ---------------- */
function setApiPreset(path) {
  document.getElementById("apiPath").value = path;
  document.getElementById("apiMethod").value = "GET";
  executeApiRequest();
}

async function executeApiRequest() {
  const method = document.getElementById("apiMethod").value;
  const path = document.getElementById("apiPath").value.trim();
  const rawPayload = document.getElementById("apiPayload").value.trim();
  const viewer = document.getElementById("apiResponse");
  const badge = document.getElementById("apiStatusBadge");

  let payload = null;
  if (rawPayload && (method === "POST" || method === "PATCH")) {
    try {
      payload = JSON.parse(rawPayload);
    } catch (e) {
      showMobileToast("Invalid JSON payload");
      return;
    }
  }

  viewer.textContent = "Executing request...";
  badge.textContent = "";

  try {
    const data = await iloRequest(path, method, payload);
    badge.textContent = "200 OK";
    badge.className = "pill pill-ok";
    viewer.textContent = JSON.stringify(data, null, 2);
  } catch (e) {
    badge.textContent = "ERROR";
    badge.className = "pill";
    viewer.textContent = `Request error: ${e.message}`;
  }
}

/* ---------------- POLLING & REFRESH ---------------- */
function startAutoPoll() {
  stopAutoPoll();
  autoPollTimer = setInterval(pollPowerState, 4000);
}

function stopAutoPoll() {
  if (autoPollTimer) {
    clearInterval(autoPollTimer);
    autoPollTimer = null;
  }
}

async function pollPowerState() {
  try {
    if (activeConfig.mode === "gateway") {
      const data = await iloRequest("/api/power/status");
      if (data.power_state) {
        currentPowerState = data.power_state;
        updatePowerUI(currentPowerState);
      }
      if (data.uid_status) {
        currentUidState = data.uid_status;
        updateUidUI(currentUidState);
      }
    } else {
      const sys = await iloRequest("/rest/v1/Systems/1");
      if (sys && sys.PowerState) {
        currentPowerState = sys.PowerState;
        updatePowerUI(currentPowerState);
      }
    }
  } catch (e) {
    // Ignore minor periodic poll failures
  }
}

function refreshAllDashboardData() {
  pollPowerState();
  loadTelemetry();
}

/* ---------------- TOAST UTILITY ---------------- */
function showMobileToast(msg) {
  const toast = document.getElementById("toast");
  if (!toast) return;
  toast.textContent = msg;
  toast.classList.add("show");
  setTimeout(() => toast.classList.remove("show"), 3000);
}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
