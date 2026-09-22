import { Injectable } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import type { PayrollEnvelopeRow, PayrollPeriod } from './contracts';

const text = (value: unknown) => String(value ?? '').trim();
const number = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const money = (value: number) => new Intl.NumberFormat('es-NI', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);
const escape = (value: unknown) => text(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]!);

function receiptHtml(rows: PayrollEnvelopeRow[], period: PayrollPeriod) {
  const first = rows[0];
  const incomes = rows.filter(row => text(row.RotDeveng) && number(row.valor) !== 0);
  const deductions = rows.filter(row => text(row.RotDeduc) && number(row.Valoded) !== 0);
  const totalIncome = incomes.reduce((sum, row) => sum + number(row.valor), 0);
  const totalDeductions = deductions.reduce((sum, row) => sum + number(row.Valoded), 0);
  const lines = (items: PayrollEnvelopeRow[], label: 'RotDeveng' | 'RotDeduc', amount: 'valor' | 'Valoded') => items.map(row => `<tr><td>${escape(row[label])}</td><td style="text-align:right">${money(number(row[amount]))}</td></tr>`).join('');
  return `<div style="font-family:Arial;max-width:760px;margin:auto"><h2>INDUSTRIAL COMERCIAL SAN MARTÍN</h2><p>Planilla del ${escape(period.from)} al ${escape(period.to)}</p><p><b>Empleado:</b> ${escape(first.cod_Empleado)} ${escape(first.nom_empleado)} ${escape(first.ape_empleado)}<br><b>INSS:</b> ${escape(first.numero_inss)}<br><b>Cargo:</b> ${escape(first.des_cargo)} · <b>Área:</b> ${escape(first.des_dependencia)}</p><h3>Ingresos</h3><table style="width:100%">${lines(incomes, 'RotDeveng', 'valor')}</table><p><b>Total ingresos: ${money(totalIncome)}</b></p><h3>Deducciones</h3><table style="width:100%">${lines(deductions, 'RotDeduc', 'Valoded')}</table><p><b>Total deducciones: ${money(totalDeductions)} · Ingreso neto: ${money(totalIncome - totalDeductions)}</b></p></div>`;
}

@Injectable()
export class MailService {
  async sendReceipt(email: string, rows: PayrollEnvelopeRow[], period: PayrollPeriod) {
    const host = process.env.KIOSK_SMTP_HOST;
    if (!host) throw new Error('Configure KIOSK_SMTP_HOST para habilitar el envío por correo.');
    const transporter = nodemailer.createTransport({
      host,
      port: Number(process.env.KIOSK_SMTP_PORT || 587),
      secure: process.env.KIOSK_SMTP_SECURE === 'true',
      auth: process.env.KIOSK_SMTP_USER ? { user: process.env.KIOSK_SMTP_USER, pass: process.env.KIOSK_SMTP_PASSWORD || '' } : undefined
    });
    const info = await transporter.sendMail({
      from: process.env.KIOSK_SMTP_FROM || process.env.KIOSK_SMTP_USER,
      to: email,
      subject: `Comprobante de pago - Planilla ${period.consecutive}`,
      html: receiptHtml(rows, period)
    });
    return { sent: true, messageId: info.messageId };
  }
}
