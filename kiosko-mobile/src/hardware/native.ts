import { NativeEventEmitter, NativeModules, Platform } from 'react-native';
import type { HardwareDiagnostics } from './usb/UsbDeviceTypes';

interface NativeKioskHardware {
  getHardwareDiagnostics(): Promise<HardwareDiagnostics>;
  setScannerEnabled(enabled: boolean): void;
  startSerialScanner(path: string): Promise<boolean>;
  stopSerialScanner(): Promise<void>;
  requestUsbPermission(vendorId: number, productId: number): Promise<boolean>;
  hasUsbPermission(vendorId: number, productId: number): Promise<boolean>;
  printUsb(base64: string, vendorId: number | null, productId: number | null, timeoutMs: number): Promise<{ printed: boolean; bytesWritten: number; vendorId: number; productId: number }>;
  startNfc(): Promise<boolean>;
  stopNfc(): Promise<void>;
  addListener(eventName: string): void;
  removeListeners(count: number): void;
}

const unavailable = () => Promise.reject(new Error('HARDWARE_NATIVE_UNAVAILABLE: esta función requiere el APK Android, no Expo Go.'));
const fallback: NativeKioskHardware = {
  getHardwareDiagnostics: unavailable, setScannerEnabled: () => undefined, startSerialScanner: unavailable, stopSerialScanner: unavailable,
  requestUsbPermission: unavailable, hasUsbPermission: unavailable, printUsb: unavailable,
  startNfc: unavailable, stopNfc: unavailable, addListener: () => undefined, removeListeners: () => undefined,
};

export const NativeHardware: NativeKioskHardware = Platform.OS === 'android' && NativeModules.KioskHardwareModule
  ? NativeModules.KioskHardwareModule as NativeKioskHardware : fallback;
export const hardwareEvents = Platform.OS === 'android' && NativeModules.KioskHardwareModule
  ? new NativeEventEmitter(NativeModules.KioskHardwareModule) : null;
