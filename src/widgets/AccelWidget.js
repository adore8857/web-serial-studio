/**
 * AccelWidget — 3-axis accelerometer + gyroscope widget
 */
import { WidgetBase } from './WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { formatValue } from '../utils/helpers.js';

export class AccelWidget extends WidgetBase {
  constructor(config = {}) {
    super({ title: config.title || 'Accelerometer', icon: '📐', ...config });
    this._axes = config.axes || [
      { index: 3, label: 'X', color: '#3b82f6', min: -10, max: 10 },
      { index: 4, label: 'Y', color: '#10b981', min: -10, max: 10 },
      { index: 5, label: 'Z', color: '#f59e0b', min: -10, max: 10 },
    ];
    this._items = [];
  }

  _render(body) {
    body.innerHTML = '<div class="imu-container"></div>';
    const container = body.querySelector('.imu-container');
    this._axes.forEach((ax, i) => {
      const el = document.createElement('div');
      el.className = 'imu-axis';
      el.innerHTML = `
        <div class="imu-axis-label" style="color:${ax.color}">${ax.label}</div>
        <div class="imu-axis-bar">
          <div class="imu-axis-fill" style="background:${ax.color};width:50%;left:50%"></div>
        </div>
        <div class="imu-axis-value mono">0.000</div>`;
      container.appendChild(el);
      this._items.push({ fill: el.querySelector('.imu-axis-fill'), valueEl: el.querySelector('.imu-axis-value'), ax });
    });
  }

  _subscribe() {
    this._unsubscribe = eventBus.on('frame:received', (frame) => {
      if (this._destroyed) return;
      this._axes.forEach((ax, i) => {
        const ds = frame.datasets?.[ax.index];
        if (!ds) return;
        const v = typeof ds.value === 'number' ? ds.value : parseFloat(ds.value) || 0;
        const item = this._items[i];
        if (!item) return;

        // Normalize to 0-100% where 50% = 0
        const range = ax.max - ax.min;
        const norm = (v - ax.min) / range; // 0..1
        const fromCenter = norm - 0.5; // -0.5..0.5

        if (fromCenter >= 0) {
          item.fill.style.left = '50%';
          item.fill.style.width = (fromCenter * 100) + '%';
        } else {
          const w = Math.abs(fromCenter) * 100;
          item.fill.style.left = (50 - w) + '%';
          item.fill.style.width = w + '%';
        }
        item.valueEl.textContent = formatValue(v) + (ax.units ? ` ${ax.units}` : '');
      });
    });
  }

  reset() {
    this._items.forEach(item => {
      item.fill.style.left = '50%';
      item.fill.style.width = '0%';
      item.valueEl.textContent = '0.000';
    });
  }
}
