import { Hono } from 'hono';
import { ObjectId } from 'mongodb';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { AppError } from '../domain/errors';
import { DB_USER_ROLES } from '../domain/auth/rbac';
import { SUPPORTED_CURRENCIES } from '../domain/accounting/money';
import { buildKeysetFilter, clampLimit, decodeCursor, slicePaginated } from '../domain/pagination';
import { Collections, type AuditLogDoc, type SystemSettingsDoc, type UserDoc } from '../infrastructure/db/collections';
import { hashPassword } from '../infrastructure/security/password';
import { writeAuditLog } from '../infrastructure/audit/auditLogger';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getActorMeta, parseJsonBody, type AppEnv } from '../middleware/context';

const createUserSchema = z.strictObject({
  email: z.string().email().max(200),
  name: z.string().min(1).max(160),
  password: z.string().min(12, 'Password must be at least 12 characters').max(128),
  role: z.enum(DB_USER_ROLES),
});

const patchUserSchema = z.strictObject({
  name: z.string().min(1).max(160).optional(),
  role: z.enum(DB_USER_ROLES).optional(),
  status: z.enum(['ACTIVE', 'DISABLED']).optional(),
  password: z.string().min(12).max(128).optional(),
  version: z.number().int().min(1).optional(),
});

const updateSettingsSchema = z.strictObject({
  baseCurrency: z.enum(SUPPORTED_CURRENCIES),
  companyLegalName: z.string().min(1).max(200).optional(),
  fiscalYearStartMonth: z.number().int().min(1).max(12).optional(),
  defaultBadgeValidityDays: z.number().int().min(1).max(3650).optional(),
  version: z.number().int().min(1).optional(),
});

function serializeUser(doc: UserDoc) {
  return {
    id: doc._id.toHexString(),
    email: doc.email,
    name: doc.name,
    role: doc.role,
    status: doc.status,
    version: doc.version,
    lastLoginAt: doc.lastLoginAt ? doc.lastLoginAt.toISOString() : null,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function serializeSettings(doc: SystemSettingsDoc) {
  return {
    id: doc._id,
    baseCurrency: doc.baseCurrency,
    companyLegalName: doc.companyLegalName,
    fiscalYearStartMonth: doc.fiscalYearStartMonth,
    defaultBadgeValidityDays: doc.defaultBadgeValidityDays,
    version: doc.version,
    updatedBy: doc.updatedBy,
    updatedAt: doc.updatedAt.toISOString(),
  };
}

function serializeAuditLog(doc: AuditLogDoc) {
  return {
    id: doc._id.toHexString(),
    actorId: doc.actorId,
    actorEmail: doc.actorEmail,
    actorRole: doc.actorRole,
    isStaticSuperAdmin: doc.isStaticSuperAdmin,
    action: doc.action,
    resourceType: doc.resourceType,
    resourceId: doc.resourceId,
    requestId: doc.requestId,
    ipAddress: doc.ipAddress,
    userAgent: doc.userAgent,
    beforeSnapshot: doc.beforeSnapshot,
    afterSnapshot: doc.afterSnapshot,
    createdAt: doc.createdAt.toISOString(),
  };
}

export function createAdminRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requireAuth());

  // Users
  app.get('/users', requirePermission('admin:users'), async (c) => {
    const limit = clampLimit(c.req.query('limit'), 25, 100);
    const cursor = decodeCursor(c.req.query('cursor'));
    const filter: Record<string, unknown> = {};
    if (c.req.query('role')) filter.role = c.req.query('role');
    if (c.req.query('status')) filter.status = c.req.query('status');

    const keyset = buildKeysetFilter('createdAt', cursor, { direction: 'desc', isDate: true });
    const query = keyset ? { $and: [filter, keyset] } : filter;

    const docs = await Collections.users()
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.createdAt, id: doc._id }));
    return c.json({
      items: page.items.map(serializeUser),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    });
  });

  app.post('/users', requirePermission('admin:users'), async (c) => {
    const body = await parseJsonBody(c, createUserSchema);
    const email = body.email.trim().toLowerCase();

    if (email === getEnv().superAdminEmailNormalized) {
      throw AppError.conflict(
        'This email is reserved for the Static Super Admin.',
        'reserved-super-admin-email'
      );
    }

    const actor = getActorMeta(c);
    const passwordHash = await hashPassword(body.password);
    const now = new Date();
    const doc: UserDoc = {
      _id: new ObjectId(),
      email,
      name: body.name.trim(),
      passwordHash,
      role: body.role,
      status: 'ACTIVE',
      version: 1,
      lastLoginAt: null,
      createdBy: actor.actorId,
      createdAt: now,
      updatedAt: now,
    };

    await Collections.users().insertOne(doc);
    const dto = serializeUser(doc);

    await writeAuditLog({
      ...actor,
      action: 'USER_CREATED',
      resourceType: 'user',
      resourceId: dto.id,
      afterSnapshot: dto as unknown as Record<string, unknown>,
    });

    return c.json(dto, 201);
  });

  app.patch('/users/:id', requirePermission('admin:users'), async (c) => {
    const id = c.req.param('id');
    if (id === 'static-super-admin') {
      throw AppError.forbidden('Static Super Admin cannot be modified via API.');
    }
    if (!ObjectId.isValid(id)) {
      throw AppError.badRequest('Invalid user ID.');
    }

    const body = await parseJsonBody(c, patchUserSchema);
    const oid = new ObjectId(id);
    const existing = await Collections.users().findOne({ _id: oid });
    if (!existing) {
      throw AppError.notFound('User not found.');
    }

    const patch: Record<string, unknown> = { updatedAt: new Date() };
    if (body.name !== undefined) patch.name = body.name.trim();
    if (body.role !== undefined) patch.role = body.role;
    if (body.status !== undefined) patch.status = body.status;
    if (body.password !== undefined) patch.passwordHash = await hashPassword(body.password);

    const filter: Record<string, unknown> = { _id: oid };
    if (body.version !== undefined) filter.version = body.version;

    const updated = await Collections.users().findOneAndUpdate(
      filter,
      { $set: patch, $inc: { version: 1 } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      throw AppError.conflict(`User version conflict. Current version is ${existing.version}.`, 'version-conflict');
    }

    const dto = serializeUser(updated);
    await writeAuditLog({
      ...getActorMeta(c),
      action: 'USER_UPDATED',
      resourceType: 'user',
      resourceId: dto.id,
      beforeSnapshot: serializeUser(existing) as unknown as Record<string, unknown>,
      afterSnapshot: dto as unknown as Record<string, unknown>,
    });

    return c.json(dto);
  });

  // System Settings
  app.get('/settings', requirePermission('admin:settings'), async (c) => {
    const doc = await Collections.systemSettings().findOne({ _id: 'global' });
    if (!doc) {
      throw AppError.notFound('System settings not initialized.');
    }
    return c.json(serializeSettings(doc));
  });

  app.put('/settings', requirePermission('admin:settings'), async (c) => {
    const body = await parseJsonBody(c, updateSettingsSchema);
    const existing = await Collections.systemSettings().findOne({ _id: 'global' });
    if (!existing) {
      throw AppError.notFound('System settings not initialized.');
    }

    const actor = getActorMeta(c);
    const patch: Record<string, unknown> = {
      baseCurrency: body.baseCurrency,
      updatedBy: actor.actorId,
      updatedAt: new Date(),
    };
    if (body.companyLegalName !== undefined) patch.companyLegalName = body.companyLegalName.trim();
    if (body.fiscalYearStartMonth !== undefined) patch.fiscalYearStartMonth = body.fiscalYearStartMonth;
    if (body.defaultBadgeValidityDays !== undefined) {
      patch.defaultBadgeValidityDays = body.defaultBadgeValidityDays;
    }

    const filter: Record<string, unknown> = { _id: 'global' };
    if (body.version !== undefined) filter.version = body.version;

    const updated = await Collections.systemSettings().findOneAndUpdate(
      filter,
      { $set: patch, $inc: { version: 1 } },
      { returnDocument: 'after' }
    );
    if (!updated) {
      throw AppError.conflict(
        `Settings version conflict. Current version is ${existing.version}.`,
        'version-conflict'
      );
    }

    const dto = serializeSettings(updated);
    await writeAuditLog({
      ...actor,
      action: 'SETTINGS_UPDATED',
      resourceType: 'system_settings',
      resourceId: 'global',
      beforeSnapshot: serializeSettings(existing) as unknown as Record<string, unknown>,
      afterSnapshot: dto as unknown as Record<string, unknown>,
    });

    return c.json(dto);
  });

  // Audit Logs
  app.get('/audit-logs', requirePermission('admin:audit'), async (c) => {
    const limit = clampLimit(c.req.query('limit'), 25, 100);
    const cursor = decodeCursor(c.req.query('cursor'));

    const filter: Record<string, unknown> = {};
    if (c.req.query('resourceType')) filter.resourceType = c.req.query('resourceType');
    if (c.req.query('resourceId')) filter.resourceId = c.req.query('resourceId');
    if (c.req.query('actorId')) filter.actorId = c.req.query('actorId');
    if (c.req.query('action')) filter.action = c.req.query('action');

    const keyset = buildKeysetFilter('createdAt', cursor, { direction: 'desc', isDate: true });
    const query = keyset ? { $and: [filter, keyset] } : filter;

    const docs = await Collections.auditLogs()
      .find(query)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray();

    const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.createdAt, id: doc._id }));
    return c.json({
      items: page.items.map(serializeAuditLog),
      nextCursor: page.nextCursor,
      hasMore: page.hasMore,
    });
  });

  return app;
}
