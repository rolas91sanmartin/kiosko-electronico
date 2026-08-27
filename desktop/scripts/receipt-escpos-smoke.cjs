const assert = require('node:assert/strict');
const { buildEscPosReceipt } = require('../dist-electron/electron/infrastructure/escpos-receipt.js');

const period = { from: '01/08/2026', to: '15/08/2026', consecutive: 4239, totalRecords: 1 };
const base = {
  cod_Empleado: 1234,
  nom_empleado: 'JOSÉ',
  ape_empleado: 'MUÑOZ',
  des_cargo: 'OPERADOR',
  numero_inss: '1234567',
  des_dependencia: 'PRODUCCIÓN',
  Dias_laborados: 15,
  fechaini: period.from,
  fechafin: period.to,
  saldo: 0
};
const rows = [
  { ...base, RotDeveng: 'SALARIO BÁSICO', valor: 14649.72, RotDeduc: null, Valoded: null },
  { ...base, RotDeveng: null, valor: null, RotDeduc: 'INSS', Valoded: 1025.48 }
];

const receipt = buildEscPosReceipt(rows, period, { columns: 40, cutPaper: true });
assert.deepEqual([...receipt.subarray(0, 2)], [0x1b, 0x40]);
assert.deepEqual([...receipt.subarray(-4)], [0x1d, 0x56, 0x42, 0x00]);
assert.ok(receipt.includes(Buffer.from('PLANILLA: 4239')));
assert.ok(receipt.includes(Buffer.from('TOTAL INGRESOS')));
assert.ok(receipt.includes(Buffer.from('13,624.24')));
const printableLines = receipt.toString('latin1').split('\n').filter((line) => !line.includes(String.fromCharCode(0x1b)));
assert.ok(printableLines.every((line) => line.length <= 40), 'Cada línea imprimible debe respetar las 40 columnas.');
console.log('ESC/POS receipt smoke test passed.');
