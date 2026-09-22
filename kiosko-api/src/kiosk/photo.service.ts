import { BadRequestException, Injectable } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import * as fs from 'node:fs/promises';
import * as path from 'node:path';
import type { Employee } from './contracts';
import { SqlServerRepository } from './sql-server.repository';

async function exists(file: string) { try { await fs.access(file); return true; } catch { return false; } }

@Injectable()
export class PhotoService {
  constructor(private readonly repository: SqlServerRepository) {}
  private directory() { return path.resolve(process.env.KIOSK_PHOTO_DIRECTORY || './photos'); }

  async read(code: string) {
    const candidates = [`${Number(code)}.JPG`, `${Number(code)}.jpg`];
    for (const candidate of candidates) {
      try { const bytes = await fs.readFile(path.join(this.directory(), candidate)); return `data:image/jpeg;base64,${bytes.toString('base64')}`; } catch { /* next */ }
    }
    return null;
  }

  async save(employee: Employee, imageDataUrl: string): Promise<Employee> {
    const match = /^data:image\/jpeg;base64,([A-Za-z0-9+/=]+)$/.exec(imageDataUrl);
    if (!match) throw new BadRequestException('La captura debe ser una imagen JPEG válida.');
    const bytes = Buffer.from(match[1], 'base64');
    if (bytes.length < 4 || bytes[0] !== 0xff || bytes[1] !== 0xd8 || bytes[2] !== 0xff) throw new BadRequestException('La fotografía JPEG no es válida.');
    if (bytes.length > 10 * 1024 * 1024) throw new BadRequestException('La fotografía supera el máximo de 10 MB.');
    const directory = this.directory();
    await fs.mkdir(directory, { recursive: true });
    const fileName = `${Number(employee.code)}.JPG`;
    const target = path.join(directory, fileName);
    const id = randomUUID();
    const temporary = path.join(directory, `.${fileName}.${id}.tmp`);
    const backup = path.join(directory, `.${fileName}.${id}.bak`);
    let originalMoved = false;
    let installed = false;
    try {
      await fs.writeFile(temporary, bytes, { flag: 'wx' });
      if (await exists(target)) { await fs.rename(target, backup); originalMoved = true; }
      await fs.rename(temporary, target); installed = true;
      await this.repository.updateEmployeePhoto(employee.payrollCode, employee.code, fileName);
    } catch (error) {
      if (installed) await fs.rm(target, { force: true }).catch(() => undefined);
      if (originalMoved) await fs.rename(backup, target).catch(() => undefined);
      await fs.rm(temporary, { force: true }).catch(() => undefined);
      throw error;
    }
    if (originalMoved) await fs.rm(backup, { force: true }).catch(() => undefined);
    return { ...employee, photoDataUrl: `data:image/jpeg;base64,${bytes.toString('base64')}` };
  }
}
