import { randomBytes } from 'node:crypto';
import { AppError } from '../errors';

export const ASSOCIATE_TYPES = ['contractor', 'freelancer', 'advisor', 'executive'] as const;
export type AssociateType = (typeof ASSOCIATE_TYPES)[number];

export const ASSOCIATE_STATUSES = ['ACTIVE', 'INACTIVE', 'REVOKED'] as const;
export type AssociateStatus = (typeof ASSOCIATE_STATUSES)[number];

export const RESERVED_PUBLIC_SLUGS = new Set([
  'about',
  'ai',
  'api',
  'careers',
  'contact',
  'pricing',
  'schedule-demo',
  'verify',
  'admin',
  'login',
  'hq',
]);

export const SLUG_REGEX = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
export const EMPLOYEE_ID_REGEX = /^THEA-[A-Z0-9]{4}$/;

const BADGE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export function assertValidPublicSlug(slug: string): void {
  const normalized = slug.trim().toLowerCase();
  if (!SLUG_REGEX.test(normalized)) {
    throw AppError.badRequest('Invalid associate slug format.', [
      { field: 'slug', message: 'Use lowercase alphanumeric words separated by hyphens.' },
    ]);
  }
  if (RESERVED_PUBLIC_SLUGS.has(normalized)) {
    throw AppError.conflict(`Slug "${normalized}" is reserved by a public website route.`, 'reserved-slug', [
      { field: 'slug', message: `"${normalized}" cannot be used as an associate slug.` },
    ]);
  }
}

export function generateAssociateBadgeId(): string {
  const bytes = randomBytes(4);
  let suffix = '';
  for (let i = 0; i < 4; i++) {
    suffix += BADGE_ALPHABET[(bytes[i] ?? 0) % BADGE_ALPHABET.length];
  }
  return `THEA-${suffix}`;
}

export type VerificationStatus = 'verified' | 'expired' | 'revoked';

export function computeVerificationStatus(associate: {
  status: AssociateStatus;
  revokedAt: Date | null;
  cardExpirationDate: string;
}, nowUtc: Date = new Date()): { isVerified: boolean; verificationStatus: VerificationStatus } {
  if (associate.status === 'REVOKED' || associate.revokedAt !== null) {
    return { isVerified: false, verificationStatus: 'revoked' };
  }

  const todayIsoDate = nowUtc.toISOString().slice(0, 10);
  if (todayIsoDate > associate.cardExpirationDate) {
    return { isVerified: false, verificationStatus: 'expired' };
  }

  if (associate.status === 'ACTIVE') {
    return { isVerified: true, verificationStatus: 'verified' };
  }

  return { isVerified: false, verificationStatus: 'revoked' };
}
