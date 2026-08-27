import { BrowserWindow } from 'electron';
import type { AppConfig } from '../config';
import type { PayrollEnvelopeRow, PayrollPeriod, ReceiptPrintResult } from '../../src/shared/contracts';
import { buildEscPosReceipt } from './escpos-receipt';
import { printWindowsRaw } from './windows-raw-printer';

function text(value: unknown) {
  return String(value ?? '').trim();
}

function escapeHtml(value: unknown) {
  return text(value).replace(/[&<>"']/g, (character) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[character]!);
}

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat('es-NI', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  }).format(value);
}

function line(label: unknown, value: unknown) {
  return `<div class="line"><span>${escapeHtml(label)}</span><b>${money(amount(value))}</b></div>`;
}

function receiptHtml(rows: PayrollEnvelopeRow[], period: PayrollPeriod, widthMm: number) {
  const printableWidthMm = widthMm === 76 ? 63.4 : widthMm === 69.5 ? 57 : 47.5;
  const first = rows[0];
  const incomes = rows.filter((row) => text(row.RotDeveng) && amount(row.valor) !== 0);
  const deductions = rows.filter((row) => text(row.RotDeduc) && amount(row.Valoded) !== 0);
  const totalIncome = incomes.reduce((total, row) => total + amount(row.valor), 0);
  const totalDeductions = deductions.reduce((total, row) => total + amount(row.Valoded), 0);
  const debt = deductions.reduce((total, row) => total + amount(row.saldo), 0);
  return `<!doctype html><html><head><meta charset="utf-8"><style>
    @page{size:${widthMm}mm auto;margin:0}
    *{box-sizing:border-box}html,body{margin:0;padding:0;color:#000;background:#fff}
    body{width:${printableWidthMm}mm;margin:0 auto;padding:2mm 0 10mm;font:10px/1.35 "Courier New",monospace}
    h1{margin:0;text-align:center;font-size:13px;line-height:1.2}h2{margin:3mm 0 1mm;text-align:center;font-size:12px}
    p{margin:1.2mm 0}.rule{margin:2mm 0;border-top:1px dashed #000}
    .line{display:flex;justify-content:space-between;gap:3mm;min-height:4mm}.line span{min-width:0;overflow:hidden}.line b{flex:none;text-align:right}
    .total{font-weight:bold}.center{text-align:center}.small{font-size:9px}.feed{height:8mm}
  </style></head><body>
    <h1>INDUSTRIAL COMERCIAL<br>SANMARTIN</h1>
    <p class="center">COMPROBANTE DE PAGO</p><div class="rule"></div>
    <p>PLANILLA: <b>${period.consecutive}</b></p><p>PERIODO: ${escapeHtml(period.from)} AL ${escapeHtml(period.to)}</p>
    <p>EMPLEADO: <b>${escapeHtml(first.cod_Empleado)}</b><br>${escapeHtml(first.nom_empleado)} ${escapeHtml(first.ape_empleado)}</p>
    <p>INSS: ${escapeHtml(first.numero_inss)}</p><p>CARGO: ${escapeHtml(first.des_cargo)}</p><p>AREA: ${escapeHtml(first.des_dependencia)}</p>
    <p>DIAS LABORADOS: ${money(amount(first.Dias_laborados))}</p><div class="rule"></div>
    <h2>INGRESOS</h2>${incomes.map((row) => line(row.RotDeveng, row.valor)).join('')}
    <div class="line total"><span>TOTAL INGRESOS</span><b>${money(totalIncome)}</b></div>
    <h2>DEDUCCIONES</h2>${deductions.map((row) => line(row.RotDeduc, row.Valoded)).join('')}
    <div class="line total"><span>TOTAL DEDUCCIONES</span><b>${money(totalDeductions)}</b></div>
    <div class="rule"></div><div class="line total"><span>INGRESO NETO</span><b>${money(totalIncome - totalDeductions)}</b></div>
    <div class="line"><span>SALDO DE DEUDA</span><b>${money(debt)}</b></div><div class="rule"></div>
    <p class="center small">Documento generado por Kiosko Electrónico</p><div class="feed"></div>
  </body></html>`;
}

export class ElectronReceiptPrinter {
  constructor(private readonly config: AppConfig) {}

  async print(rows: PayrollEnvelopeRow[], period: PayrollPeriod): Promise<ReceiptPrintResult> {
    if (!rows.length) throw new Error('El empleado no tiene comprobante en la planilla seleccionada.');
    const requestedName = this.config.kiosk.receiptPrinterName.trim();
    if (!requestedName) throw new Error('Configure kiosk.receiptPrinterName antes de imprimir.');
    const supportedWidths = [76, 69.5, 57.5];
    const widthMm = supportedWidths.reduce((closest, candidate) =>
      Math.abs(candidate - this.config.kiosk.receiptPaperWidthMm) < Math.abs(closest - this.config.kiosk.receiptPaperWidthMm) ? candidate : closest
    );
    const printWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
    try {
      const printers = await printWindow.webContents.getPrintersAsync();
      const requested = requestedName.toLocaleLowerCase();
      let printer = printers.find((candidate) =>
        candidate.name.toLocaleLowerCase() === requested ||
        candidate.displayName?.toLocaleLowerCase() === requested
      );
      if (!printer) {
        const model = this.config.kiosk.receiptPrinterModel.trim().toLocaleLowerCase();
        const modelMatches = model ? printers.filter((candidate) =>
          candidate.name.toLocaleLowerCase().includes(model) || candidate.displayName?.toLocaleLowerCase().includes(model)
        ) : [];
        if (modelMatches.length === 1) printer = modelMatches[0];
      }
      if (!printer) {
        const available = printers.map((candidate) => candidate.displayName || candidate.name).join(', ');
        throw new Error(`No se encontró la impresora "${requestedName}". Disponibles: ${available || 'ninguna'}.`);
      }
      if (this.config.kiosk.receiptSilentPrint) {
        const columns = widthMm === 76 ? 40 : widthMm === 69.5 ? 36 : 30;
        const payload = buildEscPosReceipt(rows, period, {
          columns,
          cutPaper: this.config.kiosk.receiptRawCutPaper
        });
        await printWindowsRaw(printer.name, payload);
        return { printed: true, printerName: printer.displayName || printer.name };
      }
      const html = receiptHtml(rows, period, widthMm);
      await printWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
      await new Promise<void>((resolve, reject) => {
        printWindow.webContents.print({
          silent: false,
          deviceName: printer.name,
          printBackground: false,
          color: false,
          landscape: false,
          scaleFactor: 100,
          pagesPerSheet: 1,
          copies: 1,
          margins: { marginType: 'none' },
          usePrinterDefaultPageSize: true
        }, (success, failureReason) => success ? resolve() : reject(new Error(`No se pudo imprimir: ${failureReason || 'error del controlador'}.`)));
      });
      return { printed: true, printerName: printer.displayName || printer.name };
    } finally {
      if (!printWindow.isDestroyed()) printWindow.destroy();
    }
  }
}
