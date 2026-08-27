import type { PayrollEnvelopeRow, PayrollPeriod } from '../../src/shared/contracts';

const ESC = 0x1b;
const GS = 0x1d;

const cp850Characters: Record<string, number> = {
  'Ç': 128, 'ü': 129, 'é': 130, 'â': 131, 'ä': 132, 'à': 133, 'å': 134, 'ç': 135,
  'ê': 136, 'ë': 137, 'è': 138, 'ï': 139, 'î': 140, 'ì': 141, 'Ä': 142, 'Å': 143,
  'É': 144, 'æ': 145, 'Æ': 146, 'ô': 147, 'ö': 148, 'ò': 149, 'û': 150, 'ù': 151,
  'ÿ': 152, 'Ö': 153, 'Ü': 154, 'ø': 155, '£': 156, 'Ø': 157, '×': 158, 'ƒ': 159,
  'á': 160, 'í': 161, 'ó': 162, 'ú': 163, 'ñ': 164, 'Ñ': 165, 'ª': 166, 'º': 167,
  '¿': 168, '®': 169, '¬': 170, '½': 171, '¼': 172, '¡': 173, '«': 174, '»': 175,
  'Á': 181, 'Â': 182, 'À': 183, '©': 184, 'Í': 214, 'Ó': 224, 'Ú': 233
};

function text(value: unknown) {
  return String(value ?? '').trim().replace(/[\r\n\t]+/g, ' ').replace(/\s{2,}/g, ' ');
}

function amount(value: unknown) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function money(value: number) {
  return new Intl.NumberFormat('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    useGrouping: true
  }).format(value);
}

function encodeCp850(value: string) {
  const bytes: number[] = [];
  for (const character of value) {
    const code = character.charCodeAt(0);
    if (code === 10 || code === 13 || (code >= 32 && code <= 126)) bytes.push(code);
    else bytes.push(cp850Characters[character] ?? 63);
  }
  return Buffer.from(bytes);
}

function pair(label: unknown, value: unknown, columns: number) {
  const right = text(value).slice(0, columns - 1);
  const leftWidth = Math.max(1, columns - right.length - 1);
  const left = text(label).slice(0, leftWidth);
  return `${left.padEnd(columns - right.length)}${right}\n`;
}

function wrap(value: unknown, columns: number) {
  const words = text(value).split(' ').filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    if (!current) current = word.slice(0, columns);
    else if (`${current} ${word}`.length <= columns) current += ` ${word}`;
    else { lines.push(current); current = word.slice(0, columns); }
  }
  if (current) lines.push(current);
  return lines.join('\n');
}

export interface EscPosReceiptOptions {
  columns: number;
  cutPaper: boolean;
}

export function buildEscPosReceipt(
  rows: PayrollEnvelopeRow[],
  period: PayrollPeriod,
  options: EscPosReceiptOptions
) {
  if (!rows.length) throw new Error('El empleado no tiene comprobante en la planilla seleccionada.');
  const columns = Math.max(30, Math.min(48, Math.round(options.columns)));
  const rule = `${'-'.repeat(columns)}\n`;
  const first = rows[0];
  const incomes = rows.filter((row) => text(row.RotDeveng) && amount(row.valor) !== 0);
  const deductions = rows.filter((row) => text(row.RotDeduc) && amount(row.Valoded) !== 0);
  const totalIncome = incomes.reduce((total, row) => total + amount(row.valor), 0);
  const totalDeductions = deductions.reduce((total, row) => total + amount(row.Valoded), 0);
  const debt = deductions.reduce((total, row) => total + amount(row.saldo), 0);
  const chunks: Buffer[] = [];
  const command = (...bytes: number[]) => chunks.push(Buffer.from(bytes));
  const write = (value: string) => chunks.push(encodeCp850(value));

  command(ESC, 0x40); // Inicializar.
  command(ESC, 0x74, 0x02); // Página de códigos PC850 multilingüe.
  command(ESC, 0x61, 0x01); // Centrar.
  command(ESC, 0x45, 0x01); // Negrita.
  write('INDUSTRIAL COMERCIAL\nSAN MARTIN\n');
  command(ESC, 0x45, 0x00);
  write('COMPROBANTE DE PAGO\n');
  command(ESC, 0x61, 0x00); // Alinear a la izquierda.
  write(rule);
  write(`PLANILLA: ${period.consecutive}\n`);
  write(`PERIODO: ${text(period.from)} AL ${text(period.to)}\n`);
  write(`EMPLEADO: ${text(first.cod_Empleado)}\n`);
  write(`${wrap(`${text(first.nom_empleado)} ${text(first.ape_empleado)}`, columns)}\n`);
  write(`INSS: ${text(first.numero_inss)}\n`);
  write(`CARGO: ${wrap(first.des_cargo, columns)}\n`);
  write(`AREA: ${wrap(first.des_dependencia, columns)}\n`);
  write(`DIAS LABORADOS: ${money(amount(first.Dias_laborados))}\n`);
  write(rule);

  command(ESC, 0x45, 0x01); write('INGRESOS\n'); command(ESC, 0x45, 0x00);
  for (const row of incomes) write(pair(row.RotDeveng, money(amount(row.valor)), columns));
  command(ESC, 0x45, 0x01); write(pair('TOTAL INGRESOS', money(totalIncome), columns)); command(ESC, 0x45, 0x00);

  write('\n'); command(ESC, 0x45, 0x01); write('DEDUCCIONES\n'); command(ESC, 0x45, 0x00);
  for (const row of deductions) write(pair(row.RotDeduc, money(amount(row.Valoded)), columns));
  command(ESC, 0x45, 0x01); write(pair('TOTAL DEDUCCIONES', money(totalDeductions), columns)); command(ESC, 0x45, 0x00);
  write(rule);
  command(ESC, 0x45, 0x01); write(pair('INGRESO NETO', money(totalIncome - totalDeductions), columns)); command(ESC, 0x45, 0x00);
  write(pair('SALDO DE DEUDA', money(debt), columns));
  write(rule);
  command(ESC, 0x61, 0x01);
  write('Documento generado por\nKiosko Electrónico\n');
  command(ESC, 0x61, 0x00);
  command(ESC, 0x64, 0x05); // Avanzar cinco líneas.
  if (options.cutPaper) command(GS, 0x56, 0x42, 0x00); // Corte parcial.
  return Buffer.concat(chunks);
}
