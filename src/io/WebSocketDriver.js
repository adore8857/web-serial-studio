/**
 * WebSocketDriver — WebSocket connection driver
 */
import { appState } from '../core/AppState.js';

export class WebSocketDriver {
  constructor() {
    this._ws = null;
    this._callbacks = { data: [], error: [], close: [] };
  }

  on(event, cb) { this._callbacks[event]?.push(cb); }
  off(event, cb) {
    if (!this._callbacks[event]) return;
    this._callbacks[event] = this._callbacks[event].filter(c => c !== cb);
  }
  _emit(event, data) { this._callbacks[event]?.forEach(cb => cb(data)); }

  async connect() {
    const cfg = appState.wsConfig;
    return new Promise((resolve, reject) => {
      try {
        this._ws = new WebSocket(cfg.url, cfg.protocol || undefined);
        this._ws.binaryType = 'arraybuffer';

        this._ws.onopen = () => resolve();
        this._ws.onerror = (e) => {
          this._emit('error', e);
          reject(new Error('WebSocket connection failed'));
        };
        this._ws.onclose = () => this._emit('close');
        this._ws.onmessage = (e) => {
          if (typeof e.data === 'string') {
            const encoder = new TextEncoder();
            this._emit('data', encoder.encode(e.data));
          } else {
            this._emit('data', new Uint8Array(e.data));
          }
        };
      } catch (err) {
        reject(err);
      }
    });
  }

  async send(data) {
    if (!this._ws || this._ws.readyState !== WebSocket.OPEN) {
      throw new Error('WebSocket not connected');
    }
    this._ws.send(data);
  }

  async disconnect() {
    if (this._ws) {
      this._ws.close();
      this._ws = null;
    }
  }
}
