import type { EmitterSubscription } from 'react-native';
import { logEvent } from '../../infrastructure/secureDatabase';
import { hardwareEvents, NativeHardware } from '../native';
import { ScannerBuffer } from './ScannerBuffer';
import type { HardwareKeyEvent, ScannerConfig, ScannerResult } from './ScannerTypes';

export class ScannerService {
  private listeners = new Set<(result: ScannerResult) => void>();
  private nativeSubscription?: EmitterSubscription;
  private flushTimer?: ReturnType<typeof setTimeout>;
  private buffer: ScannerBuffer;
  private active = false;

  constructor(private config: ScannerConfig) { this.buffer = new ScannerBuffer(config.characterTimeoutMs); }

  configure(config: ScannerConfig) { const restart = this.active; if (restart) this.stop(); this.config = config; this.buffer = new ScannerBuffer(config.characterTimeoutMs); if (restart) this.start(); }
  start() {
    if (this.active || !this.config.enabled || this.config.mode === 'usb') return;
    this.active = true; NativeHardware.setScannerEnabled(true);
    if (this.config.serialPort && (this.config.mode === 'auto' || this.config.mode === 'serial')) {
      void NativeHardware.startSerialScanner(this.config.serialPort).then(() => logEvent('[HARDWARE][SCANNER] serial started', this.config.serialPort || '')).catch(error => logEvent('[HARDWARE][SCANNER] serial error', error instanceof Error ? error.message : String(error)));
    }
    this.nativeSubscription = hardwareEvents?.addListener('KioskHardwareKey', (event: HardwareKeyEvent) => {
      const result = this.buffer.push(event);
      if (result) this.emit(result);
      if (this.flushTimer) clearTimeout(this.flushTimer);
      this.flushTimer = setTimeout(() => { const timed = this.buffer.flush(); if (timed) this.emit(timed); }, this.config.characterTimeoutMs + 15);
    });
    void logEvent('[HARDWARE][SCANNER] started', this.config.mode);
  }
  stop() {
    this.active = false; NativeHardware.setScannerEnabled(false); void NativeHardware.stopSerialScanner(); this.nativeSubscription?.remove(); this.nativeSubscription = undefined;
    if (this.flushTimer) clearTimeout(this.flushTimer); this.buffer.reset();
  }
  subscribe(callback: (result: ScannerResult) => void) { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; }
  private emit(result: ScannerResult) { void logEvent('[HARDWARE][SCANNER] scan', `length=${result.value.length}`); this.listeners.forEach(listener => listener(result)); }
}
