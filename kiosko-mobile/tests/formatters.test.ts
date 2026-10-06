import assert from 'node:assert/strict';
import test from 'node:test';
import { formatSqlDate, receiptHtml } from '../src/application/formatters';

test('convierte la fecha ISO al formato usado por SQL Server', () => {
  assert.equal(formatSqlDate('2026-09-02'), '02/09/2026');
});

test('genera el comprobante con totales y HTML escapado', () => {
  const html = receiptHtml([{ cod_Empleado: 1234, valor: 1000, RotDeveng: 'SALARIO <BASE>', Valoded: 70, RotDeduc: 'INSS', saldo: 0, nom_empleado: 'ANA', ape_empleado: 'PEREZ', des_cargo: 'ANALISTA', numero_inss: '123', des_dependencia: 'TI', Dias_laborados: 15, fechaini: '01/09/2026', fechafin: '15/09/2026' }], { consecutive: 10, from: '01/09/2026', to: '15/09/2026', totalRecords: 1 });
  assert.match(html, /SALARIO &lt;BASE&gt;/);
  assert.match(html, /TOTAL INGRESOS: 1,000\.00/);
  assert.match(html, /INGRESO NETO: 930\.00/);
});
