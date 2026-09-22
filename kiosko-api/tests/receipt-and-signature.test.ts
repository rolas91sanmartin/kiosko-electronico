import assert from 'node:assert/strict';
import { mkdtempSync, rmSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { verify } from 'node:crypto';
import { buildEscPosReceipt } from '../src/kiosk/escpos-receipt';
import { PayrollTransferService } from '../src/kiosk/payroll-transfer.service';

const period = { consecutive: 216, from: '16/07/2026', to: '31/07/2026', totalRecords: 1 };
const rows = [{ cod_Empleado: 1234, valor: 14649.72, RotDeveng: 'SALARIO BASICO', Valoded: 1025.48, RotDeduc: 'INSS', saldo: 0, nom_empleado: 'ANA', ape_empleado: 'PEREZ', des_cargo: 'ANALISTA', numero_inss: '123456', des_dependencia: 'INFORMATICA', Dias_laborados: 15, fechaini: period.from, fechafin: period.to }];

test('genera ticket ESC/POS para la TM-U220', () => {
  const ticket = buildEscPosReceipt(rows, period, { columns: 42, cutPaper: true });
  assert.equal(ticket[0], 0x1b);
  assert.match(ticket.toString('latin1'), /COMPROBANTE DE PAGO/);
  assert.ok(ticket.includes(Buffer.from([0x1d, 0x56, 0x42, 0x00])));
});

test('firma el PDF417 con Ed25519 y permite verificarlo', async () => {
  const folder = mkdtempSync(path.join(os.tmpdir(), 'kiosko-sign-'));
  process.env.KIOSK_SIGNING_KEY_PATH = path.join(folder, 'private.pem');
  process.env.KIOSK_SIGNING_PUBLIC_KEY_PATH = path.join(folder, 'public.pem');
  try {
    const result = await new PayrollTransferService().create({ code: '1234', name: 'ANA PEREZ', photoDataUrl: null, payrollCode: 1 }, period, rows);
    const [, keyId, payload, signature] = result.payload.split('.');
    assert.equal(keyId, result.keyId);
    assert.equal(signature, result.signature);
    assert.equal(verify(null, Buffer.from(payload), result.publicKey, Buffer.from(signature, 'base64url')), true);
    assert.match(result.barcodeDataUrl, /^data:image\/png;base64,/);
  } finally { rmSync(folder, { recursive: true, force: true }); }
});
