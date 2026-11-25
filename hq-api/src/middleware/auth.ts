import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { ObjectId } from 'mongodb';
import { AppError } from '../domain/errors';
import {
  getPermissionsForRole,
  hasAnyRole,
  hasPermission,
  type Permission,
  type UserRole,
} from '../domain/auth/rbac';
import { SESSION_COOKIE_NAME, verifySessionToken } from '../infrastructure/security/jwt';
import { Collections } from '../infrastructure/db/collections';
import type { AppEnv } from './context';

function extractToken(c: Parameters<MiddlewareHandler<AppEnv>>[0]): string | null {
  const authHeader = c.req.header('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) return token;
  }
  const cookieToken = getCookie(c, SESSION_COOKIE_NAME);
  return cookieToken && cookieToken.length > 0 ? cookieToken : null;
}

export function requireAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = extractToken(c);
    if (!token) {
      throw AppError.unauthorized('Missing authentication credentials.');
    }

    const claims = await verifySessionToken(token);
    if (!claims) {
      throw AppError.unauthorized('Invalid or expired session token.');
    }

    if (claims.isStaticSuperAdmin && claims.role === 'SUPER_ADMIN') {
      c.set('authUser', {
        id: claims.sub,
        email: claims.email,
        name: claims.name,
        role: 'SUPER_ADMIN',
        isStaticSuperAdmin: true,
        permissions: getPermissionsForRole('SUPER_ADMIN'),
      });
      await next();
      return;
    }

    if (!ObjectId.isValid(claims.sub)) {
      throw AppError.unauthorized('Malformed user identity in token.');
    }

    const user = await Collections.users().findOne({ _id: new ObjectId(claims.sub) });
    if (!user) {
      throw AppError.unauthorized('User account no longer exists.');
    }
    if (user.status !== 'ACTIVE') {
      throw AppError.forbidden('User account is disabled.', 'account-disabled');
    }

    c.set('authUser', {
      id: user._id.toHexString(),
      email: user.email,
      name: user.name,
      role: user.role,
      isStaticSuperAdmin: false,
      permissions: getPermissionsForRole(user.role),
    });

    await next();
  };
}

export function requireRoles(...allowedRoles: UserRole[]): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('authUser');
    if (!user) {
      throw AppError.unauthorized();
    }
    if (!hasAnyRole(user.role, user.isStaticSuperAdmin, allowedRoles)) {
      throw AppError.forbidden(
        `Role ${user.role} is not authorized to access this endpoint.`
      );
    }
    await next();
  };
}

export function requirePermission(permission: Permission): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const user = c.get('authUser');
    if (!user) {
      throw AppError.unauthorized();
    }
    if (!hasPermission(user.role, user.isStaticSuperAdmin, permission)) {
      throw AppError.forbidden(`Missing required permission: ${permission}.`);
    }
    await next();
  };
}
