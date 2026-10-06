import { amount, clean } from '../../application/formatters';
import { EscPosBuilder, fitColumns } from './EscPosBuilder';
import type { ReceiptData } from './PrinterTypes';

export function receiptBytes({ employee, period, rows }: ReceiptData, paperWidth: 58 | 80) {
  // Leave room for the receipt's left margin (about 3 mm on 203 dpi printers).
  const width = paperWidth === 58 ? 29 : 45, first = rows[0];
  const incomes = rows.filter(row => clean(row.RotDeveng));
  const deductions = rows.filter(row => clean(row.RotDeduc));
  const income = incomes.reduce((sum, row) => sum + amount(row.valor), 0);
  const deduction = deductions.reduce((sum, row) => sum + amount(row.Valoded), 0);
  const debt = rows.reduce((sum, row) => sum + amount(row.saldo), 0);
  const money = (value: number) => value.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const builder = new EscPosBuilder().initialize().leftMargin(24).align('center').bold(true).line('INDUSTRIAL COMERCIAL').line('SAN MARTIN').line('COMPROBANTE DE PAGO').bold(false).line(`PLANILLA ${period.consecutive}`).line(`${period.from} AL ${period.to}`).feed().align('left').line(`EMPLEADO: ${employee.code}`).line(employee.name).line(`INSS: ${clean(first?.numero_inss)}`).line(`CARGO: ${clean(first?.des_cargo)}`).line('-'.repeat(width)).bold(true).line('INGRESOS').bold(false);
  incomes.forEach(row => builder.line(fitColumns(clean(row.RotDeveng), money(amount(row.valor)), width)));
  builder.bold(true).line(fitColumns('TOTAL INGRESOS', money(income), width)).line('DEDUCCIONES').bold(false);
  deductions.forEach(row => builder.line(fitColumns(clean(row.RotDeduc), money(amount(row.Valoded)), width)));
  return builder.bold(true).line(fitColumns('TOTAL DEDUCCIONES', money(deduction), width)).line(fitColumns('SALDO DE DEUDA', money(debt), width)).line(fitColumns('INGRESO NETO', money(income - deduction), width)).bold(false).line('-'.repeat(width)).align('center').line('CORTAR AQUI').feed(5).cut().build();
}
