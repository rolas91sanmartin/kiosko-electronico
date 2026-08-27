const assert = require('node:assert/strict');
const { createHash } = require('node:crypto');
const bwipjs = require('bwip-js');
const { deflate, inflate } = require('pako');

const envelope = {
  v: 1,
  payroll: { consecutive: 216, from: '16/07/2026', to: '31/07/2026', receiptNumber: 1 },
  employee: { code: '1588', name: 'ROLANDO JOSÉ SÁNCHEZ BALTODANO', socialSecurityNumber: '23929313', role: 'ANALISTA PROGRAMADOR', area: 'INFORMÁTICA', workedDays: 15 },
  incomes: Array.from({ length: 12 }, (_, index) => ({ label: index ? `INGRESO ${index}` : 'SALARIO BÁSICO', amount: 14649.72 + index })),
  deductions: Array.from({ length: 12 }, (_, index) => ({ label: index ? `DEDUCCIÓN ${index}` : 'RETENCIÓN (I/R)', amount: 1025.48 + index })),
  debtBalance: 0
};
const compressed = deflate(Buffer.from(JSON.stringify(envelope), 'utf8'), { level: 9 });
const body = Buffer.from(compressed).toString('base64url');
const checksum = createHash('sha256').update(body).digest('hex').slice(0, 32);
const code = `SM1.${body}.${checksum}`;
assert.ok(Buffer.byteLength(code, 'utf8') <= 1800, 'El código excede la capacidad definida');
assert.equal(createHash('sha256').update(body).digest('hex').slice(0, 32), checksum);
const restored = JSON.parse(Buffer.from(inflate(Buffer.from(body, 'base64url'))).toString('utf8'));
assert.deepEqual(restored, envelope);
void bwipjs.toBuffer({ bcid: 'pdf417', text: code, scale: 3, height: 18, paddingwidth: 10, paddingheight: 10, columns: 10, eclevel: 4 }).then((png) => {
  console.log(`PDF417 renderizado: ${png.readUInt32BE(16)}x${png.readUInt32BE(20)} px`);
  console.log(`PDF417 válido: ${Buffer.byteLength(code, 'utf8')} bytes, ${envelope.incomes.length + envelope.deductions.length} conceptos.`);
});
