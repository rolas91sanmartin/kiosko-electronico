import type { UsbDeviceInfo } from '../usb/UsbDeviceTypes';

const bulkOut = (device: UsbDeviceInfo) => device.interfaces.some(item => item.endpoints.some(endpoint => endpoint.type === 2 && endpoint.direction === 0));
export function selectUsbPrinter(devices: UsbDeviceInfo[], vendorId: number | null, productId: number | null) {
  const matching = devices.filter(device => bulkOut(device) && (vendorId === null || device.vendorId === vendorId) && (productId === null || device.productId === productId));
  return matching.find(device => device.interfaces.some(item => item.interfaceClass === 7)) || matching[0] || null;
}
