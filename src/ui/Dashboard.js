/**
 * Dashboard — Dashboard layout manager with free-form drag/resize
 */
import { eventBus } from '../core/EventBus.js';
import { appState } from '../core/AppState.js';
import { PlotWidget } from '../widgets/PlotWidget.js';
import { GaugeWidget } from '../widgets/GaugeWidget.js';
import { BarWidget } from '../widgets/BarWidget.js';
import { CompassWidget } from '../widgets/CompassWidget.js';
import { DataGridWidget } from '../widgets/DataGridWidget.js';
import { AccelWidget } from '../widgets/AccelWidget.js';

// ── Default widget layout for demo simulator ──
function buildDefaultLayout(W) {
  const col = Math.floor(W / 3);
  const col2 = col * 2;
  return [
    // Row 1: wide multi-plot
    {
      type: 'MultiPlot',
      config: {
        title: 'Temperature & Humidity', icon: '🌡️',
        datasetIndices: [0, 1], datasetLabels: ['Temperature (°C)', 'Humidity (%)'],
        colorOffset: 0,
        x: 0, y: 0, w: col2, h: 280
      }
    },
    // Row 1: accelerometer (right)
    {
      type: 'Accel',
      config: {
        title: 'Accelerometer', icon: '📐',
        axes: [
          { index: 3, label: 'X', color: '#3b82f6', min: -10, max: 10 },
          { index: 4, label: 'Y', color: '#10b981', min: -10, max: 10 },
          { index: 5, label: 'Z', color: '#f59e0b', min:  0, max: 20 },
        ],
        x: col2, y: 0, w: col, h: 280
      }
    },
    // Row 2: three gauges
    {
      type: 'Gauge',
      config: {
        title: 'Temperature', icon: '🌡️',
        datasetIndex: 0, min: -20, max: 80, units: '°C', colorIdx: 0,
        x: 0, y: 288, w: col, h: 260
      }
    },
    {
      type: 'Gauge',
      config: {
        title: 'Humidity', icon: '💧',
        datasetIndex: 1, min: 0, max: 100, units: '%', colorIdx: 1,
        x: col, y: 288, w: col, h: 260
      }
    },
    {
      type: 'Gauge',
      config: {
        title: 'Pressure', icon: '🌬️',
        datasetIndex: 2, min: 900, max: 1100, units: 'hPa', colorIdx: 2,
        x: col2, y: 288, w: col, h: 260
      }
    },
    // Row 3: compass + bar + pressure plot
    {
      type: 'Compass',
      config: {
        title: 'Heading', icon: '🧭',
        datasetIndex: 6,
        x: 0, y: 556, w: col, h: 280
      }
    },
    {
      type: 'Bar',
      config: {
        title: 'Voltage', icon: '🔋',
        datasets: [{ index: 7, title: 'Battery', min: 0, max: 5, units: 'V' }],
        colorOffset: 7,
        x: col, y: 556, w: col, h: 280
      }
    },
    {
      type: 'Plot',
      config: {
        title: 'Pressure History', icon: '📉',
        datasetIndices: [2], datasetLabels: ['Pressure (hPa)'],
        colorOffset: 2,
        x: col2, y: 556, w: col, h: 280
      }
    },
    // Row 4: full-width data grid
    {
      type: 'DataGrid',
      config: {
        title: 'All Channels', icon: '▦',
        datasets: [
          { index: 0, title: 'Temperature', units: '°C' },
          { index: 1, title: 'Humidity',    units: '%' },
          { index: 2, title: 'Pressure',    units: 'hPa' },
          { index: 3, title: 'Accel X',     units: 'm/s²' },
          { index: 4, title: 'Accel Y',     units: 'm/s²' },
          { index: 5, title: 'Accel Z',     units: 'm/s²' },
          { index: 6, title: 'Heading',     units: '°' },
          { index: 7, title: 'Voltage',     units: 'V' },
        ],
        x: 0, y: 844, w: W - 4, h: 260
      }
    }
  ];
}

export class Dashboard {
  constructor(container) {
    this._container = container;
    this._grid = null;
    this._canvas = null;
    this._widgets = [];
    this._hasData = false;
    this._emptyEl = null;
    this._wheelHandler = (e) => this._handleWheelScroll(e);

    this._frameHandler = () => {
      if (!this._hasData) {
        this._hasData = true;
        this._showGrid();
      }
    };

    this._render();
    eventBus.on('frame:received', this._frameHandler);
    eventBus.on('state:connectionStateChanged', (state) => {
      if (state === 'Disconnected') {
        this._hasData = false;
        this._showEmpty();
        this._widgets.forEach(w => w.reset?.());
      }
    });
  }

  _render() {
    this._container.innerHTML = `
      <div class="dashboard-header">
        <div class="dashboard-header-title">
          <span>📈</span>
          <span id="dashboard-title">Dashboard</span>
        </div>
        <div class="dashboard-header-actions">
          <button class="btn btn-icon" id="btn-auto-layout" title="Auto-arrange widgets">⊞ Auto Layout</button>
          <button class="btn btn-icon" id="btn-reset-data" title="Reset all widget data">↺ Reset</button>
          <button class="btn btn-icon" id="btn-fullscreen" title="Toggle fullscreen">⤢</button>
        </div>
      </div>
      <div class="dashboard-empty" id="dashboard-empty">
        <div class="dashboard-empty-icon">📡</div>
        <div class="dashboard-empty-title">Real-Time Telemetry Dashboard</div>
        <div class="dashboard-empty-desc">
          Connect a device or start the <strong>Demo Simulator</strong> to visualize live data.
          Supports UART, BLE, TCP/UDP, MQTT, and more.
        </div>
        <div style="display:flex;flex-wrap:wrap;gap:12px;justify-content:center;margin-top:16px;max-width:680px">
          ${[
            ['⚡ Quick Plot', 'Send comma-separated values from Arduino instantly. No setup needed.'],
            ['📁 Project File', 'Create custom dashboards with drag-and-drop widgets in the editor.'],
            ['📡 Device JSON', 'Let your device send its own dashboard layout via JSON.'],
            ['🌐 Multi-Protocol', 'UART · BLE · TCP/UDP · MQTT · WebSocket'],
            ['📊 Export', 'CSV export for further analysis or session replay.'],
            ['🎮 Actions', 'Define buttons that send commands back to the device.'],
          ].map(([t, d]) => `
            <div style="background:rgba(59,130,246,.06);border:1px solid rgba(59,130,246,.12);border-radius:8px;padding:12px 14px;max-width:200px;text-align:left">
              <div style="font-size:12px;font-weight:600;color:var(--text-secondary);margin-bottom:4px">${t}</div>
              <div style="font-size:11px;color:var(--text-muted);line-height:1.4">${d}</div>
            </div>`).join('')}
        </div>
        <div style="margin-top:20px;display:flex;gap:8px">
          <button class="btn btn-primary" id="btn-start-sim-empty" style="font-size:13px;padding:8px 20px">🎲 Start Demo Simulator</button>
          <button class="btn" id="btn-open-project-empty" style="font-size:13px;padding:8px 20px">📁 Open Project File</button>
        </div>
      </div>
      <div class="dashboard-grid hidden" id="dashboard-grid">
        <div class="dashboard-grid-canvas" id="dashboard-grid-canvas"></div>
      </div>`;

    this._emptyEl = this._container.querySelector('#dashboard-empty');
    this._grid = this._container.querySelector('#dashboard-grid');
    this._canvas = this._container.querySelector('#dashboard-grid-canvas');
    this._container?.addEventListener('wheel', this._wheelHandler, { passive: false });

    this._container.querySelector('#btn-reset-data')
      .addEventListener('click', () => this._resetAll());
    this._container.querySelector('#btn-auto-layout')
      .addEventListener('click', () => this._autoLayout());
    this._container.querySelector('#btn-fullscreen')
      .addEventListener('click', () => {
        if (!document.fullscreenElement) this._container.requestFullscreen?.();
        else document.exitFullscreen?.();
      });
    this._container.querySelector('#btn-start-sim-empty')
      ?.addEventListener('click', () => eventBus.emit('ui:startSimulator'));
    this._container.querySelector('#btn-open-project-empty')
      ?.addEventListener('click', () => eventBus.emit('project:openFile'));

    this._buildDefaultWidgets();
  }

  _buildDefaultWidgets() {
    this._widgets.forEach(w => w.destroy?.());
    this._widgets = [];
    // Wait for DOM to settle so we can measure container width
    requestAnimationFrame(() => {
      const W = (this._grid.clientWidth || 1100) - 8;
      const layout = buildDefaultLayout(W);
      layout.forEach(def => {
        const w = this._createWidget(def.type, def.config);
        if (w) { w.mount(this._canvas); this._widgets.push(w); }
      });
      // Set grid canvas height to fit all widgets
      this._updateCanvasHeight();
    });
  }

  _updateCanvasHeight() {
    let maxBottom = 600;
    this._widgets.forEach(w => {
      if (!w._el) return;
      const bottom = (parseInt(w._el.style.top) || 0) + (parseInt(w._el.style.height) || 260);
      if (bottom > maxBottom) maxBottom = bottom;
    });
    if (this._canvas) {
      const nextHeight = (maxBottom + 40) + 'px';
      this._canvas.style.height = nextHeight;
      this._canvas.style.minHeight = nextHeight;
    }
  }

  _autoLayout() {
    const W = (this._grid.clientWidth || 1100) - 8;
    const layout = buildDefaultLayout(W);
    this._widgets.forEach((w, i) => {
      const pos = layout[i];
      if (pos && w._el) {
        w._el.style.left = pos.config.x + 'px';
        w._el.style.top  = pos.config.y + 'px';
        w._el.style.width  = pos.config.w + 'px';
        w._el.style.height = pos.config.h + 'px';
      }
    });
    this._updateCanvasHeight();
    eventBus.emit('toast', { type: 'info', message: 'Widgets auto-arranged!' });
  }

  buildFromProject(project) {
    this._widgets.forEach(w => w.destroy?.());
    this._widgets = [];

    const datasets = [];
    (project.groups || []).forEach(g => g.datasets.forEach(d => datasets.push(d)));
    const gaugeDatasets = [];
    (project.groups || []).forEach((group) => {
      const groupForcesGauge = group.widget === 'Gauges';
      (group.datasets || []).forEach((dataset) => {
        if (groupForcesGauge || dataset.gauge) {
          gaugeDatasets.push(dataset);
        }
      });
    });

    const W = (this._grid?.clientWidth || 1100) - 8;
    const col = Math.floor(W / 2);
    let y = 0;

    // Multi-plot at top
    if (datasets.length > 0) {
      const mp = new PlotWidget({
        title: project.title + ' — Overview', icon: '📉',
        datasetIndices: datasets.map(d => d.index),
        datasetLabels: datasets.map(d => d.title + (d.units ? ` (${d.units})` : '')),
        x: 0, y, w: W, h: 280
      });
      mp.mount(this._canvas); this._widgets.push(mp);
      y += 288;
    }

    // Gauges for each gauge-enabled dataset or any group explicitly marked as Gauges
    let gx = 0;
    gaugeDatasets.forEach((ds, i) => {
      const g = new GaugeWidget({
        title: ds.title, datasetIndex: ds.index,
        min: ds.min, max: ds.max, units: ds.units, colorIdx: i,
        x: gx, y, w: Math.floor(W / 3), h: 260
      });
      g.mount(this._canvas); this._widgets.push(g);
      gx += Math.floor(W / 3);
      if (gx + Math.floor(W / 3) > W) { gx = 0; y += 268; }
    });
    if (gx > 0) y += 268;

    // DataGrid at bottom
    if (datasets.length > 0) {
      const dg = new DataGridWidget({
        title: 'All Data', icon: '▦', datasets,
        x: 0, y, w: W, h: 260
      });
      dg.mount(this._canvas); this._widgets.push(dg);
    }

    this._updateCanvasHeight();
  }

  _createWidget(type, config) {
    switch (type) {
      case 'Plot':      return new PlotWidget(config);
      case 'MultiPlot': return new PlotWidget(config);
      case 'Gauge':     return new GaugeWidget(config);
      case 'Bar':       return new BarWidget(config);
      case 'Compass':   return new CompassWidget(config);
      case 'DataGrid':  return new DataGridWidget(config);
      case 'Accel':     return new AccelWidget(config);
      default:          return null;
    }
  }

  _showGrid() {
    this._emptyEl?.classList.add('hidden');
    this._grid?.classList.remove('hidden');
  }

  _showEmpty() {
    this._emptyEl?.classList.remove('hidden');
    this._grid?.classList.add('hidden');
  }

  _resetAll() {
    this._widgets.forEach(w => w.reset?.());
  }

  _handleWheelScroll(e) {
    if (!this._container || e.ctrlKey || e.metaKey) return;
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX)) return;

    const target = this._findScrollableTarget(e.target);
    if (!target) return;

    target.scrollTop += e.deltaY;
    e.preventDefault();
  }

  _findScrollableTarget(startEl) {
    let el = startEl instanceof HTMLElement ? startEl : null;
    while (el && el !== this._container) {
      const style = window.getComputedStyle(el);
      const overflowY = style.overflowY;
      const canScroll =
        (overflowY === 'auto' || overflowY === 'scroll') &&
        el.scrollHeight > el.clientHeight;
      if (canScroll) return el;
      el = el.parentElement;
    }
    return this._container.scrollHeight > this._container.clientHeight ? this._container : null;
  }

  destroy() {
    this._container?.removeEventListener('wheel', this._wheelHandler);
    this._widgets.forEach(w => w.destroy?.());
    this._widgets = [];
  }
}
