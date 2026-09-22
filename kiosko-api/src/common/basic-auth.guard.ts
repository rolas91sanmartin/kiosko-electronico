import { CanActivate, ExecutionContext, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { createHash, timingSafeEqual } from 'node:crypto';
import type { Request, Response } from 'express';
import { ADMIN_ROLES_KEY, type AdminRole } from './roles.decorator';

export interface AuthenticatedAdmin { username: string; role: AdminRole }

function safeEqual(left: string, right: string) {
  const a = createHash('sha256').update(left).digest();
  const b = createHash('sha256').update(right).digest();
  return timingSafeEqual(a, b);
}

function decodeBasic(header?: string) {
  if (!header?.startsWith('Basic ')) return null;
  try {
    const decoded = Buffer.from(header.slice(6).trim(), 'base64').toString('utf8');
    const separator = decoded.indexOf(':');
    if (separator < 1) return null;
    return { username: decoded.slice(0, separator), password: decoded.slice(separator + 1) };
  } catch { return null; }
}

@Injectable()
export class BasicAuthGuard implements CanActivate {
  constructor(private readonly reflector: Reflector) {}

  canActivate(context: ExecutionContext) {
    const roles = this.reflector.getAllAndOverride<AdminRole[]>(ADMIN_ROLES_KEY, [context.getHandler(), context.getClass()]) || [];
    const request = context.switchToHttp().getRequest<Request & { admin?: AuthenticatedAdmin }>();
    const response = context.switchToHttp().getResponse<Response>();
    const supplied = decodeBasic(request.header('authorization'));
    const accounts: Array<AuthenticatedAdmin & { password?: string }> = [
      { role: 'RRHH', username: process.env.KIOSK_RRHH_USER || '', password: process.env.KIOSK_RRHH_PASSWORD },
      { role: 'TI_ADMIN', username: process.env.KIOSK_TI_ADMIN_USER || '', password: process.env.KIOSK_TI_ADMIN_PASSWORD }
    ];
    const account = accounts.find(item => item.username && item.password && item.password !== 'CAMBIAR_PASSWORD' && supplied && safeEqual(item.username, supplied.username) && safeEqual(item.password, supplied.password));
    if (!account || (roles.length && !roles.includes(account.role))) {
      response.setHeader('WWW-Authenticate', 'Basic realm="Kiosko API"');
      throw new UnauthorizedException('Usuario, contraseña incorrecto.');
    }
    request.admin = { username: account.username, role: account.role };
    return true;
  }
}
