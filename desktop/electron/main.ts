import { app, BrowserWindow, dialog, ipcMain, net, protocol, session, shell } from 'electron';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { randomUUID } from 'node:crypto';
import { loadConfig, configurationStatus } from './config';
import { AttendanceService } from './application/attendance-service';
import { SqlServerAttendanceRepository } from './infrastructure/sql-server-attendance-repository';
import { PhotoEnrollmentService } from './application/photo-enrollment-service';
import { ElectronReceiptPrinter } from './infrastructure/electron-receipt-printer';
import type { Employee, MovementCode, PayrollPeriod, ReportFilters } from '../src/shared/contracts';

const singleInstance = app.requestSingleInstanceLock();
if (!singleInstance) app.quit();

protocol.registerSchemesAsPrivileged([{
  scheme: 'app',
  privileges: { standard: true, secure: true, supportFetchAPI: true, corsEnabled: true, stream: true }
}]);

let mainWindow: BrowserWindow | null = null;
const config = loadConfig();
const repository = new SqlServerAttendanceRepository(config);
const service = new AttendanceService(repository, config);
const photoEnrollmentService = new PhotoEnrollmentService(repository, config);
const receiptPrinter = new ElectronReceiptPrinter(config);
const photoAuthorizations = new Map<string, { employee: Employee; expiresAt: number }>();

function createWindow() {
  const iconName = 'app-icon.png';
  mainWindow = new BrowserWindow({
    title: 'Kiosko Electrónico',
    width: 1156,
    height: 690,
    minWidth: 900,
    minHeight: 600,
    show: false,
    autoHideMenuBar: true,
    icon: app.isPackaged
      ? path.join(process.resourcesPath, iconName)
      : path.join(process.cwd(), 'public', iconName),
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true
    }
  });
  mainWindow.maximize();
  mainWindow.once('ready-to-show', () => mainWindow?.show());
  if (!app.isPackaged) mainWindow.loadURL('http://localhost:5173');
  else mainWindow.loadURL('app://local/index.html');
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:/.test(url)) void shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  if (app.isPackaged) {
    const rendererRoot = path.resolve(__dirname, '..', '..', 'dist');
    protocol.handle('app', (request) => {
      const url = new URL(request.url);
      const relative = decodeURIComponent(url.pathname).replace(/^\/+/, '') || 'index.html';
      const target = path.resolve(rendererRoot, relative);
      if (target !== rendererRoot && !target.startsWith(`${rendererRoot}${path.sep}`)) {
        return new Response('Ruta no permitida', { status: 403 });
      }
      return net.fetch(pathToFileURL(target).toString());
    });
  }
  session.defaultSession.setPermissionCheckHandler((webContents, permission) =>
    permission === 'media' && webContents?.id === mainWindow?.webContents.id
  );
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) =>
    callback(permission === 'media' && webContents.id === mainWindow?.webContents.id)
  );
  createWindow();
});
app.on('window-all-closed', () => app.quit());
app.on('second-instance', () => {
  if (!mainWindow) return;
  if (mainWindow.isMinimized()) mainWindow.restore();
  mainWindow.focus();
});

ipcMain.handle('app:configuration-status', () => configurationStatus(config));
ipcMain.handle('attendance:lookup', (_event, barcode: string) => service.lookup(barcode));
ipcMain.handle('attendance:register', (_event, code: string, movement: MovementCode) => service.register(code, movement));
ipcMain.handle('payments:authenticate', (_event, barcode: string) => service.authenticateEmployee(barcode));
ipcMain.handle('payments:payrolls', (_event, page: number) => repository.paymentPayrolls(page));
ipcMain.handle('payments:envelope', (_event, employeeCode: string, consecutive: number) => repository.paymentEnvelope(employeeCode, consecutive));
ipcMain.handle('payments:print', async (_event, employeeCode: string, period: PayrollPeriod) => {
  if (!period || !Number.isInteger(period.consecutive) || period.consecutive <= 0) throw new Error('Planilla inválida.');
  const rows = await repository.paymentEnvelope(employeeCode, period.consecutive);
  return receiptPrinter.print(rows, period);
});
ipcMain.handle('photos:authenticate', async (_event, barcode: string) => {
  const employee = await service.authenticateEmployee(barcode);
  const token = randomUUID();
  photoAuthorizations.set(token, { employee, expiresAt: Date.now() + 2 * 60_000 });
  return { employee, token };
});
ipcMain.handle('photos:save', async (_event, token: string, imageDataUrl: string) => {
  const authorization = photoAuthorizations.get(token);
  photoAuthorizations.delete(token);
  if (!authorization || authorization.expiresAt < Date.now()) {
    throw new Error('La autorización venció. Escanee nuevamente el carnet.');
  }
  return photoEnrollmentService.save({ employee: authorization.employee, imageDataUrl });
});
ipcMain.handle('reports:payrolls', () => repository.payrolls());
ipcMain.handle('reports:dependencies', (_event, codes: string[]) => repository.dependencies(codes));
ipcMain.handle('reports:employees', (_event, filters: ReportFilters) => repository.employees(filters));
ipcMain.handle('reports:generate', (_event, filters: ReportFilters) => repository.report(filters));
ipcMain.handle('reports:export-pdf', async (_event, rows: Record<string, unknown>[]) => {
  const target = await dialog.showSaveDialog(mainWindow!, {
    title: 'Exportar PDF',
    defaultPath: 'Entrada-Salida-de-Empleados.pdf',
    filters: [{ name: 'PDF', extensions: ['pdf'] }]
  });
  if (target.canceled || !target.filePath) return { canceled: true };
  const reportWindow = new BrowserWindow({ show: false, webPreferences: { sandbox: true } });
  const columns = rows.length ? Object.keys(rows[0]) : [];
  const escape = (value: unknown) => String(value ?? '').replace(/[&<>\"]/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[char]!);
  const html = `<!doctype html><html><head><meta charset="utf-8"><style>body{font-family:"Times New Roman",serif;padding:18px;color:#111}h1{text-align:center;font-size:18px}table{border-collapse:collapse;width:100%;font-size:10px}th,td{border:1px solid #777;padding:4px;text-align:left}th{background:#eee}</style></head><body><h1>Entrada/Salida de Empleados</h1><table><thead><tr>${columns.map(c => `<th>${escape(c)}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${columns.map(c => `<td>${escape(row[c])}</td>`).join('')}</tr>`).join('')}</tbody></table></body></html>`;
  await reportWindow.loadURL(`data:text/html;charset=utf-8,${encodeURIComponent(html)}`);
  const pdf = await reportWindow.webContents.printToPDF({ pageSize: 'A4', printBackground: true, margins: { top: 0.4, bottom: 0.4, left: 0.4, right: 0.4 } });
  const fs = await import('node:fs/promises');
  await fs.writeFile(target.filePath, pdf);
  reportWindow.destroy();
  return { canceled: false, filePath: target.filePath };
});
