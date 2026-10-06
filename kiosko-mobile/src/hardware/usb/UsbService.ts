import { NativeHardware } from '../native';
import type { HardwareDiagnostics, UsbDeviceInfo } from './UsbDeviceTypes';

export class UsbService {
  diagnostics(): Promise<HardwareDiagnostics> { return NativeHardware.getHardwareDiagnostics(); }
  async devices(): Promise<UsbDeviceInfo[]> { return (await this.diagnostics()).usbDevices; }
  hasPermission(device: Pick<UsbDeviceInfo, 'vendorId' | 'productId'>) { return NativeHardware.hasUsbPermission(device.vendorId, device.productId); }
  requestPermission(device: Pick<UsbDeviceInfo, 'vendorId' | 'productId'>) { return NativeHardware.requestUsbPermission(device.vendorId, device.productId); }
}
