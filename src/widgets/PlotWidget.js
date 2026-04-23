/**
 * PlotWidget — Real-time line chart using Chart.js
 */
import { WidgetBase } from './WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { appState } from '../core/AppState.js';
import { getDatasetColor, getDatasetColorAlpha } from '../utils/helpers.js';

export class PlotWidget extends WidgetBase {
  constructor(config = {}) {
    super({ title: config.title || 'Plot', icon: '📉', ...config });
    this._chart = null;
    this._datasetIndices = config.datasetIndices || [0];
    this._datasetLabels = config.datasetLabels || ['Channel 1'];
    this._maxPoints = appState.points;
    this._data = this._datasetIndices.map(() => []);
    this._labels = [];
    this._paused = false;
    this._frameHandler = (frame) => this._onFrame(frame);
    this._syncVisibleYScale = () => {
      this._updateVisibleYScale();
      this._chart?.update('none');
    };
  }

  _render(body) {
    body.style.padding = '8px';
    const canvas = document.createElement('canvas');
    canvas.style.width = '100%';
    canvas.style.height = '100%';
    body.appendChild(canvas);

    const colors = this._datasetIndices.map((_, i) => getDatasetColor(this.config.colorOffset + i || i));
    const alphas = this._datasetIndices.map((_, i) => getDatasetColorAlpha(this.config.colorOffset + i || i, 0.15));

    this._chart = new Chart(canvas, {
      type: 'line',
      data: {
        labels: this._labels,
        datasets: this._datasetIndices.map((_, i) => ({
          label: this._datasetLabels[i] || `Ch ${i+1}`,
          data: this._data[i],
          borderColor: colors[i],
          backgroundColor: alphas[i],
          borderWidth: 1.5,
          pointRadius: 0,
          tension: 0.3,
          fill: this._datasetIndices.length === 1,
        }))
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        interaction: { mode: 'index', intersect: false },
        plugins: {
          legend: {
            display: this._datasetIndices.length > 1,
            labels: { color: '#94a3b8', font: { size: 10 }, boxWidth: 12 }
          },
          tooltip: {
            backgroundColor: 'rgba(12,18,32,0.95)',
            borderColor: 'rgba(148,163,184,0.15)',
            borderWidth: 1,
            titleColor: '#94a3b8',
            bodyColor: '#f1f5f9',
            bodyFont: { family: "'JetBrains Mono', monospace", size: 11 }
          },
          zoom: {
            pan: {
              enabled: true,
              mode: 'x',
              modifierKey: 'shift', // User must hold shift to pan if desired, or can just drag
            },
            zoom: {
              // Keep normal page scrolling working unless the user explicitly
              // requests chart zoom with Ctrl/Cmd + wheel.
              wheel: { enabled: true, modifierKey: 'ctrl' },
              pinch: { enabled: true },
              drag: { enabled: true, backgroundColor: 'rgba(59,130,246,0.2)' },
              mode: 'x',
            },
            onZoomComplete: this._syncVisibleYScale,
            onPanComplete: this._syncVisibleYScale
          }
        },
        scales: {
          x: {
            display: false,
            grid: { color: 'rgba(148,163,184,0.05)' }
          },
          y: {
            beginAtZero: false,
            grid: { color: 'rgba(148,163,184,0.06)' },
            ticks: { color: '#64748b', font: { size: 10, family: "'JetBrains Mono', monospace" }, maxTicksLimit: 5 },
            border: { color: 'rgba(148,163,184,0.1)' }
          }
        }
      }
    });

    // Pause button
    const actionsEl = this._el.querySelector('.widget-actions');
    const pauseBtn = document.createElement('button');
    pauseBtn.className = 'widget-action-btn';
    pauseBtn.title = 'Pause/Resume';
    pauseBtn.textContent = '⏸';
    pauseBtn.addEventListener('click', () => {
      this._paused = !this._paused;
      pauseBtn.textContent = this._paused ? '▶' : '⏸';
    });
    actionsEl.insertBefore(pauseBtn, actionsEl.firstChild);
  }

  _subscribe() {
    this._unsubscribe = eventBus.on('frame:received', this._frameHandler);
  }

  _onFrame(frame) {
    if (this._paused || this._destroyed) return;
    const maxPts = appState.points;

    let pointsAdded = 1;
    this._datasetIndices.forEach((idx, i) => {
      const ds = frame.datasets?.[idx];
      if (ds && ds.buffer && Array.isArray(ds.buffer)) {
        this._data[i].push(...ds.buffer);
        pointsAdded = Math.max(pointsAdded, ds.buffer.length);
      } else {
        const val = ds ? (typeof ds.value === 'number' ? ds.value : parseFloat(ds.value) || 0) : 0;
        this._data[i].push(val);
      }
      
      // Trim to maxPoints
      if (this._data[i].length > maxPts) {
        this._data[i].splice(0, this._data[i].length - maxPts);
      }
    });

    // Update labels to match the largest dataset
    const maxLen = Math.max(...this._data.map(d => d.length));
    while (this._labels.length < maxLen) this._labels.push('');
    if (this._labels.length > maxLen) this._labels.splice(0, this._labels.length - maxLen);

    if (this._chart) {
      this._updateVisibleYScale();
      this._chart.update('none');
    }
  }

  reset() {
    this._data = this._datasetIndices.map(() => []);
    this._labels = [];
    if (this._chart) {
      if (typeof this._chart.resetZoom === 'function') this._chart.resetZoom();
      this._chart.options.scales.y.min = undefined;
      this._chart.options.scales.y.max = undefined;
      this._chart.update('none');
    }
  }

  _updateVisibleYScale() {
    if (!this._chart) return;

    const xScale = this._chart.scales?.x;
    const yScale = this._chart.options?.scales?.y;
    if (!xScale || !yScale) return;

    const start = Number.isFinite(xScale.min) ? Math.max(0, Math.floor(xScale.min)) : 0;
    const fallbackEnd = Math.max(...this._data.map(series => series.length - 1), 0);
    const end = Number.isFinite(xScale.max) ? Math.max(start, Math.ceil(xScale.max)) : fallbackEnd;

    const visible = [];
    this._data.forEach(series => {
      for (let i = start; i <= end && i < series.length; i += 1) {
        const value = series[i];
        if (Number.isFinite(value)) visible.push(value);
      }
    });

    if (!visible.length) {
      yScale.min = undefined;
      yScale.max = undefined;
      return;
    }

    let min = Math.min(...visible);
    let max = Math.max(...visible);

    if (min === max) {
      const padding = Math.max(Math.abs(min) * 0.1, 1);
      min -= padding;
      max += padding;
    } else {
      const padding = Math.max((max - min) * 0.1, 0.01);
      min -= padding;
      max += padding;
    }

    yScale.min = min;
    yScale.max = max;
  }

  destroy() {
    if (this._chart) { this._chart.destroy(); this._chart = null; }
    super.destroy();
  }
}
