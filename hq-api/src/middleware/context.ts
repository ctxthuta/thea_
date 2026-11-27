import type { Context } from 'hono';
import type { ZodType } from 'zod';
import { AppError } from '../domain/errors';
import type { Permission, UserRole } from '../domain/auth/rbac';

export interface AuthUser {
  id: string;
  email: string;
  name: string;
  role: UserRole;
  isStaticSuperAdmin: boolean;
  permissions: Permission[];
}

export interface ClientPortalUser {
  accountId: string;
  portalSlug: string;
  accountName: string;
  requesterName: string;
  requesterEmail: string;
}

export interface AppVariables {
  requestId: string;
  clientIp: string;
  userAgent: string;
  authUser?: AuthUser;
  clientPortalUser?: ClientPortalUser;
  rawBodyText?: string;
}

export type AppEnv = {
  Variables: AppVariables;
};

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export function assertSafeJsonKeys(value: unknown, path = ''): void {
  if (value === null || value === undefined || typeof value !== 'object') return;
  if (Array.isArray(value)) {
    for (let i = 0; i < value.length; i++) {
      assertSafeJsonKeys(value[i], `${path}[${i}]`);
    }
    return;
  }
  for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
    if (key.startsWith('$') || FORBIDDEN_KEYS.has(key)) {
      throw AppError.badRequest(`Disallowed key "${key}" in request payload.`, [
        { field: path ? `${path}.${key}` : key, message: 'Operator or prototype keys are prohibited.' },
      ]);
    }
    assertSafeJsonKeys(val, path ? `${path}.${key}` : key);
  }
}

export async function parseJsonBody<T>(c: Context<AppEnv>, schema: ZodType<T>): Promise<T> {
  let rawJson: unknown;
  try {
    const cachedText = c.get('rawBodyText');
    if (cachedText !== undefined) {
      rawJson = cachedText.trim().length > 0 ? JSON.parse(cachedText) : {};
    } else {
      const text = await c.req.text();
      c.set('rawBodyText', text);
      rawJson = text.trim().length > 0 ? JSON.parse(text) : {};
    }
  } catch {
    throw AppError.badRequest('Request body must be valid JSON.');
  }

  assertSafeJsonKeys(rawJson);

  const parsed = schema.safeParse(rawJson);
  if (!parsed.success) {
    throw AppError.badRequest(
      'Request payload failed schema validation.',
      parsed.error.issues.map((issue) => ({
        field: issue.path.join('.') || 'body',
        message: issue.message,
      })),
      'validation-error'
    );
  }

  return parsed.data;
}

export function getActorMeta(c: Context<AppEnv>): {
  actorId: string;
  actorEmail: string;
  actorRole: UserRole | 'SYSTEM' | 'PUBLIC_INGEST';
  isStaticSuperAdmin: boolean;
  requestId: string;
  ipAddress: string;
  userAgent: string;
} {
  const user = c.get('authUser');
  return {
    actorId: user?.id ?? 'anonymous',
    actorEmail: user?.email ?? '',
    actorRole: user?.role ?? 'SYSTEM',
    isStaticSuperAdmin: user?.isStaticSuperAdmin ?? false,
    requestId: c.get('requestId') ?? 'unknown',
    ipAddress: c.get('clientIp') ?? 'unknown',
    userAgent: c.get('userAgent') ?? 'unknown',
  };
}
