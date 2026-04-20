/**
 * Sidebar - Device setup panel
 */
import { eventBus } from '../core/EventBus.js';
import { appState, OperationMode, BusType, ConnectionState } from '../core/AppState.js';

export class Sidebar {
  constructor(container) {
    this._container = container;
    this._render();
    this._bindEvents();
    this._updateDriverPanel();
    this._updateStatusDot();
    eventBus.on('state:busTypeChanged', () => this._updateDriverPanel());
    eventBus.on('state:connectionStateChanged', () => this._updateStatusDot());
    eventBus.on('state:operationModeChanged', () => this._updateDriverPanel());
  }

  _render() {
    this._container.innerHTML = `
      <div class="sidebar">
        <div class="sidebar-header">
          <div class="sidebar-title">
            <span class="sidebar-title-icon">⚙️</span>
            <span>Device Setup</span>
          </div>
        </div>
        <div class="sidebar-scroll">

          <!-- Frame Parsing Mode -->
          <div class="sidebar-section">
            <div class="sidebar-section-label">Frame Parsing</div>
            <div class="sidebar-section-content">
              <label class="radio-wrap">
                <input type="radio" name="opMode" value="QuickPlot" ${appState.operationMode === OperationMode.QuickPlot ? 'checked' : ''}>
                <span>Quick Plot (CSV values)</span>
              </label>
              <label class="radio-wrap">
                <input type="radio" name="opMode" value="DeviceSendsJSON" ${appState.operationMode === OperationMode.DeviceSendsJSON ? 'checked' : ''}>
                <span>Device Sends JSON</span>
              </label>
              <label class="radio-wrap">
                <input type="radio" name="opMode" value="ProjectFile" ${appState.operationMode === OperationMode.ProjectFile ? 'checked' : ''}>
                <span>Project File</span>
              </label>
            </div>
          </div>

          <!-- Data Export -->
          <div class="sidebar-section">
            <div class="sidebar-section-label">Data Export</div>
            <div class="sidebar-section-content">
              <label class="checkbox-wrap">
                <input type="checkbox" id="chk-csv" ${appState.csvExportEnabled ? 'checked' : ''}>
                <span>Export CSV file</span>
              </label>
              <label class="checkbox-wrap">
                <input type="checkbox" id="chk-console-log" ${appState.consoleExportEnabled ? 'checked' : ''}>
                <span>Export console log</span>
              </label>
            </div>
          </div>

          <!-- I/O Interface -->
          <div class="sidebar-section">
            <div class="sidebar-section-label">I/O Interface</div>
            <div class="sidebar-section-content">
              <div style="display:grid;grid-template-columns:1fr 1fr;gap:4px">
                <button class="btn bus-btn ${appState.busType === BusType.Serial ? 'btn-primary' : ''}" data-bus="Serial">⚡ Serial</button>
                <button class="btn bus-btn ${appState.busType === BusType.Bluetooth ? 'btn-primary' : ''}" data-bus="Bluetooth">📶 BLE</button>
                <button class="btn bus-btn ${appState.busType === BusType.WebSocket ? 'btn-primary' : ''}" data-bus="WebSocket">🌐 WebSocket</button>
                <button class="btn bus-btn ${appState.busType === BusType.MQTT ? 'btn-primary' : ''}" data-bus="MQTT">📡 MQTT</button>
              </div>
            </div>
          </div>

          <!-- Driver Config Panel (dynamic) -->
          <div class="sidebar-section" id="driver-panel"></div>

          <!-- JSON Project Editor (DeviceSendsJSON mode) -->
          <div class="sidebar-section" id="json-editor-section" style="display:none">
            <div class="sidebar-section-label">JSON Project Editor</div>
            <div class="json-editor-panel">
              <div style="font-size:10px;color:var(--text-muted);line-height:1.5;margin-bottom:4px">
                Device should send JSON wrapped in <code style="color:var(--accent-cyan)">/* ... */</code> delimiters.
                Edit the schema below to customize dashboard widgets.
              </div>
              <textarea class="json-editor-textarea" id="json-schema-editor" spellcheck="false" rows="10">${JSON.stringify({
  "t": "My Device",
  "g": [
    {
      "t": "Sensors",
      "w": "multiplot",
      "d": [
        {"t": "Temperature", "v": 0, "u": "\u00b0C", "g": true, "b": true, "min": -20, "max": 80},
        {"t": "Humidity",    "v": 0, "u": "%",   "g": false,"b": true, "min": 0,   "max": 100}
      ]
    }
  ]
}, null, 2)}</textarea>
              <div style="display:flex;align-items:center;justify-content:space-between">
                <span class="json-editor-status valid" id="json-status">✓ Valid JSON</span>
                <div style="display:flex;gap:4px">
                  <button class="btn" id="btn-json-load" style="font-size:11px;padding:3px 8px">📂 Load JSON</button>
                  <button class="btn btn-primary" id="btn-json-apply" style="font-size:11px;padding:3px 8px">▶ Apply</button>
                </div>
              </div>
              <div style="font-size:10px;color:var(--text-muted);margin-top:4px">
                <strong style="color:var(--text-secondary)">Last received JSON:</strong>
                <div id="json-last-received" style="color:var(--accent-green);font-family:var(--font-mono);font-size:10px;max-height:80px;overflow-y:auto;margin-top:2px;word-break:break-all">None</div>
              </div>
            </div>
          </div>

          <!-- Frame Config -->
          <div class="sidebar-section">
            <div class="sidebar-section-label">Frame Settings</div>
            <div class="sidebar-section-content">
              <div class="form-row">
                <div class="form-label">End Delimiter</div>
                <input class="form-input" id="cfg-end-del" value="${appState.frameConfig.endDelimiter}" placeholder="\\n">
              </div>
              <div class="form-row">
                <div class="form-label">Start Delimiter</div>
                <input class="form-input" id="cfg-start-del" value="${appState.frameConfig.startDelimiter}" placeholder="Leave empty">
              </div>
            </div>
          </div>

          <!-- History Points -->
          <div class="sidebar-section">
            <div class="sidebar-section-label">Plot Settings</div>
            <div class="sidebar-section-content">
              <div class="form-row">
                <div class="form-label">History Points</div>
                <input class="form-input" id="cfg-points" type="number" min="10" max="5000" value="${appState.points}">
              </div>
            </div>
          </div>

        </div>
        <div class="sidebar-status">
          <div class="sidebar-status-dot" id="status-dot"></div>
          <span id="status-text">Disconnected</span>
        </div>
      </div>`;
  }

  _bindEvents() {
    // Operation mode
    this._container.querySelectorAll('input[name="opMode"]').forEach(r => {
      r.addEventListener('change', () => {
        appState.operationMode = r.value;
        this._toggleJsonEditor(r.value);
      });
    });

    // Export toggles
    const csvChk = this._container.querySelector('#chk-csv');
    if (csvChk) csvChk.addEventListener('change', () => { appState.csvExportEnabled = csvChk.checked; });
    const conChk = this._container.querySelector('#chk-console-log');
    if (conChk) conChk.addEventListener('change', () => { appState.consoleExportEnabled = conChk.checked; });

    // Bus type buttons
    this._container.querySelectorAll('.bus-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        appState.busType = btn.dataset.bus;
        this._container.querySelectorAll('.bus-btn').forEach(b => b.classList.remove('btn-primary'));
        btn.classList.add('btn-primary');
      });
    });

    // Frame config
    const endDel = this._container.querySelector('#cfg-end-del');
    if (endDel) endDel.addEventListener('change', () => appState.updateFrameConfig({ endDelimiter: endDel.value }));
    const startDel = this._container.querySelector('#cfg-start-del');
    if (startDel) startDel.addEventListener('change', () => appState.updateFrameConfig({ startDelimiter: startDel.value }));

    // Points
    const pointsInput = this._container.querySelector('#cfg-points');
    if (pointsInput) pointsInput.addEventListener('change', () => { appState.points = parseInt(pointsInput.value) || 100; });

    // JSON editor
    this._bindJsonEditor();

    // Show/hide JSON editor based on current mode
    this._toggleJsonEditor(appState.operationMode);
  }

  _toggleJsonEditor(mode) {
    const section = this._container.querySelector('#json-editor-section');
    if (!section) return;
    section.style.display = mode === 'DeviceSendsJSON' ? 'block' : 'none';
  }

  _bindJsonEditor() {
    const textarea = this._container.querySelector('#json-schema-editor');
    const statusEl = this._container.querySelector('#json-status');
    const applyBtn = this._container.querySelector('#btn-json-apply');
    const loadBtn = this._container.querySelector('#btn-json-load');
    if (!textarea) return;

    // Live validation
    textarea.addEventListener('input', () => {
      try {
        JSON.parse(textarea.value);
        if (statusEl) { statusEl.textContent = '✓ Valid JSON'; statusEl.className = 'json-editor-status valid'; }
        if (applyBtn) applyBtn.disabled = false;
      } catch (e) {
        if (statusEl) { statusEl.textContent = '✗ ' + e.message.slice(0, 40); statusEl.className = 'json-editor-status invalid'; }
        if (applyBtn) applyBtn.disabled = true;
      }
    });

    // Apply button — apply the JSON schema to the dashboard
    if (applyBtn) {
      applyBtn.addEventListener('click', () => {
        try {
          const schema = JSON.parse(textarea.value);
          eventBus.emit('project:applyJSON', schema);
          eventBus.emit('toast', { type: 'success', message: 'JSON schema applied to dashboard!' });
        } catch (e) {
          eventBus.emit('toast', { type: 'error', message: 'Invalid JSON: ' + e.message });
        }
      });
    }

    // Load from file
    if (loadBtn) {
      loadBtn.addEventListener('click', () => {
        const input = document.createElement('input');
        input.type = 'file'; input.accept = '.json';
        input.addEventListener('change', (e) => {
          const file = e.target.files[0];
          if (!file) return;
          const reader = new FileReader();
          reader.onload = (ev) => {
            textarea.value = ev.target.result;
            textarea.dispatchEvent(new Event('input'));
          };
          reader.readAsText(file);
        });
        input.click();
      });
    }

    // Listen for incoming JSON frames and display them
    eventBus.on('frame:receivedJSON', (json) => {
      const lastEl = this._container.querySelector('#json-last-received');
      if (lastEl) lastEl.textContent = JSON.stringify(json).slice(0, 200);
    });
  }

  _updateDriverPanel() {
    const panel = this._container.querySelector('#driver-panel');
    if (!panel) return;

    const bus = appState.busType;
    let html = `<div class="sidebar-section-label">${bus} Configuration</div><div class="driver-config">`;

    if (bus === BusType.Serial) {
      const cfg = appState.serialConfig;
      html += `
        <div class="form-row">
          <div class="form-label">Baud Rate</div>
          <select class="form-select" id="drv-baud">
            ${[300,1200,2400,4800,9600,19200,38400,57600,115200,230400,460800,921600].map(b =>
              `<option ${b === cfg.baudRate ? 'selected' : ''} value="${b}">${b}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Data Bits</div>
          <select class="form-select" id="drv-databits">
            ${[7,8].map(b => `<option ${b === cfg.dataBits ? 'selected' : ''} value="${b}">${b}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Stop Bits</div>
          <select class="form-select" id="drv-stopbits">
            ${[1,2].map(b => `<option ${b === cfg.stopBits ? 'selected' : ''} value="${b}">${b}</option>`).join('')}
          </select>
        </div>
        <div class="form-row">
          <div class="form-label">Parity</div>
          <select class="form-select" id="drv-parity">
            ${['none','even','odd','mark','space'].map(p => `<option ${p === cfg.parity ? 'selected' : ''} value="${p}">${p}</option>`).join('')}
          </select>
        </div>`;
    } else if (bus === BusType.WebSocket) {
      const cfg = appState.wsConfig;
      html += `
        <div class="form-row">
          <div class="form-label">URL</div>
          <input class="form-input" id="drv-ws-url" value="${cfg.url}" placeholder="ws://localhost:8080">
        </div>`;
    } else if (bus === BusType.MQTT) {
      const cfg = appState.mqttConfig;
      html += `
        <div class="form-row">
          <div class="form-label">Broker URL</div>
          <input class="form-input" id="drv-mqtt-url" value="${cfg.brokerUrl}" placeholder="ws://broker:9001">
        </div>
        <div class="form-row">
          <div class="form-label">Topic</div>
          <input class="form-input" id="drv-mqtt-topic" value="${cfg.topic}" placeholder="sensor/data">
        </div>
        <div class="form-row">
          <div class="form-label">Username</div>
          <input class="form-input" id="drv-mqtt-user" value="${cfg.username}">
        </div>
        <div class="form-row">
          <div class="form-label">Password</div>
          <input class="form-input" id="drv-mqtt-pass" type="password" value="${cfg.password}">
        </div>`;
    } else if (bus === BusType.Bluetooth) {
      html += `<div style="color:var(--text-muted);font-size:var(--font-size-xs);line-height:1.6;">
        Web Bluetooth API will prompt for device selection when you click Connect.<br>
        Requires a GATT service exposing a readable+notify characteristic.
      </div>`;
    }

    html += '</div>';
    panel.innerHTML = html;

    // Bind driver-specific inputs
    if (bus === BusType.Serial) {
      ['baud','databits','stopbits','parity'].forEach(id => {
        const el = panel.querySelector(`#drv-${id}`);
        if (el) el.addEventListener('change', () => {
          appState.updateSerialConfig({
            baudRate: parseInt(panel.querySelector('#drv-baud')?.value) || 115200,
            dataBits: parseInt(panel.querySelector('#drv-databits')?.value) || 8,
            stopBits: parseInt(panel.querySelector('#drv-stopbits')?.value) || 1,
            parity: panel.querySelector('#drv-parity')?.value || 'none',
          });
        });
      });
    } else if (bus === BusType.WebSocket) {
      panel.querySelector('#drv-ws-url')?.addEventListener('change', (e) => appState.updateWsConfig({ url: e.target.value }));
    } else if (bus === BusType.MQTT) {
      panel.querySelector('#drv-mqtt-url')?.addEventListener('change', (e) => appState.updateMqttConfig({ brokerUrl: e.target.value }));
      panel.querySelector('#drv-mqtt-topic')?.addEventListener('change', (e) => appState.updateMqttConfig({ topic: e.target.value }));
      panel.querySelector('#drv-mqtt-user')?.addEventListener('change', (e) => appState.updateMqttConfig({ username: e.target.value }));
      panel.querySelector('#drv-mqtt-pass')?.addEventListener('change', (e) => appState.updateMqttConfig({ password: e.target.value }));
    }
  }

  _updateStatusDot() {
    const dot = this._container.querySelector('#status-dot');
    const text = this._container.querySelector('#status-text');
    if (!dot || !text) return;
    const state = appState.connectionState;
    dot.className = 'sidebar-status-dot';
    if (state === ConnectionState.Connected) {
      dot.classList.add('connected');
      text.textContent = `Connected via ${appState.busType}`;
    } else if (state === ConnectionState.Connecting) {
      dot.classList.add('connecting');
      text.textContent = 'Connecting…';
    } else if (state === ConnectionState.Error) {
      dot.classList.add('error');
      text.textContent = 'Connection Error';
    } else {
      text.textContent = 'Disconnected';
    }
  }
}
