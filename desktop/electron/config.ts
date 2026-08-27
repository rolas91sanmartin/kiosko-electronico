import fs from 'node:fs';
import path from 'node:path';
import { app } from 'electron';

export interface AppConfig {
  database: {
    server: string;
    database: string;
    user: string;
    password: string;
    port: number;
    encrypt: boolean;
    trustServerCertificate: boolean;
  };
  kiosk: {
    pcId: number;
    photoDirectory: string;
    timezone: string;
    autoRegisterDelayMs: number;
    confirmationDurationMs: number;
    faceMatchThreshold: number;
    faceRequiredMatches: number;
    receiptPrinterName: string;
    receiptPrinterModel: string;
    receiptPaperWidthMm: number;
    receiptSilentPrint: boolean;
    receiptRawCutPaper: boolean;
  };
}

const defaults: AppConfig = {
  database: {
    server: process.env.KIOSK_DB_SERVER ?? '170.0.1.247',
    database: process.env.KIOSK_DB_NAME ?? 'RRHH',
    user: process.env.KIOSK_DB_USER ?? 'sa',
    password: process.env.KIOSK_DB_PASSWORD ?? '',
    port: Number(process.env.KIOSK_DB_PORT ?? 1433),
    encrypt: process.env.KIOSK_DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.KIOSK_DB_TRUST_CERT !== 'false'
  },
  kiosk: {
    pcId: Number(process.env.KIOSK_PC_ID ?? 1),
    photoDirectory: process.env.KIOSK_PHOTO_DIRECTORY ?? '\\\\192.168.2.100\\Sys\\Usuarios\\Nomina\\FOTOS\\Empleados',
    timezone: process.env.KIOSK_TIMEZONE ?? 'America/Guatemala',
    autoRegisterDelayMs: Number(process.env.KIOSK_AUTO_DELAY_MS ?? 250),
    confirmationDurationMs: Number(process.env.KIOSK_CONFIRMATION_MS ?? 1500),
    faceMatchThreshold: Number(process.env.KIOSK_FACE_THRESHOLD ?? 0.52),
    faceRequiredMatches: Number(process.env.KIOSK_FACE_REQUIRED_MATCHES ?? 3),
    receiptPrinterName: process.env.KIOSK_RECEIPT_PRINTER ?? 'EPSON TM-U220II Receipt',
    receiptPrinterModel: process.env.KIOSK_RECEIPT_MODEL ?? 'TM-U220',
    receiptPaperWidthMm: Number(process.env.KIOSK_RECEIPT_WIDTH_MM ?? 76),
    receiptSilentPrint: process.env.KIOSK_RECEIPT_SILENT !== 'false',
    receiptRawCutPaper: process.env.KIOSK_RECEIPT_RAW_CUT !== 'false'
  }
};

function candidateFiles(): string[] {
  const paths = [
    path.join(process.cwd(), 'config', 'kiosk.config.json'),
    path.join(path.dirname(app.getPath('exe')), 'kiosk.config.json'),
    path.join(process.resourcesPath, 'kiosk.config.json'),
    path.join(app.getPath('userData'), 'kiosk.config.json')
  ];
  return [...new Set(paths)];
}

export function loadConfig(): AppConfig {
  const file = candidateFiles().find(fs.existsSync);
  if (!file) return defaults;
  const parsed = JSON.parse(fs.readFileSync(file, 'utf8')) as Partial<AppConfig>;
  const merged: AppConfig = {
    database: { ...defaults.database, ...parsed.database },
    kiosk: { ...defaults.kiosk, ...parsed.kiosk }
  };
  if (process.env.KIOSK_DB_SERVER) merged.database.server = process.env.KIOSK_DB_SERVER;
  if (process.env.KIOSK_DB_NAME) merged.database.database = process.env.KIOSK_DB_NAME;
  if (process.env.KIOSK_DB_USER) merged.database.user = process.env.KIOSK_DB_USER;
  if (process.env.KIOSK_DB_PASSWORD) merged.database.password = process.env.KIOSK_DB_PASSWORD;
  if (process.env.KIOSK_DB_PORT) merged.database.port = Number(process.env.KIOSK_DB_PORT);
  if (process.env.KIOSK_PC_ID) merged.kiosk.pcId = Number(process.env.KIOSK_PC_ID);
  if (process.env.KIOSK_PHOTO_DIRECTORY) merged.kiosk.photoDirectory = process.env.KIOSK_PHOTO_DIRECTORY;
  if (process.env.KIOSK_TIMEZONE) merged.kiosk.timezone = process.env.KIOSK_TIMEZONE;
  if (process.env.KIOSK_RECEIPT_PRINTER) merged.kiosk.receiptPrinterName = process.env.KIOSK_RECEIPT_PRINTER;
  if (process.env.KIOSK_RECEIPT_MODEL) merged.kiosk.receiptPrinterModel = process.env.KIOSK_RECEIPT_MODEL;
  return merged;
}

export function configurationStatus(config: AppConfig) {
  const kiosk = {
    timezone: config.kiosk.timezone,
    autoRegisterDelayMs: config.kiosk.autoRegisterDelayMs,
    confirmationDurationMs: config.kiosk.confirmationDurationMs,
    faceMatchThreshold: config.kiosk.faceMatchThreshold,
    faceRequiredMatches: config.kiosk.faceRequiredMatches
  };
  if (!config.database.password || config.database.password === 'CAMBIAR_PASSWORD') {
    return {
      ready: false,
      message: 'Configure la contraseña de la base de datos en config/kiosk.config.json.',
      kiosk
    };
  }
  return { ready: true, kiosk };
}
