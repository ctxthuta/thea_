import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '../../config/env';
import type { UserRole } from '../../domain/auth/rbac';

export const SESSION_COOKIE_NAME = 'thea_hq_session';
export const CLIENT_SESSION_COOKIE_NAME = 'thea_client_session';
export const JWT_ISSUER = 'hq.theasolutions.co';
export const JWT_AUDIENCE = 'thea-hq-api';
export const CLIENT_JWT_AUDIENCE = 'thea-client-portal';

export interface SessionJwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  isStaticSuperAdmin: boolean;
}

export interface ClientPortalJwtPayload {
  sub: string;
  accountId: string;
  portalSlug: string;
  accountName: string;
  requesterName: string;
  requesterEmail: string;
  tokenType: 'CLIENT_PORTAL';
}

function getSecretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().JWT_SECRET);
}

export async function signSessionToken(payload: SessionJwtPayload): Promise<string> {
  return await new SignJWT({
    email: payload.email,
    name: payload.name,
    role: payload.role,
    isStaticSuperAdmin: payload.isStaticSuperAdmin,
    tokenType: 'INTERNAL_STAFF',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('8h')
    .sign(getSecretKey());
}

export async function verifySessionToken(token: string): Promise<SessionJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: JWT_ISSUER,
      audience: JWT_AUDIENCE,
      algorithms: ['HS256'],
    });

    if (
      payload.tokenType === 'CLIENT_PORTAL' ||
      typeof payload.sub !== 'string' ||
      typeof payload.email !== 'string' ||
      typeof payload.name !== 'string' ||
      typeof payload.role !== 'string' ||
      typeof payload.isStaticSuperAdmin !== 'boolean'
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      email: payload.email,
      name: payload.name,
      role: payload.role as UserRole,
      isStaticSuperAdmin: payload.isStaticSuperAdmin,
    };
  } catch {
    return null;
  }
}

export async function signClientPortalToken(
  payload: Omit<ClientPortalJwtPayload, 'tokenType'>
): Promise<string> {
  return await new SignJWT({
    accountId: payload.accountId,
    portalSlug: payload.portalSlug,
    accountName: payload.accountName,
    requesterName: payload.requesterName,
    requesterEmail: payload.requesterEmail,
    tokenType: 'CLIENT_PORTAL',
  })
    .setProtectedHeader({ alg: 'HS256', typ: 'JWT' })
    .setSubject(payload.sub)
    .setIssuer(JWT_ISSUER)
    .setAudience(CLIENT_JWT_AUDIENCE)
    .setIssuedAt()
    .setExpirationTime('12h')
    .sign(getSecretKey());
}

export async function verifyClientPortalToken(
  token: string
): Promise<ClientPortalJwtPayload | null> {
  try {
    const { payload } = await jwtVerify(token, getSecretKey(), {
      issuer: JWT_ISSUER,
      audience: CLIENT_JWT_AUDIENCE,
      algorithms: ['HS256'],
    });

    if (
      payload.tokenType !== 'CLIENT_PORTAL' ||
      typeof payload.sub !== 'string' ||
      typeof payload.accountId !== 'string' ||
      typeof payload.portalSlug !== 'string' ||
      typeof payload.accountName !== 'string' ||
      typeof payload.requesterName !== 'string' ||
      typeof payload.requesterEmail !== 'string'
    ) {
      return null;
    }

    return {
      sub: payload.sub,
      accountId: payload.accountId,
      portalSlug: payload.portalSlug,
      accountName: payload.accountName,
      requesterName: payload.requesterName,
      requesterEmail: payload.requesterEmail,
      tokenType: 'CLIENT_PORTAL',
    };
  } catch {
    return null;
  }
}
