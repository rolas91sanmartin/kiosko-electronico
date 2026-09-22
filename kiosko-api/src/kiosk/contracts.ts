export type MovementCode = 1 | 2;
export interface Employee { code: string; name: string; photoDataUrl: string | null; payrollCode: number }
export interface PayrollPeriod { from: string; to: string; consecutive: number; totalRecords: number }
export interface PayrollEnvelopeRow extends Record<string, unknown> {
  cod_Empleado: number; valor: number | null; RotDeveng: string | null; Valoded: number | null;
  RotDeduc: string | null; saldo: number | null; nom_empleado: string; ape_empleado: string;
  des_cargo: string; numero_inss: string; des_dependencia: string; Dias_laborados: number;
  fechaini: string; fechafin: string;
}
export interface ReportFilters {
  from: string; to: string; payrollCodes: string[]; dependencyCodes: string[];
  employeeCodes?: string[]; search?: string; includeExitTime?: boolean;
}
export interface ReceiptPrintResult { printed: boolean; printerName: string }
export interface SignedPayrollTransfer {
  version: 1;
  algorithm: 'Ed25519';
  keyId: string;
  payload: string;
  signature: string;
  publicKey: string;
  barcodeDataUrl: string;
}
