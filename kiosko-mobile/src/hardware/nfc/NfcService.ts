import type { EmitterSubscription } from 'react-native';
import { logEvent } from '../../infrastructure/secureDatabase';
import { hardwareEvents, NativeHardware } from '../native';
import type { NfcConfig, NfcTag } from './NfcTypes';

export class NfcService {
  private listeners = new Set<(tag: NfcTag) => void>();
  private subscription?: EmitterSubscription;
  constructor(private config: NfcConfig) {}
  configure(config: NfcConfig) { this.config = config; }
  async start() {
    if (!this.config.enabled || this.config.mode === 'usb') return false;
    const available = await NativeHardware.startNfc();
    if (available && !this.subscription) this.subscription = hardwareEvents?.addListener('KioskHardwareNfcTag', (tag: NfcTag) => { void logEvent('[HARDWARE][NFC] tag', `technologies=${tag.technologies.length}`); this.listeners.forEach(listener => listener(tag)); });
    return available;
  }
  async stop() { this.subscription?.remove(); this.subscription = undefined; await NativeHardware.stopNfc(); }
  subscribe(callback: (tag: NfcTag) => void) { this.listeners.add(callback); return () => { this.listeners.delete(callback); }; }
}

export class UsbNfcProvider {
  readonly available = false;
  readonly reason = 'USB_NFC_PROTOCOL_UNKNOWN';
}
