/**
 * GaugeWidget — Circular gauge drawn on Canvas
 */
import { WidgetBase } from './WidgetBase.js';
import { eventBus } from '../core/EventBus.js';
import { getDatasetColor, formatValue } from '../utils/helpers.js';

export class GaugeWidget extends WidgetBase {
  constructor(config = {}) {
    super({ title: config.title || 'Gauge', icon: '🔘', ...config });
    this._value = 0;
    this._min = config.min ?? 0;
    this._max = config.max ?? 100;
    this._units = config.units || '';
    this._colorIdx = config.colorIdx || 0;
    this._datasetIndex = config.datasetIndex ?? 0;
    this._canvas = null;
    this._ctx = null;
    this._valueEl = null;
    this._labelEl = null;
    this._raf = null;
    this._dirty = false;
  }

  _render(body) {
    body.innerHTML = `
      <div class="gauge-container">
        <canvas class="gauge-canvas" width="200" height="120"></canvas>
        <div class="gauge-value">0${this._units}</div>
        <div class="gauge-range">
          <span>${this._min}</span><span>${this._max}</span>
        </div>
      </div>`;
    this._canvas = body.querySelector('canvas');
    this._ctx = this._canvas.getContext('2d');
    this._valueEl = body.querySelector('.gauge-value');
    this._drawGauge(0);
  }

  _subscribe() {
    this._unsubscribe = eventBus.on('frame:received', (frame) => {
      if (this._destroyed) return;
      const ds = frame.datasets?.[this._datasetIndex];
      if (!ds) return;
      const v = typeof ds.value === 'number' ? ds.value : parseFloat(ds.value) || 0;
      if (v !== this._value) {
        this._value = v;
        this._dirty = true;
        if (!this._raf) this._raf = requestAnimationFrame(() => {
          this._raf = null;
          if (this._dirty) { this._drawGauge(this._value); this._dirty = false; }
        });
      }
    });
  }

  _drawGauge(value) {
    const canvas = this._canvas;
    const ctx = this._ctx;
    if (!canvas || !ctx) return;

    const W = canvas.width, H = canvas.height;
    ctx.clearRect(0, 0, W, H);

    const cx = W / 2, cy = H - 10;
    const r = Math.min(W / 2, H) - 16;
    const startAngle = Math.PI;
    const endAngle = 0;
    const fraction = Math.max(0, Math.min(1, (value - this._min) / (this._max - this._min)));
    const currentAngle = startAngle + fraction * Math.PI;

    const color = getDatasetColor(this._colorIdx);

    // Track
    ctx.beginPath();
    ctx.arc(cx, cy, r, startAngle, endAngle, false);
    ctx.strokeStyle = 'rgba(148,163,184,0.1)';
    ctx.lineWidth = 14;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Arc gradient
    if (fraction > 0) {
      const grad = ctx.createLinearGradient(cx - r, cy, cx + r, cy);
      grad.addColorStop(0, color + '99');
      grad.addColorStop(1, color);
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, currentAngle, false);
      ctx.strokeStyle = grad;
      ctx.lineWidth = 14;
      ctx.lineCap = 'round';
      ctx.stroke();

      // Glow
      ctx.beginPath();
      ctx.arc(cx, cy, r, startAngle, currentAngle, false);
      ctx.strokeStyle = color + '30';
      ctx.lineWidth = 22;
      ctx.stroke();
    }

    // Needle
    const needleAngle = startAngle + fraction * Math.PI;
    const nx = cx + (r - 6) * Math.cos(needleAngle);
    const ny = cy + (r - 6) * Math.sin(needleAngle);
    ctx.beginPath();
    ctx.moveTo(cx, cy);
    ctx.lineTo(nx, ny);
    ctx.strokeStyle = '#f1f5f9';
    ctx.lineWidth = 2;
    ctx.lineCap = 'round';
    ctx.stroke();

    // Center dot
    ctx.beginPath();
    ctx.arc(cx, cy, 5, 0, Math.PI * 2);
    ctx.fillStyle = '#f1f5f9';
    ctx.fill();

    // Update value text
    if (this._valueEl) {
      this._valueEl.textContent = formatValue(value, this._min, this._max) + (this._units ? ` ${this._units}` : '');
      this._valueEl.style.color = color;
    }
  }

  reset() {
    this._value = 0;
    this._drawGauge(0);
    if (this._valueEl) this._valueEl.textContent = '0';
  }

  destroy() {
    if (this._raf) cancelAnimationFrame(this._raf);
    super.destroy();
  }
}
