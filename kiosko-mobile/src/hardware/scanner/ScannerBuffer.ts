import type { HardwareKeyEvent, ScannerResult } from './ScannerTypes';

const ENTER_KEYS = new Set([66, 160]);

export class ScannerBuffer {
  private value = '';
  private lastAt = 0;
  private deviceId?: number;
  constructor(private readonly timeoutMs = 80) {}

  push(event: HardwareKeyEvent): ScannerResult | null {
    if (ENTER_KEYS.has(event.keyCode)) {
      const value = this.value;
      const deviceId = this.deviceId;
      this.reset();
      return value ? { value, timestamp: event.timestamp, deviceId } : null;
    }
    if (!event.character || !event.external) return null;
    if (this.lastAt && event.timestamp - this.lastAt > this.timeoutMs) this.reset();
    this.value += event.character;
    this.lastAt = event.timestamp;
    this.deviceId = event.deviceId;
    return null;
  }

  flush(timestamp = Date.now()): ScannerResult | null {
    if (!this.value || timestamp - this.lastAt < this.timeoutMs) return null;
    const result = { value: this.value, timestamp, deviceId: this.deviceId };
    this.reset();
    return result;
  }

  reset() { this.value = ''; this.lastAt = 0; this.deviceId = undefined; }
}
