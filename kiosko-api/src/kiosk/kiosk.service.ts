import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import type { Employee, MovementCode } from './contracts';
import { PhotoService } from './photo.service';
import { SqlServerRepository } from './sql-server.repository';

@Injectable()
export class KioskService {
  private readonly authorizations = new Map<string, { employee: Employee; expiresAt: number }>();
  constructor(private readonly repository: SqlServerRepository, private readonly photos: PhotoService) {}

  employeeCode(barcode: string) {
    const normalized = barcode.trim();
    if (normalized.length < 5) throw new BadRequestException('El código de barra no tiene el formato esperado.');
    const code = normalized.substring(1, 5);
    if (!/^\d{4}$/.test(code)) throw new BadRequestException('El código de empleado no es válido.');
    return code;
  }

  async employee(barcode: string): Promise<Employee> {
    const code = this.employeeCode(barcode);
    return this.employeeByCode(code);
  }

  async employeeByCode(code: string): Promise<Employee> {
    const employee = await this.repository.findEmployee(code);
    if (!employee) throw new NotFoundException('Empleado no encontrado');
    return { ...employee, photoDataUrl: await this.photos.read(code) };
  }

  async attendanceLookup(barcode: string) {
    const employee = await this.employee(barcode);
    const lastMovement = await this.repository.lastMovement(employee.code);
    const nextMovement: MovementCode = lastMovement === 1 ? 2 : 1;
    return { employee, nextMovement, nextMovementLabel: nextMovement === 1 ? 'Entrada' : 'Salida' };
  }

  async authorizePhoto(barcode: string) {
    const employee = await this.employee(barcode);
    const token = randomUUID();
    this.authorizations.set(token, { employee, expiresAt: Date.now() + 2 * 60_000 });
    return { employee, token };
  }

  async savePhoto(token: string, imageDataUrl: string) {
    const authorization = this.authorizations.get(token);
    this.authorizations.delete(token);
    if (!authorization || authorization.expiresAt < Date.now()) throw new BadRequestException('La autorización venció. Escanee nuevamente el carnet.');
    return this.photos.save(authorization.employee, imageDataUrl);
  }
}
