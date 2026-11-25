import { Hono } from 'hono';
import { z } from 'zod';
import { NON_NEGATIVE_AMOUNT_REGEX, SUPPORTED_CURRENCIES } from '../domain/accounting/money';
import type {
  CrmAccountStatus,
  CrmDealStage,
  CrmLeadSource,
  CrmLeadStatus,
} from '../infrastructure/db/collections';
import {
  convertLead,
  createAccount,
  createContact,
  createDeal,
  createLead,
  listAccounts,
  listContacts,
  listDeals,
  listLeads,
  updateAccount,
  updateContact,
  updateDeal,
  updateLead,
} from '../application/crm/crmService';
import {
  getGoogleDriveSyncConfig,
  GOOGLE_GID_REGEX,
  GOOGLE_ID_REGEX,
  importLeadsFromCsv,
  isValidGoogleDriveUrl,
  syncGoogleSheetsLeads,
  updateGoogleDriveSyncConfig,
} from '../application/crm/sheetSyncService';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getActorMeta, parseJsonBody, type AppEnv } from '../middleware/context';
import { idempotencyMiddleware } from '../middleware/idempotency';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

const createLeadSchema = z.strictObject({
  source: z.enum(['MANUAL', 'REFERRAL', 'WEB_CONTACT', 'WEB_QUOTE', 'WEB_DEMO_REQUEST']),
  name: z.string().min(1).max(160),
  email: z.string().email().max(200),
  phone: z.string().max(60).optional(),
  company: z.string().max(200).optional(),
  notes: z.string().max(2000).optional(),
  payload: z.record(z.string(), z.unknown()).optional(),
  utm: z.record(z.string(), z.unknown()).optional(),
});

const patchLeadSchema = z.strictObject({
  status: z.enum(['NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISQUALIFIED']).optional(),
  notes: z.string().max(2000).optional(),
  version: z.number().int().min(1).optional(),
});

const convertLeadSchema = z.strictObject({
  accountName: z.string().min(1).max(200),
  website: z.string().max(300).optional(),
  industry: z.string().max(120).optional(),
  country: z.string().max(60).optional(),
  dealTitle: z.string().min(1).max(240),
  currency: z.enum(SUPPORTED_CURRENCIES),
  estimatedValue: z.string().regex(NON_NEGATIVE_AMOUNT_REGEX),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
  version: z.number().int().min(1).optional(),
});

const createAccountSchema = z.strictObject({
  name: z.string().min(1).max(200),
  website: z.string().max(300).optional(),
  industry: z.string().max(120).optional(),
  country: z.string().max(60).optional(),
  status: z.enum(['PROSPECT', 'ACTIVE_CLIENT', 'PAST_CLIENT', 'CHURNED']).optional(),
  notes: z.string().max(2000).optional(),
});

const updateAccountSchema = createAccountSchema.partial().extend({
  version: z.number().int().min(1).optional(),
});

const createContactSchema = z.strictObject({
  accountId: z.string().nullable().optional(),
  fullName: z.string().min(1).max(160),
  email: z.string().email().max(200),
  phone: z.string().max(60).optional(),
  roleTitle: z.string().max(120).optional(),
});

const updateContactSchema = createContactSchema.partial().extend({
  status: z.enum(['ACTIVE', 'INACTIVE']).optional(),
  version: z.number().int().min(1).optional(),
});

const createDealSchema = z.strictObject({
  accountId: z.string().min(1),
  primaryContactId: z.string().nullable().optional(),
  title: z.string().min(1).max(240),
  stage: z.enum(['DISCOVERY', 'SCOPING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES),
  estimatedValue: z.string().regex(NON_NEGATIVE_AMOUNT_REGEX),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
});

const patchDealSchema = z.strictObject({
  title: z.string().min(1).max(240).optional(),
  stage: z.enum(['DISCOVERY', 'SCOPING', 'PROPOSAL', 'NEGOTIATION', 'WON', 'LOST']).optional(),
  currency: z.enum(SUPPORTED_CURRENCIES).optional(),
  estimatedValue: z.string().regex(NON_NEGATIVE_AMOUNT_REGEX).optional(),
  probability: z.number().int().min(0).max(100).optional(),
  expectedCloseDate: z.string().regex(ISO_DATE_REGEX).nullable().optional(),
  lostReason: z.string().max(500).nullable().optional(),
  version: z.number().int().min(1).optional(),
});

const syncConfigSchema = z.strictObject({
  driveFolderId: z.string().regex(GOOGLE_ID_REGEX, 'Invalid Google Drive folder ID'),
  driveFolderUrl: z
    .string()
    .max(500)
    .refine(isValidGoogleDriveUrl, 'Must be a valid https://drive.google.com URL'),
  sheets: z
    .array(
      z.strictObject({
        id: z.string().min(1).max(80),
        label: z.string().min(1).max(200),
        spreadsheetId: z.string().regex(GOOGLE_ID_REGEX, 'Invalid Google Sheet ID'),
        gid: z.string().regex(GOOGLE_GID_REGEX, 'gid must be numeric'),
        source: z.enum(['WEB_CONTACT', 'WEB_QUOTE', 'WEB_DEMO_REQUEST', 'MANUAL', 'REFERRAL']),
        enabled: z.boolean(),
      })
    )
    .max(20),
});

const importCsvSchema = z.strictObject({
  csvText: z.string().min(1).max(2_000_000),
  source: z.enum(['WEB_CONTACT', 'WEB_QUOTE', 'WEB_DEMO_REQUEST', 'MANUAL']),
  label: z.string().max(200).optional(),
});

export function createCrmRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requireAuth());

  // Leads
  app.get('/leads', requirePermission('crm:read'), async (c) => {
    const result = await listLeads({
      status: (c.req.query('status') as CrmLeadStatus | undefined) || undefined,
      source: (c.req.query('source') as CrmLeadSource | undefined) || undefined,
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
    });
    return c.json(result);
  });

  app.post('/leads', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, createLeadSchema);
    const dto = await createLead(body, getActorMeta(c));
    return c.json(dto, 201);
  });

  app.patch('/leads/:id', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, patchLeadSchema);
    const dto = await updateLead(c.req.param('id'), body, getActorMeta(c));
    return c.json(dto);
  });

  app.post(
    '/leads/:id/convert',
    requirePermission('crm:write'),
    idempotencyMiddleware(),
    async (c) => {
      const body = await parseJsonBody(c, convertLeadSchema);
      const result = await convertLead(c.req.param('id'), body, getActorMeta(c));
      return c.json(result, 201);
    }
  );

  // Accounts
  app.get('/accounts', requirePermission('crm:read'), async (c) => {
    const result = await listAccounts({
      status: (c.req.query('status') as CrmAccountStatus | undefined) || undefined,
      search: c.req.query('search') || undefined,
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
    });
    return c.json(result);
  });

  app.post('/accounts', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, createAccountSchema);
    const dto = await createAccount(body, getActorMeta(c));
    return c.json(dto, 201);
  });

  app.put('/accounts/:id', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, updateAccountSchema);
    const dto = await updateAccount(c.req.param('id'), body, getActorMeta(c));
    return c.json(dto);
  });

  // Contacts
  app.get('/contacts', requirePermission('crm:read'), async (c) => {
    const result = await listContacts({
      accountId: c.req.query('accountId') || undefined,
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
    });
    return c.json(result);
  });

  app.post('/contacts', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, createContactSchema);
    const dto = await createContact(body, getActorMeta(c));
    return c.json(dto, 201);
  });

  app.put('/contacts/:id', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, updateContactSchema);
    const dto = await updateContact(c.req.param('id'), body, getActorMeta(c));
    return c.json(dto);
  });

  // Deals
  app.get('/deals', requirePermission('crm:read'), async (c) => {
    const result = await listDeals({
      stage: (c.req.query('stage') as CrmDealStage | undefined) || undefined,
      accountId: c.req.query('accountId') || undefined,
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
    });
    return c.json(result);
  });

  app.post('/deals', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, createDealSchema);
    const dto = await createDeal(body, getActorMeta(c));
    return c.json(dto, 201);
  });

  app.patch('/deals/:id', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, patchDealSchema);
    const dto = await updateDeal(c.req.param('id'), body, getActorMeta(c));
    return c.json(dto);
  });

  // Google Drive & Sheets Sync + Local CSV Import
  app.get('/sync/config', requirePermission('crm:read'), async (c) => {
    return c.json(await getGoogleDriveSyncConfig());
  });

  app.put('/sync/config', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, syncConfigSchema);
    const dto = await updateGoogleDriveSyncConfig(body, getActorMeta(c));
    return c.json(dto);
  });

  app.post('/sync/google-sheets', requirePermission('crm:write'), async (c) => {
    const result = await syncGoogleSheetsLeads(getActorMeta(c));
    return c.json(result);
  });

  app.post('/import/csv', requirePermission('crm:write'), async (c) => {
    const body = await parseJsonBody(c, importCsvSchema);
    const result = await importLeadsFromCsv(body, getActorMeta(c));
    return c.json(result, 201);
  });

  return app;
}
