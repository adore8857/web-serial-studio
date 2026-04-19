/**
 * PreferencesDialog — Application preferences modal
 */
import { eventBus } from '../core/EventBus.js';
import { appState } from '../core/AppState.js';

export class PreferencesDialog {
  constructor(modalRoot) {
    this._root = modalRoot;
    this._el = null;
    eventBus.on('ui:openPreferences', () => this.open());
  }

  open() {
    if (this._el) this.close();

    const cfg = appState.serialConfig;
    const frameCfg = appState.frameConfig;

    this._el = document.createElement('div');
    this._el.className = 'modal-overlay animate-fadeIn';
    this._el.innerHTML = `
      <div class="modal" style="max-width:580px">
        <div class="modal-header">
          <div class="modal-title">⚙️ Preferences</div>
          <button class="btn btn-icon" id="pref-close" style="font-size:18px">✕</button>
        </div>
        <div class="modal-body">

          <!-- Display Settings -->
          <div class="editor-form-section" style="margin-bottom:20px">
            <div class="editor-form-section-title">📊 Display</div>
            <div class="editor-form-grid">
              <div class="form-row">
                <div class="form-label">Plot History Points</div>
                <input class="form-input" id="pref-points" type="number" min="10" max="10000" value="${appState.points}">
              </div>
              <div class="form-row">
                <div class="form-label">Theme</div>
                <select class="form-select" id="pref-theme">
                  <option value="dark" selected>Dark (Default)</option>
                  <option value="darker">Darker</option>
                </select>
              </div>
            </div>
          </div>

          <!-- Frame Parsing -->
          <div class="editor-form-section" style="margin-bottom:20px">
            <div class="editor-form-section-title">📦 Frame Parsing</div>
            <div class="editor-form-grid">
              <div class="form-row">
                <div class="form-label">Frame Detection</div>
                <select class="form-select" id="pref-frame-detection">
                  <option value="EndDelimiterOnly" ${frameCfg.frameDetection==='EndDelimiterOnly'?'selected':''}>End Delimiter Only</option>
                  <option value="StartAndEndDelimiter" ${frameCfg.frameDetection==='StartAndEndDelimiter'?'selected':''}>Start + End Delimiter</option>
                  <option value="NoDelimiters" ${frameCfg.frameDetection==='NoDelimiters'?'selected':''}>No Delimiters</option>
                </select>
              </div>
              <div class="form-row">
                <div class="form-label">End Delimiter</div>
                <input class="form-input" id="pref-end-del" value="${frameCfg.endDelimiter}" placeholder="\\n">
              </div>
              <div class="form-row">
                <div class="form-label">Start Delimiter</div>
                <input class="form-input" id="pref-start-del" value="${frameCfg.startDelimiter}" placeholder="Leave empty">
              </div>
            </div>
          </div>

          <!-- Serial Port Defaults -->
          <div class="editor-form-section" style="margin-bottom:20px">
            <div class="editor-form-section-title">⚡ Serial Port Defaults</div>
            <div class="editor-form-grid">
              <div class="form-row">
                <div class="form-label">Baud Rate</div>
                <select class="form-select" id="pref-baud">
                  ${[300,1200,2400,4800,9600,19200,38400,57600,115200,230400,460800,921600].map(b =>
                    `<option ${b===cfg.baudRate?'selected':''} value="${b}">${b}</option>`).join('')}
                </select>
              </div>
              <div class="form-row">
                <div class="form-label">Data Bits</div>
                <select class="form-select" id="pref-databits">
                  ${[7,8].map(b=>`<option ${b===cfg.dataBits?'selected':''} value="${b}">${b}</option>`).join('')}
                </select>
              </div>
              <div class="form-row">
                <div class="form-label">Stop Bits</div>
                <select class="form-select" id="pref-stopbits">
                  ${[1,2].map(b=>`<option ${b===cfg.stopBits?'selected':''} value="${b}">${b}</option>`).join('')}
                </select>
              </div>
              <div class="form-row">
                <div class="form-label">Parity</div>
                <select class="form-select" id="pref-parity">
                  ${['none','even','odd','mark','space'].map(p=>`<option ${p===cfg.parity?'selected':''} value="${p}">${p}</option>`).join('')}
                </select>
              </div>
              <div class="form-row">
                <div class="form-label">Flow Control</div>
                <select class="form-select" id="pref-flowcontrol">
                  ${['none','hardware'].map(p=>`<option ${p===cfg.flowControl?'selected':''} value="${p}">${p}</option>`).join('')}
                </select>
              </div>
            </div>
          </div>

          <!-- Data Export -->
          <div class="editor-form-section" style="margin-bottom:20px">
            <div class="editor-form-section-title">📁 Data Export</div>
            <div style="display:flex;flex-direction:column;gap:8px">
              <label class="checkbox-wrap">
                <input type="checkbox" id="pref-csv" ${appState.csvExportEnabled?'checked':''}>
                <span>Auto-export CSV on connect</span>
              </label>
              <label class="checkbox-wrap">
                <input type="checkbox" id="pref-console-log" ${appState.consoleExportEnabled?'checked':''}>
                <span>Export console log</span>
              </label>
            </div>
          </div>

          <!-- About -->
          <div class="editor-form-section">
            <div class="editor-form-section-title">ℹ️ About</div>
            <div style="font-size:12px;color:var(--text-muted);line-height:1.8">
              <div><strong style="color:var(--text-secondary)">Web Serial Studio</strong> — v1.0.0</div>
              <div>A web-based telemetry dashboard inspired by <a href="https://github.com/Serial-Studio/Serial-Studio" target="_blank" style="color:var(--accent-blue)">Serial Studio</a></div>
              <div style="margin-top:8px">Supports: Web Serial API (UART), WebSocket, MQTT</div>
              <div>Widgets: Plot, Gauge, Bar, Compass, DataGrid, Accelerometer</div>
              <div style="margin-top:8px;color:var(--text-muted)">
                <strong>Quick Plot mode:</strong> Send comma-separated values (e.g. <code style="color:var(--accent-green)">25.4,63.2,1013.1\n</code>)<br>
                <strong>Device Sends JSON:</strong> Wrap JSON in <code style="color:var(--accent-cyan)">/* ... */</code> delimiters<br>
                <strong>Project File:</strong> Load a .json project to define custom dashboards
              </div>
            </div>
          </div>

        </div>
        <div class="modal-footer">
          <button class="btn" id="pref-reset">Reset to Defaults</button>
          <button class="btn btn-primary" id="pref-save">Save & Close</button>
        </div>
      </div>`;

    this._root.appendChild(this._el);

    // Close on overlay click
    this._el.addEventListener('click', (e) => { if (e.target === this._el) this.close(); });
    this._el.querySelector('#pref-close').addEventListener('click', () => this.close());

    this._el.querySelector('#pref-reset').addEventListener('click', () => {
      appState.points = 100;
      appState.updateSerialConfig({ baudRate: 115200, dataBits: 8, stopBits: 1, parity: 'none', flowControl: 'none' });
      appState.updateFrameConfig({ endDelimiter: '\\n', startDelimiter: '', frameDetection: 'EndDelimiterOnly' });
      this.close();
      this.open(); // reopen with defaults
      eventBus.emit('toast', { type: 'info', message: 'Preferences reset to defaults' });
    });

    this._el.querySelector('#pref-save').addEventListener('click', () => {
      const points = parseInt(this._el.querySelector('#pref-points')?.value) || 100;
      appState.points = points;

      appState.updateSerialConfig({
        baudRate: parseInt(this._el.querySelector('#pref-baud')?.value) || 115200,
        dataBits: parseInt(this._el.querySelector('#pref-databits')?.value) || 8,
        stopBits: parseInt(this._el.querySelector('#pref-stopbits')?.value) || 1,
        parity: this._el.querySelector('#pref-parity')?.value || 'none',
        flowControl: this._el.querySelector('#pref-flowcontrol')?.value || 'none',
      });

      appState.updateFrameConfig({
        endDelimiter: this._el.querySelector('#pref-end-del')?.value || '\\n',
        startDelimiter: this._el.querySelector('#pref-start-del')?.value || '',
        frameDetection: this._el.querySelector('#pref-frame-detection')?.value || 'EndDelimiterOnly',
      });

      appState.csvExportEnabled = this._el.querySelector('#pref-csv')?.checked ?? true;
      appState.consoleExportEnabled = this._el.querySelector('#pref-console-log')?.checked ?? false;

      eventBus.emit('toast', { type: 'success', message: 'Preferences saved!' });
      this.close();
    });
  }

  close() {
    if (this._el) {
      this._el.remove();
      this._el = null;
    }
  }
}
