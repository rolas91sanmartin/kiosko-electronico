import { logEvent } from '../../infrastructure/secureDatabase';
import { NativeHardware } from '../native';
import { UsbService } from '../usb/UsbService';
import { EscPosBuilder } from './EscPosBuilder';
import { receiptBytes } from './ReceiptBuilder';
import { selectUsbPrinter } from './deviceSelection';
import { withPrinterFallback } from './printerFallback';
import type { ApiPrintFallback, LocalPrintResult, PrinterConfig, ReceiptData } from './PrinterTypes';

function base64(bytes: Uint8Array) {
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'; let output = '';
  for (let index = 0; index < bytes.length; index += 3) { const a=bytes[index], b=bytes[index+1], c=bytes[index+2]; const n=(a<<16)|((b||0)<<8)|(c||0); output += alphabet[(n>>18)&63]+alphabet[(n>>12)&63]+(index+1<bytes.length?alphabet[(n>>6)&63]:'=')+(index+2<bytes.length?alphabet[n&63]:'='); }
  return output;
}
export class PrinterService {
  constructor(private config: PrinterConfig, private usb = new UsbService()) {}
  configure(config: PrinterConfig) { this.config = config; }
  async printRaw(bytes: Uint8Array) {
    try {
      if (!this.config.enabled) throw new Error('NO_USB_PRINTER: impresión local deshabilitada.');
      const device = selectUsbPrinter(await this.usb.devices(), this.config.vendorId, this.config.productId);
      if (!device) throw new Error('NO_USB_PRINTER: no se encontró endpoint USB Bulk OUT.');
      if (!device.permission && !await this.usb.requestPermission(device)) throw new Error('USB_PERMISSION_DENIED');
      return await NativeHardware.printUsb(base64(bytes), device.vendorId, device.productId, this.config.timeoutMs);
    } catch (error) { void logEvent('[HARDWARE][PRINTER] error', error instanceof Error ? error.message : String(error), 'error'); throw error; }
  }
  printText(text: string) { return this.printRaw(new EscPosBuilder().initialize().text(text).feed(1).build()); }
  cut() { return this.printRaw(new EscPosBuilder().cut().build()); }
  feed(lines: number) { return this.printRaw(new EscPosBuilder().feed(lines).build()); }
  async printReceipt(receipt: ReceiptData, apiFallback: ApiPrintFallback): Promise<LocalPrintResult> {
    return withPrinterFallback<LocalPrintResult>(this.config.mode, async () => {
      const result = await this.printRaw(receiptBytes(receipt, this.config.paperWidth));
      void logEvent('[HARDWARE][PRINTER] printed', `VID=${result.vendorId} PID=${result.productId}`);
      return { printed: true, source: 'local' as const, printerName: 'USB ESC/POS local', vendorId: result.vendorId, productId: result.productId };
    }, async () => { const result = await apiFallback(); void logEvent('[HARDWARE][PRINTER] api fallback', result.printerName); return { ...result, source: 'api' as const }; });
  }
  printTest() {
    const width = this.config.paperWidth === 58 ? 32 : 48;
    return this.printRaw(new EscPosBuilder().initialize().align('left').line('PRUEBA ASCII MASUNG').line('ABCDEFGHIJKLMNOPQRSTUVWXYZ').line('0123456789').line('-'.repeat(width)).line(new Date().toLocaleString()).feed(1).rasterBar(this.config.paperWidth === 58 ? 24 : 32, 16).feed(5).cut().build());
  }
}
