import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import type { Request } from 'express';

@Injectable()
export class ApiKeyGuard implements CanActivate {
  canActivate(context: ExecutionContext) {
    const expected = process.env.KIOSK_API_KEY?.trim();
    if (!expected || expected === 'CAMBIAR_API_KEY') return true;
    const request = context.switchToHttp().getRequest<Request>();
    if (request.header('x-api-key') !== expected) throw new UnauthorizedException('Clave de API inválida.');
    return true;
  }
}
