export interface UsbEndpointInfo {
  address: number;
  type: number;
  direction: number;
  maxPacketSize: number;
}

export interface UsbInterfaceInfo {
  id: number;
  interfaceClass: number;
  interfaceSubclass: number;
  interfaceProtocol: number;
  endpoints: UsbEndpointInfo[];
}

export interface UsbDeviceInfo {
  deviceName: string;
  deviceId: number;
  vendorId: number;
  productId: number;
  manufacturerName?: string;
  productName?: string;
  deviceClass: number;
  permission: boolean;
  hid: boolean;
  interfaces: UsbInterfaceInfo[];
}

export interface HardwareDiagnostics {
  android: { version: string; sdk: number; abi: string; supportedAbis: string[]; manufacturer: string; model: string };
  usbDevices: UsbDeviceInfo[];
  serialPorts: string[];
  cameras: import('../camera/CameraTypes').CameraDevice[];
  nfc: { available: boolean; enabled: boolean };
}
