import { createHash } from 'node:crypto';
import type { MiddlewareHandler } from 'hono';
import { AppError } from '../domain/errors';
import { Collections } from '../infrastructure/db/collections';
import type { AppEnv } from './context';

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

function canonicalize(value: unknown): string {
  if (value === null || typeof value !== 'object') {
    return JSON.stringify(value);
  }
  if (Array.isArray(value)) {
    return `[${value.map((v) => canonicalize(v)).join(',')}]`;
  }
  const keys = Object.keys(value as Record<string, unknown>).sort();
  const entries = keys.map(
    (k) => `${JSON.stringify(k)}:${canonicalize((value as Record<string, unknown>)[k])}`
  );
  return `{${entries.join(',')}}`;
}

function hashRequest(method: string, path: string, rawBody: string): string {
  let canonicalBody = rawBody;
  try {
    if (rawBody.trim().length > 0) {
      canonicalBody = canonicalize(JSON.parse(rawBody));
    }
  } catch {
    canonicalBody = rawBody;
  }
  return createHash('sha256')
    .update(`${method.toUpperCase()}:${path}:${canonicalBody}`, 'utf8')
    .digest('hex');
}

export function idempotencyMiddleware(options: { required?: boolean } = {}): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const key = c.req.header('idempotency-key')?.trim();
    if (!key) {
      if (options.required) {
        throw AppError.badRequest('Idempotency-Key header is required for this operation.', [
          { field: 'Idempotency-Key', message: 'Provide a unique Idempotency-Key header.' },
        ]);
      }
      await next();
      return;
    }

    if (key.length > 128) {
      throw AppError.badRequest('Idempotency-Key exceeds maximum length of 128 characters.');
    }

    const rawBody = await c.req.text();
    c.set('rawBodyText', rawBody);

    const actorId = c.get('authUser')?.id ?? c.get('clientIp') ?? 'public';
    const scopedId = `${actorId}:${c.req.method.toUpperCase()}:${c.req.path}:${key}`;
    const requestHash = hashRequest(c.req.method, c.req.path, rawBody);

    const existing = await Collections.idempotencyKeys().findOne({ _id: scopedId });
    if (existing) {
      if (existing.requestHash !== requestHash) {
        throw AppError.conflict(
          'Idempotency-Key was already used with a different request payload.',
          'idempotency-key-conflict'
        );
      }
      c.header('Idempotency-Replayed', 'true');
      return c.json(existing.responseBody, existing.statusCode as 200 | 201);
    }

    await next();

    const status = c.res.status;
    if (status >= 200 && status < 300) {
      try {
        const cloned = c.res.clone();
        const responseBody = await cloned.json();
        const now = new Date();
        await Collections.idempotencyKeys().updateOne(
          { _id: scopedId },
          {
            $setOnInsert: {
              _id: scopedId,
              requestHash,
              statusCode: status,
              responseBody,
              createdAt: now,
              expiresAt: new Date(now.getTime() + IDEMPOTENCY_TTL_MS),
            },
          },
          { upsert: true }
        );
      } catch {
        // Non-JSON responses skip idempotency payload caching
      }
    }
  };
}
