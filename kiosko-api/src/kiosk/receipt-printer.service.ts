import { Injectable } from '@nestjs/common';
import { execFile } from 'node:child_process';
import type { PayrollEnvelopeRow, PayrollPeriod, ReceiptPrintResult } from './contracts';
import { buildEscPosReceipt } from './escpos-receipt';
import { printWindowsRaw } from './windows-raw-printer';

function powershell(script: string) {
  const encoded = Buffer.from(script, 'utf16le').toString('base64');
  return new Promise<string>((resolve, reject) => {
    execFile('powershell.exe', ['-NoLogo', '-NoProfile', '-NonInteractive', '-EncodedCommand', encoded], {
      windowsHide: true, timeout: 15_000, maxBuffer: 512 * 1024
    }, (error, stdout, stderr) => error ? reject(new Error(stderr.trim() || error.message)) : resolve(stdout));
  });
}

@Injectable()
export class ReceiptPrinterService {
  private async resolvePrinter() {
    if (process.platform !== 'win32') throw new Error('La impresión RAW requiere que kiosko-api se ejecute en Windows.');
    const configured = (process.env.KIOSK_RECEIPT_PRINTER || 'EPSON TM-U220II Receipt').trim();
    const model = (process.env.KIOSK_RECEIPT_MODEL || 'TM-U220').trim().toLowerCase();
    const output = await powershell("Get-Printer | Select-Object -ExpandProperty Name | ConvertTo-Json -Compress");
    const parsed = JSON.parse(output.trim() || '[]') as string | string[];
    const printers = Array.isArray(parsed) ? parsed : [parsed];
    const exact = printers.find(name => name.toLowerCase() === configured.toLowerCase());
    if (exact) return exact;
    const matches = printers.filter(name => name.toLowerCase().includes(model));
    if (matches.length === 1) return matches[0];
    throw new Error(`No se encontró la impresora '${configured}'. Disponibles: ${printers.join(', ') || 'ninguna'}.`);
  }

  async print(rows: PayrollEnvelopeRow[], period: PayrollPeriod): Promise<ReceiptPrintResult> {
    const printerName = await this.resolvePrinter();
    const width = Number(process.env.KIOSK_RECEIPT_WIDTH_MM || 76);
    const columns = width >= 76 ? 42 : width >= 69 ? 38 : 32;
    const payload = buildEscPosReceipt(rows, period, {
      columns,
      cutPaper: process.env.KIOSK_RECEIPT_RAW_CUT !== 'false'
    });
    await printWindowsRaw(printerName, payload);
    return { printed: true, printerName };
  }
}
