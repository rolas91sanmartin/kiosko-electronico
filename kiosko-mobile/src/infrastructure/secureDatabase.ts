import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import * as SQLite from 'expo-sqlite';
import type { PayrollEnvelopeRow, PayrollPeriod } from '../domain/contracts';

const KEY_NAME = 'kiosko-sqlcipher-key-v1';
let database: SQLite.SQLiteDatabase | null = null;

async function databaseKey() {
  const stored = await SecureStore.getItemAsync(KEY_NAME);
  if (stored) return stored;
  const bytes = await Crypto.getRandomBytesAsync(32);
  const key = Array.from(bytes, byte => byte.toString(16).padStart(2, '0')).join('');
  await SecureStore.setItemAsync(KEY_NAME, key, { keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY });
  return key;
}

export async function initializeSecureDatabase() {
  if (database) return database;
  const key = await databaseKey();
  const db = await SQLite.openDatabaseAsync('kiosko-secure.db');
  await db.execAsync(`PRAGMA key = '${key}'; PRAGMA journal_mode = WAL; PRAGMA foreign_keys = ON;`);
  await db.execAsync(`
    CREATE TABLE IF NOT EXISTS diagnostic_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      at TEXT NOT NULL,
      level TEXT NOT NULL,
      event TEXT NOT NULL,
      detail TEXT
    );
    CREATE TABLE IF NOT EXISTS receipt_cache (
      id TEXT PRIMARY KEY NOT NULL,
      employee_code TEXT NOT NULL,
      consecutive INTEGER NOT NULL,
      period_json TEXT NOT NULL,
      rows_json TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );
  `);
  database = db;
  return db;
}

export async function logEvent(event: string, detail?: string, level: 'info' | 'error' = 'info') {
  try {
    const db = await initializeSecureDatabase();
    await db.runAsync('INSERT INTO diagnostic_logs (at, level, event, detail) VALUES (?, ?, ?, ?)', new Date().toISOString(), level, event, detail || null);
    await db.runAsync('DELETE FROM diagnostic_logs WHERE id NOT IN (SELECT id FROM diagnostic_logs ORDER BY id DESC LIMIT 1000)');
  } catch { /* Logging must never interrupt kiosk operation. */ }
}

export async function listLocalLogs() {
  const db = await initializeSecureDatabase();
  return db.getAllAsync<{ at: string; level: 'info' | 'error'; event: string; detail?: string }>('SELECT at, level, event, detail FROM diagnostic_logs ORDER BY id DESC LIMIT 300');
}

export async function cacheReceipt(employeeCode: string, period: PayrollPeriod, rows: PayrollEnvelopeRow[]) {
  const db = await initializeSecureDatabase();
  const id = `${employeeCode}:${period.consecutive}`;
  await db.runAsync('INSERT INTO receipt_cache (id, employee_code, consecutive, period_json, rows_json, updated_at) VALUES (?, ?, ?, ?, ?, ?) ON CONFLICT(id) DO UPDATE SET period_json=excluded.period_json, rows_json=excluded.rows_json, updated_at=excluded.updated_at', id, employeeCode, period.consecutive, JSON.stringify(period), JSON.stringify(rows), new Date().toISOString());
}
