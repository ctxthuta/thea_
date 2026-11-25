import { Hono } from 'hono';
import { z } from 'zod';
import {
  ASSOCIATE_STATUSES,
  ASSOCIATE_TYPES,
  EMPLOYEE_ID_REGEX,
  SLUG_REGEX,
  type AssociateStatus,
  type AssociateType,
} from '../domain/associates/associateDomain';
import { NON_NEGATIVE_AMOUNT_REGEX, SUPPORTED_CURRENCIES } from '../domain/accounting/money';
import { hasPermission } from '../domain/auth/rbac';
import { safeUrlSchema } from '../domain/validation';
import {
  createAssociate,
  getAssociateById,
  listAssociates,
  reinstateAssociate,
  revokeAssociate,
  updateAssociate,
} from '../application/associates/associateService';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getActorMeta, parseJsonBody, type AppEnv } from '../middleware/context';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const compensationSchema = z.strictObject({
  rateType: z.enum(['MONTHLY_RETAINER', 'DAILY', 'HOURLY', 'MILESTONE', 'ADVISORY', 'NONE']),
  rateAmount: z.string().regex(NON_NEGATIVE_AMOUNT_REGEX),
  currency: z.enum(SUPPORTED_CURRENCIES),
  payoutMethod: z.string().max(120),
  ndaSigned: z.boolean(),
  msaSigned: z.boolean(),
});

const contactSchema = z.strictObject({
  email: z.string().max(200),
  phone: z.string().max(60).optional(),
  location: z.string().max(160).optional(),
});

const socialLinksSchema = z.strictObject({
  linkedin: safeUrlSchema.optional(),
  github: safeUrlSchema.optional(),
  twitter: safeUrlSchema.optional(),
  website: safeUrlSchema.optional(),
});

const educationSchema = z.strictObject({
  degree: z.string().min(1),
  institution: z.string().min(1),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  description: z.string().optional(),
});

const experienceSchema = z.strictObject({
  position: z.string().min(1),
  company: z.string().min(1),
  location: z.string(),
  startDate: z.string(),
  endDate: z.string(),
  current: z.boolean().optional(),
  description: z.array(z.string()),
});

const certificationSchema = z.strictObject({
  name: z.string().min(1),
  issuer: z.string().min(1),
  date: z.string(),
  credentialUrl: safeUrlSchema.optional(),
});

const projectSchema = z.strictObject({
  name: z.string().min(1),
  description: z.string(),
  technologies: z.array(z.string()),
  url: safeUrlSchema.optional(),
});

const publicationSchema = z.strictObject({
  title: z.string().min(1),
  type: z.string(),
  date: z.string(),
  authors: z.array(z.string()),
  description: z.string(),
  url: safeUrlSchema,
});

const createAssociateSchema = z.strictObject({
  slug: z.string().regex(SLUG_REGEX, 'Use lowercase letters, numbers, and hyphens'),
  employeeId: z.string().regex(EMPLOYEE_ID_REGEX).optional(),
  associateType: z.enum(ASSOCIATE_TYPES),
  name: z.string().min(1).max(160),
  title: z.string().min(1).max(160),
  department: z.string().min(1).max(120),
  status: z.enum(ASSOCIATE_STATUSES).optional(),
  profileImage: safeUrlSchema.optional(),
  bio: z.string().max(4000),
  cardExpirationDate: z.string().regex(ISO_DATE_REGEX),
  isPublicCardEnabled: z.boolean().optional(),
  contact: contactSchema.optional(),
  socialLinks: socialLinksSchema.optional(),
  skills: z.array(z.string()).optional(),
  education: z.array(educationSchema).optional(),
  experience: z.array(experienceSchema).optional(),
  certifications: z.array(certificationSchema).optional(),
  projects: z.array(projectSchema).optional(),
  publications: z.array(publicationSchema).optional(),
  compensation: compensationSchema.optional(),
  internalNotes: z.string().max(4000).optional(),
});

const updateAssociateSchema = createAssociateSchema.partial().extend({
  version: z.number().int().min(1).optional(),
});

const revokeSchema = z.strictObject({
  reason: z.string().min(1).max(500),
  version: z.number().int().min(1).optional(),
});

const reinstateSchema = z.strictObject({
  cardExpirationDate: z.string().regex(ISO_DATE_REGEX).optional(),
  version: z.number().int().min(1).optional(),
});

function canAccessSensitiveAssociateData(
  user: NonNullable<AppEnv['Variables']['authUser']>
): boolean {
  return (
    hasPermission(user.role, user.isStaticSuperAdmin, 'accounting:read') ||
    hasPermission(user.role, user.isStaticSuperAdmin, 'admin:users')
  );
}

function stripSensitiveIfNeeded<T extends { compensation?: unknown; internalNotes?: unknown }>(
  dto: T,
  includeSensitive: boolean
): T {
  if (includeSensitive) return dto;
  const copy = { ...dto };
  delete copy.compensation;
  delete copy.internalNotes;
  return copy;
}

export function createAssociatesRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requireAuth());

  app.get('/', requirePermission('associates:read'), async (c) => {
    const includeCompensation = canAccessSensitiveAssociateData(c.get('authUser')!);
    const result = await listAssociates({
      status: (c.req.query('status') as AssociateStatus | undefined) || undefined,
      associateType: (c.req.query('associateType') as AssociateType | undefined) || undefined,
      search: c.req.query('search') || undefined,
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
      includeCompensation,
    });
    return c.json(result);
  });

  app.get('/:id', requirePermission('associates:read'), async (c) => {
    const includeCompensation = canAccessSensitiveAssociateData(c.get('authUser')!);
    return c.json(await getAssociateById(c.req.param('id'), { includeCompensation }));
  });

  app.post('/', requirePermission('associates:write'), async (c) => {
    const includeCompensation = canAccessSensitiveAssociateData(c.get('authUser')!);
    const body = await parseJsonBody(c, createAssociateSchema);
    const sanitized = includeCompensation
      ? body
      : { ...body, compensation: undefined, internalNotes: undefined };
    const dto = await createAssociate(sanitized, getActorMeta(c));
    return c.json(stripSensitiveIfNeeded(dto, includeCompensation), 201);
  });

  app.put('/:id', requirePermission('associates:write'), async (c) => {
    const includeCompensation = canAccessSensitiveAssociateData(c.get('authUser')!);
    const body = await parseJsonBody(c, updateAssociateSchema);
    const sanitized = includeCompensation
      ? body
      : { ...body, compensation: undefined, internalNotes: undefined };
    const dto = await updateAssociate(c.req.param('id'), sanitized, getActorMeta(c));
    return c.json(stripSensitiveIfNeeded(dto, includeCompensation));
  });

  app.post('/:id/revoke', requirePermission('associates:write'), async (c) => {
    const includeCompensation = canAccessSensitiveAssociateData(c.get('authUser')!);
    const body = await parseJsonBody(c, revokeSchema);
    const dto = await revokeAssociate(c.req.param('id'), body, getActorMeta(c));
    return c.json(stripSensitiveIfNeeded(dto, includeCompensation));
  });

  app.post('/:id/reinstate', requirePermission('associates:write'), async (c) => {
    const includeCompensation = canAccessSensitiveAssociateData(c.get('authUser')!);
    const body = await parseJsonBody(c, reinstateSchema);
    const dto = await reinstateAssociate(c.req.param('id'), body, getActorMeta(c));
    return c.json(stripSensitiveIfNeeded(dto, includeCompensation));
  });

  return app;
}
