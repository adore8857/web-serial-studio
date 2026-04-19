/**
 * Toolbar — Ribbon-style top toolbar
 */
import { eventBus } from '../core/EventBus.js';
import { appState, BusType, ConnectionState } from '../core/AppState.js';
import { CSVExporter } from '../utils/helpers.js';

export class Toolbar {
  constructor(container, connectionManager, simulator) {
    this._container = container;
    this._conn = connectionManager;
    this._sim = simulator;
    this._csvExporter = new CSVExporter();
    this._rateEl = null;
    this._countEl = null;
    this._render();
    this._bindEvents();
    eventBus.on('state:connectionStateChanged', () => this._updateConnectBtn());
    // Update stats every second
    setInterval(() => this._updateStats(), 1000);
  }

  _render() {
    this._container.innerHTML = `
      <div class="toolbar">
        <!-- Brand -->
        <div class="toolbar-brand">
          <div class="toolbar-brand-icon">SS</div>
          <div class="toolbar-brand-text">
            <div class="toolbar-brand-title">Serial Studio</div>
            <div class="toolbar-brand-subtitle">Web Edition</div>
          </div>
        </div>

        <!-- Sections -->
        <div class="toolbar-sections">

          <!-- Project Section -->
          <div class="toolbar-section">
            <div class="toolbar-section-content">
              <button class="toolbar-btn" id="btn-project-editor" title="Open Project Editor">
                <div class="toolbar-btn-icon">✏️</div>
                <div class="toolbar-btn-label">Editor</div>
              </button>
              <div style="display:flex;flex-direction:column;gap:2px">
                <button class="toolbar-btn toolbar-btn-compact" id="btn-open-project" title="Open project file">
                  <div class="toolbar-btn-icon">📂</div>
                  <div class="toolbar-btn-label">Open Project</div>
                </button>
                <button class="toolbar-btn toolbar-btn-compact" id="btn-save-project" title="Save project">
                  <div class="toolbar-btn-icon">💾</div>
                  <div class="toolbar-btn-label">Save Project</div>
                </button>
                <button class="toolbar-btn toolbar-btn-compact" id="btn-export-csv" title="Download CSV">
                  <div class="toolbar-btn-icon">📊</div>
                  <div class="toolbar-btn-label">Export CSV</div>
                </button>
              </div>
            </div>
            <div class="toolbar-section-label">Project</div>
          </div>

          <!-- Driver Section -->
          <div class="toolbar-section">
            <div class="toolbar-section-content">
              <div class="toolbar-drivers">
                <button class="toolbar-btn toolbar-btn-compact driver-btn ${appState.busType===BusType.Serial?'active':''}" data-bus="Serial" title="Serial UART">
                  <div class="toolbar-btn-icon">⚡</div>
                  <div class="toolbar-btn-label">UART</div>
                </button>
                <button class="toolbar-btn toolbar-btn-compact driver-btn ${appState.busType===BusType.Bluetooth?'active':''}" data-bus="Bluetooth" title="Bluetooth LE">
                  <div class="toolbar-btn-icon">📶</div>
                  <div class="toolbar-btn-label">BLE</div>
                </button>
                <button class="toolbar-btn toolbar-btn-compact driver-btn ${appState.busType===BusType.WebSocket?'active':''}" data-bus="WebSocket" title="WebSocket TCP">
                  <div class="toolbar-btn-icon">🌐</div>
                  <div class="toolbar-btn-label">Network</div>
                </button>
                <button class="toolbar-btn toolbar-btn-compact driver-btn ${appState.busType===BusType.MQTT?'active':''}" data-bus="MQTT" title="MQTT">
                  <div class="toolbar-btn-icon">📡</div>
                  <div class="toolbar-btn-label">MQTT</div>
                </button>
              </div>
            </div>
            <div class="toolbar-section-label">Interface</div>
          </div>

          <!-- Simulator Section -->
          <div class="toolbar-section">
            <div class="toolbar-section-content">
              <button class="toolbar-btn" id="btn-sim" title="Start/Stop Demo Simulator">
                <div class="toolbar-btn-icon" id="sim-icon">🎲</div>
                <div class="toolbar-btn-label" id="sim-label">Demo Sim</div>
              </button>
              <div style="display:flex;flex-direction:column;gap:2px">
                <button class="toolbar-btn toolbar-btn-compact" id="btn-sidebar" title="Toggle Setup Panel">
                  <div class="toolbar-btn-icon">◧</div>
                  <div class="toolbar-btn-label">Setup Panel</div>
                </button>
                <button class="toolbar-btn toolbar-btn-compact" id="btn-preferences" title="Preferences">
                  <div class="toolbar-btn-icon">⚙️</div>
                  <div class="toolbar-btn-label">Preferences</div>
                </button>
              </div>
            </div>
            <div class="toolbar-section-label">Tools</div>
          </div>

          <!-- Stats Section -->
          <div class="toolbar-section">
            <div class="toolbar-section-content" style="flex-direction:column;align-items:flex-start;gap:6px;min-width:100px">
              <div style="font-size:10px;color:var(--text-muted)">Frames/s: <span id="stat-rate" style="color:var(--accent-green);font-family:var(--font-mono)">0</span></div>
              <div style="font-size:10px;color:var(--text-muted)">Total: <span id="stat-count" style="color:var(--accent-blue);font-family:var(--font-mono)">0</span></div>
            </div>
            <div class="toolbar-section-label">Statistics</div>
          </div>

        </div>

        <!-- Connect Button -->
        <div class="toolbar-connect-area">
          <button class="toolbar-connect-btn disconnected" id="btn-connect">
            <span class="btn-dot"></span>
            <span id="connect-label">Connect</span>
          </button>
        </div>
      </div>`;

    this._rateEl = this._container.querySelector('#stat-rate');
    this._countEl = this._container.querySelector('#stat-count');
  }

  _bindEvents() {
    // Connect button
    this._container.querySelector('#btn-connect').addEventListener('click', () => {
      if (this._sim?.isRunning) { this._sim.stop(); return; }
      this._conn.toggleConnection();
    });

    // Simulator
    this._container.querySelector('#btn-sim').addEventListener('click', () => {
      if (appState.isConnected && !this._sim?.isRunning) return;
      this._sim?.toggle();
      this._updateSimBtn();
      this._updateConnectBtn();
    });

    // Driver buttons
    this._container.querySelectorAll('.driver-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        if (appState.isConnected) return;
        appState.busType = btn.dataset.bus;
        this._container.querySelectorAll('.driver-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
      });
    });

    // Sidebar toggle
    this._container.querySelector('#btn-sidebar').addEventListener('click', () => {
      appState.sidebarVisible = !appState.sidebarVisible;
      eventBus.emit('ui:toggleSidebar');
    });

    // Project open
    this._container.querySelector('#btn-open-project').addEventListener('click', () => {
      const input = document.createElement('input');
      input.type = 'file'; input.accept = '.json';
      input.addEventListener('change', (e) => {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => eventBus.emit('project:load', ev.target.result);
        reader.readAsText(file);
      });
      input.click();
    });

    // Project save
    this._container.querySelector('#btn-save-project').addEventListener('click', () => eventBus.emit('project:save'));

    // CSV export
    this._container.querySelector('#btn-export-csv').addEventListener('click', () => {
      this._csvExporter.download('serial-studio');
      eventBus.emit('toast', { type: 'success', message: 'CSV exported!' });
    });

    // Project editor
    this._container.querySelector('#btn-project-editor').addEventListener('click', () => eventBus.emit('ui:openEditor'));

    // Listen to frame events for CSV
    eventBus.on('frame:received', (frame) => {
      if (appState.csvExportEnabled && frame.datasets) {
        if (!this._csvExporter.isRecording) {
          const headers = frame.datasets.map(d => d.title || `Ch${d.index+1}`);
          this._csvExporter.start(headers);
        }
        this._csvExporter.addRow(frame.datasets.map(d => d.value));
      }
    });
    eventBus.on('state:connectionStateChanged', (state) => {
      if (state === 'Disconnected') this._csvExporter.stop();
    });
  }

  _updateConnectBtn() {
    const btn = this._container.querySelector('#btn-connect');
    const label = this._container.querySelector('#connect-label');
    if (!btn || !label) return;
    const connected = appState.isConnected;
    const simRunning = this._sim?.isRunning;
    btn.className = `toolbar-connect-btn ${connected || simRunning ? 'connected' : 'disconnected'}`;
    label.textContent = connected ? 'Disconnect' : (simRunning ? 'Stop Sim' : 'Connect');
  }

  _updateSimBtn() {
    const icon = this._container.querySelector('#sim-icon');
    const label = this._container.querySelector('#sim-label');
    if (!icon || !label) return;
    icon.textContent = this._sim?.isRunning ? '⏹' : '🎲';
    label.textContent = this._sim?.isRunning ? 'Stop Sim' : 'Demo Sim';
  }

  _updateStats() {
    if (this._rateEl) this._rateEl.textContent = appState.dataRate;
    if (this._countEl) this._countEl.textContent = appState.frameCount;
  }
}
