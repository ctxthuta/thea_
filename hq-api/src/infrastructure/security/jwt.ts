import { SignJWT, jwtVerify } from 'jose';
import { getEnv } from '../../config/env';
import type { UserRole } from '../../domain/auth/rbac';

export const SESSION_COOKIE_NAME = 'thea_hq_session';
export const JWT_ISSUER = 'hq.theasolutions.co';
export const JWT_AUDIENCE = 'thea-hq-api';

export interface SessionJwtPayload {
  sub: string;
  email: string;
  name: string;
  role: UserRole;
  isStaticSuperAdmin: boolean;
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
