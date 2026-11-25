import { ClientSession, ObjectId } from 'mongodb';
import { AppError } from '../../domain/errors';
import {
  formatFxMicro,
  formatMoneyMinor,
  fxMicroToDecimal128,
  moneyMinorToDecimal128,
  parseFxMicro,
  parseMoneyMinor,
  validateAndComputeJournalLines,
  type CurrencyCode,
  type RawJournalLineInput,
} from '../../domain/accounting/money';
import {
  buildKeysetFilter,
  clampLimit,
  decodeCursor,
  slicePaginated,
  type PaginatedResult,
} from '../../domain/pagination';
import {
  Collections,
  type JournalEntryDoc,
  type JournalEntryStatus,
  type JournalEntryType,
  type JournalLineDoc,
} from '../../infrastructure/db/collections';
import { withTransaction } from '../../infrastructure/db/mongo';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';
import { getSystemBaseCurrency, resolveFxRate } from './fxService';

export interface JournalLineDTO {
  lineNo: number;
  accountCode: string;
  accountNameSnapshot: string;
  memo: string;
  debitOrig: string;
  creditOrig: string;
  debitBase: string;
  creditBase: string;
}

export interface JournalEntryDTO {
  id: string;
  entryNumber: string;
  entryType: JournalEntryType;
  status: JournalEntryStatus;
  entryDate: string;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  fxRateUsed: string;
  fxRateDate: string;
  description: string;
  reference: string;
  associateId: string | null;
  lines: JournalLineDTO[];
  totalDebitOrig: string;
  totalCreditOrig: string;
  totalDebitBase: string;
  totalCreditBase: string;
  reversedByEntryId: string | null;
  reversesEntryId: string | null;
  version: number;
  createdBy: string;
  postedBy: string | null;
  postedAt: string | null;
  createdAt: string;
  updatedAt: string;
}

export function serializeJournalEntry(doc: JournalEntryDoc): JournalEntryDTO {
  return {
    id: doc._id.toHexString(),
    entryNumber: doc.entryNumber,
    entryType: doc.entryType,
    status: doc.status,
    entryDate: doc.entryDate,
    currency: doc.currency,
    baseCurrency: doc.baseCurrency,
    fxRateUsed: formatFxMicro(parseFxMicro(doc.fxRateUsed)),
    fxRateDate: doc.fxRateDate,
    description: doc.description,
    reference: doc.reference,
    associateId: doc.associateId ? doc.associateId.toHexString() : null,
    lines: doc.lines.map((l) => ({
      lineNo: l.lineNo,
      accountCode: l.accountCode,
      accountNameSnapshot: l.accountNameSnapshot,
      memo: l.memo,
      debitOrig: formatMoneyMinor(parseMoneyMinor(l.debitOrig)),
      creditOrig: formatMoneyMinor(parseMoneyMinor(l.creditOrig)),
      debitBase: formatMoneyMinor(parseMoneyMinor(l.debitBase)),
      creditBase: formatMoneyMinor(parseMoneyMinor(l.creditBase)),
    })),
    totalDebitOrig: formatMoneyMinor(parseMoneyMinor(doc.totalDebitOrig)),
    totalCreditOrig: formatMoneyMinor(parseMoneyMinor(doc.totalCreditOrig)),
    totalDebitBase: formatMoneyMinor(parseMoneyMinor(doc.totalDebitBase)),
    totalCreditBase: formatMoneyMinor(parseMoneyMinor(doc.totalCreditBase)),
    reversedByEntryId: doc.reversedByEntryId ? doc.reversedByEntryId.toHexString() : null,
    reversesEntryId: doc.reversesEntryId ? doc.reversesEntryId.toHexString() : null,
    version: doc.version,
    createdBy: doc.createdBy,
    postedBy: doc.postedBy,
    postedAt: doc.postedAt ? doc.postedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function generateEntryNumber(entryDate: string, session?: ClientSession): Promise<string> {
  const year = entryDate.slice(0, 4);
  const counterId = `JE-${year}`;
  const updated = await Collections.counters().findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    {
      upsert: true,
      returnDocument: 'after',
      ...(session ? { session } : {}),
    }
  );
  const seq = updated?.seq ?? 1;
  return `${counterId}-${String(seq).padStart(6, '0')}`;
}

async function loadActiveAccountMap(
  codes: string[],
  session?: ClientSession
): Promise<Map<string, string>> {
  const uniqueCodes = [...new Set(codes)];
  const docs = await Collections.coaAccounts()
    .find(
      { code: { $in: uniqueCodes }, isActive: true },
      session ? { session } : undefined
    )
    .toArray();
  const map = new Map<string, string>();
  for (const d of docs) {
    map.set(d.code, d.name);
  }
  return map;
}

export interface CreateJournalInput {
  entryType: JournalEntryType;
  entryDate: string;
  currency: CurrencyCode;
  description: string;
  reference?: string;
  associateId?: string | null;
  lines: RawJournalLineInput[];
  postImmediately?: boolean;
  strictFxDate?: boolean;
}

export async function listJournalEntries(params: {
  status?: JournalEntryStatus;
  entryType?: JournalEntryType;
  dateFrom?: string;
  dateTo?: string;
  accountCode?: string;
  currency?: CurrencyCode;
  associateId?: string;
  cursor?: string;
  limit?: string;
}): Promise<PaginatedResult<JournalEntryDTO>> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);

  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.entryType) filter.entryType = params.entryType;
  if (params.currency) filter.currency = params.currency;
  if (params.accountCode) filter['lines.accountCode'] = params.accountCode;
  if (params.associateId && ObjectId.isValid(params.associateId)) {
    filter.associateId = new ObjectId(params.associateId);
  }
  if (params.dateFrom || params.dateTo) {
    const range: Record<string, string> = {};
    if (params.dateFrom) range.$gte = params.dateFrom;
    if (params.dateTo) range.$lte = params.dateTo;
    filter.entryDate = range;
  }

  const keyset = buildKeysetFilter('entryDate', cursor, { direction: 'desc' });
  const query = keyset ? { $and: [filter, keyset] } : filter;

  const docs = await Collections.journalEntries()
    .find(query)
    .sort({ entryDate: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.entryDate, id: doc._id }));
  return {
    items: page.items.map(serializeJournalEntry),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function getJournalEntryById(id: string): Promise<JournalEntryDTO> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid journal entry ID.');
  }
  const doc = await Collections.journalEntries().findOne({ _id: new ObjectId(id) });
  if (!doc) {
    throw AppError.notFound('Journal entry not found.');
  }
  return serializeJournalEntry(doc);
}

export async function createJournalEntry(
  input: CreateJournalInput,
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<JournalEntryDTO> {
  const associateOid =
    input.associateId && ObjectId.isValid(input.associateId) ? new ObjectId(input.associateId) : null;
  if (input.associateId && !associateOid) {
    throw AppError.badRequest('Invalid associateId format.');
  }

  return await withTransaction(async (session) => {
    const baseCurrency = await getSystemBaseCurrency(session);
    const accountNames = await loadActiveAccountMap(
      input.lines.map((l) => l.accountCode),
      session
    );

    const fx = await resolveFxRate(input.entryDate, input.currency, baseCurrency, {
      strictFxDate: input.strictFxDate,
      session,
    });

    const computed = validateAndComputeJournalLines(input.lines, accountNames, fx.rateMicro);
    const entryNumber = await generateEntryNumber(input.entryDate, session);
    const now = new Date();
    const isPosted = Boolean(input.postImmediately);

    const lineDocs: JournalLineDoc[] = computed.lines.map((l) => ({
      lineNo: l.lineNo,
      accountCode: l.accountCode,
      accountNameSnapshot: l.accountNameSnapshot,
      memo: l.memo,
      debitOrig: moneyMinorToDecimal128(l.debitOrigMinor),
      creditOrig: moneyMinorToDecimal128(l.creditOrigMinor),
      debitBase: moneyMinorToDecimal128(l.debitBaseMinor),
      creditBase: moneyMinorToDecimal128(l.creditBaseMinor),
    }));

    const doc: JournalEntryDoc = {
      _id: new ObjectId(),
      entryNumber,
      entryType: input.entryType,
      status: isPosted ? 'POSTED' : 'DRAFT',
      entryDate: input.entryDate,
      currency: input.currency,
      baseCurrency,
      fxRateUsed: fxMicroToDecimal128(fx.rateMicro),
      fxRateDate: fx.fxRateDate,
      description: input.description.trim(),
      reference: (input.reference ?? '').trim(),
      associateId: associateOid,
      lines: lineDocs,
      totalDebitOrig: moneyMinorToDecimal128(computed.totalDebitOrigMinor),
      totalCreditOrig: moneyMinorToDecimal128(computed.totalCreditOrigMinor),
      totalDebitBase: moneyMinorToDecimal128(computed.totalDebitBaseMinor),
      totalCreditBase: moneyMinorToDecimal128(computed.totalCreditBaseMinor),
      reversedByEntryId: null,
      reversesEntryId: null,
      version: 1,
      createdBy: actor.actorId,
      postedBy: isPosted ? actor.actorId : null,
      postedAt: isPosted ? now : null,
      createdAt: now,
      updatedAt: now,
    };

    await Collections.journalEntries().insertOne(doc, session ? { session } : undefined);
    const dto = serializeJournalEntry(doc);

    await writeAuditLog(
      {
        ...actor,
        action: isPosted ? 'JOURNAL_CREATED_AND_POSTED' : 'JOURNAL_DRAFT_CREATED',
        resourceType: 'journal_entry',
        resourceId: dto.id,
        afterSnapshot: dto as unknown as Record<string, unknown>,
      },
      session
    );

    return dto;
  });
}

export async function updateDraftJournalEntry(
  id: string,
  input: CreateJournalInput & { version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<JournalEntryDTO> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid journal entry ID.');
  }
  const oid = new ObjectId(id);

  return await withTransaction(async (session) => {
    const existing = await Collections.journalEntries().findOne(
      { _id: oid },
      session ? { session } : undefined
    );
    if (!existing) {
      throw AppError.notFound('Journal entry not found.');
    }
    if (existing.status !== 'DRAFT') {
      throw AppError.conflict(
        `Journal entry ${existing.entryNumber} is ${existing.status} and immutable. Create a reversal instead.`,
        'journal-immutable'
      );
    }
    if (input.version !== undefined && existing.version !== input.version) {
      throw AppError.conflict(
        `Version conflict: expected ${input.version}, current is ${existing.version}.`,
        'version-conflict'
      );
    }

    const associateOid =
      input.associateId && ObjectId.isValid(input.associateId) ? new ObjectId(input.associateId) : null;
    if (input.associateId && !associateOid) {
      throw AppError.badRequest('Invalid associateId format.');
    }

    const baseCurrency = await getSystemBaseCurrency(session);
    const accountNames = await loadActiveAccountMap(
      input.lines.map((l) => l.accountCode),
      session
    );
    const fx = await resolveFxRate(input.entryDate, input.currency, baseCurrency, {
      strictFxDate: input.strictFxDate,
      session,
    });
    const computed = validateAndComputeJournalLines(input.lines, accountNames, fx.rateMicro);

    const lineDocs: JournalLineDoc[] = computed.lines.map((l) => ({
      lineNo: l.lineNo,
      accountCode: l.accountCode,
      accountNameSnapshot: l.accountNameSnapshot,
      memo: l.memo,
      debitOrig: moneyMinorToDecimal128(l.debitOrigMinor),
      creditOrig: moneyMinorToDecimal128(l.creditOrigMinor),
      debitBase: moneyMinorToDecimal128(l.debitBaseMinor),
      creditBase: moneyMinorToDecimal128(l.creditBaseMinor),
    }));

    const updated = await Collections.journalEntries().findOneAndUpdate(
      { _id: oid, status: 'DRAFT', version: existing.version },
      {
        $set: {
          entryType: input.entryType,
          entryDate: input.entryDate,
          currency: input.currency,
          baseCurrency,
          fxRateUsed: fxMicroToDecimal128(fx.rateMicro),
          fxRateDate: fx.fxRateDate,
          description: input.description.trim(),
          reference: (input.reference ?? '').trim(),
          associateId: associateOid,
          lines: lineDocs,
          totalDebitOrig: moneyMinorToDecimal128(computed.totalDebitOrigMinor),
          totalCreditOrig: moneyMinorToDecimal128(computed.totalCreditOrigMinor),
          totalDebitBase: moneyMinorToDecimal128(computed.totalDebitBaseMinor),
          totalCreditBase: moneyMinorToDecimal128(computed.totalCreditBaseMinor),
          updatedAt: new Date(),
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );

    if (!updated) {
      throw AppError.conflict('Journal entry changed concurrently. Reload and retry.', 'version-conflict');
    }

    const dto = serializeJournalEntry(updated);
    await writeAuditLog(
      {
        ...actor,
        action: 'JOURNAL_DRAFT_UPDATED',
        resourceType: 'journal_entry',
        resourceId: dto.id,
        beforeSnapshot: serializeJournalEntry(existing) as unknown as Record<string, unknown>,
        afterSnapshot: dto as unknown as Record<string, unknown>,
      },
      session
    );

    return dto;
  });
}

export async function postJournalEntry(
  id: string,
  options: { version?: number; strictFxDate?: boolean },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<JournalEntryDTO> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid journal entry ID.');
  }
  const oid = new ObjectId(id);

  return await withTransaction(async (session) => {
    const existing = await Collections.journalEntries().findOne(
      { _id: oid },
      session ? { session } : undefined
    );
    if (!existing) {
      throw AppError.notFound('Journal entry not found.');
    }
    if (existing.status !== 'DRAFT') {
      throw AppError.conflict(
        `Journal entry ${existing.entryNumber} cannot be posted from status ${existing.status}.`,
        'invalid-status-transition'
      );
    }
    if (options.version !== undefined && existing.version !== options.version) {
      throw AppError.conflict(
        `Version conflict: expected ${options.version}, current is ${existing.version}.`,
        'version-conflict'
      );
    }

    const baseCurrency = await getSystemBaseCurrency(session);
    const accountNames = await loadActiveAccountMap(
      existing.lines.map((l) => l.accountCode),
      session
    );
    const fx = await resolveFxRate(existing.entryDate, existing.currency, baseCurrency, {
      strictFxDate: options.strictFxDate,
      session,
    });

    const rawLines: RawJournalLineInput[] = existing.lines.map((l) => ({
      accountCode: l.accountCode,
      memo: l.memo,
      debitOrig: formatMoneyMinor(parseMoneyMinor(l.debitOrig)),
      creditOrig: formatMoneyMinor(parseMoneyMinor(l.creditOrig)),
    }));
    const computed = validateAndComputeJournalLines(rawLines, accountNames, fx.rateMicro);

    const lineDocs: JournalLineDoc[] = computed.lines.map((l) => ({
      lineNo: l.lineNo,
      accountCode: l.accountCode,
      accountNameSnapshot: l.accountNameSnapshot,
      memo: l.memo,
      debitOrig: moneyMinorToDecimal128(l.debitOrigMinor),
      creditOrig: moneyMinorToDecimal128(l.creditOrigMinor),
      debitBase: moneyMinorToDecimal128(l.debitBaseMinor),
      creditBase: moneyMinorToDecimal128(l.creditBaseMinor),
    }));

    const now = new Date();
    const updated = await Collections.journalEntries().findOneAndUpdate(
      { _id: oid, status: 'DRAFT', version: existing.version },
      {
        $set: {
          status: 'POSTED',
          baseCurrency,
          fxRateUsed: fxMicroToDecimal128(fx.rateMicro),
          fxRateDate: fx.fxRateDate,
          lines: lineDocs,
          totalDebitOrig: moneyMinorToDecimal128(computed.totalDebitOrigMinor),
          totalCreditOrig: moneyMinorToDecimal128(computed.totalCreditOrigMinor),
          totalDebitBase: moneyMinorToDecimal128(computed.totalDebitBaseMinor),
          totalCreditBase: moneyMinorToDecimal128(computed.totalCreditBaseMinor),
          postedBy: actor.actorId,
          postedAt: now,
          updatedAt: now,
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );

    if (!updated) {
      throw AppError.conflict('Journal entry changed concurrently before posting.', 'version-conflict');
    }

    const dto = serializeJournalEntry(updated);
    await writeAuditLog(
      {
        ...actor,
        action: 'JOURNAL_POSTED',
        resourceType: 'journal_entry',
        resourceId: dto.id,
        beforeSnapshot: serializeJournalEntry(existing) as unknown as Record<string, unknown>,
        afterSnapshot: dto as unknown as Record<string, unknown>,
      },
      session
    );

    return dto;
  });
}

export async function reverseJournalEntry(
  id: string,
  input: { reversalDate: string; reason: string; version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<{ originalEntry: JournalEntryDTO; reversingEntry: JournalEntryDTO }> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid journal entry ID.');
  }
  const oid = new ObjectId(id);

  return await withTransaction(async (session) => {
    const existing = await Collections.journalEntries().findOne(
      { _id: oid },
      session ? { session } : undefined
    );
    if (!existing) {
      throw AppError.notFound('Journal entry not found.');
    }
    if (existing.status !== 'POSTED' || existing.reversedByEntryId !== null) {
      throw AppError.conflict(
        `Journal entry ${existing.entryNumber} cannot be reversed from status ${existing.status}.`,
        'already-reversed-or-unposted'
      );
    }
    if (input.version !== undefined && existing.version !== input.version) {
      throw AppError.conflict(
        `Version conflict: expected ${input.version}, current is ${existing.version}.`,
        'version-conflict'
      );
    }

    const reversingId = new ObjectId();
    const now = new Date();

    // Lock and mark the original entry REVERSED before inserting the counter-entry
    const updatedOriginal = await Collections.journalEntries().findOneAndUpdate(
      { _id: existing._id, status: 'POSTED', reversedByEntryId: null, version: existing.version },
      {
        $set: {
          status: 'REVERSED',
          reversedByEntryId: reversingId,
          updatedAt: now,
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );

    if (!updatedOriginal) {
      throw AppError.conflict('Journal entry was concurrently reversed or modified.', 'version-conflict');
    }

    const reversingNumber = await generateEntryNumber(input.reversalDate, session);

    // Mirror debits and credits with identical FX rate and base totals
    const mirroredLines: JournalLineDoc[] = existing.lines.map((line, idx) => ({
      lineNo: idx + 1,
      accountCode: line.accountCode,
      accountNameSnapshot: line.accountNameSnapshot,
      memo: `Reversal of ${existing.entryNumber}: ${line.memo || input.reason}`.trim(),
      debitOrig: line.creditOrig,
      creditOrig: line.debitOrig,
      debitBase: line.creditBase,
      creditBase: line.debitBase,
    }));

    const reversingDoc: JournalEntryDoc = {
      _id: reversingId,
      entryNumber: reversingNumber,
      entryType: existing.entryType,
      status: 'POSTED',
      entryDate: input.reversalDate,
      currency: existing.currency,
      baseCurrency: existing.baseCurrency,
      fxRateUsed: existing.fxRateUsed,
      fxRateDate: existing.fxRateDate,
      description: `Reversal of ${existing.entryNumber}: ${input.reason.trim()}`,
      reference: existing.reference,
      associateId: existing.associateId,
      lines: mirroredLines,
      totalDebitOrig: existing.totalCreditOrig,
      totalCreditOrig: existing.totalDebitOrig,
      totalDebitBase: existing.totalCreditBase,
      totalCreditBase: existing.totalDebitBase,
      reversedByEntryId: null,
      reversesEntryId: existing._id,
      version: 1,
      createdBy: actor.actorId,
      postedBy: actor.actorId,
      postedAt: now,
      createdAt: now,
      updatedAt: now,
    };

    await Collections.journalEntries().insertOne(reversingDoc, session ? { session } : undefined);

    const originalDto = serializeJournalEntry(updatedOriginal);
    const reversingDto = serializeJournalEntry(reversingDoc);

    await writeAuditLog(
      {
        ...actor,
        action: 'JOURNAL_REVERSED',
        resourceType: 'journal_entry',
        resourceId: originalDto.id,
        beforeSnapshot: serializeJournalEntry(existing) as unknown as Record<string, unknown>,
        afterSnapshot: {
          originalEntryId: originalDto.id,
          reversingEntryId: reversingDto.id,
          reason: input.reason,
        },
      },
      session
    );

    return { originalEntry: originalDto, reversingEntry: reversingDto };
  });
}

export async function voidDraftJournalEntry(
  id: string,
  version: number | undefined,
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<JournalEntryDTO> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid journal entry ID.');
  }
  const oid = new ObjectId(id);
  const existing = await Collections.journalEntries().findOne({ _id: oid });
  if (!existing) {
    throw AppError.notFound('Journal entry not found.');
  }
  if (existing.status !== 'DRAFT') {
    throw AppError.conflict('Only DRAFT journal entries can be voided.', 'journal-immutable');
  }
  if (version !== undefined && existing.version !== version) {
    throw AppError.conflict('Version conflict on journal entry.', 'version-conflict');
  }

  const updated = await Collections.journalEntries().findOneAndUpdate(
    { _id: oid, status: 'DRAFT', version: existing.version },
    { $set: { status: 'VOIDED', updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    throw AppError.conflict('Journal entry changed concurrently.', 'version-conflict');
  }

  const dto = serializeJournalEntry(updated);
  await writeAuditLog({
    ...actor,
    action: 'JOURNAL_DRAFT_VOIDED',
    resourceType: 'journal_entry',
    resourceId: dto.id,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });
  return dto;
}
