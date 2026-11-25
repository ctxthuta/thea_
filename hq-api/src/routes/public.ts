import { Hono, type MiddlewareHandler } from 'hono';
import { z } from 'zod';
import { AppError } from '../domain/errors';
import { CMS_SECTIONS, type CmsSectionKey } from '../infrastructure/db/collections';
import { verifyPublicIngestKey } from '../infrastructure/security/password';
import {
  assertValidCmsSection,
  getPublicCmsSection,
  getPublicCmsSectionsBatch,
} from '../application/cms/cmsService';
import {
  getPublicAssociateBySlug,
  verifyPublicAssociateByEmployeeId,
} from '../application/associates/associateService';
import { createLead } from '../application/crm/crmService';
import { parseJsonBody, type AppEnv } from '../middleware/context';
import { idempotencyMiddleware } from '../middleware/idempotency';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const leadIngestSchema = z.strictObject({
  source: z.enum(['WEB_CONTACT', 'WEB_QUOTE', 'WEB_DEMO_REQUEST']),
  name: z.string().max(160).optional(),
  email: z.string().email().max(200),
  phone: z.string().max(60).optional(),
  company: z.string().max(200).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  utm: z.record(z.string(), z.unknown()).optional(),
});

export function createPublicRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  const publicReadRateLimit = rateLimitMiddleware({
    windowMs: 60 * 1000,
    maxRequests: 120,
    keyPrefix: 'public-read',
  });

  app.get('/cms/:section', publicReadRateLimit, async (c) => {
    const section = assertValidCmsSection(c.req.param('section'));
    const data = await getPublicCmsSection(section);
    c.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    c.header('ETag', `W/"${section}-${data.version}"`);
    return c.json(data);
  });

  app.get('/cms', publicReadRateLimit, async (c) => {
    const raw = c.req.query('sections');
    let sections: CmsSectionKey[];
    if (!raw || raw.trim().length === 0) {
      sections = [...CMS_SECTIONS];
    } else {
      sections = raw
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean)
        .map((s) => assertValidCmsSection(s));
    }

    const data = await getPublicCmsSectionsBatch(sections);
    c.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return c.json({ sections: data });
  });

  app.get('/associates/:slug', publicReadRateLimit, async (c) => {
    const slug = c.req.param('slug');
    const profile = await getPublicAssociateBySlug(slug);
    c.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=300');
    return c.json(profile);
  });

  app.get('/verify/:employeeId', publicReadRateLimit, async (c) => {
    const employeeId = c.req.param('employeeId');
    const verification = await verifyPublicAssociateByEmployeeId(employeeId);
    c.header('Cache-Control', 'no-store');
    return c.json(verification);
  });

  const requireIngestKey: MiddlewareHandler<AppEnv> = async (c, next) => {
    const ingestKey = c.req.header('x-hq-ingest-key');
    if (!verifyPublicIngestKey(ingestKey)) {
      throw AppError.unauthorized('Invalid or missing X-HQ-Ingest-Key.', 'invalid-ingest-key');
    }
    await next();
  };

  app.post(
    '/leads/ingest',
    rateLimitMiddleware({
      windowMs: 60 * 1000,
      maxRequests: 30,
      keyPrefix: 'public-ingest',
    }),
    requireIngestKey,
    idempotencyMiddleware(),
    async (c) => {
      const body = await parseJsonBody(c, leadIngestSchema);
      const lead = await createLead(body, {
        actorId: 'public-ingest',
        actorEmail: body.email.trim().toLowerCase(),
        actorRole: 'PUBLIC_INGEST',
        isStaticSuperAdmin: false,
        requestId: c.get('requestId'),
        ipAddress: c.get('clientIp'),
        userAgent: c.get('userAgent'),
      });

      return c.json({ leadId: lead.id, status: lead.status }, 201);
    }
  );

  return app;
}
