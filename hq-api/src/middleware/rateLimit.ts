import type { Context, MiddlewareHandler } from 'hono';
import { AppError } from '../domain/errors';
import type { AppEnv } from './context';

interface RateLimitOptions {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
  keyGenerator?: (c: Context<AppEnv>) => Promise<string> | string;
}

const buckets = new Map<string, number[]>();

export function clearRateLimitBuckets(): void {
  buckets.clear();
}

export function rateLimitMiddleware(options: RateLimitOptions): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const suffix = options.keyGenerator
      ? await options.keyGenerator(c)
      : c.get('clientIp') ?? '127.0.0.1';
    const key = `${options.keyPrefix}:${suffix}`;
    const now = Date.now();
    const cutoff = now - options.windowMs;

    const timestamps = (buckets.get(key) ?? []).filter((ts) => ts > cutoff);
    if (timestamps.length >= options.maxRequests) {
      const oldest = timestamps[0] ?? now;
      const retryAfterSec = Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000));
      c.header('Retry-After', String(retryAfterSec));
      throw AppError.tooManyRequests(
        `Rate limit exceeded (${options.maxRequests} requests per ${Math.round(options.windowMs / 1000)}s).`
      );
    }

    timestamps.push(now);
    buckets.set(key, timestamps);

    // Opportunistic memory guard for long-lived single-process deployments
    if (buckets.size > 10_000) {
      for (const [k, list] of buckets.entries()) {
        if (list.length === 0 || (list[list.length - 1] ?? 0) <= cutoff) {
          buckets.delete(k);
        }
      }
    }

    await next();
  };
}
