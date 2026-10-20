// iLO 4 Remote - Mobile Application Engine
let config = {
  mode: localStorage.getItem("ilo_mode") || "gateway", // 'gateway' or 'direct'
  host: localStorage.getItem("ilo_host") || "192.168.8.53",
  gateway: localStorage.getItem("ilo_gateway") || "http://192.168.8.124:8000",
  user: localStorage.getItem("ilo_user") || "Administrator",
  password: localStorage.getItem("ilo_password") || "",
  token: null
};

let currentPowerState = "Unknown";
let currentUidState = "Off";
let autoPollInterval = null;

document.addEventListener("DOMContentLoaded", () => {
  initBottomNav();
  initPowerControls();
  initSettingsUI();
  
  // Initial check
  checkConnectionAndRefresh();
  
  // Auto poll every 4 seconds
  autoPollInterval = setInterval(pollPowerState, 4000);

  // Header buttons
  document.getElementById("btnHeaderRefresh")?.addEventListener("click", () => {
    checkConnectionAndRefresh();
    showMobileToast("Refreshed data");
  });

  document.getElementById("btnHeaderUid")?.addEventListener("click", toggleUid);
  document.getElementById("btnSendApi")?.addEventListener("click", executeApiRequest);
});

/* ---------------- NAVIGATION ---------------- */
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

/* ---------------- HTTP TRANSPORT ADAPTER ---------------- */
// Supports both Gateway mode and Direct iLO REST mode
async function iloRequest(endpoint, method = "GET", body = null) {
  if (config.mode === "gateway") {
    // Companion gateway proxy
    if (endpoint.startsWith("/api/")) {
      const res = await fetch(`${config.gateway}${endpoint}`, {
        method,
        headers: { "Content-Type": "application/json" },
        body: body ? JSON.stringify(body) : undefined
      });
      return await res.json();
    } else {
      // Proxy REST request through gateway
      const res = await fetch(`${config.gateway}/api/rest/proxy`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ method, path: endpoint, body })
      });
      const data = await res.json();
      if (data.status === "error") throw new Error(data.error);
      return data.data;
    }
  } else {
    // Direct mode to https://<ilo_host>/rest/v1
    const base = `https://${config.host}`;
    if (!config.token) {
      await directLogin();
    }
    const res = await fetch(`${base}${endpoint}`, {
      method,
      headers: {
        "X-Auth-Token": config.token,
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
  const url = `https://${config.host}/rest/v1/SessionService/Sessions`;
  const res = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ UserName: config.user, Password: config.password })
  });
  const token = res.headers.get("X-Auth-Token") || res.headers.get("x-auth-token");
  if (!token) throw new Error("Could not obtain X-Auth-Token from iLO");
  config.token = token;
  return token;
}

/* ---------------- CONNECTION & POWER ---------------- */
async function checkConnectionAndRefresh() {
  const dot = document.getElementById("headerDot");
  const lat = document.getElementById("headerLatencyLabel");
  const hostLabel = document.getElementById("headerHostLabel");

  hostLabel.textContent = config.host;
  lat.textContent = "Connecting...";

  const start = Date.now();
  try {
    if (config.mode === "gateway") {
      const data = await iloRequest("/api/status");
      const elapsed = Date.now() - start;
      if (data.status === "connected") {
        dot.className = "status-indicator-dot";
        lat.textContent = `${elapsed}ms`;
        currentPowerState = data.power_state || "Unknown";
        updatePowerUI(currentPowerState);
      } else {
        throw new Error(data.error || "Gateway error");
      }
    } else {
      await directLogin();
      const sys = await iloRequest("/rest/v1/Systems/1");
      const elapsed = Date.now() - start;
      dot.className = "status-indicator-dot";
      lat.textContent = `${elapsed}ms (Direct)`;
      currentPowerState = sys.PowerState || "Unknown";
      updatePowerUI(currentPowerState);
    }
  } catch (err) {
    dot.className = "status-indicator-dot offline";
    lat.textContent = "Offline";
    console.error("Connection check failed:", err);
  }
}

async function pollPowerState() {
  try {
    if (config.mode === "gateway") {
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
    // Ignore periodic poll failure
  }
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

async function triggerPowerAction(action, friendlyName) {
  showMobileToast(`Issuing ${friendlyName}...`);
  try {
    if (config.mode === "gateway") {
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
    if (config.mode === "gateway") {
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
    const data = (config.mode === "gateway") 
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
    const data = (config.mode === "gateway")
      ? await iloRequest("/api/system/power")
      : await iloRequest("/rest/v1/Chassis/1/Power");

    const psus = data.power_supplies || data.PowerSupplies || [];
    if (psus.length === 0) {
      list.innerHTML = `<div style="color: var(--text-muted); font-size: 0.8rem;">No PSUs found.</div>`;
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

/* ---------------- SENSORS ---------------- */
async function loadSensors() {
  const grid = document.getElementById("sensorsGrid");
  const fans = document.getElementById("fansContainer");
  try {
    const data = (config.mode === "gateway")
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
    if (config.mode === "gateway") {
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

/* ---------------- SETTINGS ---------------- */
function initSettingsUI() {
  document.getElementById("cfgMode").value = config.mode;
  document.getElementById("cfgIloHost").value = config.host;
  document.getElementById("cfgUser").value = config.user;
  document.getElementById("cfgPassword").value = config.password;
}

function saveConnectionSettings() {
  config.mode = document.getElementById("cfgMode").value;
  config.host = document.getElementById("cfgIloHost").value.trim();
  config.user = document.getElementById("cfgUser").value.trim();
  config.password = document.getElementById("cfgPassword").value;
  config.token = null;

  localStorage.setItem("ilo_mode", config.mode);
  localStorage.setItem("ilo_host", config.host);
  localStorage.setItem("ilo_user", config.user);
  localStorage.setItem("ilo_password", config.password);

  showMobileToast("Settings saved. Testing connection...");
  checkConnectionAndRefresh();
}

/* ---------------- TOAST ---------------- */
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
