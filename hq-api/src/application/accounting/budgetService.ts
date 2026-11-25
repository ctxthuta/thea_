import { ObjectId } from 'mongodb';
import { AppError } from '../../domain/errors';
import {
  convertMoneyMinor,
  formatMoneyMinor,
  invertFxMicro,
  moneyMinorToDecimal128,
  parseFxMicro,
  parseMoneyMinor,
  type CurrencyCode,
} from '../../domain/accounting/money';
import {
  Collections,
  type BudgetDoc,
  type BudgetPeriodType,
  type CoaCategory,
} from '../../infrastructure/db/collections';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';
import { getSystemBaseCurrency, resolveFxRate } from './fxService';
import {
  FX_TRANSLATION_BASIS,
  translateJournalLinesToCurrency,
} from './fxTranslation';

export interface BudgetDTO {
  id: string;
  periodType: BudgetPeriodType;
  periodKey: string;
  accountCode: string;
  accountName?: string;
  category?: CoaCategory;
  currency: CurrencyCode;
  targetAmount: string;
  targetBase?: string;
  actualBase?: string;
  varianceBase?: string;
  variancePct?: number;
  notes: string;
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface BudgetVsActualRow {
  accountCode: string;
  accountName: string;
  category: CoaCategory;
  currency: CurrencyCode;
  targetOrig: string;
  targetBase: string;
  actualBase: string;
  varianceBase: string;
  variancePct: number;
}

export function getPeriodDateRange(
  periodType: BudgetPeriodType,
  periodKey: string
): { dateFrom: string; dateTo: string } {
  if (periodType === 'MONTHLY') {
    const match = /^(\d{4})-(\d{2})$/.exec(periodKey);
    if (!match) {
      throw AppError.badRequest('MONTHLY periodKey must match YYYY-MM.', [
        { field: 'periodKey', message: 'Expected format YYYY-MM.' },
      ]);
    }
    const year = Number(match[1]);
    const month = Number(match[2]);
    if (month < 1 || month > 12) {
      throw AppError.badRequest('Month must be between 01 and 12.');
    }
    const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
    return {
      dateFrom: `${match[1]}-${match[2]}-01`,
      dateTo: `${match[1]}-${match[2]}-${String(lastDay).padStart(2, '0')}`,
    };
  }

  const qMatch = /^(\d{4})-Q([1-4])$/.exec(periodKey);
  if (!qMatch) {
    throw AppError.badRequest('QUARTERLY periodKey must match YYYY-Q[1-4].', [
      { field: 'periodKey', message: 'Expected format YYYY-Q1..Q4.' },
    ]);
  }
  const year = Number(qMatch[1]);
  const quarter = Number(qMatch[2]);
  const startMonth = (quarter - 1) * 3 + 1;
  const endMonth = startMonth + 2;
  const lastDay = new Date(Date.UTC(year, endMonth, 0)).getUTCDate();
  return {
    dateFrom: `${qMatch[1]}-${String(startMonth).padStart(2, '0')}-01`,
    dateTo: `${qMatch[1]}-${String(endMonth).padStart(2, '0')}-${String(lastDay).padStart(2, '0')}`,
  };
}

export function serializeBudget(doc: BudgetDoc): BudgetDTO {
  return {
    id: doc._id.toHexString(),
    periodType: doc.periodType,
    periodKey: doc.periodKey,
    accountCode: doc.accountCode,
    currency: doc.currency,
    targetAmount: formatMoneyMinor(parseMoneyMinor(doc.targetAmount)),
    notes: doc.notes,
    version: doc.version,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function upsertBudget(
  input: {
    periodType: BudgetPeriodType;
    periodKey: string;
    accountCode: string;
    currency: CurrencyCode;
    targetAmount: string;
    notes?: string;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<BudgetDTO> {
  // Validate periodKey format
  getPeriodDateRange(input.periodType, input.periodKey);

  const account = await Collections.coaAccounts().findOne({ code: input.accountCode });
  if (!account) {
    throw AppError.badRequest(`Account code ${input.accountCode} does not exist.`, [
      { field: 'accountCode', message: 'Unknown COA account code.' },
    ]);
  }

  const targetMinor = parseMoneyMinor(input.targetAmount, 'targetAmount');
  if (targetMinor < 0n) {
    throw AppError.badRequest('targetAmount must be >= 0.00.', [
      { field: 'targetAmount', message: 'Cannot be negative.' },
    ]);
  }

  const now = new Date();
  const existing = await Collections.budgets().findOne({
    periodType: input.periodType,
    periodKey: input.periodKey,
    accountCode: input.accountCode,
  });

  if (existing) {
    const updated = await Collections.budgets().findOneAndUpdate(
      { _id: existing._id },
      {
        $set: {
          currency: input.currency,
          targetAmount: moneyMinorToDecimal128(targetMinor),
          notes: (input.notes ?? '').trim(),
          updatedAt: now,
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after' }
    );
    const dto = serializeBudget(updated!);
    await writeAuditLog({
      ...actor,
      action: 'BUDGET_UPDATED',
      resourceType: 'budget',
      resourceId: dto.id,
      beforeSnapshot: serializeBudget(existing) as unknown as Record<string, unknown>,
      afterSnapshot: dto as unknown as Record<string, unknown>,
    });
    return dto;
  }

  const doc: BudgetDoc = {
    _id: new ObjectId(),
    periodType: input.periodType,
    periodKey: input.periodKey,
    accountCode: input.accountCode,
    currency: input.currency,
    targetAmount: moneyMinorToDecimal128(targetMinor),
    notes: (input.notes ?? '').trim(),
    version: 1,
    createdBy: actor.actorId,
    createdAt: now,
    updatedAt: now,
  };

  await Collections.budgets().insertOne(doc);
  const dto = serializeBudget(doc);
  await writeAuditLog({
    ...actor,
    action: 'BUDGET_CREATED',
    resourceType: 'budget',
    resourceId: dto.id,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });
  return dto;
}

/**
 * Resolves a period's immutable opening FX rate: prefers rate on or before dateFrom,
 * falling back to the earliest rate inside [dateFrom, dateTo] so later rates in the
 * period never mutate historical budget targets.
 */
async function resolvePeriodOpeningFxMicro(
  dateFrom: string,
  dateTo: string,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode
): Promise<bigint> {
  if (fromCurrency === toCurrency) return 1_000_000n;
  try {
    const opening = await resolveFxRate(dateFrom, fromCurrency, toCurrency);
    return opening.rateMicro;
  } catch {
    const [directEarliest, inverseEarliest] = await Promise.all([
      Collections.exchangeRates().findOne(
        { fromCurrency, toCurrency, date: { $gte: dateFrom, $lte: dateTo } },
        { sort: { date: 1 } }
      ),
      Collections.exchangeRates().findOne(
        { fromCurrency: toCurrency, toCurrency: fromCurrency, date: { $gte: dateFrom, $lte: dateTo } },
        { sort: { date: 1 } }
      ),
    ]);

    if (directEarliest && (!inverseEarliest || directEarliest.date <= inverseEarliest.date)) {
      return parseFxMicro(directEarliest.rate);
    }
    if (inverseEarliest) {
      return invertFxMicro(parseFxMicro(inverseEarliest.rate));
    }
    const fallback = await resolveFxRate(dateTo, fromCurrency, toCurrency);
    return fallback.rateMicro;
  }
}

export async function getBudgetVsActualReport(params: {
  periodType: BudgetPeriodType;
  periodKey: string;
  displayCurrency?: CurrencyCode;
}): Promise<{
  periodType: BudgetPeriodType;
  periodKey: string;
  dateFrom: string;
  dateTo: string;
  baseCurrency: CurrencyCode;
  displayCurrency: CurrencyCode;
  fxTranslationBasis: typeof FX_TRANSLATION_BASIS;
  items: BudgetDTO[];
  rows: BudgetVsActualRow[];
}> {
  const { dateFrom, dateTo } = getPeriodDateRange(params.periodType, params.periodKey);
  const baseCurrency = await getSystemBaseCurrency();
  const displayCurrency = params.displayCurrency ?? baseCurrency;

  const [budgets, coaAccounts, postedJournals] = await Promise.all([
    Collections.budgets()
      .find({ periodType: params.periodType, periodKey: params.periodKey })
      .sort({ accountCode: 1 })
      .toArray(),
    Collections.coaAccounts().find({}).toArray(),
    Collections.journalEntries()
      .find({
        status: { $in: ['POSTED', 'REVERSED'] },
        entryDate: { $gte: dateFrom, $lte: dateTo },
      })
      .toArray(),
  ]);

  const coaMap = new Map(coaAccounts.map((a) => [a.code, a]));

  // Aggregate actuals in displayCurrency using each journal entry's immutable historical entryDate FX rate
  const debitByAccount = new Map<string, bigint>();
  const creditByAccount = new Map<string, bigint>();
  const rateCache = new Map<string, bigint>();

  for (const je of postedJournals) {
    const lines = await translateJournalLinesToCurrency(je, displayCurrency, rateCache);
    for (const line of lines) {
      debitByAccount.set(
        line.accountCode,
        (debitByAccount.get(line.accountCode) ?? 0n) + line.debitDisplay
      );
      creditByAccount.set(
        line.accountCode,
        (creditByAccount.get(line.accountCode) ?? 0n) + line.creditDisplay
      );
    }
  }

  const budgetRateCache = new Map<string, bigint>();
  const rows: BudgetVsActualRow[] = [];
  const items: BudgetDTO[] = [];

  for (const budget of budgets) {
    const account = coaMap.get(budget.accountCode);
    const category: CoaCategory = account?.category ?? 'OPEX';
    const accountName = account?.name ?? budget.accountCode;

    const targetOrigMinor = parseMoneyMinor(budget.targetAmount);
    let targetDisplayMinor = targetOrigMinor;
    if (budget.currency !== displayCurrency) {
      const bKey = `${budget.currency}->${displayCurrency}`;
      let rateMicro = budgetRateCache.get(bKey);
      if (rateMicro === undefined) {
        try {
          rateMicro = await resolvePeriodOpeningFxMicro(
            dateFrom,
            dateTo,
            budget.currency,
            displayCurrency
          );
        } catch {
          rateMicro = 1_000_000n;
        }
        budgetRateCache.set(bKey, rateMicro);
      }
      targetDisplayMinor = convertMoneyMinor(targetOrigMinor, rateMicro);
    }

    const totalDebit = debitByAccount.get(budget.accountCode) ?? 0n;
    const totalCredit = creditByAccount.get(budget.accountCode) ?? 0n;

    // Revenue: actual = credit - debit, variance = actual - target (positive favorable)
    // COGS/OPEX/others: actual = debit - credit, variance = target - actual (positive under-budget)
    const isRevenue = category === 'REVENUE';
    const actualDisplayMinor = isRevenue ? totalCredit - totalDebit : totalDebit - totalCredit;
    const varianceDisplayMinor = isRevenue
      ? actualDisplayMinor - targetDisplayMinor
      : targetDisplayMinor - actualDisplayMinor;

    const variancePct =
      targetDisplayMinor === 0n
        ? 0
        : Number((varianceDisplayMinor * 10000n) / targetDisplayMinor) / 100;

    const row: BudgetVsActualRow = {
      accountCode: budget.accountCode,
      accountName,
      category,
      currency: budget.currency,
      targetOrig: formatMoneyMinor(targetOrigMinor),
      targetBase: formatMoneyMinor(targetDisplayMinor),
      actualBase: formatMoneyMinor(actualDisplayMinor),
      varianceBase: formatMoneyMinor(varianceDisplayMinor),
      variancePct,
    };
    rows.push(row);

    items.push({
      ...serializeBudget(budget),
      accountName,
      category,
      targetBase: row.targetBase,
      actualBase: row.actualBase,
      varianceBase: row.varianceBase,
      variancePct,
    });
  }

  return {
    periodType: params.periodType,
    periodKey: params.periodKey,
    dateFrom,
    dateTo,
    baseCurrency,
    displayCurrency,
    fxTranslationBasis: FX_TRANSLATION_BASIS,
    items,
    rows,
  };
}
