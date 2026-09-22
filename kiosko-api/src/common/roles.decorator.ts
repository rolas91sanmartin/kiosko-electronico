import { SetMetadata } from '@nestjs/common';

export type AdminRole = 'RRHH' | 'TI_ADMIN';
export const ADMIN_ROLES_KEY = 'adminRoles';
export const AdminRoles = (...roles: AdminRole[]) => SetMetadata(ADMIN_ROLES_KEY, roles);
