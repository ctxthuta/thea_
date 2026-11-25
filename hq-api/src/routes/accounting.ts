import { Hono, type Context } from 'hono';
import { z } from 'zod';
import {
  NON_NEGATIVE_AMOUNT_REGEX,
  POSITIVE_FX_RATE_REGEX,
  SUPPORTED_CURRENCIES,
  type CurrencyCode,
} from '../domain/accounting/money';
import type {
  BudgetPeriodType,
  CoaCategory,
  JournalEntryStatus,
  JournalEntryType,
} from '../infrastructure/db/collections';
import {
  createExchangeRate,
  getSystemBaseCurrency,
  listExchangeRates,
  resolveFxRate,
  updateExchangeRate,
} from '../application/accounting/fxService';
import { AppError } from '../domain/errors';
import {
  createCoaAccount,
  listCoaAccounts,
  updateCoaAccount,
} from '../application/accounting/coaService';
import {
  createJournalEntry,
  getJournalEntryById,
  listJournalEntries,
  postJournalEntry,
  reverseJournalEntry,
  updateDraftJournalEntry,
  voidDraftJournalEntry,
} from '../application/accounting/journalService';
import { getBudgetVsActualReport, upsertBudget } from '../application/accounting/budgetService';
import {
  getBalanceSheet,
  getCashFlowReport,
  getFinancialSummary,
  getGeneralLedger,
  getIncomeStatement,
  getMoneyUsageReport,
  getTrialBalance,
} from '../application/accounting/reportService';
import { requireAuth, requirePermission } from '../middleware/auth';
import { getActorMeta, parseJsonBody, type AppEnv } from '../middleware/context';
import { idempotencyMiddleware } from '../middleware/idempotency';

const ISO_DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const COA_CODE_REGEX = /^[1-6]\d{3}$/;

const createFxSchema = z.strictObject({
  date: z.string().regex(ISO_DATE_REGEX, 'Expected YYYY-MM-DD'),
  fromCurrency: z.enum(SUPPORTED_CURRENCIES),
  toCurrency: z.enum(SUPPORTED_CURRENCIES),
  rate: z.string().regex(POSITIVE_FX_RATE_REGEX, 'Expected positive decimal with up to 6 decimals'),
  source: z.string().min(1).max(160),
  notes: z.string().max(500).optional(),
});

const updateFxSchema = z.strictObject({
  rate: z.string().regex(POSITIVE_FX_RATE_REGEX, 'Expected positive decimal with up to 6 decimals'),
  source: z.string().min(1).max(160).optional(),
  notes: z.string().max(500).optional(),
});

const createCoaSchema = z.strictObject({
  code: z.string().regex(COA_CODE_REGEX, 'COA code must be 4 digits starting with 1-6'),
  name: z.string().min(1).max(160),
  category: z.enum(['ASSET', 'LIABILITY', 'EQUITY', 'REVENUE', 'COGS', 'OPEX']),
  parentCode: z.string().regex(COA_CODE_REGEX).nullable().optional(),
  description: z.string().max(500).optional(),
});

const patchCoaSchema = z.strictObject({
  name: z.string().min(1).max(160).optional(),
  description: z.string().max(500).optional(),
  isActive: z.boolean().optional(),
  version: z.number().int().min(1).optional(),
});

const journalLineSchema = z.strictObject({
  accountCode: z.string().regex(COA_CODE_REGEX),
  memo: z.string().max(300).optional(),
  debitOrig: z.string().regex(NON_NEGATIVE_AMOUNT_REGEX),
  creditOrig: z.string().regex(NON_NEGATIVE_AMOUNT_REGEX),
});

const createJournalSchema = z.strictObject({
  entryType: z.enum(['INCOME', 'EXPENSE', 'GENERAL']),
  entryDate: z.string().regex(ISO_DATE_REGEX),
  currency: z.enum(SUPPORTED_CURRENCIES),
  description: z.string().min(1).max(500),
  reference: z.string().max(120).optional(),
  associateId: z.string().nullable().optional(),
  lines: z.array(journalLineSchema).min(2),
  postImmediately: z.boolean().optional(),
  strictFxDate: z.boolean().optional(),
});

const updateJournalSchema = createJournalSchema.extend({
  version: z.number().int().min(1).optional(),
});

const postJournalSchema = z.strictObject({
  version: z.number().int().min(1).optional(),
  strictFxDate: z.boolean().optional(),
});

const reverseJournalSchema = z.strictObject({
  reversalDate: z.string().regex(ISO_DATE_REGEX),
  reason: z.string().min(1).max(500),
  version: z.number().int().min(1).optional(),
});

const upsertBudgetSchema = z.strictObject({
  periodType: z.enum(['MONTHLY', 'QUARTERLY']),
  periodKey: z.string().min(6).max(10),
  accountCode: z.string().regex(COA_CODE_REGEX),
  currency: z.enum(SUPPORTED_CURRENCIES),
  targetAmount: z.string().regex(NON_NEGATIVE_AMOUNT_REGEX),
  notes: z.string().max(500).optional(),
});

function parseOptionalCurrency(raw?: string): CurrencyCode | undefined {
  if (!raw) return undefined;
  const upper = raw.toUpperCase();
  return (SUPPORTED_CURRENCIES as readonly string[]).includes(upper)
    ? (upper as CurrencyCode)
    : undefined;
}

export function createAccountingRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requireAuth());

  // FX Rates
  app.get('/fx-rates', requirePermission('accounting:read'), async (c) => {
    const result = await listExchangeRates({
      from: parseOptionalCurrency(c.req.query('from')),
      to: parseOptionalCurrency(c.req.query('to')),
      dateFrom: c.req.query('dateFrom') || undefined,
      dateTo: c.req.query('dateTo') || undefined,
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
    });
    return c.json(result);
  });

  app.get('/fx-rates/resolve', requirePermission('accounting:read'), async (c) => {
    const requestedDate = c.req.query('date') ?? new Date().toISOString().slice(0, 10);
    if (!ISO_DATE_REGEX.test(requestedDate)) {
      throw AppError.badRequest('Query parameter "date" must match YYYY-MM-DD.', [
        { field: 'date', message: 'Expected format YYYY-MM-DD.' },
      ]);
    }

    const fromCurrency = parseOptionalCurrency(c.req.query('from'));
    if (!fromCurrency) {
      throw AppError.badRequest('Query parameter "from" must be MMK or THB.', [
        { field: 'from', message: 'Supported currencies: MMK, THB.' },
      ]);
    }

    const toCurrency = parseOptionalCurrency(c.req.query('to')) ?? (await getSystemBaseCurrency());
    const resolved = await resolveFxRate(requestedDate, fromCurrency, toCurrency);

    return c.json({
      fromCurrency,
      toCurrency,
      requestedDate,
      fxRateDate: resolved.fxRateDate,
      rate: resolved.rateString,
      isExactDateMatch: resolved.fxRateDate === requestedDate,
    });
  });

  app.post('/fx-rates', requirePermission('accounting:write'), async (c) => {
    const body = await parseJsonBody(c, createFxSchema);
    const dto = await createExchangeRate(body, getActorMeta(c));
    return c.json(dto, 201);
  });

  app.put('/fx-rates/:id', requirePermission('accounting:write'), async (c) => {
    const body = await parseJsonBody(c, updateFxSchema);
    const dto = await updateExchangeRate(c.req.param('id'), body, getActorMeta(c));
    return c.json(dto);
  });

  // Chart of Accounts
  app.get('/coa', requirePermission('accounting:read'), async (c) => {
    const category = c.req.query('category') as CoaCategory | undefined;
    const activeOnly = c.req.query('activeOnly') === 'true';
    const items = await listCoaAccounts({ category, activeOnly });
    return c.json({ items });
  });

  app.post('/coa', requirePermission('accounting:write'), async (c) => {
    const body = await parseJsonBody(c, createCoaSchema);
    const dto = await createCoaAccount(body, getActorMeta(c));
    return c.json(dto, 201);
  });

  app.patch('/coa/:code', requirePermission('accounting:write'), async (c) => {
    const body = await parseJsonBody(c, patchCoaSchema);
    const dto = await updateCoaAccount(c.req.param('code'), body, getActorMeta(c));
    return c.json(dto);
  });

  // Journal Entries
  app.get('/journals', requirePermission('accounting:read'), async (c) => {
    const result = await listJournalEntries({
      status: (c.req.query('status') as JournalEntryStatus | undefined) || undefined,
      entryType: (c.req.query('entryType') as JournalEntryType | undefined) || undefined,
      dateFrom: c.req.query('dateFrom') || undefined,
      dateTo: c.req.query('dateTo') || undefined,
      accountCode: c.req.query('accountCode') || undefined,
      currency: parseOptionalCurrency(c.req.query('currency')),
      associateId: c.req.query('associateId') || undefined,
      cursor: c.req.query('cursor') || undefined,
      limit: c.req.query('limit') || undefined,
    });
    return c.json(result);
  });

  app.get('/journals/:id', requirePermission('accounting:read'), async (c) => {
    const dto = await getJournalEntryById(c.req.param('id'));
    return c.json(dto);
  });

  app.post('/journals', requirePermission('accounting:write'), idempotencyMiddleware(), async (c) => {
    const body = await parseJsonBody(c, createJournalSchema);
    const dto = await createJournalEntry(body, getActorMeta(c));
    return c.json(dto, 201);
  });

  app.put('/journals/:id', requirePermission('accounting:write'), async (c) => {
    const body = await parseJsonBody(c, updateJournalSchema);
    const dto = await updateDraftJournalEntry(c.req.param('id'), body, getActorMeta(c));
    return c.json(dto);
  });

  app.post(
    '/journals/:id/post',
    requirePermission('accounting:write'),
    idempotencyMiddleware(),
    async (c) => {
      const body = await parseJsonBody(c, postJournalSchema);
      const dto = await postJournalEntry(c.req.param('id'), body, getActorMeta(c));
      return c.json(dto);
    }
  );

  app.post(
    '/journals/:id/reverse',
    requirePermission('accounting:write'),
    idempotencyMiddleware(),
    async (c) => {
      const body = await parseJsonBody(c, reverseJournalSchema);
      const result = await reverseJournalEntry(c.req.param('id'), body, getActorMeta(c));
      return c.json(result, 201);
    }
  );

  app.post('/journals/:id/void', requirePermission('accounting:write'), async (c) => {
    const body = await parseJsonBody(c, z.strictObject({ version: z.number().int().min(1).optional() }));
    const dto = await voidDraftJournalEntry(c.req.param('id'), body.version, getActorMeta(c));
    return c.json(dto);
  });

  // Budgets
  app.get('/budgets', requirePermission('accounting:read'), async (c) => {
    const periodType = (c.req.query('periodType') ?? 'MONTHLY').toUpperCase() as BudgetPeriodType;
    const periodKey = c.req.query('periodKey') ?? new Date().toISOString().slice(0, 7);
    const displayCurrency = parseOptionalCurrency(c.req.query('displayCurrency'));

    const report = await getBudgetVsActualReport({ periodType, periodKey, displayCurrency });
    return c.json({
      periodType: report.periodType,
      periodKey: report.periodKey,
      baseCurrency: report.baseCurrency,
      displayCurrency: report.displayCurrency,
      fxTranslationBasis: report.fxTranslationBasis,
      items: report.items,
      rows: report.rows,
    });
  });

  app.put('/budgets', requirePermission('accounting:write'), async (c) => {
    const body = await parseJsonBody(c, upsertBudgetSchema);
    const dto = await upsertBudget(body, getActorMeta(c));
    return c.json(dto);
  });

  // General Ledger
  app.get('/ledger', requirePermission('accounting:read'), async (c) => {
    const dateFrom = c.req.query('dateFrom') || undefined;
    const dateTo = c.req.query('dateTo') || undefined;
    if (dateFrom && !ISO_DATE_REGEX.test(dateFrom)) {
      throw AppError.badRequest('dateFrom must match YYYY-MM-DD.');
    }
    if (dateTo && !ISO_DATE_REGEX.test(dateTo)) {
      throw AppError.badRequest('dateTo must match YYYY-MM-DD.');
    }

    const ledger = await getGeneralLedger({
      accountCode: c.req.query('accountCode') || undefined,
      dateFrom,
      dateTo,
      displayCurrency: parseOptionalCurrency(c.req.query('displayCurrency')),
    });
    return c.json(ledger);
  });

  // Reports
  app.get('/reports/budget-vs-actual', requirePermission('accounting:read'), async (c) => {
    const periodType = (c.req.query('periodType') ?? 'MONTHLY').toUpperCase() as BudgetPeriodType;
    const periodKey = c.req.query('periodKey') ?? new Date().toISOString().slice(0, 7);
    const displayCurrency = parseOptionalCurrency(c.req.query('displayCurrency'));
    const report = await getBudgetVsActualReport({ periodType, periodKey, displayCurrency });
    return c.json({
      periodKey: report.periodKey,
      periodType: report.periodType,
      baseCurrency: report.displayCurrency,
      displayCurrency: report.displayCurrency,
      reportingBaseCurrency: report.baseCurrency,
      fxTranslationBasis: report.fxTranslationBasis,
      rows: report.rows,
    });
  });

  app.get('/reports/trial-balance', requirePermission('accounting:read'), async (c) => {
    const asOf = c.req.query('asOf') ?? new Date().toISOString().slice(0, 10);
    const displayCurrency = parseOptionalCurrency(c.req.query('displayCurrency'));
    return c.json(await getTrialBalance(asOf, displayCurrency));
  });

  const handlePnl = async (c: Context<AppEnv>) => {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = c.req.query('dateFrom') ?? `${today.slice(0, 4)}-01-01`;
    const dateTo = c.req.query('dateTo') ?? today;
    const displayCurrency = parseOptionalCurrency(c.req.query('displayCurrency'));
    return c.json(await getIncomeStatement(dateFrom, dateTo, displayCurrency));
  };

  app.get('/reports/pnl', requirePermission('accounting:read'), handlePnl);
  app.get('/reports/income-statement', requirePermission('accounting:read'), handlePnl);

  app.get('/reports/balance-sheet', requirePermission('accounting:read'), async (c) => {
    const asOf = c.req.query('asOf') ?? new Date().toISOString().slice(0, 10);
    const displayCurrency = parseOptionalCurrency(c.req.query('displayCurrency'));
    return c.json(await getBalanceSheet(asOf, displayCurrency));
  });

  app.get('/reports/cash-flow', requirePermission('accounting:read'), async (c) => {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = c.req.query('dateFrom') ?? `${today.slice(0, 4)}-01-01`;
    const dateTo = c.req.query('dateTo') ?? today;
    const displayCurrency = parseOptionalCurrency(c.req.query('displayCurrency'));
    return c.json(await getCashFlowReport(dateFrom, dateTo, displayCurrency));
  });

  app.get('/reports/money-usage', requirePermission('accounting:read'), async (c) => {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = c.req.query('dateFrom') ?? `${today.slice(0, 4)}-01-01`;
    const dateTo = c.req.query('dateTo') ?? today;
    const displayCurrency = parseOptionalCurrency(c.req.query('displayCurrency'));
    return c.json(await getMoneyUsageReport(dateFrom, dateTo, displayCurrency));
  });

  app.get('/reports/summary', requirePermission('accounting:read'), async (c) => {
    const today = new Date().toISOString().slice(0, 10);
    const dateFrom = c.req.query('dateFrom') ?? `${today.slice(0, 4)}-01-01`;
    const dateTo = c.req.query('dateTo') ?? today;
    const displayCurrency = parseOptionalCurrency(c.req.query('displayCurrency'));
    return c.json(await getFinancialSummary(dateFrom, dateTo, displayCurrency));
  });

  return app;
}
