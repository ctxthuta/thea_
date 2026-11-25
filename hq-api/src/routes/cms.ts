import { Hono } from 'hono';
import { z } from 'zod';
import {
  assertValidCmsSection,
  getCmsSection,
  listCmsRevisions,
  listCmsSections,
  publishCmsSection,
  rollbackCmsSection,
  updateCmsDraft,
} from '../application/cms/cmsService';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getActorMeta, parseJsonBody, type AppEnv } from '../middleware/context';
import { idempotencyMiddleware } from '../middleware/idempotency';

const updateDraftSchema = z.strictObject({
  draftData: z.record(z.string(), z.unknown()),
  version: z.number().int().min(1).optional(),
});

const publishSchema = z.strictObject({
  changeSummary: z.string().max(500).optional(),
  version: z.number().int().min(1).optional(),
});

const rollbackSchema = z.strictObject({
  targetVersion: z.number().int().min(1),
  changeSummary: z.string().max(500).optional(),
  version: z.number().int().min(1).optional(),
});

export function createCmsRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requireAuth());

  app.get('/sections', requirePermission('cms:read'), async (c) => {
    const items = await listCmsSections();
    return c.json({ items });
  });

  app.get('/sections/:section', requirePermission('cms:read'), async (c) => {
    const section = assertValidCmsSection(c.req.param('section'));
    return c.json(await getCmsSection(section));
  });

  app.put('/sections/:section', requirePermission('cms:write'), async (c) => {
    const section = assertValidCmsSection(c.req.param('section'));
    const body = await parseJsonBody(c, updateDraftSchema);
    const dto = await updateCmsDraft(section, body, getActorMeta(c));
    return c.json(dto);
  });

  app.post(
    '/sections/:section/publish',
    requirePermission('cms:write'),
    idempotencyMiddleware(),
    async (c) => {
      const section = assertValidCmsSection(c.req.param('section'));
      const body = await parseJsonBody(c, publishSchema);
      const dto = await publishCmsSection(section, body, getActorMeta(c));
      c.header('ETag', `W/"${section}-${dto.publishedVersion}"`);
      return c.json(dto);
    }
  );

  app.get('/sections/:section/revisions', requirePermission('cms:read'), async (c) => {
    const section = assertValidCmsSection(c.req.param('section'));
    const result = await listCmsRevisions(section, {
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
    });
    return c.json(result);
  });

  app.post('/sections/:section/rollback', requirePermission('cms:write'), async (c) => {
    const section = assertValidCmsSection(c.req.param('section'));
    const body = await parseJsonBody(c, rollbackSchema);
    const dto = await rollbackCmsSection(section, body, getActorMeta(c));
    return c.json(dto);
  });

  return app;
}
