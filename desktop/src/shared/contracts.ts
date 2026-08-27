export type MovementCode = 1 | 2;
export type MovementKind = 'Entrada' | 'Salida';

export interface Employee {
  code: string;
  name: string;
  photoDataUrl: string | null;
  payrollCode: number;
}

export interface PhotoEnrollmentAuthorization {
  employee: Employee;
  token: string;
}

export interface PayrollPeriod {
  from: string;
  to: string;
  consecutive: number;
  totalRecords: number;
}

export interface PayrollEnvelopeRow extends Record<string, unknown> {
  cod_Empleado: number;
  valor: number | null;
  RotDeveng: string | null;
  Valoded: number | null;
  RotDeduc: string | null;
  saldo: number | null;
  nom_empleado: string;
  ape_empleado: string;
  des_cargo: string;
  numero_inss: string;
  des_dependencia: string;
  Dias_laborados: number;
  fechaini: string;
  fechafin: string;
}

export interface PayrollPage {
  periods: PayrollPeriod[];
  page: number;
  pageSize: number;
  totalRecords: number;
}

export interface ReceiptPrintResult {
  printed: boolean;
  printerName: string;
}

export interface AttendanceLookup {
  employee: Employee;
  nextMovement: MovementCode;
  nextMovementLabel: MovementKind;
}

export interface CatalogItem {
  code: string;
  description: string;
}

export interface ReportEmployee extends Record<string, unknown> {
  Codigo: string;
  Seleccionar?: boolean;
}

export interface ReportFilters {
  from: string;
  to: string;
  payrollCodes: string[];
  dependencyCodes: string[];
  employeeCodes?: string[];
  search?: string;
  includeExitTime?: boolean;
}

export interface ExportResult {
  canceled: boolean;
  filePath?: string;
}

export interface KioskApi {
  attendance: {
    lookup(barcode: string): Promise<AttendanceLookup>;
    register(employeeCode: string, movement: MovementCode): Promise<void>;
  };
  reports: {
    payrolls(): Promise<CatalogItem[]>;
    dependencies(payrollCodes: string[]): Promise<CatalogItem[]>;
    employees(filters: ReportFilters): Promise<ReportEmployee[]>;
    generate(filters: ReportFilters): Promise<Record<string, unknown>[]>;
    exportPdf(rows: Record<string, unknown>[]): Promise<ExportResult>;
  };
  payments: {
    authenticate(barcode: string): Promise<Employee>;
    payrolls(page: number): Promise<PayrollPage>;
    envelope(employeeCode: string, consecutive: number): Promise<PayrollEnvelopeRow[]>;
    print(employeeCode: string, period: PayrollPeriod): Promise<ReceiptPrintResult>;
  };
  photos: {
    authenticate(barcode: string): Promise<PhotoEnrollmentAuthorization>;
    save(token: string, imageDataUrl: string): Promise<Employee>;
  };
  app: {
    getConfigurationStatus(): Promise<{
      ready: boolean;
      message?: string;
      kiosk: {
        timezone: string;
        autoRegisterDelayMs: number;
        confirmationDurationMs: number;
        faceMatchThreshold: number;
        faceRequiredMatches: number;
      };
    }>;
  };
}
