import assert from 'node:assert/strict';
import test from 'node:test';
import type { ExecutionContext } from '@nestjs/common';
import { BasicAuthGuard } from '../src/common/basic-auth.guard';
import type { AdminRole } from '../src/common/roles.decorator';

function context(username: string, password: string) {
  const request: { admin?: unknown; header(name: string): string | undefined } = { header: name => name === 'authorization' ? `Basic ${Buffer.from(`${username}:${password}`).toString('base64')}` : undefined };
  const response = { setHeader() {} };
  return { request, value: { switchToHttp: () => ({ getRequest: () => request, getResponse: () => response }), getHandler: () => null, getClass: () => null } as unknown as ExecutionContext };
}

function guard(role: AdminRole) {
  return new BasicAuthGuard({ getAllAndOverride: () => [role] } as never);
}

test.before(() => {
  process.env.KIOSK_RRHH_USER = 'rrhh-test';
  process.env.KIOSK_RRHH_PASSWORD = 'rrhh-secret';
  process.env.KIOSK_TI_ADMIN_USER = 'ti-test';
  process.env.KIOSK_TI_ADMIN_PASSWORD = 'ti-secret';
});

test('acepta credenciales Basic del rol requerido', () => {
  const mock = context('rrhh-test', 'rrhh-secret');
  assert.equal(guard('RRHH').canActivate(mock.value), true);
  assert.deepEqual(mock.request.admin, { username: 'rrhh-test', role: 'RRHH' });
});

test('rechaza contraseña incorrecta', () => {
  const mock = context('rrhh-test', 'incorrecta');
  assert.throws(() => guard('RRHH').canActivate(mock.value), /Usuario, contraseña incorrecto/);
});

test('rechaza una cuenta válida cuando no tiene el rol requerido', () => {
  const mock = context('ti-test', 'ti-secret');
  assert.throws(() => guard('RRHH').canActivate(mock.value), /Usuario, contraseña incorrecto/);
});
