/**
 * Dashboard — Dashboard layout manager
 */
import { eventBus } from '../core/EventBus.js';
import { appState, OperationMode } from '../core/AppState.js';
import { PlotWidget } from '../widgets/PlotWidget.js';
import { GaugeWidget } from '../widgets/GaugeWidget.js';
import { BarWidget } from '../widgets/BarWidget.js';
import { CompassWidget } from '../widgets/CompassWidget.js';
import { DataGridWidget } from '../widgets/DataGridWidget.js';
import { AccelWidget } from '../widgets/AccelWidget.js';

const DEFAULT_DEMO_WIDGETS = [
  {
    type: 'MultiPlot',
    config: {
      title: 'Temperature & Humidity',
      icon: '🌡️',
      datasetIndices: [0, 1],
      datasetLabels: ['Temperature (°C)', 'Humidity (%)'],
      colorOffset: 0,
      spanCols: 2
    }
  },
  {
    type: 'Gauge',
    config: { title: 'Temperature', icon: '🌡️', datasetIndex: 0, min: -20, max: 80, units: '°C', colorIdx: 0 }
  },
  {
    type: 'Gauge',
    config: { title: 'Humidity', icon: '💧', datasetIndex: 1, min: 0, max: 100, units: '%', colorIdx: 1 }
  },
  {
    type: 'Gauge',
    config: { title: 'Pressure', icon: '🌬️', datasetIndex: 2, min: 900, max: 1100, units: 'hPa', colorIdx: 2 }
  },
  {
    type: 'Accel',
    config: {
      title: 'Accelerometer',
      icon: '📐',
      axes: [
        { index: 3, label: 'X', color: '#3b82f6', min: -10, max: 10 },
        { index: 4, label: 'Y', color: '#10b981', min: -10, max: 10 },
        { index: 5, label: 'Z', color: '#f59e0b', min: 0, max: 20 },
      ]
    }
  },
  {
    type: 'Compass',
    config: { title: 'Heading', icon: '🧭', datasetIndex: 6 }
  },
  {
    type: 'Bar',
    config: {
      title: 'Voltage & Battery',
      icon: '🔋',
      datasets: [
        { index: 7, title: 'Voltage', min: 0, max: 5, units: 'V' }
      ],
      colorOffset: 7
    }
  },
  {
    type: 'Plot',
    config: {
      title: 'Pressure History',
      icon: '📉',
      datasetIndices: [2],
      datasetLabels: ['Pressure (hPa)'],
      colorOffset: 2
    }
  },
  {
    type: 'DataGrid',
    config: {
      title: 'All Channels',
      icon: '▦',
      spanCols: 2,
      datasets: [
        { index: 0, title: 'Temperature', units: '°C' },
        { index: 1, title: 'Humidity', units: '%' },
        { index: 2, title: 'Pressure', units: 'hPa' },
        { index: 3, title: 'Accel X', units: 'm/s²' },
        { index: 4, title: 'Accel Y', units: 'm/s²' },
        { index: 5, title: 'Accel Z', units: 'm/s²' },
        { index: 6, title: 'Heading', units: '°' },
        { index: 7, title: 'Voltage', units: 'V' },
      ]
    }
  }
];

export class Dashboard {
  constructor(container) {
    this._container = container;
    this._grid = null;
    this._widgets = [];
    this._headerEl = null;
    this._emptyEl = null;
    this._hasData = false;
    this._frameHandler = (frame) => {
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
          <button class="btn btn-icon" id="btn-reset-data" title="Reset all widget data">↺ Reset</button>
          <button class="btn btn-icon" id="btn-fullscreen" title="Toggle fullscreen">⤢</button>
        </div>
      </div>
      <div class="dashboard-empty" id="dashboard-empty">
        <div class="dashboard-empty-icon">📡</div>
        <div class="dashboard-empty-title">No Data Yet</div>
        <div class="dashboard-empty-desc">
          Connect a device or start the Demo Simulator to visualize real-time telemetry data.
        </div>
        <div class="dashboard-empty-steps">
          <div class="dashboard-empty-step">
            <div class="dashboard-empty-step-num">1</div>
            <div class="dashboard-empty-step-text">Select interface in the left panel</div>
          </div>
          <div class="dashboard-empty-step">
            <div class="dashboard-empty-step-num">2</div>
            <div class="dashboard-empty-step-text">Click Connect or start Demo Sim</div>
          </div>
          <div class="dashboard-empty-step">
            <div class="dashboard-empty-step-num">3</div>
            <div class="dashboard-empty-step-text">Watch your data come alive!</div>
          </div>
        </div>
      </div>
      <div class="dashboard-grid hidden" id="dashboard-grid"></div>`;

    this._emptyEl = this._container.querySelector('#dashboard-empty');
    this._grid = this._container.querySelector('#dashboard-grid');
    this._container.querySelector('#btn-reset-data').addEventListener('click', () => this._resetAll());
    this._container.querySelector('#btn-fullscreen').addEventListener('click', () => {
      if (!document.fullscreenElement) this._container.requestFullscreen?.();
      else document.exitFullscreen?.();
    });

    this._buildDefaultWidgets();
  }

  _buildDefaultWidgets() {
    this._widgets.forEach(w => w.destroy?.());
    this._widgets = [];
    DEFAULT_DEMO_WIDGETS.forEach(def => {
      const w = this._createWidget(def.type, def.config);
      if (w) {
        w.mount(this._grid);
        this._widgets.push(w);
      }
    });
  }

  buildFromProject(project) {
    this._widgets.forEach(w => w.destroy?.());
    this._widgets = [];
    const datasets = [];
    (project.groups || []).forEach(g => {
      g.datasets.forEach(d => datasets.push(d));
    });

    // Multi-plot covering all datasets
    if (datasets.length > 0) {
      const mp = new PlotWidget({
        title: project.title + ' — Overview',
        icon: '📉',
        datasetIndices: datasets.map(d => d.index),
        datasetLabels: datasets.map(d => d.title + (d.units ? ` (${d.units})` : '')),
        spanCols: 2
      });
      mp.mount(this._grid);
      this._widgets.push(mp);
    }

    // DataGrid
    if (datasets.length > 0) {
      const dg = new DataGridWidget({ title: 'All Data', icon: '▦', spanCols: 2, datasets });
      dg.mount(this._grid);
      this._widgets.push(dg);
    }

    // Individual widgets per dataset
    datasets.forEach((ds, i) => {
      if (ds.gauge) {
        const g = new GaugeWidget({ title: ds.title, datasetIndex: ds.index, min: ds.min, max: ds.max, units: ds.units, colorIdx: i });
        g.mount(this._grid); this._widgets.push(g);
      }
    });
  }

  _createWidget(type, config) {
    switch (type) {
      case 'Plot': return new PlotWidget(config);
      case 'MultiPlot': return new PlotWidget(config);
      case 'Gauge': return new GaugeWidget(config);
      case 'Bar': return new BarWidget(config);
      case 'Compass': return new CompassWidget(config);
      case 'DataGrid': return new DataGridWidget(config);
      case 'Accel': return new AccelWidget(config);
      default: return null;
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

  destroy() {
    this._widgets.forEach(w => w.destroy?.());
    this._widgets = [];
  }
}
