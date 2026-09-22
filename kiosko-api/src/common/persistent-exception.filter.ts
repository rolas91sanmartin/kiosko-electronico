import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Response } from 'express';
import { PersistentLogService } from '../kiosk/persistent-log.service';

@Catch()
export class PersistentExceptionFilter implements ExceptionFilter {
  constructor(private readonly logs: PersistentLogService) {}
  catch(exception: unknown, host: ArgumentsHost) {
    const response = host.switchToHttp().getResponse<Response>();
    const status = exception instanceof HttpException ? exception.getStatus() : HttpStatus.INTERNAL_SERVER_ERROR;
    const detail = exception instanceof Error ? `${exception.name}: ${exception.message}` : String(exception);
    void this.logs.write('http.exception', detail, 'error').catch(() => undefined);
    const body = exception instanceof HttpException ? exception.getResponse() : { statusCode: status, message: 'Internal server error' };
    response.status(status).json(typeof body === 'string' ? { statusCode: status, message: body } : body);
  }
}
