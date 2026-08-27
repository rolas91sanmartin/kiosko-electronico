export interface PayrollTransferEnvelope {
  v: 1;
  payroll: { consecutive: number; from: string; to: string; receiptNumber: number };
  employee: {
    code: string;
    name: string;
    socialSecurityNumber: string;
    role: string;
    area: string;
    workedDays: number;
  };
  incomes: Array<{ label: string; amount: number }>;
  deductions: Array<{ label: string; amount: number }>;
  debtBalance: number;
}

export interface StoredEnvelope {
  id: string;
  consecutive: number;
  dateFrom: string;
  dateTo: string;
  employeeCode: string;
  employeeName: string;
  envelope: PayrollTransferEnvelope;
  scannedAt: string;
}
