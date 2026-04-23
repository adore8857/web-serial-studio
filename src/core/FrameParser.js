/**
 * FrameParser - Frame detection and data parsing
 */
import { eventBus } from './EventBus.js';
import { appState, OperationMode } from './AppState.js';

export class FrameParser {
  constructor() {
    this._buffer = new Uint8Array(0);
    this._mqttBinaryBuffer = new Uint8Array(0);
    this._mqttHexBuffer = '';
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

    // MQTT preserves message boundaries. When Serial Studio publishes STM32
    // frames over MQTT it emits the frame payload without the start/end
    // delimiters, so we can parse exact-size messages directly and avoid
    // misalignment caused by buffering across messages.
    if (this._tryParseDirectSTM32MqttMessage(newData)) {
      return;
    }

    // Append to buffer
    const combined = new Uint8Array(this._buffer.length + newData.length);
    combined.set(this._buffer);
    combined.set(newData, this._buffer.length);
    this._buffer = combined;

    this._parse();
  }

  _tryParseDirectSTM32MqttMessage(newData) {
    const mode = appState.operationMode;
    const stm32Mode = mode === OperationMode.STM32Binary || mode === OperationMode.ProjectFile;
    if (!stm32Mode || appState.busType !== 'MQTT') return false;

    const payloadSize = this._stm32PayloadSize();
    if (newData.length >= payloadSize && newData.length % payloadSize === 0) {
      for (let offset = 0; offset < newData.length; offset += payloadSize) {
        const payload = newData.slice(offset, offset + payloadSize);
        this._emitSTM32BearingFrame(payload, true, payload.length);
      }
      return true;
    }

    if (newData.length >= 4 && newData[0] === 0x5A && newData[1] === 0xA5) {
      const last = newData.length - 2;
      if (newData[last] === 0xDD && newData[last + 1] === 0xEE) {
        this._emitSTM32BearingFrame(newData, false, newData.length);
        return true;
      }
    }

    const text = new TextDecoder().decode(newData);
    if (this._looksLikeHexAscii(text)) {
      this._mqttHexBuffer += text.replace(/[^0-9a-fA-F]/g, '');
      this._drainMqttHexToBinary();
      this._drainMqttBinaryFrames();
      return true;
    }

    this._appendMqttBinary(newData);
    this._drainMqttBinaryFrames();
    return true;
  }

  _looksLikeHexAscii(text) {
    if (!text) return false;
    return /^[\s0-9a-fA-F]+$/.test(text);
  }

  _drainMqttHexToBinary() {
    const evenLen = this._mqttHexBuffer.length - (this._mqttHexBuffer.length % 2);
    if (evenLen <= 0) return;

    const bytes = this._hexToBytes(this._mqttHexBuffer.slice(0, evenLen));
    if (bytes) {
      this._appendMqttBinary(bytes);
      this._mqttHexBuffer = this._mqttHexBuffer.slice(evenLen);
    }
  }

  _appendMqttBinary(bytes) {
    const combined = new Uint8Array(this._mqttBinaryBuffer.length + bytes.length);
    combined.set(this._mqttBinaryBuffer);
    combined.set(bytes, this._mqttBinaryBuffer.length);
    this._mqttBinaryBuffer = combined;
  }

  _drainMqttBinaryFrames() {
    const payloadSize = this._stm32PayloadSize();
    const minFrameSize = payloadSize + 4;

    while (this._mqttBinaryBuffer.length >= payloadSize) {
      let headerPos = -1;
      for (let i = 0; i <= this._mqttBinaryBuffer.length - 2; i++) {
        if (this._mqttBinaryBuffer[i] === 0x5A && this._mqttBinaryBuffer[i + 1] === 0xA5) {
          headerPos = i;
          break;
        }
      }

      if (headerPos !== -1) {
        if (headerPos > 0) {
          this._mqttBinaryBuffer = this._mqttBinaryBuffer.slice(headerPos);
        }

        if (this._mqttBinaryBuffer.length < minFrameSize) {
          return;
        }

        let tailPos = -1;
        for (let i = 5700; i <= this._mqttBinaryBuffer.length - 2; i++) {
          if (this._mqttBinaryBuffer[i] === 0xDD && this._mqttBinaryBuffer[i + 1] === 0xEE) {
            tailPos = i;
            break;
          }
        }

        if (tailPos === -1) {
          return;
        }

        const frame = this._mqttBinaryBuffer.slice(0, tailPos + 2);
        this._emitSTM32BearingFrame(frame, false, frame.length);
        this._mqttBinaryBuffer = this._mqttBinaryBuffer.slice(tailPos + 2);
        continue;
      }

      const aligned = this._alignMqttPayloadStream();
      if (!aligned) {
        if (this._mqttBinaryBuffer.length > payloadSize * 3) {
          this._mqttBinaryBuffer = this._mqttBinaryBuffer.slice(-(payloadSize * 2));
        }
        return;
      }

      if (aligned > 0) {
        this._mqttBinaryBuffer = this._mqttBinaryBuffer.slice(aligned);
      }

      if (this._mqttBinaryBuffer.length < payloadSize) {
        return;
      }

      const payload = this._mqttBinaryBuffer.slice(0, payloadSize);
      this._emitSTM32BearingFrame(payload, true, payload.length);
      this._mqttBinaryBuffer = this._mqttBinaryBuffer.slice(payloadSize);
    }
  }

  _alignMqttPayloadStream() {
    const payloadSize = this._stm32PayloadSize();
    if (this._mqttBinaryBuffer.length < payloadSize) {
      return -1;
    }

    const maxStart = Math.min(this._mqttBinaryBuffer.length - payloadSize, payloadSize - 1);
    for (let start = 0; start <= maxStart; start++) {
      if (this._looksLikeBearingPayloadAt(start)) {
        return start;
      }
    }

    return -1;
  }

  _looksLikeBearingPayloadAt(start) {
    const buf = this._mqttBinaryBuffer;
    const payloadSize = this._stm32PayloadSize();
    if (start < 0 || start + payloadSize > buf.length) {
      return false;
    }

    const zeroRunStart = start + 4754;
    const zeroRunEnd = start + 5234;
    if (zeroRunEnd > buf.length) {
      return false;
    }

    let zeroCount = 0;
    for (let i = zeroRunStart; i < zeroRunEnd; i++) {
      if (buf[i] === 0x00) zeroCount++;
    }

    // This STM32 payload has a very long zero-filled block in the middle.
    if (zeroCount < 430) {
      return false;
    }

    let nonZeroBefore = 0;
    for (let i = start + 4274; i < start + 4754; i++) {
      if (buf[i] !== 0x00) nonZeroBefore++;
    }
    if (nonZeroBefore < 120) {
      return false;
    }

    let nonZeroAfter = 0;
    for (let i = start + 5234; i < start + 5714; i++) {
      if (buf[i] !== 0x00) nonZeroAfter++;
    }

    return nonZeroAfter > 120;
  }

  _hexToBytes(hex) {
    if (!hex || hex.length % 2 !== 0) return null;

    const out = new Uint8Array(hex.length / 2);
    for (let i = 0; i < hex.length; i += 2) {
      const byte = parseInt(hex.slice(i, i + 2), 16);
      if (Number.isNaN(byte)) return null;
      out[i / 2] = byte;
    }

    return out;
  }

  _parse() {
    const mode = appState.operationMode;

    // STM32 Binary mode explicitly
    if (mode === OperationMode.STM32Binary) {
      if (this._findSTM32Header() !== -1) {
        this._parseSTM32Binary();
      }
      return;
    }

    if (mode === OperationMode.DeviceSendsJSON) {
      this._parseJSON();
    } else if (mode === OperationMode.QuickPlot) {
      this._parseCSV();
    } else if (mode === OperationMode.ProjectFile) {
      // MQTT payloads may begin mid-frame, so scan for the STM32 header
      // anywhere in the buffer before falling back to CSV parsing.
      if (this._findSTM32Header() !== -1) {
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

      this._emitSTM32BearingFrame(frameData, false, FRAME_SIZE);
    }
  }

  _findSTM32Header() {
    if (this._buffer.length < 2) return -1;
    for (let i = 0; i <= this._buffer.length - 2; i++) {
      if (this._buffer[i] === 0x5A && this._buffer[i + 1] === 0xA5) {
        return i;
      }
    }
    return -1;
  }

  _stm32PayloadSize() {
    // Serial Studio strips only the configured delimiters (5A A5 / DD EE).
    // This STM32 frame keeps the remaining 10-byte header prefix and the
    // 9-byte reserved tail padding inside the MQTT payload:
    // 5732-byte full frame - 2-byte start delimiter - 2-byte end delimiter.
    return 5728;
  }

  _emitSTM32BearingFrame(frameData, payloadOnly = false, frameSize = frameData.length) {
    const view = new DataView(frameData.buffer, frameData.byteOffset, frameData.byteLength);
    const shift = payloadOnly ? -2 : 0;
    const adjusted = (offset) => offset + shift;
    const accelScale = 0.000488;

    const toAccelG = (raw, removeGravity = false) => {
      const accelG = raw * accelScale;
      if (!removeGravity) return accelG;
      if (accelG === 0) return 0;
      return accelG - Math.sign(accelG);
    };

    // 1. Extract acceleration waveform (int16_t adcx[2132]) - Little Endian.
    // This channel is treated as the Z-axis acceleration. After converting
    // the signed ADC values to g, remove the static 1 g gravity component so
    // the resting baseline is close to 0 g.
    const accelZ = [];
    for (let i = 0; i < 2132; i++) {
      const raw = view.getInt16(adjusted(12) + i * 2, true);
      accelZ.push(toAccelG(raw, true));
    }

    const parseSigned24BitRaw = (offset) => {
      const pos = adjusted(offset);
      const msb = frameData[pos];
      const mid = frameData[pos + 1];
      const lsb = frameData[pos + 2];
      let val = (msb << 16) | (mid << 8) | lsb;
      if (val & 0x800000) val -= 0x1000000;
      return val;
    };

    const convertAds24ToVoltage = (raw) => (raw * 2.5) / 8388608.0;

    // 2. Extract Strain 1, 2, 3 (each is 160 samples of 24-bit signed data)
    const str1 = [];
    const str2 = [];
    const str3 = [];
    for (let i = 0; i < 160; i++) {
      str1.push(convertAds24ToVoltage(parseSigned24BitRaw(4276 + i * 3)));
      str2.push(convertAds24ToVoltage(parseSigned24BitRaw(4756 + i * 3)));
      str3.push(convertAds24ToVoltage(parseSigned24BitRaw(5236 + i * 3)));
    }

    // 3. Extract temperatures
    const tempOffset = adjusted(5716);
    const temp1 = convertAds24ToVoltage(parseSigned24BitRaw(5716));

    const tmp117_msb = frameData[tempOffset + 3];
    const tmp117_lsb = frameData[tempOffset + 4];
    let tmp117_val = (tmp117_msb << 8) | tmp117_lsb;
    if (tmp117_val & 0x8000) tmp117_val -= 0x10000;
    const temp2 = tmp117_val * 0.0078125;

    this._emitFrame({
      title: 'STM32 Bearing Data',
      datasets: [
        { title: 'Accel Z',   value: accelZ[accelZ.length - 1], index: 0, buffer: accelZ },
        { title: 'Strain 1',  value: str1[str1.length - 1], index: 1, buffer: str1 },
        { title: 'Strain 2',  value: str2[str2.length - 1], index: 2, buffer: str2 },
        { title: 'Strain 3',  value: str3[str3.length - 1], index: 3, buffer: str3 },
        { title: 'ADC Temp',  value: temp1, index: 4 },
        { title: 'TMP117',    value: temp2, index: 5 }
      ],
      raw: (payloadOnly ? 'Binary Payload' : 'Binary Frame') + ` (${frameSize} bytes)`,
      timestamp: Date.now()
    });
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
    this._mqttBinaryBuffer = new Uint8Array(0);
    this._mqttHexBuffer = '';
    this._frameCount = 0;
    this._frameRateCounter = 0;
  }
}
