import { ClientSession, ObjectId } from 'mongodb';
import { Collections } from '../db/collections';
import type { UserRole } from '../../domain/auth/rbac';

const REDACTED_KEYS = new Set([
  'password',
  'passwordHash',
  'token',
  'secret',
  'jwt',
  'authorization',
  'x-hq-ingest-key',
]);

function redactObject(input: unknown, depth = 0): unknown {
  if (input === null || input === undefined) return input;
  if (depth > 5) return '[MAX_DEPTH_REDACTED]';
  if (input instanceof Date) return input.toISOString();
  if (input instanceof ObjectId) return input.toHexString();
  if (Array.isArray(input)) return input.map((item) => redactObject(item, depth + 1));
  if (typeof input === 'object') {
    const out: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(input as Record<string, unknown>)) {
      if (REDACTED_KEYS.has(key.toLowerCase()) || REDACTED_KEYS.has(key)) {
        out[key] = '[REDACTED]';
      } else if (val && typeof val === 'object' && '_bsontype' in (val as Record<string, unknown>)) {
        out[key] = String(val);
      } else {
        out[key] = redactObject(val, depth + 1);
      }
    }
    return out;
  }
  return input;
}

export interface AuditEntryInput {
  actorId: string;
  actorEmail: string;
  actorRole: UserRole | 'SYSTEM' | 'PUBLIC_INGEST';
  isStaticSuperAdmin: boolean;
  action: string;
  resourceType: string;
  resourceId: string;
  requestId?: string;
  ipAddress?: string;
  userAgent?: string;
  beforeSnapshot?: Record<string, unknown> | null;
  afterSnapshot?: Record<string, unknown> | null;
}

export async function writeAuditLog(
  entry: AuditEntryInput,
  session?: ClientSession
): Promise<void> {
  await Collections.auditLogs().insertOne(
    {
      _id: new ObjectId(),
      actorId: entry.actorId,
      actorEmail: entry.actorEmail,
      actorRole: entry.actorRole,
      isStaticSuperAdmin: entry.isStaticSuperAdmin,
      action: entry.action,
      resourceType: entry.resourceType,
      resourceId: entry.resourceId,
      requestId: entry.requestId ?? 'internal',
      ipAddress: entry.ipAddress ?? 'unknown',
      userAgent: entry.userAgent ?? 'unknown',
      beforeSnapshot: entry.beforeSnapshot
        ? (redactObject(entry.beforeSnapshot) as Record<string, unknown>)
        : null,
      afterSnapshot: entry.afterSnapshot
        ? (redactObject(entry.afterSnapshot) as Record<string, unknown>)
        : null,
      createdAt: new Date(),
    },
    session ? { session } : undefined
  );
}
