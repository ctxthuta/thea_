import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { AppError } from '../domain/errors';
import { getPermissionsForRole } from '../domain/auth/rbac';
import { Collections } from '../infrastructure/db/collections';
import {
  hashPassword,
  verifyPassword,
  verifyStaticSuperAdminCredentials,
} from '../infrastructure/security/password';
import { SESSION_COOKIE_NAME, signSessionToken } from '../infrastructure/security/jwt';
import { writeAuditLog } from '../infrastructure/audit/auditLogger';
import { getActorMeta, parseJsonBody, type AppEnv } from '../middleware/context';
import { requireAuth } from '../middleware/auth';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const loginSchema = z.strictObject({
  email: z.string().email(),
  password: z.string().min(1),
});

let dummyArgon2HashPromise: Promise<string> | null = null;
function getDummyArgon2Hash(): Promise<string> {
  if (!dummyArgon2HashPromise) {
    dummyArgon2HashPromise = hashPassword('thea-hq-dummy-timing-equalizer-2026');
  }
  return dummyArgon2HashPromise;
}

export function createAuthRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post(
    '/login',
    rateLimitMiddleware({
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
      keyPrefix: 'auth-login',
      keyGenerator: async (c) => {
        const ip = c.get('clientIp') ?? '127.0.0.1';
        try {
          const text = await c.req.text();
          c.set('rawBodyText', text);
          const body = JSON.parse(text) as { email?: string };
          const email = typeof body.email === 'string' ? body.email.trim().toLowerCase() : 'unknown';
          return `${ip}:${email}`;
        } catch {
          return `${ip}:malformed`;
        }
      },
    }),
    async (c) => {
      const body = await parseJsonBody(c, loginSchema);
      const env = getEnv();
      const normalizedEmail = body.email.trim().toLowerCase();
      const isProd = env.NODE_ENV === 'production';

      // Constant-time Static Super Admin ("Final Boss") check
      if (verifyStaticSuperAdminCredentials(normalizedEmail, body.password)) {
        const payload = {
          sub: 'static-super-admin',
          email: env.superAdminEmailNormalized,
          name: env.SUPER_ADMIN_NAME,
          role: 'SUPER_ADMIN' as const,
          isStaticSuperAdmin: true,
        };
        const token = await signSessionToken(payload);

        setCookie(c, SESSION_COOKIE_NAME, token, {
          httpOnly: true,
          sameSite: 'Lax',
          path: '/',
          secure: isProd,
          maxAge: 8 * 60 * 60,
        });

        await writeAuditLog({
          actorId: payload.sub,
          actorEmail: payload.email,
          actorRole: 'SUPER_ADMIN',
          isStaticSuperAdmin: true,
          action: 'AUTH_LOGIN',
          resourceType: 'session',
          resourceId: payload.sub,
          requestId: c.get('requestId'),
          ipAddress: c.get('clientIp'),
          userAgent: c.get('userAgent'),
        });

        return c.json({
          user: {
            id: payload.sub,
            email: payload.email,
            name: payload.name,
            role: payload.role,
            isStaticSuperAdmin: true,
            permissions: getPermissionsForRole('SUPER_ADMIN'),
          },
          token,
        });
      }

      // Database-backed internal user authentication
      const user = await Collections.users().findOne({ email: normalizedEmail });
      if (!user) {
        // Equalize Argon2id timing to prevent account enumeration
        await verifyPassword(body.password, await getDummyArgon2Hash());
        throw AppError.unauthorized('Invalid email or password.', 'invalid-credentials');
      }

      const valid = await verifyPassword(body.password, user.passwordHash);
      if (!valid) {
        throw AppError.unauthorized('Invalid email or password.', 'invalid-credentials');
      }

      if (user.status !== 'ACTIVE') {
        throw AppError.forbidden('This account has been disabled.', 'account-disabled');
      }

      const payload = {
        sub: user._id.toHexString(),
        email: user.email,
        name: user.name,
        role: user.role,
        isStaticSuperAdmin: false,
      };
      const token = await signSessionToken(payload);

      await Collections.users().updateOne(
        { _id: user._id },
        { $set: { lastLoginAt: new Date(), updatedAt: new Date() } }
      );

      setCookie(c, SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        secure: isProd,
        maxAge: 8 * 60 * 60,
      });

      await writeAuditLog({
        actorId: payload.sub,
        actorEmail: payload.email,
        actorRole: payload.role,
        isStaticSuperAdmin: false,
        action: 'AUTH_LOGIN',
        resourceType: 'session',
        resourceId: payload.sub,
        requestId: c.get('requestId'),
        ipAddress: c.get('clientIp'),
        userAgent: c.get('userAgent'),
      });

      return c.json({
        user: {
          id: payload.sub,
          email: payload.email,
          name: payload.name,
          role: payload.role,
          isStaticSuperAdmin: false,
          permissions: getPermissionsForRole(payload.role),
        },
        token,
      });
    }
  );

  app.post('/logout', requireAuth(), async (c) => {
    const actor = getActorMeta(c);
    deleteCookie(c, SESSION_COOKIE_NAME, { path: '/' });

    await writeAuditLog({
      ...actor,
      action: 'AUTH_LOGOUT',
      resourceType: 'session',
      resourceId: actor.actorId,
    });

    return c.json({ ok: true });
  });

  app.get('/me', requireAuth(), (c) => {
    const user = c.get('authUser')!;
    return c.json({ user });
  });

  return app;
}
