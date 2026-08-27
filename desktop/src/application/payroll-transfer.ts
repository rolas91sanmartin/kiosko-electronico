import { deflate } from 'pako';
import type { Employee, PayrollEnvelopeRow, PayrollPeriod } from '../shared/contracts';

export interface PayrollTransferEnvelope {
  v: 1;
  payroll: { consecutive: number; from: string; to: string; receiptNumber: number };
  employee: {
    code: string;
    name: string;
    socialSecurityNumber: string;
    role: string;
    area: string;
    workedDays: number;
  };
  incomes: Array<{ label: string; amount: number }>;
  deductions: Array<{ label: string; amount: number }>;
  debtBalance: number;
}

const clean = (value: unknown) => String(value ?? '').trim();
const amount = (value: unknown) => {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
};

function toBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (let offset = 0; offset < bytes.length; offset += 0x8000) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 0x8000));
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

async function sha256(value: string) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(value));
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, '0')).join('');
}

export async function createPayrollTransferCode(
  employee: Employee,
  period: PayrollPeriod,
  rows: PayrollEnvelopeRow[]
) {
  if (!rows.length) throw new Error('El comprobante no contiene información para transferir.');
  const first = rows[0];
  const envelope: PayrollTransferEnvelope = {
    v: 1,
    payroll: { consecutive: period.consecutive, from: period.from, to: period.to, receiptNumber: 1 },
    employee: {
      code: clean(first.cod_Empleado || employee.code),
      name: `${clean(first.nom_empleado)} ${clean(first.ape_empleado)}`.trim() || employee.name,
      socialSecurityNumber: clean(first.numero_inss),
      role: clean(first.des_cargo),
      area: clean(first.des_dependencia),
      workedDays: amount(first.Dias_laborados)
    },
    incomes: rows
      .filter((row) => clean(row.RotDeveng) && amount(row.valor) !== 0)
      .map((row) => ({ label: clean(row.RotDeveng), amount: amount(row.valor) })),
    deductions: rows
      .filter((row) => clean(row.RotDeduc) && amount(row.Valoded) !== 0)
      .map((row) => ({ label: clean(row.RotDeduc), amount: amount(row.Valoded) })),
    debtBalance: rows.reduce((total, row) => total + amount(row.saldo), 0)
  };
  const compressed = deflate(new TextEncoder().encode(JSON.stringify(envelope)), { level: 9 });
  const body = toBase64Url(compressed);
  const checksum = (await sha256(body)).slice(0, 32);
  const code = `SM1.${body}.${checksum}`;
  if (new TextEncoder().encode(code).length > 1800) {
    throw new Error('El comprobante contiene demasiados conceptos para un solo código PDF417.');
  }
  return code;
}
