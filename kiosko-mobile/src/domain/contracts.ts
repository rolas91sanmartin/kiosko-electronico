export type MovementCode = 1 | 2;
export type MovementKind = 'Entrada' | 'Salida';
export type AdminRole = 'RRHH' | 'TI_ADMIN';
export interface AdminSession { authenticated: true; role: AdminRole; username: string }
export interface Employee { code: string; name: string; photoDataUrl: string | null; payrollCode: number }
export interface AttendanceLookup { employee: Employee; nextMovement: MovementCode; nextMovementLabel: MovementKind }
export interface PhotoEnrollmentAuthorization { employee: Employee; token: string }
export interface PayrollPeriod { from: string; to: string; consecutive: number; totalRecords: number }
export interface PayrollPage { periods: PayrollPeriod[]; page: number; pageSize: number; totalRecords: number }
export interface PayrollEnvelopeRow extends Record<string, unknown> {
  cod_Empleado: number; valor: number | null; RotDeveng: string | null; Valoded: number | null;
  RotDeduc: string | null; saldo: number | null; nom_empleado: string; ape_empleado: string;
  des_cargo: string; numero_inss: string; des_dependencia: string; Dias_laborados: number;
  fechaini: string; fechafin: string;
}
export interface CatalogItem { code: string; description: string }
export interface ReportEmployee extends Record<string, unknown> { Codigo: string; Seleccionar?: boolean }
export interface ReportFilters { from: string; to: string; payrollCodes: string[]; dependencyCodes: string[]; employeeCodes?: string[]; search?: string; includeExitTime?: boolean }
export interface AppStatus { ready: boolean; message?: string; kiosk: { timezone: string; autoRegisterDelayMs: number; confirmationDurationMs: number; faceMatchThreshold: number; faceRequiredMatches: number; receiptPrinterName: string; emailEnabled: boolean } }
export interface ReceiptPrintResult { printed: boolean; printerName: string }
export interface SignedPayrollTransfer { version: 1; algorithm: 'Ed25519'; keyId: string; payload: string; signature: string; publicKey: string; barcodeDataUrl: string }
export interface DiagnosticLog { at: string; source: 'mobile' | 'api'; level: 'info' | 'error'; event: string; detail?: string }
