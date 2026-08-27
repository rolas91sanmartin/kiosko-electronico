import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import type { AppConfig } from '../config';
import type { Employee } from '../../src/shared/contracts';
import { SqlServerAttendanceRepository } from '../infrastructure/sql-server-attendance-repository';

interface SavePhotoInput {
  employee: Employee;
  imageDataUrl: string;
}

async function fileExists(filePath: string) {
  try { await fs.access(filePath); return true; } catch { return false; }
}

export class PhotoEnrollmentService {
  constructor(
    private readonly repository: SqlServerAttendanceRepository,
    private readonly config: AppConfig
  ) {}

  async save({ employee, imageDataUrl }: SavePhotoInput): Promise<Employee> {
    if (!/^\d{4}$/.test(employee.code)) throw new Error('Código de empleado inválido.');
    if (!Number.isInteger(employee.payrollCode)) throw new Error('Código de nómina inválido.');

    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl);
    if (!match) throw new Error('La captura debe ser una imagen JPEG válida.');
    const bytes = Buffer.from(match[1], 'base64');
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) {
      throw new Error('El contenido recibido no es una fotografía JPEG válida.');
    }
    if (bytes.length > 10 * 1024 * 1024) throw new Error('La fotografía supera el tamaño máximo de 10 MB.');

    const directory = path.resolve(this.config.kiosk.photoDirectory);
    await fs.mkdir(directory, { recursive: true });
    const fileName = `${Number(employee.code)}.JPG`;
    const target = path.join(directory, fileName);
    const operationId = randomUUID();
    const temporary = path.join(directory, `.${fileName}.${operationId}.tmp`);
    const backup = path.join(directory, `.${fileName}.${operationId}.bak`);
    let originalMoved = false;
    let newPhotoInstalled = false;

    try {
      await fs.writeFile(temporary, bytes, { flag: 'wx' });
      if (await fileExists(target)) {
        await fs.rename(target, backup);
        originalMoved = true;
      }
      await fs.rename(temporary, target);
      newPhotoInstalled = true;
      await this.repository.updateEmployeePhoto(employee.payrollCode, employee.code, fileName);
    } catch (error) {
      if (newPhotoInstalled) await fs.rm(target, { force: true }).catch(() => undefined);
      if (originalMoved) await fs.rename(backup, target).catch(() => undefined);
      await fs.rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }

    if (originalMoved) await fs.rm(backup, { force: true }).catch(() => undefined);
    return { ...employee, photoDataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}` };
  }
}
