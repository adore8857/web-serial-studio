/**
 * Console - Terminal console panel
 */
import { eventBus } from '../core/EventBus.js';
import { appState } from '../core/AppState.js';
import { formatTime } from '../utils/helpers.js';

export class Console {
  constructor(container, connectionManager) {
    this._container = container;
    this._conn = connectionManager;
    this._lines = [];
    this._lineNum = 0;
    this._autoscroll = true;
    this._hexMode = false;
    this._paused = false;
    this._maxLines = 2000;
    this._render();
    eventBus.on('console:data', (d) => this._onData(d));
  }

  _render() {
    this._container.innerHTML = `
      <div class="console-panel">
        <div class="console-toolbar">
          <div class="console-toolbar-group">
            <button class="btn btn-icon" id="con-clear" title="Clear">🗑 Clear</button>
            <button class="btn btn-icon" id="con-pause" title="Pause scroll">⏸</button>
            <button class="btn btn-icon" id="con-hex" title="Toggle Hex mode">HEX</button>
            <button class="btn btn-icon" id="con-autoscroll" title="Auto-scroll" style="color:var(--accent-blue)">↓ Auto</button>
          </div>
          <div class="console-toolbar-group" style="margin-left:auto">
            <button class="btn btn-icon" id="con-download" title="Download log">⬇ Export</button>
          </div>
        </div>
        <div class="console-output" id="con-output"></div>
        <div class="console-input-area">
          <span class="console-input-prefix">&gt;</span>
          <input class="console-input" id="con-input" type="text" placeholder="Type command and press Enter…" autocomplete="off" spellcheck="false"/>
          <button class="btn btn-primary" id="con-send" style="padding:4px 12px;font-size:12px">Send</button>
        </div>
      </div>`;

    this._outputEl = this._container.querySelector('#con-output');

    this._container.querySelector('#con-clear').addEventListener('click', () => this._clear());
    this._container.querySelector('#con-pause').addEventListener('click', (e) => {
      this._paused = !this._paused;
      e.target.textContent = this._paused ? '▶' : '⏸';
      e.target.style.color = this._paused ? 'var(--accent-amber)' : '';
    });
    this._container.querySelector('#con-hex').addEventListener('click', (e) => {
      this._hexMode = !this._hexMode;
      e.target.style.color = this._hexMode ? 'var(--accent-blue)' : '';
    });
    this._container.querySelector('#con-autoscroll').addEventListener('click', (e) => {
      this._autoscroll = !this._autoscroll;
      e.target.style.color = this._autoscroll ? 'var(--accent-blue)' : '';
    });
    this._container.querySelector('#con-download').addEventListener('click', () => this._downloadLog());

    const input = this._container.querySelector('#con-input');
    const sendFn = () => {
      const val = input.value.trim();
      if (!val) return;
      this._conn?.sendData(val + '\n');
      input.value = '';
    };
    input.addEventListener('keydown', (e) => { if (e.key === 'Enter') sendFn(); });
    this._container.querySelector('#con-send').addEventListener('click', sendFn);
  }

  _onData({ data, direction, timestamp }) {
    if (this._paused) return;
    this._lineNum++;

    let displayData = '';
    if (data instanceof Uint8Array) {
      if (this._hexMode) {
        displayData = Array.from(data).map(b => b.toString(16).padStart(2, '0')).join(' ');
      } else {
        const decoder = new TextDecoder();
        displayData = decoder.decode(data).replace(/\r?\n/g, '').replace(/[\x00-\x1F\x7F-\x9F]/g, '.').trim();
      }
    } else {
      displayData = String(data).replace(/\r?\n/g, '').trim();
    }

    if (!displayData) return;

    const line = document.createElement('div');
    line.className = 'console-line';
    line.innerHTML = `
      <span class="console-line-num">${this._lineNum}</span>
      <span class="console-line-time">${formatTime(timestamp)}</span>
      <span class="console-line-data ${direction === 'tx' ? 'sent' : (this._hexMode ? 'hex' : '')}">${this._escape(displayData)}</span>`;
    this._outputEl.appendChild(line);
    this._lines.push(line);

    // Trim old lines
    while (this._lines.length > this._maxLines) {
      this._lines.shift().remove();
    }

    if (this._autoscroll) {
      this._outputEl.scrollTop = this._outputEl.scrollHeight;
    }
  }

  _escape(str) {
    return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  _clear() {
    this._outputEl.innerHTML = '';
    this._lines = [];
    this._lineNum = 0;
  }

  _downloadLog() {
    const text = this._lines.map(l => l.textContent.trim()).join('\n');
    const blob = new Blob([text], { type: 'text/plain' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `console_${new Date().toISOString().slice(0,19).replace(/:/g,'-')}.txt`;
    a.click();
    URL.revokeObjectURL(a.href);
  }
}
