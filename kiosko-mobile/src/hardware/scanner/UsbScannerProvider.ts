import type { ScannerResult } from './ScannerTypes';

/** Placeholder seguro: el protocolo directo se implementará después de identificar VID/PID y endpoints. */
export class UsbScannerProvider {
  readonly available = false;
  readonly reason = 'USB_SCANNER_PROTOCOL_UNKNOWN';
  start(_callback: (result: ScannerResult) => void) { throw new Error(this.reason); }
  stop() { /* no resources until a protocol is identified */ }
}
