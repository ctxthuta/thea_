import { createHash, timingSafeEqual } from 'node:crypto';
import { getEnv } from '../../config/env';

/**
 * Constant-time SHA-256 digest comparison to prevent length and prefix timing leaks.
 */
export function constantTimeEqual(a: string, b: string): boolean {
  const hashA = createHash('sha256').update(a, 'utf8').digest();
  const hashB = createHash('sha256').update(b, 'utf8').digest();
  return timingSafeEqual(hashA, hashB);
}

export function verifyStaticSuperAdminCredentials(email: string, password: string): boolean {
  const env = getEnv();
  const normalizedEmail = email.trim().toLowerCase();
  const emailMatch = constantTimeEqual(normalizedEmail, env.superAdminEmailNormalized);
  const passwordMatch = constantTimeEqual(password, env.SUPER_ADMIN_PASSWORD);
  return emailMatch && passwordMatch;
}

export function verifyPublicIngestKey(providedKey: string | undefined): boolean {
  if (!providedKey) return false;
  const env = getEnv();
  return constantTimeEqual(providedKey, env.PUBLIC_INGEST_SECRET);
}

export async function hashPassword(plain: string): Promise<string> {
  return await Bun.password.hash(plain, {
    algorithm: 'argon2id',
    memoryCost: 65536,
    timeCost: 2,
  });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
  try {
    return await Bun.password.verify(plain, hash);
  } catch {
    return false;
  }
}
