import type { SQLiteDatabase } from 'expo-sqlite';
import type { PayrollTransferEnvelope, StoredEnvelope } from '../domain/payroll';

interface EnvelopeRow {
  id: string; consecutive: number; date_from: string; date_to: string;
  employee_code: string; employee_name: string; payload: string; scanned_at: string;
}

export async function initializeDatabase(db: SQLiteDatabase) {
  await db.execAsync(`
    PRAGMA journal_mode = WAL;
    CREATE TABLE IF NOT EXISTS payroll_envelopes (
      id TEXT PRIMARY KEY NOT NULL,
      consecutive INTEGER NOT NULL,
      date_from TEXT NOT NULL,
      date_to TEXT NOT NULL,
      employee_code TEXT NOT NULL,
      employee_name TEXT NOT NULL,
      payload TEXT NOT NULL,
      checksum TEXT NOT NULL,
      scanned_at TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_payroll_envelopes_scanned_at ON payroll_envelopes(scanned_at DESC);
  `);
}

export async function saveEnvelope(db: SQLiteDatabase, envelope: PayrollTransferEnvelope, checksum: string) {
  const id = `${envelope.employee.code}:${envelope.payroll.consecutive}:${envelope.payroll.from}:${envelope.payroll.to}`;
  const scannedAt = new Date().toISOString();
  await db.runAsync(
    `INSERT INTO payroll_envelopes
      (id, consecutive, date_from, date_to, employee_code, employee_name, payload, checksum, scanned_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
     ON CONFLICT(id) DO UPDATE SET payload = excluded.payload, checksum = excluded.checksum, scanned_at = excluded.scanned_at`,
    id, envelope.payroll.consecutive, envelope.payroll.from, envelope.payroll.to,
    envelope.employee.code, envelope.employee.name, JSON.stringify(envelope), checksum, scannedAt
  );
  return id;
}

function mapRow(row: EnvelopeRow): StoredEnvelope {
  return {
    id: row.id, consecutive: row.consecutive, dateFrom: row.date_from, dateTo: row.date_to,
    employeeCode: row.employee_code, employeeName: row.employee_name,
    envelope: JSON.parse(row.payload) as PayrollTransferEnvelope, scannedAt: row.scanned_at
  };
}

export async function listEnvelopes(db: SQLiteDatabase) {
  const rows = await db.getAllAsync<EnvelopeRow>('SELECT * FROM payroll_envelopes ORDER BY scanned_at DESC');
  return rows.map(mapRow);
}

export async function deleteEnvelope(db: SQLiteDatabase, id: string) {
  await db.runAsync('DELETE FROM payroll_envelopes WHERE id = ?', id);
}
