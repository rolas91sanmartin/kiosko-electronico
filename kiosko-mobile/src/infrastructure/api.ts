import type { AdminRole, AdminSession, AppStatus, AttendanceLookup, CatalogItem, DiagnosticLog, Employee, MovementCode, PayrollEnvelopeRow, PayrollPage, PhotoEnrollmentAuthorization, ReceiptPrintResult, ReportEmployee, ReportFilters, SignedPayrollTransfer } from '../domain/contracts';
import { loadSettings } from './settings';
import { logEvent } from './secureDatabase';

let adminAuthorization: string | null = null;

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const { apiUrl, apiKey } = await loadSettings();
  const started = Date.now();
  try {
    const response = await fetch(`${apiUrl}${path}`, { ...init, headers: { 'content-type': 'application/json', ...(apiKey ? { 'x-api-key': apiKey } : {}), ...(adminAuthorization ? { authorization: adminAuthorization } : {}), ...init.headers } });
    const body = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(Array.isArray(body.message) ? body.message.join('. ') : body.message || `Error HTTP ${response.status}`);
    void logEvent('api.request', `${init.method || 'GET'} ${path} ${response.status} ${Date.now() - started}ms`);
    return body as T;
  } catch (error) {
    void logEvent('api.error', `${init.method || 'GET'} ${path}: ${error instanceof Error ? error.message : String(error)}`, 'error');
    throw error;
  }
}
const post = <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) });

export const kioskApi = {
  health: () => request<{ ok: boolean }>('/health'),
  auth: {
    login: async (username: string, password: string, role: AdminRole) => {
      const authorization = `Basic ${btoa(`${username}:${password}`)}`;
      const path = role === 'RRHH' ? '/auth/rrhh' : '/auth/ti-admin';
      const session = await request<AdminSession>(path, { headers: { authorization } });
      adminAuthorization = authorization;
      return session;
    },
    clear: () => { adminAuthorization = null; }
  },
  app: { status: () => request<AppStatus>('/app/configuration-status') },
  attendance: {
    lookup: (barcode: string) => post<AttendanceLookup>('/attendance/lookup', { barcode }),
    register: (employeeCode: string, movement: MovementCode) => post<{ ok: boolean }>('/attendance/register', { employeeCode, movement })
  },
  payments: {
    authenticate: (barcode: string) => post<Employee>('/payments/authenticate', { barcode }),
    payrolls: (page: number) => request<PayrollPage>(`/payments/payrolls?page=${page}`),
    envelope: (employeeCode: string, payrollCode: number, consecutive: number) => request<PayrollEnvelopeRow[]>(`/payments/${encodeURIComponent(employeeCode)}/${payrollCode}/${consecutive}/envelope`),
    print: (employeeCode: string, payrollCode: number, period: { consecutive: number; from: string; to: string }) => post<ReceiptPrintResult>(`/payments/${encodeURIComponent(employeeCode)}/${payrollCode}/${period.consecutive}/print`, { from: period.from, to: period.to }),
    email: (employeeCode: string, payrollCode: number, period: { consecutive: number; from: string; to: string }, email: string) => post<{ sent: boolean; messageId: string }>(`/payments/${encodeURIComponent(employeeCode)}/${payrollCode}/${period.consecutive}/email`, { email, from: period.from, to: period.to }),
    transfer: (employeeCode: string, payrollCode: number, period: { consecutive: number; from: string; to: string }) => post<SignedPayrollTransfer>(`/payments/${encodeURIComponent(employeeCode)}/${payrollCode}/${period.consecutive}/transfer`, { from: period.from, to: period.to })
  },
  photos: {
    authenticate: (barcode: string) => post<PhotoEnrollmentAuthorization>('/photos/authenticate', { barcode }),
    save: (token: string, imageDataUrl: string) => post<Employee>('/photos/save', { token, imageDataUrl })
  },
  reports: {
    payrolls: () => request<CatalogItem[]>('/reports/payrolls'),
    dependencies: (codes: string[]) => post<CatalogItem[]>('/reports/dependencies', { codes }),
    employees: (filters: ReportFilters) => post<ReportEmployee[]>('/reports/employees', filters),
    generate: (filters: ReportFilters) => post<Record<string, unknown>[]>('/reports/generate', filters)
  },
  logs: { recent: () => request<Array<Omit<DiagnosticLog, 'source'>>>('/logs?limit=200') }
};
