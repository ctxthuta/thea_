import { Hono } from 'hono';
import { z } from 'zod';
import { NON_NEGATIVE_AMOUNT_REGEX, SUPPORTED_CURRENCIES } from '../domain/accounting/money';
import { SLA_COVERAGES, SLA_PLANS } from '../domain/sla';
import type { ProjectStatus } from '../infrastructure/db/collections';
import {
  createProject,
  getProjectById,
  listProjects,
  updateProject,
  updateProjectPhase,
} from '../application/projects/projectService';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getActorMeta, parseJsonBody, type AppEnv } from '../middleware/context';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const milestoneSchema = z.strictObject({
  id: z.string().min(1).max(80).optional(),
  title: z.string().min(1).max(240),
  deliveryDate: z.string().regex(ISO_DATE_REGEX),
  status: z.enum(['PENDING', 'IN_PROGRESS', 'COMPLETED', 'AT_RISK']),
  completedAt: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
  deliverableNote: z.string().max(1000).optional(),
});

const phaseSchema = z.strictObject({
  id: z.string().min(1).max(80).optional(),
  name: z.string().min(1).max(200),
  order: z.number().int().min(1).max(50).optional(),
  status: z.enum(['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED']),
  startDate: z.string().regex(ISO_DATE_REGEX),
  targetDate: z.string().regex(ISO_DATE_REGEX),
  progressPct: z.number().int().min(0).max(100),
  summary: z.string().max(1500).optional(),
  milestones: z.array(milestoneSchema).max(30).optional(),
});

const slaSchema = z.strictObject({
  plan: z.enum(SLA_PLANS),
  startDate: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
  endDate: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
  monthlyHours: z.number().min(0).max(1000).optional(),
  custom: z
    .strictObject({
      p1Minutes: z.number().int().min(1).max(10080),
      p2Minutes: z.number().int().min(1).max(10080),
      p3Minutes: z.number().int().min(1).max(10080),
      coverage: z.enum(SLA_COVERAGES),
    })
    .optional(),
});

const createProjectSchema = z.strictObject({
  code: z.string().regex(/^PRJ-\d{4}-\d{3,6}$/).optional(),
  name: z.string().min(1).max(240),
  accountId: z.string().min(1),
  dealId: z.string().nullable().optional(),
  leadAssociateId: z.string().nullable().optional(),
  status: z.enum(['PLANNING', 'ACTIVE', 'ON_HOLD', 'COMPLETED', 'CANCELLED']).optional(),
  summary: z.string().max(3000).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  budgetAmount: z.string().regex(NON_NEGATIVE_AMOUNT_REGEX),
  startDate: z.string().regex(ISO_DATE_REGEX),
  targetEndDate: z.string().regex(ISO_DATE_REGEX),
  phases: z.array(phaseSchema).max(30).optional(),
  sla: slaSchema.optional(),
});

const updateProjectSchema = createProjectSchema.partial().extend({
  version: z.number().int().min(1).optional(),
});

const patchPhaseSchema = z.strictObject({
  name: z.string().min(1).max(200).optional(),
  status: z.enum(['UPCOMING', 'IN_PROGRESS', 'COMPLETED', 'DELAYED']).optional(),
  startDate: z.string().regex(ISO_DATE_REGEX).optional(),
  targetDate: z.string().regex(ISO_DATE_REGEX).optional(),
  progressPct: z.number().int().min(0).max(100).optional(),
  summary: z.string().max(1500).optional(),
  milestones: z.array(milestoneSchema).max(30).optional(),
  version: z.number().int().min(1).optional(),
});

export function createProjectsRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requireAuth());

  app.get('/', requirePermission('projects:read'), async (c) => {
    const result = await listProjects({
      accountId: c.req.query('accountId') || undefined,
      status: (c.req.query('status') as ProjectStatus | undefined) || undefined,
      search: c.req.query('search') || undefined,
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
    });
    return c.json(result);
  });

  app.get('/:id', requirePermission('projects:read'), async (c) => {
    return c.json(await getProjectById(c.req.param('id')));
  });

  app.post('/', requirePermission('projects:write'), async (c) => {
    const body = await parseJsonBody(c, createProjectSchema);
    const dto = await createProject(body, getActorMeta(c));
    return c.json(dto, 201);
  });

  app.put('/:id', requirePermission('projects:write'), async (c) => {
    const body = await parseJsonBody(c, updateProjectSchema);
    const dto = await updateProject(c.req.param('id'), body, getActorMeta(c));
    return c.json(dto);
  });

  app.patch('/:id/phases/:phaseId', requirePermission('projects:write'), async (c) => {
    const body = await parseJsonBody(c, patchPhaseSchema);
    const dto = await updateProjectPhase(
      c.req.param('id'),
      c.req.param('phaseId'),
      body,
      getActorMeta(c)
    );
    return c.json(dto);
  });

  return app;
}
