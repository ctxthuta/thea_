import type { MiddlewareHandler } from 'hono';
import { getCookie } from 'hono/cookie';
import { ObjectId } from 'mongodb';
import { AppError } from '../domain/errors';
import {
  CLIENT_SESSION_COOKIE_NAME,
  verifyClientPortalToken,
} from '../infrastructure/security/jwt';
import { Collections } from '../infrastructure/db/collections';
import type { AppEnv } from './context';

function extractClientToken(c: Parameters<MiddlewareHandler<AppEnv>>[0]): string | null {
  const authHeader = c.req.header('authorization');
  if (authHeader && authHeader.toLowerCase().startsWith('bearer ')) {
    const token = authHeader.slice(7).trim();
    if (token.length > 0) return token;
  }
  const cookieToken = getCookie(c, CLIENT_SESSION_COOKIE_NAME);
  return cookieToken && cookieToken.length > 0 ? cookieToken : null;
}

export function requireClientAuth(): MiddlewareHandler<AppEnv> {
  return async (c, next) => {
    const token = extractClientToken(c);
    if (!token) {
      throw AppError.unauthorized('Client portal authentication required.');
    }

    const claims = await verifyClientPortalToken(token);
    if (!claims || !ObjectId.isValid(claims.accountId)) {
      throw AppError.unauthorized('Invalid or expired client portal session.');
    }

    const account = await Collections.crmAccounts().findOne(
      { _id: new ObjectId(claims.accountId) },
      { projection: { name: 1, status: 1, portalSlug: 1, portalAccessCode: 1 } }
    );

    if (
      !account ||
      (account.status !== 'ACTIVE_CLIENT' && account.status !== 'PROSPECT') ||
      !account.portalAccessCode
    ) {
      throw AppError.forbidden('Client portal access is disabled for this account.');
    }

    c.set('clientPortalUser', {
      accountId: account._id.toHexString(),
      portalSlug: account.portalSlug ?? claims.portalSlug,
      accountName: account.name,
      requesterName: claims.requesterName,
      requesterEmail: claims.requesterEmail,
    });

    await next();
  };
}
