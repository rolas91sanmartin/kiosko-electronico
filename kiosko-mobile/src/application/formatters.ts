import type { PayrollEnvelopeRow, PayrollPeriod } from '../domain/contracts';

export const clean = (value: unknown) => String(value ?? '').trim();
export const amount = (value: unknown) => { const parsed = Number(value); return Number.isFinite(parsed) ? parsed : 0; };
export const money = new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
export const errorMessage = (error: unknown) => error instanceof Error ? error.message : typeof error === 'string' ? error : 'Ocurrió un error inesperado.';
export function formatSqlDate(iso: string) { const [year, month, day] = iso.split('-'); return `${day}/${month}/${year}`; }
export function todayIso() { return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala', year: 'numeric', month: '2-digit', day: '2-digit' }).format(new Date()); }
const escapeHtml = (value: unknown) => clean(value).replace(/[&<>\"]/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);

export function receiptHtml(rows: PayrollEnvelopeRow[], period: PayrollPeriod) {
  if (!rows.length) throw new Error('El comprobante no contiene información.');
  const first = rows[0];
  const incomes = rows.filter(row => clean(row.RotDeveng) && amount(row.valor));
  const deductions = rows.filter(row => clean(row.RotDeduc) && amount(row.Valoded));
  const income = incomes.reduce((sum, row) => sum + amount(row.valor), 0);
  const deduction = deductions.reduce((sum, row) => sum + amount(row.Valoded), 0);
  const lines = (items: PayrollEnvelopeRow[], label: 'RotDeveng' | 'RotDeduc', value: 'valor' | 'Valoded') => items.map(row => `<tr><td>${escapeHtml(row[label])}</td><td>${money.format(amount(row[value]))}</td></tr>`).join('');
  return `<!doctype html><html><head><meta name="viewport" content="width=device-width"><style>body{font-family:monospace;color:#111;margin:10mm auto;max-width:76mm;font-size:10px}h1,h2{text-align:center;margin:2px}table{width:100%;border-collapse:collapse}td{padding:3px 0;border-bottom:1px dotted #777}td:last-child{text-align:right;font-weight:bold}.total{font-weight:bold;border-top:1px solid #111;margin-top:6px;padding-top:5px}.meta{line-height:1.5}</style></head><body><h1>INDUSTRIAL COMERCIAL<br>SAN MARTÍN</h1><h2>COMPROBANTE DE PAGO</h2><div class="meta"><b>Planilla:</b> ${period.consecutive}<br><b>Periodo:</b> ${escapeHtml(period.from)} al ${escapeHtml(period.to)}<br><b>Empleado:</b> ${escapeHtml(first.cod_Empleado)} ${escapeHtml(first.nom_empleado)} ${escapeHtml(first.ape_empleado)}<br><b>INSS:</b> ${escapeHtml(first.numero_inss)}<br><b>Cargo:</b> ${escapeHtml(first.des_cargo)}<br><b>Área:</b> ${escapeHtml(first.des_dependencia)}<br><b>Días laborados:</b> ${money.format(amount(first.Dias_laborados))}</div><h3>INGRESOS</h3><table>${lines(incomes, 'RotDeveng', 'valor')}</table><p class="total">TOTAL INGRESOS: ${money.format(income)}</p><h3>DEDUCCIONES</h3><table>${lines(deductions, 'RotDeduc', 'Valoded')}</table><p class="total">TOTAL DEDUCCIONES: ${money.format(deduction)}<br>INGRESO NETO: ${money.format(income - deduction)}</p></body></html>`;
}

export function reportHtml(rows: Record<string, unknown>[]) {
  const columns = rows.length ? Object.keys(rows[0]) : [];
  return `<!doctype html><html><head><style>@page{size:A4 landscape;margin:10mm}body{font-family:Arial;color:#111}h1{text-align:center;font-size:18px}table{border-collapse:collapse;width:100%;font-size:8px}th,td{border:1px solid #777;padding:3px}th{background:#eee}</style></head><body><h1>Entrada/Salida de Empleados</h1><table><thead><tr>${columns.map(c => `<th>${escapeHtml(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${escapeHtml(row[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
}
