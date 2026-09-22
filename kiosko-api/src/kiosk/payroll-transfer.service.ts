import { Injectable } from '@nestjs/common';
import * as bwipjs from 'bwip-js';
import { createHash, generateKeyPairSync, sign } from 'node:crypto';
import * as fs from 'node:fs';
import * as path from 'node:path';
import type { Employee, PayrollEnvelopeRow, PayrollPeriod, SignedPayrollTransfer } from './contracts';

const clean = (value: unknown) => String(value ?? '').trim();
const amount = (value: unknown) => Number.isFinite(Number(value)) ? Number(value) : 0;
const base64url = (value: Buffer | string) => Buffer.from(value).toString('base64url');

@Injectable()
export class PayrollTransferService {
  private keys() {
    const privatePath = path.resolve(process.env.KIOSK_SIGNING_KEY_PATH || './config/payroll-signing-private.pem');
    const publicPath = path.resolve(process.env.KIOSK_SIGNING_PUBLIC_KEY_PATH || './config/payroll-signing-public.pem');
    if (!fs.existsSync(privatePath) || !fs.existsSync(publicPath)) {
      fs.mkdirSync(path.dirname(privatePath), { recursive: true });
      fs.mkdirSync(path.dirname(publicPath), { recursive: true });
      const pair = generateKeyPairSync('ed25519');
      fs.writeFileSync(privatePath, pair.privateKey.export({ type: 'pkcs8', format: 'pem' }), { mode: 0o600 });
      fs.writeFileSync(publicPath, pair.publicKey.export({ type: 'spki', format: 'pem' }));
    }
    const privateKey = fs.readFileSync(privatePath, 'utf8');
    const publicKey = fs.readFileSync(publicPath, 'utf8');
    const keyId = createHash('sha256').update(publicKey).digest('hex').slice(0, 16);
    return { privateKey, publicKey, keyId };
  }

  async create(employee: Employee, period: PayrollPeriod, rows: PayrollEnvelopeRow[]): Promise<SignedPayrollTransfer> {
    if (!rows.length) throw new Error('El comprobante no contiene información para transferir.');
    const first = rows[0];
    const envelope = {
      v: 2,
      issuedAt: new Date().toISOString(),
      payroll: { consecutive: period.consecutive, from: period.from, to: period.to, receiptNumber: 1 },
      employee: { code: clean(first.cod_Empleado || employee.code), name: `${clean(first.nom_empleado)} ${clean(first.ape_empleado)}`.trim() || employee.name, socialSecurityNumber: clean(first.numero_inss), role: clean(first.des_cargo), area: clean(first.des_dependencia), workedDays: amount(first.Dias_laborados) },
      incomes: rows.filter(row => clean(row.RotDeveng) && amount(row.valor) !== 0).map(row => ({ label: clean(row.RotDeveng), amount: amount(row.valor) })),
      deductions: rows.filter(row => clean(row.RotDeduc) && amount(row.Valoded) !== 0).map(row => ({ label: clean(row.RotDeduc), amount: amount(row.Valoded) })),
      debtBalance: rows.reduce((total, row) => total + amount(row.saldo), 0)
    };
    const payload = base64url(JSON.stringify(envelope));
    const { privateKey, publicKey, keyId } = this.keys();
    const signature = sign(null, Buffer.from(payload), privateKey).toString('base64url');
    const code = `SM2.${keyId}.${payload}.${signature}`;
    if (Buffer.byteLength(code) > 2600) throw new Error('El comprobante contiene demasiada información para un PDF417 confiable.');
    const png = await bwipjs.toBuffer({ bcid: 'pdf417', text: code, scale: 3, height: 18, paddingwidth: 10, paddingheight: 10, columns: 10, eclevel: 4 } as never);
    return { version: 1, algorithm: 'Ed25519', keyId, payload: code, signature, publicKey, barcodeDataUrl: `data:image/png;base64,${Buffer.from(png).toString('base64')}` };
  }
}
