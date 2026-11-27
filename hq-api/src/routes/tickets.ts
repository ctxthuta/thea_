import { Hono } from 'hono';
import { z } from 'zod';
import type {
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '../infrastructure/db/collections';
import {
  addTeamTicketComment,
  createTicket,
  getTicketById,
  listTickets,
  updateTicket,
} from '../application/tickets/ticketService';
import { requireAuth, requirePermission } from '../middleware/auth';
import { TICKET_SEVERITIES } from '../domain/sla';
import { getActorMeta, parseJsonBody, type AppEnv } from '../middleware/context';

const TICKET_CATEGORIES = [
  'BUG',
  'FEATURE_REQUEST',
  'SUPPORT',
  'INFRASTRUCTURE',
  'BILLING',
  'TRAINING',
] as const;

const TICKET_PRIORITIES = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'] as const;
const TICKET_STATUSES = ['OPEN', 'IN_PROGRESS', 'WAITING_CLIENT', 'RESOLVED', 'CLOSED'] as const;

const createTicketSchema = z.strictObject({
  accountId: z.string().min(1),
  projectId: z.string().nullable().optional(),
  phaseId: z.string().max(80).nullable().optional(),
  title: z.string().min(1).max(240),
  description: z.string().min(1).max(5000),
  category: z.enum(TICKET_CATEGORIES),
  severity: z.enum(TICKET_SEVERITIES),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  status: z.enum(TICKET_STATUSES).optional(),
  source: z.enum(['CLIENT_PORTAL', 'INTERNAL', 'EMAIL']).optional(),
  requesterName: z.string().min(1).max(160),
  requesterEmail: z.string().email().max(200),
  assignedAssociateId: z.string().nullable().optional(),
});

const patchTicketSchema = z.strictObject({
  status: z.enum(TICKET_STATUSES).optional(),
  priority: z.enum(TICKET_PRIORITIES).optional(),
  severity: z.enum(TICKET_SEVERITIES).optional(),
  category: z.enum(TICKET_CATEGORIES).optional(),
  assignedAssociateId: z.string().nullable().optional(),
  projectId: z.string().nullable().optional(),
  phaseId: z.string().max(80).nullable().optional(),
  engineeringHours: z.number().min(0).max(1000).multipleOf(0.25).optional(),
  version: z.number().int().min(1).optional(),
});

const teamCommentSchema = z.strictObject({
  message: z.string().min(1).max(4000),
  isInternalNote: z.boolean().optional(),
});

export function createTicketsRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requireAuth());

  app.get('/', requirePermission('tickets:read'), async (c) => {
    const result = await listTickets({
      accountId: c.req.query('accountId') || undefined,
      projectId: c.req.query('projectId') || undefined,
      status: (c.req.query('status') as TicketStatus | undefined) || undefined,
      priority: (c.req.query('priority') as TicketPriority | undefined) || undefined,
      category: (c.req.query('category') as TicketCategory | undefined) || undefined,
      search: c.req.query('search') || undefined,
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
    });
    return c.json(result);
  });

  app.get('/:id', requirePermission('tickets:read'), async (c) => {
    return c.json(await getTicketById(c.req.param('id')));
  });

  app.post('/', requirePermission('tickets:write'), async (c) => {
    const body = await parseJsonBody(c, createTicketSchema);
    const dto = await createTicket(body, getActorMeta(c));
    return c.json(dto, 201);
  });

  app.patch('/:id', requirePermission('tickets:write'), async (c) => {
    const body = await parseJsonBody(c, patchTicketSchema);
    const dto = await updateTicket(c.req.param('id'), body, getActorMeta(c));
    return c.json(dto);
  });

  app.post('/:id/comments', requirePermission('tickets:write'), async (c) => {
    const body = await parseJsonBody(c, teamCommentSchema);
    const user = c.get('authUser')!;
    const dto = await addTeamTicketComment(c.req.param('id'), body, {
      ...getActorMeta(c),
      actorName: user.name,
    });
    return c.json(dto, 201);
  });

  return app;
}
