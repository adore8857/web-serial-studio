/**
 * DataSimulator - Built-in data generator for demo mode
 */
import { eventBus } from '../core/EventBus.js';
import { appState, ConnectionState } from '../core/AppState.js';
import { FrameParser } from '../core/FrameParser.js?v=accel-fix-20260423-2';

export class DataSimulator {
  constructor() {
    this._running = false;
    this._timer = null;
    this._parser = new FrameParser();
    this._t = 0;
    this._fps = 20; // 20 Hz update rate
  }

  start() {
    if (this._running) return;
    this._running = true;
    this._t = 0;
    appState.connectionState = ConnectionState.Connected;
    eventBus.emit('toast', { type: 'success', message: 'Demo simulator started (20 Hz)' });

    this._timer = setInterval(() => {
      this._t += 0.05;
      const data = this._generateFrame();
      this._parser.processData(data);
    }, 1000 / this._fps);
  }

  stop() {
    if (!this._running) return;
    this._running = false;
    clearInterval(this._timer);
    this._timer = null;
    appState.connectionState = ConnectionState.Disconnected;
    eventBus.emit('toast', { type: 'info', message: 'Demo simulator stopped' });
  }

  toggle() {
    if (this._running) this.stop();
    else this.start();
  }

  get isRunning() { return this._running; }

  _generateFrame() {
    if (appState.operationMode === 'STM32Binary') {
      return this._generateSTM32Frame();
    }

    const csv = [
      temp.toFixed(2),
      humidity.toFixed(1),
      pressure.toFixed(1),
      accelX.toFixed(3),
      accelY.toFixed(3),
      accelZ.toFixed(3),
      heading.toFixed(1),
      voltage.toFixed(3)
    ].join(',') + '\n';

    const encoder = new TextEncoder();
    return encoder.encode(csv);
  }

  _generateSTM32Frame() {
    const FRAME_SIZE = 5732;
    const buffer = new Uint8Array(FRAME_SIZE);
    const view = new DataView(buffer.buffer);

    // Header
    buffer.set([0x5A, 0xA5, 0x16, 0x5D, 0x02, 0xDD, 0x08, 0x54, 0x00, 0xA0, 0x00, 0x02], 0);

    // Vibration (uint16_t[2132]) - Sine wave + noise
    for (let i = 0; i < 2132; i++) {
      const val = 2048 + Math.sin(this._t * 5 + i * 0.05) * 1000 + (Math.random() - 0.5) * 100;
      view.setUint16(12 + i * 2, Math.floor(val), true);
    }

    // Strain 1, 2, 3 (int8_t[480])
    for (let i = 0; i < 480; i++) {
      const s1 = Math.sin(this._t * 2 + i * 0.02) * 50;
      const s2 = Math.cos(this._t * 1.5 + i * 0.02) * 40;
      const s3 = Math.sin(this._t * 3 + i * 0.01) * 30;
      view.setInt8(4276 + i, Math.floor(s1));
      view.setInt8(4756 + i, Math.floor(s2));
      view.setInt8(5236 + i, Math.floor(s3));
    }

    // Temperature (int8_t[13])
    view.setInt8(5716, 25 + Math.sin(this._t * 0.1) * 5);
    view.setInt8(5717, 30 + Math.cos(this._t * 0.1) * 3);

    // Tail
    buffer.set([0xDD, 0xEE], 5730);

    return buffer;
  }

  destroy() {
    this.stop();
    this._parser.destroy();
  }
}
