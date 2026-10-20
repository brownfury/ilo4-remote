// HP iLO 4 Command Center - Client Application Controller
let currentPowerState = "Unknown";
let currentUidState = "Off";
let pendingModalAction = null;
let autoPollTimer = null;
let allRestEndpoints = [];
let allRibclMethods = [];
let currentLogType = "iml";

document.addEventListener("DOMContentLoaded", () => {
  initTabs();
  initPowerControls();
  initRestExplorer();
  initRibclRunner();
  initSettingsModal();
  
  // Initial data fetch
  refreshAllData();

  // Setup auto-poll
  const chkAutoPoll = document.getElementById("chkAutoPoll");
  if (chkAutoPoll) {
    chkAutoPoll.addEventListener("change", (e) => {
      if (e.target.checked) {
        startAutoPoll();
      } else {
        stopAutoPoll();
      }
    });
    startAutoPoll();
  }

  // Refresh button
  const btnRefresh = document.getElementById("btnRefreshAll");
  if (btnRefresh) {
    btnRefresh.addEventListener("click", () => {
      refreshAllData();
      showToast("Refreshed all system telemetry", "info");
    });
  }

  // Copy LAN URL chip
  const lanPill = document.getElementById("lanPill");
  if (lanPill) {
    lanPill.addEventListener("click", copyLanUrl);
  }
});

/* ---------------- TABS NAVIGATION ---------------- */
function initTabs() {
  const tabBtns = document.querySelectorAll(".tab-btn");
  tabBtns.forEach(btn => {
    btn.addEventListener("click", () => {
      tabBtns.forEach(b => b.classList.remove("active"));
      document.querySelectorAll(".tab-content").forEach(c => c.classList.remove("active"));

      btn.classList.add("active");
      const tabId = btn.getAttribute("data-tab");
      const content = document.getElementById(tabId);
      if (content) content.classList.add("active");

      // Lazy load tab data
      if (tabId === "tab-sensors") loadThermalSensors();
      if (tabId === "tab-logs") loadEventLogs(currentLogType);
      if (tabId === "tab-rest" && allRestEndpoints.length === 0) loadRestEndpoints();
      if (tabId === "tab-ribcl" && allRibclMethods.length === 0) loadRibclMethods();
      if (tabId === "tab-hardware") loadHardwareTelemetry();
    });
  });
}

/* ---------------- POWER CONTROLS & STATUS ---------------- */
function initPowerControls() {
  const btnMain = document.getElementById("btnMainPowerToggle");
  if (btnMain) {
    btnMain.addEventListener("click", () => {
      if (currentPowerState.toLowerCase() === "on") {
        confirmPowerAction("graceful_shutdown", "Graceful Shutdown", "warning");
      } else {
        executePowerAction("on", "Power On");
      }
    });
  }

  const btnUid = document.getElementById("btnToggleUid");
  if (btnUid) {
    btnUid.addEventListener("click", toggleUid);
  }
}

async function fetchPowerStatus() {
  try {
    const res = await fetch("/api/power/status");
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    
    currentPowerState = data.power_state || "Unknown";
    updatePowerUI(currentPowerState);

    // UID status
    if (data.uid_status) {
      currentUidState = data.uid_status;
      updateUidUI(currentUidState);
    }
  } catch (err) {
    console.error("Error fetching power status:", err);
  }
}

function updatePowerUI(state) {
  const badge = document.getElementById("powerStatusBadge");
  const label = document.getElementById("powerStatusLabel");
  const dot = document.getElementById("powerStatusDot");
  const ring = document.getElementById("powerDialRing");
  const btn = document.getElementById("btnMainPowerToggle");
  const btnText = document.getElementById("btnMainPowerText");

  const isPowerOn = (state.toLowerCase() === "on");

  if (isPowerOn) {
    badge.className = "power-status-badge on";
    label.textContent = "ONLINE / POWER ON";
    dot.className = "status-dot";
    ring.className = "power-dial-ring on";
    btn.className = "power-btn-main is-on";
    btnText.textContent = "TURN OFF";
  } else {
    badge.className = "power-status-badge off";
    label.textContent = "STANDBY / POWER OFF";
    dot.className = "status-dot offline";
    ring.className = "power-dial-ring off";
    btn.className = "power-btn-main is-off";
    btnText.textContent = "TURN ON";
  }
}

async function executePowerAction(action, friendlyName) {
  showToast(`Issuing ${friendlyName}...`, "info");
  try {
    const res = await fetch("/api/power/action", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ action })
    });
    const result = await res.json();
    if (!res.ok) throw new Error(result.detail || "Action failed");
    
    showToast(`✓ ${friendlyName} executed: ${result.message || "Success"}`, "success");
    if (result.new_power_state) {
      currentPowerState = result.new_power_state;
      updatePowerUI(currentPowerState);
    }
    // Re-poll after 2 seconds
    setTimeout(fetchPowerStatus, 2000);
  } catch (err) {
    showToast(`✗ Failed to execute ${friendlyName}: ${err.message}`, "error");
  }
}

function confirmPowerAction(action, friendlyName, level = "danger") {
  pendingModalAction = { action, friendlyName };
  const modal = document.getElementById("confirmModal");
  const title = document.getElementById("modalTitle");
  const body = document.getElementById("modalBody");
  const btn = document.getElementById("modalConfirmBtn");

  title.textContent = `Confirm: ${friendlyName}`;
  if (action === "force_off") {
    body.innerHTML = `Are you sure you want to <strong>instantly force power off</strong> this machine? Any unsaved data in the operating system may be lost.`;
    btn.className = "btn-danger";
  } else if (action === "reset") {
    body.innerHTML = `Are you sure you want to <strong>hard reboot / reset</strong> the HPE ProLiant ML350 Gen9 server?`;
    btn.className = "btn-danger";
  } else {
    body.innerHTML = `Confirm executing <strong>${friendlyName}</strong>?`;
    btn.className = "btn-primary";
  }

  modal.classList.add("active");
}

function closeModal() {
  document.getElementById("confirmModal").classList.remove("active");
  pendingModalAction = null;
}

function modalExecute() {
  if (pendingModalAction) {
    const { action, friendlyName } = pendingModalAction;
    closeModal();
    executePowerAction(action, friendlyName);
  }
}

/* ---------------- UID LIGHT TOGGLE ---------------- */
async function toggleUid() {
  const newState = (currentUidState.toLowerCase() === "on" || currentUidState.toLowerCase() === "illuminated") ? "off" : "on";
  showToast(`Switching UID Beacon LED ${newState.toUpperCase()}...`, "info");
  try {
    const res = await fetch("/api/uid/toggle", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ state: newState })
    });
    const result = await res.json();
    currentUidState = result.uid_status;
    updateUidUI(currentUidState);
    showToast(`UID LED set to ${currentUidState.toUpperCase()}`, "success");
  } catch (err) {
    showToast(`Failed to toggle UID: ${err.message}`, "error");
  }
}

function updateUidUI(state) {
  const btn = document.getElementById("btnToggleUid");
  const isOn = (state.toLowerCase() === "on" || state.toLowerCase() === "illuminated");
  if (isOn) {
    btn.classList.add("active");
  } else {
    btn.classList.remove("active");
  }
}

/* ---------------- TELEMETRY & HARDWARE ---------------- */
async function loadHardwareTelemetry() {
  try {
    const res = await fetch("/api/system/summary");
    if (!res.ok) throw new Error("HTTP error");
    const data = await res.json();

    const sys = data.system || {};
    document.getElementById("hwModel").textContent = sys.model || "ProLiant ML350 Gen9";
    document.getElementById("hwSerial").textContent = sys.serial_number || "CZ254307FB";
    document.getElementById("hwBios").textContent = sys.bios_version || "P92 v2.92";

    const cpu = sys.processor_summary || {};
    if (cpu.Model) document.getElementById("hwCpuModel").textContent = cpu.Model;
    if (cpu.Count) document.getElementById("hwCpuSub").textContent = `${cpu.Count}x Multi-Core Socket(s)`;

    const mem = sys.memory_summary || {};
    if (mem.TotalSystemMemoryGiB) document.getElementById("hwMemory").textContent = `${mem.TotalSystemMemoryGiB} GiB`;

    const mgr = data.manager || {};
    if (mgr.firmware_version) document.getElementById("hwIloFirmware").textContent = `v${mgr.firmware_version}`;

    // Load Power Supplies
    loadPowerSupplies();
  } catch (err) {
    console.error("Error loading hardware telemetry:", err);
  }
}

async function loadPowerSupplies() {
  try {
    const res = await fetch("/api/system/power");
    if (!res.ok) return;
    const data = await res.json();
    const psus = data.power_supplies || [];
    const container = document.getElementById("psuContainer");
    if (!container) return;

    if (psus.length === 0) {
      container.innerHTML = `<div style="color: var(--text-muted);">No power supplies detected.</div>`;
      return;
    }

    container.innerHTML = psus.map((psu, idx) => {
      const bay = psu.Oem?.Hp?.BayNumber || (idx + 1);
      const serial = psu.SerialNumber?.trim() || "N/A";
      const model = psu.Model?.trim() || "HPE Common Slot";
      const state = psu.Status?.Health || "OK";
      const watts = psu.LastPowerOutputWatts || 0;
      return `
        <div class="sensor-item" style="padding: 16px;">
          <div class="sensor-top">
            <span style="font-weight: 700; color: #60a5fa;">Power Supply Bay ${bay}</span>
            <span class="severity-pill ${state}">${state}</span>
          </div>
          <div style="font-size: 0.85rem; color: var(--text-main); margin-top: 6px;">
            Model: <strong>${model}</strong>
          </div>
          <div style="font-size: 0.8rem; color: var(--text-dim);">
            Serial: ${serial} • Output: ${watts} W
          </div>
        </div>
      `;
    }).join("");
  } catch (err) {
    console.error("Error loading power supplies:", err);
  }
}

/* ---------------- SENSORS & FANS ---------------- */
async function loadThermalSensors() {
  const sensorGrid = document.getElementById("sensorGrid");
  const fansGrid = document.getElementById("fansGrid");
  
  try {
    const res = await fetch("/api/system/thermal");
    if (!res.ok) throw new Error("HTTP error");
    const data = await res.json();

    const temps = data.temperatures || [];
    const fans = data.fans || [];

    document.getElementById("sensorCountBadge").textContent = `${temps.length} Sensors`;

    // Render Thermal Sensors
    if (temps.length === 0) {
      sensorGrid.innerHTML = `<div style="padding: 20px; color: var(--text-muted);">No sensors found.</div>`;
    } else {
      sensorGrid.innerHTML = temps.map(s => {
        const temp = s.CurrentReading || 0;
        const name = s.Name || `Sensor ${s.Number}`;
        const max = s.UpperThresholdCritical || 80;
        const pct = Math.min(Math.round((temp / max) * 100), 100);
        const isWarm = temp >= (s.UpperThresholdCaution || 50);

        return `
          <div class="sensor-item">
            <div class="sensor-top">
              <span class="sensor-name" title="${name}">${name}</span>
              <span class="sensor-temp">${temp}°C</span>
            </div>
            <div class="sensor-bar-bg">
              <div class="sensor-bar-fill ${isWarm ? 'warm' : ''}" style="width: ${pct}%;"></div>
            </div>
            <div style="font-size: 0.72rem; color: var(--text-dim); display: flex; justify-content: space-between;">
              <span>${s.PhysicalContext || 'Internal'}</span>
              <span>Max: ${s.UpperThresholdCritical || 'N/A'}°C</span>
            </div>
          </div>
        `;
      }).join("");
    }

    // Render Fans
    if (fans.length === 0) {
      fansGrid.innerHTML = `<div style="color: var(--text-muted);">No fans found.</div>`;
    } else {
      fansGrid.innerHTML = fans.map(f => {
        const speed = f.CurrentReading || 0;
        const name = f.FanName || `Fan ${f.Number || ''}`;
        const health = f.Status?.Health || "OK";
        return `
          <div class="fan-card">
            <div class="fan-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <path d="M12 12c2-2 5-2 7 0s2 5 0 7-5 2-7 0"></path>
                <path d="M12 12c-2-2-2-5 0-7s5-2 7 0 2 5 0 7"></path>
                <path d="M12 12c-2 2-5 2-7 0s-2-5 0-7 5-2 7 0"></path>
                <path d="M12 12c2 2 2 5 0 7s-5 2-7 0-2-5 0-7"></path>
              </svg>
            </div>
            <div>
              <div style="font-weight: 600; font-size: 0.88rem;">${name}</div>
              <div style="font-size: 1.1rem; font-weight: 700; color: #38bdf8;">${speed}%</div>
              <div style="font-size: 0.72rem; color: var(--text-dim);">${health}</div>
            </div>
          </div>
        `;
      }).join("");
    }
  } catch (err) {
    sensorGrid.innerHTML = `<div style="color: var(--accent-red); padding: 20px;">Failed to load sensors: ${err.message}</div>`;
  }
}

/* ---------------- EVENT LOGS ---------------- */
async function loadEventLogs(type = "iml") {
  currentLogType = type;
  const tbody = document.getElementById("logsTableBody");
  tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">Loading ${type.toUpperCase()} logs...</td></tr>`;

  try {
    const res = await fetch(`/api/logs/${type}`);
    if (!res.ok) throw new Error("HTTP error");
    const data = await res.json();
    const entries = data.entries || [];

    if (entries.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--text-muted); padding: 30px;">No log records found.</td></tr>`;
      return;
    }

    tbody.innerHTML = entries.map(entry => {
      const severity = entry.Severity || "OK";
      const created = entry.Created ? new Date(entry.Created).toLocaleString() : "N/A";
      const id = entry.RecordId || entry.Id || "-";
      const message = entry.Message || entry.Description || JSON.stringify(entry);

      return `
        <tr>
          <td><span class="severity-pill ${severity}">${severity}</span></td>
          <td style="color: var(--text-muted); font-size: 0.8rem; font-family: monospace;">${created}</td>
          <td style="color: var(--text-dim); font-size: 0.8rem;">#${id}</td>
          <td style="font-size: 0.85rem;">${escapeHtml(message)}</td>
        </tr>
      `;
    }).join("");
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align: center; color: var(--accent-red); padding: 30px;">Error loading logs: ${err.message}</td></tr>`;
  }
}

function switchLogView(type) {
  document.getElementById("btnLogIML").className = (type === "iml") ? "btn-icon active" : "btn-icon";
  document.getElementById("btnLogIEL").className = (type === "iel") ? "btn-icon active" : "btn-icon";
  loadEventLogs(type);
}

/* ---------------- REST API EXPLORER ---------------- */
function initRestExplorer() {
  const btnSend = document.getElementById("btnSendRest");
  if (btnSend) {
    btnSend.addEventListener("click", executeRestProxy);
  }

  const searchInput = document.getElementById("restSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterRestEndpoints(e.target.value);
    });
  }
}

async function loadRestEndpoints() {
  const container = document.getElementById("restEndpointList");
  try {
    const res = await fetch("/api/rest/endpoints");
    if (!res.ok) throw new Error("HTTP error");
    const data = await res.json();
    allRestEndpoints = data.endpoints || [];

    renderRestEndpoints(allRestEndpoints);
  } catch (err) {
    container.innerHTML = `<div style="color: var(--accent-red); padding: 10px;">Failed to load endpoints: ${err.message}</div>`;
  }
}

function renderRestEndpoints(list) {
  const container = document.getElementById("restEndpointList");
  if (list.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); padding: 10px;">No endpoints match search.</div>`;
    return;
  }

  container.innerHTML = list.map((ep, idx) => {
    const methods = ep.methods || ["GET"];
    const primaryMethod = methods[0] || "GET";
    const path = ep.href || "";
    return `
      <div class="endpoint-item" onclick="selectRestEndpoint('${path}', '${primaryMethod}')">
        <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${path}">${path}</span>
        <span class="method-tag ${primaryMethod}">${primaryMethod}</span>
      </div>
    `;
  }).join("");
}

function filterRestEndpoints(query) {
  const q = query.toLowerCase().trim();
  const filtered = allRestEndpoints.filter(ep => (ep.href || "").toLowerCase().includes(q) || (ep.type || "").toLowerCase().includes(q));
  renderRestEndpoints(filtered);
}

function selectRestEndpoint(path, method = "GET") {
  document.getElementById("restPath").value = path;
  document.getElementById("restMethod").value = method;
  document.getElementById("restPayload").value = "";
}

function setRestPreset(path, method = "GET") {
  document.getElementById("restPath").value = path;
  document.getElementById("restMethod").value = method;
  executeRestProxy();
}

async function executeRestProxy() {
  const method = document.getElementById("restMethod").value;
  const path = document.getElementById("restPath").value.trim();
  const rawPayload = document.getElementById("restPayload").value.trim();
  const viewer = document.getElementById("restResponse");
  const badge = document.getElementById("restStatusBadge");
  const elapsedBadge = document.getElementById("restElapsedBadge");

  let parsedBody = null;
  if (rawPayload && (method === "POST" || method === "PATCH" || method === "PUT")) {
    try {
      parsedBody = JSON.parse(rawPayload);
    } catch (e) {
      showToast("Invalid JSON in Request Payload!", "error");
      return;
    }
  }

  viewer.textContent = "Executing request against iLO 4...";
  badge.textContent = "";
  elapsedBadge.textContent = "";

  try {
    const res = await fetch("/api/rest/proxy", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method,
        path,
        body: parsedBody
      })
    });
    const result = await res.json();
    
    elapsedBadge.textContent = `${result.execution_time_ms} ms`;
    
    if (result.status === "success") {
      badge.textContent = `HTTP ${result.http_status} ${result.status_text || ''}`;
      badge.className = (result.http_status >= 200 && result.http_status < 300) ? "severity-pill OK" : "severity-pill Critical";

      if (result.data) {
        viewer.textContent = JSON.stringify(result.data, null, 2);
      } else {
        viewer.textContent = result.raw_text || "(No response body)";
      }
    } else {
      badge.textContent = "ERROR";
      badge.className = "severity-pill Critical";
      viewer.textContent = `Request Failed: ${result.error}`;
    }
  } catch (err) {
    badge.textContent = "NETWORK ERROR";
    badge.className = "severity-pill Critical";
    viewer.textContent = `Client error: ${err.message}`;
  }
}

function copyRestResponse() {
  const text = document.getElementById("restResponse").textContent;
  navigator.clipboard.writeText(text);
  showToast("Response copied to clipboard!", "success");
}

/* ---------------- RIBCL COMMAND RUNNER ---------------- */
function initRibclRunner() {
  const btnRun = document.getElementById("btnRunRibcl");
  if (btnRun) {
    btnRun.addEventListener("click", executeRibclMethod);
  }

  const searchInput = document.getElementById("ribclSearch");
  if (searchInput) {
    searchInput.addEventListener("input", (e) => {
      filterRibclMethods(e.target.value);
    });
  }
}

async function loadRibclMethods() {
  const container = document.getElementById("ribclMethodList");
  try {
    const res = await fetch("/api/ribcl/methods");
    if (!res.ok) throw new Error("HTTP error");
    const data = await res.json();
    allRibclMethods = data.methods || [];

    renderRibclMethods(allRibclMethods);
  } catch (err) {
    container.innerHTML = `<div style="color: var(--accent-red); padding: 10px;">Failed to load RIBCL: ${err.message}</div>`;
  }
}

function renderRibclMethods(list) {
  const container = document.getElementById("ribclMethodList");
  if (list.length === 0) {
    container.innerHTML = `<div style="color: var(--text-muted); padding: 10px;">No methods match search.</div>`;
    return;
  }

  container.innerHTML = list.map(m => `
    <div class="endpoint-item" onclick="selectRibclMethod('${m.name}')">
      <span style="overflow: hidden; text-overflow: ellipsis; white-space: nowrap;" title="${m.name}">${m.name}</span>
      <span class="method-tag POST">RIBCL</span>
    </div>
  `).join("");
}

function filterRibclMethods(query) {
  const q = query.toLowerCase().trim();
  const filtered = allRibclMethods.filter(m => m.name.toLowerCase().includes(q) || (m.doc || "").toLowerCase().includes(q));
  renderRibclMethods(filtered);
}

function selectRibclMethod(methodName) {
  const found = allRibclMethods.find(m => m.name === methodName);
  document.getElementById("ribclSelectedMethodName").textContent = methodName;
  document.getElementById("ribclMethodDoc").textContent = (found && found.doc) ? found.doc : "Native python-hpilo RIBCL method.";
  document.getElementById("ribclKwargs").value = "{}";
}

async function executeRibclMethod() {
  const methodName = document.getElementById("ribclSelectedMethodName").textContent.trim();
  const rawKwargs = document.getElementById("ribclKwargs").value.trim();
  const viewer = document.getElementById("ribclResponse");
  const elapsedBadge = document.getElementById("ribclElapsedBadge");

  let kwargs = {};
  if (rawKwargs) {
    try {
      kwargs = JSON.parse(rawKwargs);
    } catch (e) {
      showToast("Invalid JSON in command arguments!", "error");
      return;
    }
  }

  viewer.textContent = `Executing '${methodName}' via hpilo...`;
  elapsedBadge.textContent = "";

  try {
    const res = await fetch("/api/ribcl/execute", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        method_name: methodName,
        kwargs: kwargs
      })
    });
    const result = await res.json();
    
    if (result.execution_time_ms) {
      elapsedBadge.textContent = `${result.execution_time_ms} ms`;
    }

    if (result.status === "success") {
      viewer.textContent = JSON.stringify(result.result, null, 2);
    } else {
      viewer.textContent = `Execution Error: ${result.error}`;
    }
  } catch (err) {
    viewer.textContent = `Network Error: ${err.message}`;
  }
}

function copyRibclResponse() {
  const text = document.getElementById("ribclResponse").textContent;
  navigator.clipboard.writeText(text);
  showToast("Output copied to clipboard!", "success");
}

/* ---------------- SETTINGS & LAN ---------------- */
function initSettingsModal() {
  const btn = document.getElementById("btnOpenSettings");
  if (btn) {
    btn.addEventListener("click", () => {
      document.getElementById("settingsModal").classList.add("active");
    });
  }
}

function closeSettingsModal() {
  document.getElementById("settingsModal").classList.remove("active");
}

async function saveSettings() {
  const host = document.getElementById("cfgHost").value.trim();
  const user = document.getElementById("cfgUser").value.trim();
  const pwd = document.getElementById("cfgPassword").value;

  showToast("Verifying iLO connection...", "info");
  try {
    const payload = { host, user };
    if (pwd) payload.password = pwd;

    const res = await fetch("/api/config", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const result = await res.json();
    if (result.status === "success") {
      showToast("✓ Settings updated & connection verified!", "success");
      closeSettingsModal();
      document.getElementById("headerIloHost").textContent = host;
      refreshAllData();
    } else {
      showToast(`✗ ${result.error}`, "error");
    }
  } catch (err) {
    showToast(`Failed to update config: ${err.message}`, "error");
  }
}

function copyLanUrl() {
  const url = document.getElementById("lanDisplayUrl")?.textContent?.trim() || `http://${document.getElementById("lanUrlText")?.textContent?.trim()}`;
  navigator.clipboard.writeText(url);
  showToast(`Copied LAN URL: ${url}`, "success");
}

/* ---------------- AUTO-POLL & REFRESH ---------------- */
function startAutoPoll() {
  if (autoPollTimer) clearInterval(autoPollTimer);
  autoPollTimer = setInterval(() => {
    fetchPowerStatus();
    checkConnectionStatus();
  }, 4000);
}

function stopAutoPoll() {
  if (autoPollTimer) {
    clearInterval(autoPollTimer);
    autoPollTimer = null;
  }
}

async function checkConnectionStatus() {
  try {
    const res = await fetch("/api/status");
    const data = await res.json();
    const dot = document.getElementById("headerStatusDot");
    const lat = document.getElementById("headerLatency");

    if (data.status === "connected") {
      dot.className = "status-dot";
      lat.textContent = `${data.latency_ms}ms • Online`;
    } else {
      dot.className = "status-dot offline";
      lat.textContent = `Offline / Error`;
    }
  } catch (e) {
    document.getElementById("headerStatusDot").className = "status-dot offline";
    document.getElementById("headerLatency").textContent = "Unreachable";
  }
}

function refreshAllData() {
  checkConnectionStatus();
  fetchPowerStatus();
  loadHardwareTelemetry();
}

/* ---------------- TOAST UTILITY ---------------- */
function showToast(message, type = "info") {
  const container = document.getElementById("toastContainer");
  if (!container) return;
  const toast = document.createElement("div");
  toast.className = `toast ${type}`;
  toast.textContent = message;
  container.appendChild(toast);
  setTimeout(() => {
    toast.style.opacity = "0";
    toast.style.transform = "translateX(50px)";
    toast.style.transition = "all 0.3s ease";
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function escapeHtml(str) {
  if (typeof str !== "string") return str;
  return str.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}
