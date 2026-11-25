import { ClientSession, ObjectId } from 'mongodb';
import { AppError } from '../../domain/errors';
import {
  FX_FACTOR,
  formatFxMicro,
  fxMicroToDecimal128,
  invertFxMicro,
  parseFxMicro,
  type CurrencyCode,
} from '../../domain/accounting/money';
import {
  buildKeysetFilter,
  clampLimit,
  decodeCursor,
  slicePaginated,
  type PaginatedResult,
} from '../../domain/pagination';
import { Collections, type ExchangeRateDoc } from '../../infrastructure/db/collections';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';

export interface ExchangeRateDTO {
  id: string;
  date: string;
  fromCurrency: CurrencyCode;
  toCurrency: CurrencyCode;
  rate: string;
  source: string;
  notes: string;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export function serializeExchangeRate(doc: ExchangeRateDoc): ExchangeRateDTO {
  return {
    id: doc._id.toHexString(),
    date: doc.date,
    fromCurrency: doc.fromCurrency,
    toCurrency: doc.toCurrency,
    rate: formatFxMicro(parseFxMicro(doc.rate)),
    source: doc.source,
    notes: doc.notes,
    createdBy: doc.createdBy,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function getSystemBaseCurrency(session?: ClientSession): Promise<CurrencyCode> {
  const settings = await Collections.systemSettings().findOne(
    { _id: 'global' },
    session ? { session } : undefined
  );
  return settings?.baseCurrency ?? 'MMK';
}

export interface ResolvedFxRate {
  rateMicro: bigint;
  rateString: string;
  fxRateDate: string;
  isInverted: boolean;
}

/**
 * Resolves the FX rate for converting fromCurrency -> toCurrency on or before entryDate.
 * Checks direct pair first, then inverse pair, selecting the most recent date <= entryDate.
 */
export async function resolveFxRate(
  entryDate: string,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  options: { strictFxDate?: boolean; session?: ClientSession } = {}
): Promise<ResolvedFxRate> {
  if (fromCurrency === toCurrency) {
    return {
      rateMicro: FX_FACTOR,
      rateString: formatFxMicro(FX_FACTOR),
      fxRateDate: entryDate,
      isInverted: false,
    };
  }

  const dateFilter = options.strictFxDate ? { date: entryDate } : { date: { $lte: entryDate } };
  const findOpts = {
    sort: { date: -1 as const },
    ...(options.session ? { session: options.session } : {}),
  };

  const [direct, inverse] = await Promise.all([
    Collections.exchangeRates().findOne({ fromCurrency, toCurrency, ...dateFilter }, findOpts),
    Collections.exchangeRates().findOne(
      { fromCurrency: toCurrency, toCurrency: fromCurrency, ...dateFilter },
      findOpts
    ),
  ]);

  if (!direct && !inverse) {
    throw AppError.unprocessable(
      `No ${fromCurrency}->${toCurrency} exchange rate exists ${options.strictFxDate ? 'on' : 'on or before'} ${entryDate}.`,
      'fx-rate-not-found',
      'Exchange Rate Not Found',
      [{ field: 'entryDate', message: `Add a daily exchange rate for ${fromCurrency}/${toCurrency} before posting.` }]
    );
  }

  // Pick whichever rate has the newer date (preferring direct on ties)
  if (direct && (!inverse || direct.date >= inverse.date)) {
    const rateMicro = parseFxMicro(direct.rate);
    return {
      rateMicro,
      rateString: formatFxMicro(rateMicro),
      fxRateDate: direct.date,
      isInverted: false,
    };
  }

  const invDoc = inverse!;
  const invertedMicro = invertFxMicro(parseFxMicro(invDoc.rate));
  return {
    rateMicro: invertedMicro,
    rateString: formatFxMicro(invertedMicro),
    fxRateDate: invDoc.date,
    isInverted: true,
  };
}

export async function listExchangeRates(params: {
  from?: CurrencyCode;
  to?: CurrencyCode;
  dateFrom?: string;
  dateTo?: string;
  cursor?: string;
  limit?: string;
}): Promise<PaginatedResult<ExchangeRateDTO>> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);

  const filter: Record<string, unknown> = {};
  if (params.from) filter.fromCurrency = params.from;
  if (params.to) filter.toCurrency = params.to;
  if (params.dateFrom || params.dateTo) {
    const range: Record<string, string> = {};
    if (params.dateFrom) range.$gte = params.dateFrom;
    if (params.dateTo) range.$lte = params.dateTo;
    filter.date = range;
  }

  const keyset = buildKeysetFilter('date', cursor, { direction: 'desc' });
  const query = keyset ? { $and: [filter, keyset] } : filter;

  const docs = await Collections.exchangeRates()
    .find(query)
    .sort({ date: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.date, id: doc._id }));
  return {
    items: page.items.map(serializeExchangeRate),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

async function assertFxDateUnlocked(date: string): Promise<void> {
  const lockedJournal = await Collections.journalEntries().findOne(
    {
      status: { $in: ['POSTED', 'REVERSED'] },
      $or: [{ entryDate: date }, { fxRateDate: date }],
    },
    { projection: { _id: 1 } }
  );

  if (lockedJournal) {
    throw AppError.conflict(
      'Cannot modify an exchange rate locked by posted journal entries on or referencing this date.',
      'fx-rate-locked'
    );
  }
}

export async function createExchangeRate(
  input: {
    date: string;
    fromCurrency: CurrencyCode;
    toCurrency: CurrencyCode;
    rate: string;
    source: string;
    notes?: string;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<ExchangeRateDTO> {
  if (input.fromCurrency === input.toCurrency) {
    throw AppError.badRequest('fromCurrency and toCurrency must be different.', [
      { field: 'toCurrency', message: 'Select a currency distinct from fromCurrency.' },
    ]);
  }

  const existingSameDate = await Collections.exchangeRates().findOne(
    {
      date: input.date,
      fromCurrency: input.fromCurrency,
      toCurrency: input.toCurrency,
    },
    { projection: { _id: 1 } }
  );
  if (existingSameDate) {
    await assertFxDateUnlocked(input.date);
  }

  const rateMicro = parseFxMicro(input.rate, 'rate');
  const now = new Date();
  const doc: ExchangeRateDoc = {
    _id: new ObjectId(),
    date: input.date,
    fromCurrency: input.fromCurrency,
    toCurrency: input.toCurrency,
    rate: fxMicroToDecimal128(rateMicro),
    source: input.source.trim(),
    notes: (input.notes ?? '').trim(),
    createdBy: actor.actorId,
    createdAt: now,
    updatedAt: now,
  };

  await Collections.exchangeRates().insertOne(doc);
  const dto = serializeExchangeRate(doc);

  await writeAuditLog({
    ...actor,
    action: 'FX_RATE_CREATED',
    resourceType: 'exchange_rate',
    resourceId: dto.id,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });

  return dto;
}

export async function updateExchangeRate(
  id: string,
  input: { rate: string; source?: string; notes?: string },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<ExchangeRateDTO> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid exchange rate ID.');
  }
  const oid = new ObjectId(id);
  const before = await Collections.exchangeRates().findOne({ _id: oid });
  if (!before) {
    throw AppError.notFound('Exchange rate not found.');
  }

  await assertFxDateUnlocked(before.date);

  const rateMicro = parseFxMicro(input.rate, 'rate');
  const patch: Partial<ExchangeRateDoc> = {
    rate: fxMicroToDecimal128(rateMicro),
    updatedAt: new Date(),
  };
  if (input.source !== undefined) patch.source = input.source.trim();
  if (input.notes !== undefined) patch.notes = input.notes.trim();

  const updated = await Collections.exchangeRates().findOneAndUpdate(
    { _id: oid },
    { $set: patch },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.notFound('Exchange rate not found.');
  }

  const dto = serializeExchangeRate(updated);
  await writeAuditLog({
    ...actor,
    action: 'FX_RATE_UPDATED',
    resourceType: 'exchange_rate',
    resourceId: dto.id,
    beforeSnapshot: serializeExchangeRate(before) as unknown as Record<string, unknown>,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });

  return dto;
}
