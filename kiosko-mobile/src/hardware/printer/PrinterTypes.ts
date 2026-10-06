import type { Employee, PayrollEnvelopeRow, PayrollPeriod } from '../../domain/contracts';

export interface PrinterConfig { enabled: boolean; mode: 'local' | 'api' | 'auto'; vendorId: number | null; productId: number | null; paperWidth: 58 | 80; encoding: string; timeoutMs: number }
export interface ReceiptData { employee: Employee; period: PayrollPeriod; rows: PayrollEnvelopeRow[] }
export interface LocalPrintResult { printed: boolean; source: 'local' | 'api'; printerName: string; vendorId?: number; productId?: number }
export type ApiPrintFallback = () => Promise<{ printed: boolean; printerName: string }>;
