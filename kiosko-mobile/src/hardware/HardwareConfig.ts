import type { CameraConfig } from './camera/CameraTypes';
import type { NfcConfig } from './nfc/NfcTypes';
import type { PrinterConfig } from './printer/PrinterTypes';
import type { ScannerConfig } from './scanner/ScannerTypes';

export interface HardwareConfig { scanner: ScannerConfig; printer: PrinterConfig; camera: CameraConfig; nfc: NfcConfig }
export const satKt21lcHardware = {
  printer: { vendorId: 0x0519, productId: 0x2013 },
  camera: { vendorId: 0x0bda, productId: 0x5842 },
  nfc: { vendorId: 0x072f, productId: 0x221a },
} as const;
export const defaultHardwareConfig: HardwareConfig = {
  scanner: { enabled: true, mode: 'auto', suffix: 'ENTER', characterTimeoutMs: 80, serialPort: null },
  printer: { enabled: true, mode: 'auto', ...satKt21lcHardware.printer, paperWidth: 80, encoding: 'cp850', timeoutMs: 5000 },
  camera: { enabled: true, preferred: 'front', allowExternal: true },
  nfc: { enabled: true, mode: 'auto' },
};

export function normalizeHardwareConfig(value?: Partial<HardwareConfig>): HardwareConfig {
  return {
    scanner: { ...defaultHardwareConfig.scanner, ...value?.scanner, characterTimeoutMs: Math.max(50, Math.min(100, value?.scanner?.characterTimeoutMs ?? 80)), serialPort: /^\/dev\/ttyS\d+$/.test(value?.scanner?.serialPort || '') ? value!.scanner!.serialPort! : null },
    printer: { ...defaultHardwareConfig.printer, ...value?.printer, paperWidth: value?.printer?.paperWidth === 58 ? 58 : 80 },
    camera: { ...defaultHardwareConfig.camera, ...value?.camera }, nfc: { ...defaultHardwareConfig.nfc, ...value?.nfc },
  };
}
