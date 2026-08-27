import * as Crypto from 'expo-crypto';
import { inflate } from 'pako';
import type { PayrollTransferEnvelope } from '../domain/payroll';

function decodeBase64Url(value: string) {
  const base64 = value.replace(/-/g, '+').replace(/_/g, '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(base64);
  return Uint8Array.from(binary, (character) => character.charCodeAt(0));
}

function isAmountLine(value: unknown): value is { label: string; amount: number } {
  if (!value || typeof value !== 'object') return false;
  const line = value as Record<string, unknown>;
  return typeof line.label === 'string' && line.label.trim().length > 0 && typeof line.amount === 'number' && Number.isFinite(line.amount);
}

function validateEnvelope(value: unknown): asserts value is PayrollTransferEnvelope {
  if (!value || typeof value !== 'object') throw new Error('El código no contiene un comprobante válido.');
  const envelope = value as Partial<PayrollTransferEnvelope>;
  if (envelope.v !== 1 || !envelope.payroll || !envelope.employee) throw new Error('Versión de comprobante no compatible.');
  if (!Number.isInteger(envelope.payroll.consecutive) || envelope.payroll.consecutive <= 0) throw new Error('La planilla no es válida.');
  if (!envelope.payroll.from || !envelope.payroll.to || !envelope.employee.code || !envelope.employee.name) throw new Error('El comprobante está incompleto.');
  if (!Array.isArray(envelope.incomes) || !envelope.incomes.every(isAmountLine)) throw new Error('Los ingresos no son válidos.');
  if (!Array.isArray(envelope.deductions) || !envelope.deductions.every(isAmountLine)) throw new Error('Las deducciones no son válidas.');
  if (typeof envelope.debtBalance !== 'number' || !Number.isFinite(envelope.debtBalance)) throw new Error('El saldo no es válido.');
}

export async function parsePayrollCode(raw: string) {
  const [prefix, body, checksum, ...extra] = raw.trim().split('.');
  if (prefix !== 'SM1' || !body || !checksum || extra.length) throw new Error('Este PDF417 no pertenece a Comprobantes San Martín.');
  const digest = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, body);
  if (digest.slice(0, 32).toLowerCase() !== checksum.toLowerCase()) throw new Error('El código está incompleto o contiene datos dañados. Intente escanearlo nuevamente.');
  let envelope: unknown;
  try { envelope = JSON.parse(inflate(decodeBase64Url(body), { toText: true })); }
  catch { throw new Error('No se pudo leer la información comprimida del comprobante.'); }
  validateEnvelope(envelope);
  return { envelope, checksum };
}
