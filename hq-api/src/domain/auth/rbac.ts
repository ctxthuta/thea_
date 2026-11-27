export const DB_USER_ROLES = [
  'ADMIN',
  'FINANCE',
  'CMS_EDITOR',
  'CRM_MANAGER',
  'VIEWER',
] as const;

export type DbUserRole = (typeof DB_USER_ROLES)[number];
export type UserRole = 'SUPER_ADMIN' | DbUserRole;

export type Permission =
  | '*'
  | 'overview:read'
  | 'accounting:read'
  | 'accounting:write'
  | 'associates:read'
  | 'associates:write'
  | 'cms:read'
  | 'cms:write'
  | 'crm:read'
  | 'crm:write'
  | 'projects:read'
  | 'projects:write'
  | 'tickets:read'
  | 'tickets:write'
  | 'admin:users'
  | 'admin:settings'
  | 'admin:audit';

const ROLE_PERMISSIONS: Record<UserRole, readonly Permission[]> = {
  SUPER_ADMIN: ['*'],
  ADMIN: [
    'overview:read',
    'accounting:read',
    'accounting:write',
    'associates:read',
    'associates:write',
    'cms:read',
    'cms:write',
    'crm:read',
    'crm:write',
    'projects:read',
    'projects:write',
    'tickets:read',
    'tickets:write',
    'admin:users',
    'admin:settings',
    'admin:audit',
  ],
  FINANCE: [
    'overview:read',
    'accounting:read',
    'accounting:write',
    'associates:read',
    'projects:read',
    'tickets:read',
  ],
  CMS_EDITOR: [
    'overview:read',
    'associates:read',
    'associates:write',
    'cms:read',
    'cms:write',
    'projects:read',
    'tickets:read',
  ],
  CRM_MANAGER: [
    'overview:read',
    'associates:read',
    'crm:read',
    'crm:write',
    'projects:read',
    'projects:write',
    'tickets:read',
    'tickets:write',
  ],
  VIEWER: [
    'overview:read',
    'accounting:read',
    'associates:read',
    'cms:read',
    'crm:read',
    'projects:read',
    'tickets:read',
  ],
};

export function getPermissionsForRole(role: UserRole): Permission[] {
  return [...ROLE_PERMISSIONS[role]];
}

export function hasPermission(
  role: UserRole,
  isStaticSuperAdmin: boolean,
  required: Permission
): boolean {
  if (isStaticSuperAdmin || role === 'SUPER_ADMIN') {
    return true;
  }
  const perms = ROLE_PERMISSIONS[role];
  return perms.includes('*') || perms.includes(required);
}

export function hasAnyRole(
  role: UserRole,
  isStaticSuperAdmin: boolean,
  allowedRoles: readonly UserRole[]
): boolean {
  if (isStaticSuperAdmin || role === 'SUPER_ADMIN') {
    return true;
  }
  return allowedRoles.includes(role);
}
