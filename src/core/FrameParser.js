/**
 * FrameParser - Frame detection and data parsing
 */
import { eventBus } from './EventBus.js';
import { appState, OperationMode } from './AppState.js';

export class FrameParser {
  constructor() {
    this._buffer = new Uint8Array(0);
    this._frameCount = 0;
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
  processData(newData) {
    // newData is expected to be Uint8Array from drivers
    if (!(newData instanceof Uint8Array)) {
      if (typeof newData === 'string') {
        const encoder = new TextEncoder();
        newData = encoder.encode(newData);
      } else {
        return;
      }
    }

    // Emit raw data for console (convert to string for display if needed)
    eventBus.emit('console:data', { data: newData, direction: 'rx', timestamp: Date.now() });

    // Append to buffer
    const combined = new Uint8Array(this._buffer.length + newData.length);
    combined.set(this._buffer);
    combined.set(newData, this._buffer.length);
    this._buffer = combined;

    this._parse();
  }

  _parse() {
    const mode = appState.operationMode;

    // STM32 Binary mode explicitly
    if (mode === OperationMode.STM32Binary) {
      this._parseSTM32Binary();
      return;
    }

    if (mode === OperationMode.DeviceSendsJSON) {
      this._parseJSON();
    } else if (mode === OperationMode.QuickPlot) {
      this._parseCSV();
    } else if (mode === OperationMode.ProjectFile) {
      // Auto-detect STM32 binary header in ProjectFile mode
      if (this._buffer.length >= 2 && this._buffer[0] === 0x5A && this._buffer[1] === 0xA5) {
        this._parseSTM32Binary();
      } else {
        this._parseCSV();
      }
    } else {
      this._parseWithDelimiters();
    }
  }

  _parseSTM32Binary() {
    const HEADER_0 = 0x5A;
    const HEADER_1 = 0xA5;
    const TAIL_0 = 0xDD;
    const TAIL_1 = 0xEE;
    const EXPECTED_MIN_SIZE = 5700; // minimum expected size to avoid false tail detection

    while (this._buffer.length >= EXPECTED_MIN_SIZE) {
      // Find header
      let startIdx = -1;
      for (let i = 0; i <= this._buffer.length - 2; i++) {
        if (this._buffer[i] === HEADER_0 && this._buffer[i + 1] === HEADER_1) {
          startIdx = i;
          break;
        }
      }

      if (startIdx === -1) {
        // No header found, clear buffer except last 1 byte which might be start of header
        this._buffer = this._buffer.slice(-1);
        break;
      }

      // Find tail after header
      let endIdx = -1;
      // Start searching for tail near the expected end to avoid picking up 0xDD 0xEE in the data payload
      const searchStart = startIdx + 5700; 
      for (let i = searchStart; i <= this._buffer.length - 2; i++) {
        if (this._buffer[i] === TAIL_0 && this._buffer[i + 1] === TAIL_1) {
          endIdx = i;
          break;
        }
      }

      if (endIdx === -1) {
        // Header found but no tail yet. Wait for more data.
        // If buffer is getting too large without finding a tail, discard the header to prevent memory leak.
        if (this._buffer.length - startIdx > 15000) {
            this._buffer = this._buffer.slice(startIdx + 2);
            continue; 
        }
        break; // Wait for more data
      }

      const FRAME_SIZE = (endIdx + 2) - startIdx;
      
      // Extract frame
      const frameData = this._buffer.slice(startIdx, startIdx + FRAME_SIZE);
      this._buffer = this._buffer.slice(startIdx + FRAME_SIZE);

      const view = new DataView(frameData.buffer, frameData.byteOffset, frameData.byteLength);

      // 1. Extract Vibration (int16_t adcx[2132]) - Little Endian
      const vib = [];
      for (let i = 0; i < 2132; i++) {
        vib.push(view.getInt16(12 + i * 2, true));
      }

      // Helper function for 24-bit Big Endian Two's Complement (ADS124S08)
      const parse24bit = (offset) => {
        const msb = frameData[offset];
        const mid = frameData[offset + 1];
        const lsb = frameData[offset + 2];
        let val = (msb << 16) | (mid << 8) | lsb;
        if (val & 0x800000) val -= 0x1000000;
        return (2.5 * val) / 8388608.0; // Return voltage
      };

      // 2. Extract Strain 1, 2, 3 (each is 160 samples of 24-bit data)
      const str1 = [];
      const str2 = [];
      const str3 = [];
      for (let i = 0; i < 160; i++) {
        str1.push(parse24bit(4276 + i * 3));
        str2.push(parse24bit(4756 + i * 3));
        str3.push(parse24bit(5236 + i * 3));
      }

      // 3. Extract Temp (ADS124S08Temp_Data[13])
      const tempOffset = 5716;
      // First 3 bytes: another ADS124S08 reading (possibly RTD/Thermistor voltage)
      const temp1 = parse24bit(tempOffset);
      
      // Next 2 bytes: TMP117 (16-bit Big Endian)
      const tmp117_msb = frameData[tempOffset + 3];
      const tmp117_lsb = frameData[tempOffset + 4];
      let tmp117_val = (tmp117_msb << 8) | tmp117_lsb;
      if (tmp117_val & 0x8000) tmp117_val -= 0x10000;
      const temp2 = tmp117_val * 0.0078125; // TMP117 to Celsius

      // Create telemetry datasets
      this._emitFrame({
        title: 'STM32 Bearing Data',
        datasets: [
          { title: 'Vibration', value: vib[vib.length - 1], index: 0, buffer: vib },
          { title: 'Strain 1',  value: str1[str1.length - 1], index: 1, buffer: str1 },
          { title: 'Strain 2',  value: str2[str2.length - 1], index: 2, buffer: str2 },
          { title: 'Strain 3',  value: str3[str3.length - 1], index: 3, buffer: str3 },
          { title: 'ADC Temp',  value: temp1, index: 4 },
          { title: 'TMP117',    value: temp2, index: 5 }
        ],
        raw: 'Binary Frame (' + FRAME_SIZE + ' bytes)',
        timestamp: Date.now()
      });
    }
  }

  _parseCSV() {
    const decoder = new TextDecoder();
    const text = decoder.decode(this._buffer);
    const lines = text.split('\n');
    
    if (lines.length <= 1) return; // Wait for full line

    const lastLine = lines.pop();
    // Update buffer to remaining fragment
    const encoder = new TextEncoder();
    this._buffer = encoder.encode(lastLine);

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
    const decoder = new TextDecoder();
    const text = decoder.decode(this._buffer);
    
    let startIdx;
    while ((startIdx = text.indexOf('/*')) !== -1) {
      const endIdx = text.indexOf('*/', startIdx + 2);
      if (endIdx === -1) break;

      const jsonStr = text.substring(startIdx + 2, endIdx).trim();
      // Remove processed part from buffer
      const encoder = new TextEncoder();
      const consumedLength = endIdx + 2;
      this._buffer = this._buffer.slice(consumedLength); // This is slightly inefficient but safe

      try {
        const data = JSON.parse(jsonStr);
        eventBus.emit('frame:receivedJSON', data);
        this._emitFrame({
          title: data.t || data.title || 'Telemetry',
          groups: data.g || data.groups || [],
          raw: jsonStr,
          timestamp: Date.now()
        });
      } catch (e) {
        console.warn('FrameParser: Invalid JSON frame', e);
      }
      
      // Since we modified this._buffer, we should re-decode text or break
      break; 
    }
  }

  _parseWithDelimiters() {
    const config = appState.frameConfig;
    const { startDelimiter, endDelimiter, frameDetection } = config;
    
    const decoder = new TextDecoder();
    const text = decoder.decode(this._buffer);
    const endDel = this._resolveDelimiter(endDelimiter);

    if (frameDetection === 'EndDelimiterOnly' || frameDetection === 'StartDelimiterOnly') {
      const frames = text.split(endDel);
      if (frames.length <= 1) return;

      const lastFrame = frames.pop();
      const encoder = new TextEncoder();
      this._buffer = encoder.encode(lastFrame);

      for (const frame of frames) {
        const trimmed = frame.trim();
        if (!trimmed) continue;
        this._parseFrameContent(trimmed);
      }
    } else if (frameDetection === 'StartAndEndDelimiter') {
      const startDel = this._resolveDelimiter(startDelimiter);
      let startPos;
      while ((startPos = text.indexOf(startDel)) !== -1) {
        const endPos = text.indexOf(endDel, startPos + startDel.length);
        if (endPos === -1) break;
        const content = text.substring(startPos + startDel.length, endPos).trim();
        
        const consumedLength = endPos + endDel.length;
        this._buffer = this._buffer.slice(consumedLength);
        
        if (content) this._parseFrameContent(content);
        break; // Re-parse after buffer modification
      }
    } else {
      // NoDelimiters — process entire buffer as string
      if (this._buffer.length > 0) {
        this._parseFrameContent(text);
        this._buffer = new Uint8Array(0);
      }
    }
  }

  _parseFrameContent(content) {
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
    this._buffer = new Uint8Array(0);
    this._frameCount = 0;
    this._frameRateCounter = 0;
  }
}
