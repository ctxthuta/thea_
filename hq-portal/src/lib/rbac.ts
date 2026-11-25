import type { AuthUser, UserRole } from '@/types/hq';

export type PortalModule =
  | 'overview'
  | 'cms'
  | 'associates'
  | 'finance'
  | 'crm'
  | 'admin';

export function canAccessModule(user: AuthUser | null, module: PortalModule): boolean {
  if (!user) return false;
  if (user.isStaticSuperAdmin || user.role === 'SUPER_ADMIN') return true;

  const role: UserRole = user.role;
  switch (module) {
    case 'overview':
      return true;
    case 'cms':
      return role === 'ADMIN' || role === 'CMS_EDITOR' || role === 'VIEWER';
    case 'associates':
      return true;
    case 'finance':
      return role === 'ADMIN' || role === 'FINANCE' || role === 'VIEWER';
    case 'crm':
      return role === 'ADMIN' || role === 'CRM_MANAGER' || role === 'VIEWER';
    case 'admin':
      return role === 'ADMIN' || role === 'FINANCE';
  }
}

export function canEditCms(user: AuthUser | null): boolean {
  if (!user) return false;
  return (
    user.isStaticSuperAdmin ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN' ||
    user.role === 'CMS_EDITOR'
  );
}

export function canEditAssociates(user: AuthUser | null): boolean {
  if (!user) return false;
  return (
    user.isStaticSuperAdmin ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN' ||
    user.role === 'CMS_EDITOR'
  );
}

export function canEditFinance(user: AuthUser | null): boolean {
  if (!user) return false;
  return (
    user.isStaticSuperAdmin ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN' ||
    user.role === 'FINANCE'
  );
}

export function canEditCrm(user: AuthUser | null): boolean {
  if (!user) return false;
  return (
    user.isStaticSuperAdmin ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN' ||
    user.role === 'CRM_MANAGER'
  );
}

export function canManageAdmin(user: AuthUser | null): boolean {
  if (!user) return false;
  return (
    user.isStaticSuperAdmin ||
    user.role === 'SUPER_ADMIN' ||
    user.role === 'ADMIN'
  );
}
