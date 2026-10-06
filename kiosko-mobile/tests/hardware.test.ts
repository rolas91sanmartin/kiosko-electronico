import assert from 'node:assert/strict';
import test from 'node:test';
import { defaultHardwareConfig, normalizeHardwareConfig } from '../src/hardware/HardwareConfig';
import { EscPosBuilder, fitColumns } from '../src/hardware/printer/EscPosBuilder';
import { receiptBytes } from '../src/hardware/printer/ReceiptBuilder';
import { selectUsbPrinter } from '../src/hardware/printer/deviceSelection';
import { withPrinterFallback } from '../src/hardware/printer/printerFallback';
import { ScannerBuffer } from '../src/hardware/scanner/ScannerBuffer';
import type { HardwareKeyEvent } from '../src/hardware/scanner/ScannerTypes';
import type { UsbDeviceInfo } from '../src/hardware/usb/UsbDeviceTypes';

const key = (character: string, timestamp: number, keyCode = 0): HardwareKeyEvent => ({ character, timestamp, keyCode, deviceId: 4, external: true });
test('scanner HID termina por ENTER sin asumir longitud', () => { const parser = new ScannerBuffer(80); 'AB12'.split('').forEach((value,index) => parser.push(key(value,index*10))); assert.equal(parser.push(key('',50,66))?.value,'AB12'); });
test('scanner separa lecturas cuando expira el intervalo', () => { const parser = new ScannerBuffer(80); parser.push(key('A',1)); parser.push(key('B',200)); assert.equal(parser.flush(281)?.value,'B'); });
test('ESC/POS contiene inicialización y corte', () => { const bytes = new EscPosBuilder().initialize().line('TEST').cut().build(); assert.deepEqual(Array.from(bytes.slice(0,2)),[0x1b,0x40]); assert.deepEqual(Array.from(bytes.slice(-3)),[0x1d,0x56,1]); assert.equal(fitColumns('NETO','10.00',20).length,20); });
test('ESC/POS genera una franja raster negra para diagnóstico térmico', () => { const bytes = new EscPosBuilder().rasterBar(2,3).build(); assert.deepEqual(Array.from(bytes.slice(0,8)),[0x1d,0x76,0x30,0,2,0,3,0]); assert.deepEqual(Array.from(bytes.slice(8)),[255,255,255,255,255,255]); });
test('ticket ESC/POS local imprime el saldo total de deuda', () => {
  const row = { cod_Empleado:262, valor:325, RotDeveng:'REEMBOLSO DE ALIMENTACION', Valoded:1000, RotDeduc:'ADELANTO DE SALARIO', saldo:8603.63, nom_empleado:'XIOMARA DEL CARMEN', ape_empleado:'TALAVERA ALVAREZ', des_cargo:'RESPONSABLE DE CAJA', numero_inss:'7471591', des_dependencia:'ADMINISTRACION', Dias_laborados:6, fechaini:'2026-08-09', fechafin:'2026-08-15' };
  const bytes = receiptBytes({ employee:{code:'262',name:'XIOMARA DEL CARMEN TALAVERA ALVAREZ',photoDataUrl:null,payrollCode:1}, period:{from:'09/08/2026',to:'15/08/2026',consecutive:123,totalRecords:1}, rows:[row] }, 80);
  const output = String.fromCharCode(...bytes);
  assert.match(output, /SALDO DE DEUDA\s+8,603\.63/);
});
test('configuración limita timeout y ancho de papel', () => { assert.equal(normalizeHardwareConfig({ scanner:{...defaultHardwareConfig.scanner,characterTimeoutMs:999}, printer:{...defaultHardwareConfig.printer,paperWidth:58} }).scanner.characterTimeoutMs,100); assert.equal(normalizeHardwareConfig({printer:{...defaultHardwareConfig.printer,paperWidth:58}}).printer.paperWidth,58); });
test('selección prefiere clase USB printer con Bulk OUT', () => { const endpoint={address:1,type:2,direction:0,maxPacketSize:64}; const make=(id:number,klass:number):UsbDeviceInfo=>({deviceName:String(id),deviceId:id,vendorId:id,productId:id,deviceClass:0,permission:true,hid:false,interfaces:[{id:0,interfaceClass:klass,interfaceSubclass:0,interfaceProtocol:0,endpoints:[endpoint]}]}); assert.equal(selectUsbPrinter([make(1,0),make(2,7)],null,null)?.vendorId,2); });
test('modo auto usa API cuando falla USB local', async () => { const value=await withPrinterFallback('auto',async()=>{throw new Error('NO_USB_PRINTER')},async()=> 'api'); assert.equal(value,'api'); await assert.rejects(()=>withPrinterFallback('local',async()=>{throw new Error('fail')},async()=> 'api')); });
