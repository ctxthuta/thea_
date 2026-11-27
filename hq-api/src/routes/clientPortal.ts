import { Hono } from 'hono';
import { deleteCookie, setCookie } from 'hono/cookie';
import { z } from 'zod';
import { getEnv } from '../config/env';
import { AppError } from '../domain/errors';
import { TICKET_SEVERITIES } from '../domain/sla';
import { Collections, type TicketStatus } from '../infrastructure/db/collections';
import { constantTimeEqual } from '../infrastructure/security/password';
import {
  CLIENT_SESSION_COOKIE_NAME,
  signClientPortalToken,
} from '../infrastructure/security/jwt';
import { writeAuditLog } from '../infrastructure/audit/auditLogger';
import { listClientPortalProjects } from '../application/projects/projectService';
import {
  addClientPortalComment,
  createClientPortalTicket,
  getClientPortalTicketById,
  listClientPortalTickets,
} from '../application/tickets/ticketService';
import { requireClientAuth } from '../middleware/clientAuth';
import { parseJsonBody, type AppEnv } from '../middleware/context';
import { rateLimitMiddleware } from '../middleware/rateLimit';

const clientLoginSchema = z.strictObject({
  portalSlug: z.string().min(2).max(80),
  accessCode: z.string().min(2).max(64),
  requesterName: z.string().max(160).optional(),
  requesterEmail: z.string().email().max(200).optional(),
});

const clientCreateTicketSchema = z.strictObject({
  projectId: z.string().nullable().optional(),
  phaseId: z.string().max(80).nullable().optional(),
  title: z.string().min(1).max(240),
  description: z.string().min(1).max(5000),
  category: z.enum(['BUG', 'FEATURE_REQUEST', 'SUPPORT', 'INFRASTRUCTURE', 'BILLING', 'TRAINING']),
  severity: z.enum(TICKET_SEVERITIES).optional(),
  priority: z.enum(['LOW', 'MEDIUM', 'HIGH', 'URGENT']).optional(),
  requesterName: z.string().max(160).optional(),
  requesterEmail: z.string().email().max(200).optional(),
});

const clientCommentSchema = z.strictObject({
  message: z.string().min(1).max(4000),
  authorName: z.string().max(160).optional(),
  authorEmail: z.string().email().max(200).optional(),
});

export function createClientPortalRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.post(
    '/login',
    rateLimitMiddleware({
      windowMs: 15 * 60 * 1000,
      maxRequests: 10,
      keyPrefix: 'client-portal-login',
      keyGenerator: async (c) => {
        const ip = c.get('clientIp') ?? '127.0.0.1';
        try {
          const text = await c.req.text();
          c.set('rawBodyText', text);
          const body = JSON.parse(text) as { portalSlug?: string };
          const slug =
            typeof body.portalSlug === 'string' ? body.portalSlug.trim().toLowerCase() : 'unknown';
          return `${ip}:${slug}`;
        } catch {
          return `${ip}:malformed`;
        }
      },
    }),
    async (c) => {
      const body = await parseJsonBody(c, clientLoginSchema);
      const slug = body.portalSlug.trim().toLowerCase();
      const accessCode = body.accessCode.trim();

      const account = await Collections.crmAccounts().findOne({ portalSlug: slug });
      const storedCode = account?.portalAccessCode ?? '___never_match_placeholder___';
      const codeValid = constantTimeEqual(accessCode, storedCode);

      if (
        !account ||
        !account.portalAccessCode ||
        !codeValid ||
        (account.status !== 'ACTIVE_CLIENT' && account.status !== 'PROSPECT')
      ) {
        throw AppError.unauthorized('Invalid portal slug or access code.', 'invalid-portal-credentials');
      }

      const primaryContact = await Collections.crmContacts().findOne(
        { accountId: account._id, status: 'ACTIVE' },
        { sort: { createdAt: 1 } }
      );

      const requesterName =
        body.requesterName?.trim() || primaryContact?.fullName || account.name;
      const requesterEmail = (
        body.requesterEmail?.trim() ||
        primaryContact?.email ||
        `portal@${slug}.client`
      ).toLowerCase();

      const token = await signClientPortalToken({
        sub: `client:${account._id.toHexString()}`,
        accountId: account._id.toHexString(),
        portalSlug: slug,
        accountName: account.name,
        requesterName,
        requesterEmail,
      });

      const isProd = getEnv().NODE_ENV === 'production';
      setCookie(c, CLIENT_SESSION_COOKIE_NAME, token, {
        httpOnly: true,
        sameSite: 'Lax',
        path: '/',
        secure: isProd,
        maxAge: 12 * 60 * 60,
      });

      await writeAuditLog({
        actorId: `client:${account._id.toHexString()}`,
        actorEmail: requesterEmail,
        actorRole: 'PUBLIC_INGEST',
        isStaticSuperAdmin: false,
        action: 'CLIENT_PORTAL_LOGIN',
        resourceType: 'crm_account',
        resourceId: account._id.toHexString(),
        requestId: c.get('requestId'),
        ipAddress: c.get('clientIp'),
        userAgent: c.get('userAgent'),
      });

      return c.json({
        client: {
          accountId: account._id.toHexString(),
          portalSlug: slug,
          accountName: account.name,
          industry: account.industry,
          requesterName,
          requesterEmail,
        },
        token,
      });
    }
  );

  app.post('/logout', requireClientAuth(), async (c) => {
    deleteCookie(c, CLIENT_SESSION_COOKIE_NAME, { path: '/' });
    return c.json({ ok: true });
  });

  app.get('/me', requireClientAuth(), (c) => {
    return c.json({ client: c.get('clientPortalUser')! });
  });

  app.get('/projects', requireClientAuth(), async (c) => {
    const client = c.get('clientPortalUser')!;
    const items = await listClientPortalProjects(client.accountId);
    return c.json({ items });
  });

  app.get('/tickets', requireClientAuth(), async (c) => {
    const client = c.get('clientPortalUser')!;
    const result = await listClientPortalTickets(client.accountId, {
      status: (c.req.query('status') as TicketStatus | undefined) || undefined,
      projectId: c.req.query('projectId') || undefined,
    });
    return c.json(result);
  });

  app.get('/tickets/:id', requireClientAuth(), async (c) => {
    const client = c.get('clientPortalUser')!;
    return c.json(await getClientPortalTicketById(client.accountId, c.req.param('id')));
  });

  app.post('/tickets', requireClientAuth(), async (c) => {
    const client = c.get('clientPortalUser')!;
    const body = await parseJsonBody(c, clientCreateTicketSchema);
    const dto = await createClientPortalTicket(client, body, {
      requestId: c.get('requestId'),
      ipAddress: c.get('clientIp'),
      userAgent: c.get('userAgent'),
    });
    return c.json(dto, 201);
  });

  app.post('/tickets/:id/comments', requireClientAuth(), async (c) => {
    const client = c.get('clientPortalUser')!;
    const body = await parseJsonBody(c, clientCommentSchema);
    const dto = await addClientPortalComment(client, c.req.param('id'), body, {
      requestId: c.get('requestId'),
      ipAddress: c.get('clientIp'),
      userAgent: c.get('userAgent'),
    });
    return c.json(dto, 201);
  });

  return app;
}
