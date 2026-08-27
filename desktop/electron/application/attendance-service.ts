import fs from 'node:fs/promises';
import path from 'node:path';
import type { AppConfig } from '../config';
import type { AttendanceLookup, MovementCode } from '../../src/shared/contracts';
import { SqlServerAttendanceRepository } from '../infrastructure/sql-server-attendance-repository';

export class AttendanceService {
  constructor(
    private readonly repository: SqlServerAttendanceRepository,
    private readonly config: AppConfig
  ) {}

  private employeeCode(barcode: string): string {
    const normalized = barcode.trim();
    if (normalized.length < 5) throw new Error('El código de barra no tiene el formato esperado.');
    const code = normalized.substring(1, 5);
    if (!/^\d{4}$/.test(code)) throw new Error('El código de empleado no es válido.');
    return code;
  }

  async lookup(barcode: string): Promise<AttendanceLookup> {
    const code = this.employeeCode(barcode);
    const employee = await this.repository.findEmployee(code);
    if (!employee) throw new Error('Datos no encontrados');
    const lastMovement = await this.repository.lastMovement(code);
    const nextMovement: MovementCode = lastMovement === 1 ? 2 : 1;
    return {
      employee: { ...employee, photoDataUrl: await this.photo(code) },
      nextMovement,
      nextMovementLabel: nextMovement === 1 ? 'Entrada' : 'Salida'
    };
  }

  async authenticateEmployee(barcode: string) {
    const code = this.employeeCode(barcode);
    const employee = await this.repository.findEmployee(code);
    if (!employee) throw new Error('Empleado no encontrado');
    return { ...employee, photoDataUrl: await this.photo(code) };
  }

  register(code: string, movement: MovementCode): Promise<void> {
    if (!/^\d{4}$/.test(code)) throw new Error('Código de empleado inválido.');
    if (movement !== 1 && movement !== 2) throw new Error('Movimiento inválido.');
    return this.repository.register(code, movement);
  }

  private async photo(code: string): Promise<string | null> {
    try {
      const bytes = await fs.readFile(path.join(this.config.kiosk.photoDirectory, `${Number(code)}.jpg`));
      return `data:image/jpeg;base64,${bytes.toString('base64')}`;
    } catch {
      return null;
    }
  }
}
