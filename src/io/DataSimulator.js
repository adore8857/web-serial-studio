/**
 * DataSimulator — Built-in data generator for demo mode
 */
import { eventBus } from '../core/EventBus.js';
import { appState, ConnectionState } from '../core/AppState.js';
import { FrameParser } from '../core/FrameParser.js';

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
    const t = this._t;
    // Generate realistic telemetry data
    const temp = 22 + 5 * Math.sin(t * 0.3) + (Math.random() - 0.5) * 0.5;
    const humidity = 55 + 15 * Math.sin(t * 0.2 + 1) + (Math.random() - 0.5) * 1;
    const pressure = 1013 + 10 * Math.sin(t * 0.15 + 2) + (Math.random() - 0.5) * 0.3;
    const accelX = Math.sin(t * 1.5) * 2 + (Math.random() - 0.5) * 0.2;
    const accelY = Math.cos(t * 1.2) * 1.5 + (Math.random() - 0.5) * 0.2;
    const accelZ = 9.8 + Math.sin(t * 0.8) * 0.3 + (Math.random() - 0.5) * 0.1;
    const heading = ((t * 15) % 360 + 360) % 360;
    const voltage = 3.3 + 0.2 * Math.sin(t * 0.5) + (Math.random() - 0.5) * 0.05;

    return [
      temp.toFixed(2),
      humidity.toFixed(1),
      pressure.toFixed(1),
      accelX.toFixed(3),
      accelY.toFixed(3),
      accelZ.toFixed(3),
      heading.toFixed(1),
      voltage.toFixed(3)
    ].join(',') + '\n';
  }

  destroy() {
    this.stop();
    this._parser.destroy();
  }
}
