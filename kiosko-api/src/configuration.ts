import * as fs from 'node:fs';
import * as path from 'node:path';

type Section = Record<string, unknown>;
interface JsonConfiguration { database?: Section; kiosk?: Section; api?: Section; auth?: Section; smtp?: Section }

const mappings: Array<[keyof JsonConfiguration, string, string]> = [
  ['database', 'server', 'KIOSK_DB_SERVER'], ['database', 'database', 'KIOSK_DB_NAME'], ['database', 'user', 'KIOSK_DB_USER'], ['database', 'password', 'KIOSK_DB_PASSWORD'], ['database', 'port', 'KIOSK_DB_PORT'], ['database', 'encrypt', 'KIOSK_DB_ENCRYPT'], ['database', 'trustServerCertificate', 'KIOSK_DB_TRUST_CERT'],
  ['kiosk', 'pcId', 'KIOSK_PC_ID'], ['kiosk', 'photoDirectory', 'KIOSK_PHOTO_DIRECTORY'], ['kiosk', 'timezone', 'KIOSK_TIMEZONE'], ['kiosk', 'autoRegisterDelayMs', 'KIOSK_AUTO_DELAY_MS'], ['kiosk', 'confirmationDurationMs', 'KIOSK_CONFIRMATION_MS'], ['kiosk', 'faceMatchThreshold', 'KIOSK_FACE_THRESHOLD'], ['kiosk', 'faceRequiredMatches', 'KIOSK_FACE_REQUIRED_MATCHES'], ['kiosk', 'receiptPrinterName', 'KIOSK_RECEIPT_PRINTER'], ['kiosk', 'receiptPrinterModel', 'KIOSK_RECEIPT_MODEL'], ['kiosk', 'receiptPaperWidthMm', 'KIOSK_RECEIPT_WIDTH_MM'], ['kiosk', 'receiptRawCutPaper', 'KIOSK_RECEIPT_RAW_CUT'],
  ['api', 'apiKey', 'KIOSK_API_KEY'],
  ['auth', 'rrhhUser', 'KIOSK_RRHH_USER'], ['auth', 'rrhhPassword', 'KIOSK_RRHH_PASSWORD'], ['auth', 'tiAdminUser', 'KIOSK_TI_ADMIN_USER'], ['auth', 'tiAdminPassword', 'KIOSK_TI_ADMIN_PASSWORD'],
  ['smtp', 'host', 'KIOSK_SMTP_HOST'], ['smtp', 'port', 'KIOSK_SMTP_PORT'], ['smtp', 'secure', 'KIOSK_SMTP_SECURE'], ['smtp', 'user', 'KIOSK_SMTP_USER'], ['smtp', 'password', 'KIOSK_SMTP_PASSWORD'], ['smtp', 'from', 'KIOSK_SMTP_FROM']
];

export function loadJsonConfiguration() {
  const candidate = process.env.KIOSK_CONFIG_FILE || path.resolve(process.cwd(), 'config', 'kiosk.config.json');
  if (!fs.existsSync(candidate)) return;
  const parsed = JSON.parse(fs.readFileSync(candidate, 'utf8')) as JsonConfiguration;
  for (const [section, property, environment] of mappings) {
    if (process.env[environment] !== undefined) continue;
    const value = parsed[section]?.[property];
    if (value !== undefined && value !== null) process.env[environment] = String(value);
  }
}

export function validateProductionConfiguration() {
  if (process.env.NODE_ENV !== 'production') return;
  const required = ['KIOSK_API_KEY', 'KIOSK_DB_SERVER', 'KIOSK_DB_NAME', 'KIOSK_DB_USER', 'KIOSK_DB_PASSWORD'];
  const missing = required.filter(name => {
    const value = process.env[name]?.trim();
    return !value || value.startsWith('CAMBIAR_');
  });
  if (missing.length) throw new Error(`Configure las variables de producción: ${missing.join(', ')}`);
}
