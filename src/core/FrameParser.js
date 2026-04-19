/**
 * FrameParser — Frame detection and data parsing
 */
import { eventBus } from './EventBus.js';
import { appState, OperationMode } from './AppState.js';

export class FrameParser {
  constructor() {
    this._buffer = '';
    this._frameCount = 0;
    this._lastFrameTime = 0;
    this._frameRateCounter = 0;
    this._frameRateTimer = null;
    this._startFrameRate();
  }

  _startFrameRate() {
    this._frameRateTimer = setInterval(() => {
      appState.dataRate = this._frameRateCounter;
      this._frameRateCounter = 0;
    }, 1000);
  }

  destroy() {
    if (this._frameRateTimer) clearInterval(this._frameRateTimer);
  }

  /**
   * Feed raw data into parser. Emits 'frame:received' for each complete frame.
   */
  processData(rawData) {
    // Emit raw data for console
    eventBus.emit('console:data', { data: rawData, direction: 'rx', timestamp: Date.now() });

    this._buffer += rawData;
    const mode = appState.operationMode;
    const config = appState.frameConfig;

    if (mode === OperationMode.DeviceSendsJSON) {
      this._parseJSON();
    } else if (mode === OperationMode.QuickPlot) {
      this._parseCSV();
    } else {
      this._parseWithDelimiters(config);
    }
  }

  _parseCSV() {
    const lines = this._buffer.split('\n');
    this._buffer = lines.pop() || '';

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      const values = trimmed.split(',').map(v => {
        const n = parseFloat(v.trim());
        return isNaN(n) ? v.trim() : n;
      });

      if (values.length > 0) {
        this._emitFrame({
          datasets: values.map((v, i) => ({
            title: `Channel ${i + 1}`,
            value: typeof v === 'number' ? v : 0,
            index: i
          })),
          raw: trimmed,
          timestamp: Date.now()
        });
      }
    }
  }

  _parseJSON() {
    // Scan for /* ... */ delimiters
    let startIdx;
    while ((startIdx = this._buffer.indexOf('/*')) !== -1) {
      const endIdx = this._buffer.indexOf('*/', startIdx + 2);
      if (endIdx === -1) break;

      const jsonStr = this._buffer.substring(startIdx + 2, endIdx).trim();
      this._buffer = this._buffer.substring(endIdx + 2);

      try {
        const data = JSON.parse(jsonStr);
        this._emitFrame({
          title: data.t || data.title || 'Telemetry',
          groups: data.g || data.groups || [],
          raw: jsonStr,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn('FrameParser: Invalid JSON frame', e);
      }
    }
  }

  _parseWithDelimiters(config) {
    const { startDelimiter, endDelimiter, frameDetection } = config;
    const endDel = this._resolveDelimiter(endDelimiter);

    if (frameDetection === 'EndDelimiterOnly' || frameDetection === 'StartDelimiterOnly') {
      const frames = this._buffer.split(endDel);
      this._buffer = frames.pop() || '';

      for (const frame of frames) {
        const trimmed = frame.trim();
        if (!trimmed) continue;
        this._parseFrameContent(trimmed);
      }
    } else if (frameDetection === 'StartAndEndDelimiter') {
      const startDel = this._resolveDelimiter(startDelimiter);
      let startPos;
      while ((startPos = this._buffer.indexOf(startDel)) !== -1) {
        const endPos = this._buffer.indexOf(endDel, startPos + startDel.length);
        if (endPos === -1) break;
        const content = this._buffer.substring(startPos + startDel.length, endPos).trim();
        this._buffer = this._buffer.substring(endPos + endDel.length);
        if (content) this._parseFrameContent(content);
      }
    } else {
      // NoDelimiters — process entire buffer as-is
      if (this._buffer.length > 0) {
        this._parseFrameContent(this._buffer);
        this._buffer = '';
      }
    }
  }

  _parseFrameContent(content) {
    // Try CSV first
    const values = content.split(',').map(v => {
      const n = parseFloat(v.trim());
      return isNaN(n) ? v.trim() : n;
    });

    this._emitFrame({
      datasets: values.map((v, i) => ({
        title: `Channel ${i + 1}`,
        value: typeof v === 'number' ? v : 0,
        index: i
      })),
      raw: content,
      timestamp: Date.now()
    });
  }

  _emitFrame(frame) {
    this._frameCount++;
    this._frameRateCounter++;
    appState.frameCount = this._frameCount;
    eventBus.emit('frame:received', frame);
  }

  _resolveDelimiter(str) {
    if (!str) return '\n';
    return str
      .replace(/\\n/g, '\n')
      .replace(/\\r/g, '\r')
      .replace(/\\t/g, '\t');
  }

  reset() {
    this._buffer = '';
    this._frameCount = 0;
    this._frameRateCounter = 0;
  }
}
