import { contextBridge, ipcRenderer } from 'electron';
import type { KioskApi } from '../src/shared/contracts';

const api: KioskApi = {
  attendance: {
    lookup: (barcode) => ipcRenderer.invoke('attendance:lookup', barcode),
    register: (employeeCode, movement) => ipcRenderer.invoke('attendance:register', employeeCode, movement)
  },
  reports: {
    payrolls: () => ipcRenderer.invoke('reports:payrolls'),
    dependencies: (payrollCodes) => ipcRenderer.invoke('reports:dependencies', payrollCodes),
    employees: (filters) => ipcRenderer.invoke('reports:employees', filters),
    generate: (filters) => ipcRenderer.invoke('reports:generate', filters),
    exportPdf: (rows) => ipcRenderer.invoke('reports:export-pdf', rows)
  },
  payments: {
    authenticate: (barcode) => ipcRenderer.invoke('payments:authenticate', barcode),
    payrolls: (page) => ipcRenderer.invoke('payments:payrolls', page),
    envelope: (employeeCode, consecutive) => ipcRenderer.invoke('payments:envelope', employeeCode, consecutive),
    print: (employeeCode, period) => ipcRenderer.invoke('payments:print', employeeCode, period)
  },
  photos: {
    authenticate: (barcode) => ipcRenderer.invoke('photos:authenticate', barcode),
    save: (token, imageDataUrl) => ipcRenderer.invoke('photos:save', token, imageDataUrl)
  },
  app: {
    getConfigurationStatus: () => ipcRenderer.invoke('app:configuration-status')
  }
};

contextBridge.exposeInMainWorld('kiosk', api);
