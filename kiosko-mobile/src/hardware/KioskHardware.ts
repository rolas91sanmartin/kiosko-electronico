import { loadHardwareConfig } from '../infrastructure/settings';
import { logEvent } from '../infrastructure/secureDatabase';
import { CameraService } from './camera/CameraService';
import { NfcService } from './nfc/NfcService';
import { PrinterService } from './printer/PrinterService';
import { ScannerService } from './scanner/ScannerService';
import { UsbService } from './usb/UsbService';

const usb = new UsbService();
const initial = { scanner: { enabled:true,mode:'auto' as const,suffix:'ENTER' as const,characterTimeoutMs:80,serialPort:null }, printer:{ enabled:true,mode:'auto' as const,vendorId:null,productId:null,paperWidth:80 as const,encoding:'cp850',timeoutMs:5000 }, camera:{enabled:true,preferred:'front' as const,allowExternal:true}, nfc:{enabled:true,mode:'auto' as const} };
const scanner = new ScannerService(initial.scanner), printer = new PrinterService(initial.printer, usb), camera = new CameraService(initial.camera), nfc = new NfcService(initial.nfc);

export const KioskHardware = {
  scanner, printer, camera, nfc, usb,
  diagnostics: () => usb.diagnostics(),
  async initialize() { const config = await loadHardwareConfig(); scanner.configure(config.scanner); printer.configure(config.printer); camera.configure(config.camera); nfc.configure(config.nfc); scanner.start(); void logEvent('[HARDWARE] initialized'); return this.getStatus(); },
  async shutdown() { scanner.stop(); await nfc.stop(); await camera.release(); },
  async getStatus() {
    const diagnostics = await usb.diagnostics();
    const printerDevice = diagnostics.usbDevices.find(device => device.interfaces.some(item => item.interfaceClass === 7 || item.endpoints.some(endpoint => endpoint.type === 2 && endpoint.direction === 0)));
    return {
      scanner: { available: diagnostics.usbDevices.some(device => device.hid) || diagnostics.serialPorts.length > 0, type: diagnostics.usbDevices.some(device => device.hid) ? 'hid' : diagnostics.serialPorts.length ? 'serial' : 'unknown' },
      printer: { available: Boolean(printerDevice), type: printerDevice ? 'usb' : 'unavailable', vendorId: printerDevice?.vendorId, productId: printerDevice?.productId },
      camera: { available: diagnostics.cameras.length > 0, type: diagnostics.cameras.length ? 'android' : 'unavailable' },
      nfc: { available: diagnostics.nfc.available, type: diagnostics.nfc.available ? 'android' : diagnostics.usbDevices.some(device => device.interfaces.some(item => item.interfaceClass === 11)) ? 'usb' : 'unavailable' },
    };
  },
};
