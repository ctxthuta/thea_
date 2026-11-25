import { randomUUID } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { cors } from 'hono/cors';
import { getEnv } from '../config/env';
import type { AppEnv } from './context';

const SAFE_REQUEST_ID_REGEX = /^[A-Za-z0-9._-]{1,64}$/;

export function requestContextMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const incomingId = c.req.header('x-request-id')?.trim();
    const requestId =
      incomingId && SAFE_REQUEST_ID_REGEX.test(incomingId) ? incomingId : randomUUID();

    const trustProxy = getEnv().TRUST_PROXY;
    let clientIp = '127.0.0.1';
    if (trustProxy) {
      const forwarded = c.req.header('x-forwarded-for');
      clientIp =
        (forwarded ? forwarded.split(',')[0]?.trim() : undefined) ||
        c.req.header('cf-connecting-ip')?.trim() ||
        c.req.header('x-real-ip')?.trim() ||
        '127.0.0.1';
    }
    const userAgent = c.req.header('user-agent') ?? 'unknown';

    c.set('requestId', requestId);
    c.set('clientIp', clientIp);
    c.set('userAgent', userAgent);

    await next();

    c.header('X-Request-Id', requestId);
  };
}

export function securityHeadersMiddleware(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    await next();
    c.header('X-Content-Type-Options', 'nosniff');
    c.header('X-Frame-Options', 'DENY');
    c.header('Referrer-Policy', 'strict-origin-when-cross-origin');
    c.header('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');

    if (!c.req.path.startsWith('/api/')) {
      c.header(
        'Content-Security-Policy',
        "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' https: data:; font-src 'self' https: data:; connect-src 'self' https:; frame-ancestors 'none'"
      );
    }
  };
}

export function createCorsMiddleware(): MiddlewareHandler<AppEnv> {
  return cors({
    origin: (origin) => {
      if (!origin) return '';
      const allowed = getEnv().corsOrigins;
      return allowed.includes(origin) ? origin : '';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
    allowHeaders: [
      'Content-Type',
      'Authorization',
      'Idempotency-Key',
      'If-Match',
      'X-Request-Id',
      'X-HQ-Ingest-Key',
    ],
    exposeHeaders: ['X-Request-Id', 'Idempotency-Replayed', 'ETag'],
    credentials: true,
    maxAge: 86400,
  });
}
