import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { ApiKeyGuard } from './common/api-key.guard';
import { BasicAuthGuard } from './common/basic-auth.guard';
import { KioskController } from './kiosk/kiosk.controller';
import { KioskService } from './kiosk/kiosk.service';
import { PhotoService } from './kiosk/photo.service';
import { SqlServerRepository } from './kiosk/sql-server.repository';
import { MailService } from './kiosk/mail.service';
import { PayrollTransferService } from './kiosk/payroll-transfer.service';
import { PersistentLogService } from './kiosk/persistent-log.service';
import { ReceiptPrinterService } from './kiosk/receipt-printer.service';

@Module({
  imports: [ConfigModule.forRoot({ isGlobal: true })],
  controllers: [KioskController],
  providers: [ApiKeyGuard, BasicAuthGuard, KioskService, PhotoService, SqlServerRepository, MailService, PayrollTransferService, PersistentLogService, ReceiptPrinterService]
})
export class AppModule {}
