import { Body, Controller, Get, Header, Param, ParseIntPipe, Post, Query, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { ApiSecurity, ApiTags } from '@nestjs/swagger';
import { ApiKeyGuard } from '../common/api-key.guard';
import { BasicAuthGuard, type AuthenticatedAdmin } from '../common/basic-auth.guard';
import { AdminRoles } from '../common/roles.decorator';
import { BarcodeDto, CodesDto, EmailReceiptDto, PayrollActionDto, PhotoSaveDto, RegisterDto, ReportFiltersDto } from './dto';
import { KioskService } from './kiosk.service';
import { SqlServerRepository } from './sql-server.repository';
import { MailService } from './mail.service';
import { PayrollTransferService } from './payroll-transfer.service';
import { PersistentLogService } from './persistent-log.service';
import { ReceiptPrinterService } from './receipt-printer.service';
import { faceEngineHtml } from './face-engine';

@Controller()
@UseGuards(ApiKeyGuard)
@ApiTags('Kiosko')
@ApiSecurity('api-key')
export class KioskController {
  constructor(
    private readonly service: KioskService,
    private readonly repository: SqlServerRepository,
    private readonly printer: ReceiptPrinterService,
    private readonly mail: MailService,
    private readonly transfers: PayrollTransferService,
    private readonly logs: PersistentLogService
  ) {}

  @Get('health') health() { return { ok: true, service: 'kiosko-api' }; }
  @Get('auth/rrhh') @UseGuards(BasicAuthGuard) @AdminRoles('RRHH') rrhhAuth(@Req() request: Request & { admin?: AuthenticatedAdmin }) { return { authenticated: true, role: request.admin!.role, username: request.admin!.username }; }
  @Get('auth/ti-admin') @UseGuards(BasicAuthGuard) @AdminRoles('TI_ADMIN') tiAdminAuth(@Req() request: Request & { admin?: AuthenticatedAdmin }) { return { authenticated: true, role: request.admin!.role, username: request.admin!.username }; }
  @Get('app/configuration-status') async configuration() {
    const databaseConfigured = Boolean(process.env.KIOSK_DB_PASSWORD && process.env.KIOSK_DB_PASSWORD !== 'CAMBIAR_PASSWORD');
    let ready = databaseConfigured;
    let message = databaseConfigured ? undefined : 'Configure KIOSK_DB_PASSWORD en la API.';
    if (databaseConfigured) {
      try { await this.repository.ping(); }
      catch { ready = false; message = 'SQL Server no está disponible desde Kiosko API. Revise red, servidor y credenciales.'; }
    }
    return { ready, message, kiosk: { timezone: process.env.KIOSK_TIMEZONE || 'America/Guatemala', autoRegisterDelayMs: Number(process.env.KIOSK_AUTO_DELAY_MS || 250), confirmationDurationMs: Number(process.env.KIOSK_CONFIRMATION_MS || 1500), faceMatchThreshold: Number(process.env.KIOSK_FACE_THRESHOLD || .52), faceRequiredMatches: Number(process.env.KIOSK_FACE_REQUIRED_MATCHES || 3), receiptPrinterName: process.env.KIOSK_RECEIPT_PRINTER || 'EPSON TM-U220II Receipt', emailEnabled: Boolean(process.env.KIOSK_SMTP_HOST) } };
  }
  @Post('attendance/lookup') lookup(@Body() dto: BarcodeDto) { return this.service.attendanceLookup(dto.barcode); }
  @Post('attendance/register') async register(@Body() dto: RegisterDto) { await this.repository.register(dto.employeeCode, dto.movement); return { ok: true }; }
  @Post('payments/authenticate') authenticate(@Body() dto: BarcodeDto) { return this.service.employee(dto.barcode); }
  @Get('payments/payrolls') payrolls(@Query('page', new ParseIntPipe({ optional: true })) page = 1) { return this.repository.paymentPayrolls(page); }
  @Get('payments/:employeeCode/:consecutive/envelope') envelope(@Param('employeeCode') employeeCode: string, @Param('consecutive', ParseIntPipe) consecutive: number) { return this.repository.paymentEnvelope(employeeCode, consecutive); }
  @Post('payments/:employeeCode/:consecutive/print') async print(@Param('employeeCode') employeeCode: string, @Param('consecutive', ParseIntPipe) consecutive: number, @Body() dto: PayrollActionDto) {
    const rows = await this.repository.paymentEnvelope(employeeCode, consecutive);
    const result = await this.printer.print(rows, { consecutive, from: dto.from, to: dto.to, totalRecords: 1 });
    await this.logs.write('payment.print', `${employeeCode}:${consecutive}`);
    return result;
  }
  @Post('payments/:employeeCode/:consecutive/email') async email(@Param('employeeCode') employeeCode: string, @Param('consecutive', ParseIntPipe) consecutive: number, @Body() dto: EmailReceiptDto) {
    const rows = await this.repository.paymentEnvelope(employeeCode, consecutive);
    const result = await this.mail.sendReceipt(dto.email, rows, { consecutive, from: dto.from, to: dto.to, totalRecords: 1 });
    await this.logs.write('payment.email', `${employeeCode}:${consecutive}:${dto.email}`);
    return result;
  }
  @Post('payments/:employeeCode/:consecutive/transfer') async transfer(@Param('employeeCode') employeeCode: string, @Param('consecutive', ParseIntPipe) consecutive: number, @Body() dto: PayrollActionDto) {
    const [employee, rows] = await Promise.all([this.service.employeeByCode(employeeCode), this.repository.paymentEnvelope(employeeCode, consecutive)]);
    return this.transfers.create(employee, { consecutive, from: dto.from, to: dto.to, totalRecords: 1 }, rows);
  }
  @Post('photos/authenticate') photoAuth(@Body() dto: BarcodeDto) { return this.service.authorizePhoto(dto.barcode); }
  @Post('photos/save') photoSave(@Body() dto: PhotoSaveDto) { return this.service.savePhoto(dto.token, dto.imageDataUrl); }
  @Get('reports/payrolls') @UseGuards(BasicAuthGuard) @AdminRoles('RRHH') reportPayrolls() { return this.repository.payrolls(); }
  @Post('reports/dependencies') @UseGuards(BasicAuthGuard) @AdminRoles('RRHH') dependencies(@Body() dto: CodesDto) { return this.repository.dependencies(dto.codes); }
  @Post('reports/employees') @UseGuards(BasicAuthGuard) @AdminRoles('RRHH') employees(@Body() dto: ReportFiltersDto) { return this.repository.employees(dto); }
  @Post('reports/generate') @UseGuards(BasicAuthGuard) @AdminRoles('RRHH') report(@Body() dto: ReportFiltersDto) { return this.repository.report(dto); }
  @Get('logs') @UseGuards(BasicAuthGuard) @AdminRoles('TI_ADMIN') logsList(@Query('limit', new ParseIntPipe({ optional: true })) limit = 200) { return this.logs.recent(limit); }
  @Get('face/engine') @Header('content-type', 'text/html; charset=utf-8') faceEngine() { return faceEngineHtml; }
}
