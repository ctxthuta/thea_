import { ObjectId } from 'mongodb';
import { AppError } from '../../domain/errors';
import {
  formatMoneyMinor,
  moneyMinorToDecimal128,
  parseMoneyMinor,
  type CurrencyCode,
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
  type CrmAccountDoc,
  type CrmAccountStatus,
  type CrmContactDoc,
  type CrmDealDoc,
  type CrmDealStage,
  type CrmLeadDoc,
  type CrmLeadSource,
  type CrmLeadStatus,
} from '../../infrastructure/db/collections';
import { withTransaction } from '../../infrastructure/db/mongo';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';

const FREE_EMAIL_DOMAINS = new Set([
  'gmail.com',
  'yahoo.com',
  'outlook.com',
  'hotmail.com',
  'icloud.com',
  'proton.me',
  'protonmail.com',
]);

export function normalizeDomain(website?: string, fallbackEmail?: string): string | null {
  if (website && website.trim().length > 0) {
    try {
      const urlStr = website.includes('://') ? website.trim() : `https://${website.trim()}`;
      const hostname = new URL(urlStr).hostname.toLowerCase().replace(/^www\./, '');
      return hostname || null;
    } catch {
      return null;
    }
  }
  if (fallbackEmail && fallbackEmail.includes('@')) {
    const domain = fallbackEmail.split('@')[1]?.trim().toLowerCase();
    if (domain && !FREE_EMAIL_DOMAINS.has(domain)) {
      return domain;
    }
  }
  return null;
}

export interface CrmLeadDTO {
  id: string;
  source: CrmLeadSource;
  status: CrmLeadStatus;
  name: string;
  email: string;
  phone: string;
  company: string;
  notes: string;
  externalRef: string | null;
  payload: Record<string, unknown>;
  utm: Record<string, unknown>;
  convertedAccountId: string | null;
  convertedContactId: string | null;
  convertedDealId: string | null;
  convertedAt: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmAccountDTO {
  id: string;
  name: string;
  normalizedDomain: string | null;
  industry: string;
  country: string;
  website: string;
  status: CrmAccountStatus;
  ownerId: string | null;
  notes: string;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmContactDTO {
  id: string;
  accountId: string | null;
  fullName: string;
  email: string;
  phone: string;
  roleTitle: string;
  status: 'ACTIVE' | 'INACTIVE';
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface CrmDealDTO {
  id: string;
  accountId: string;
  primaryContactId: string | null;
  title: string;
  stage: CrmDealStage;
  currency: CurrencyCode;
  estimatedValue: string;
  probability: number;
  expectedCloseDate: string | null;
  ownerId: string | null;
  lostReason: string | null;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function serializeLead(doc: CrmLeadDoc): CrmLeadDTO {
  return {
    id: doc._id.toHexString(),
    source: doc.source,
    status: doc.status,
    name: doc.name,
    email: doc.email,
    phone: doc.phone,
    company: doc.company,
    notes: doc.notes,
    externalRef: doc.externalRef ?? null,
    payload: doc.payload,
    utm: doc.utm,
    convertedAccountId: doc.convertedAccountId ? doc.convertedAccountId.toHexString() : null,
    convertedContactId: doc.convertedContactId ? doc.convertedContactId.toHexString() : null,
    convertedDealId: doc.convertedDealId ? doc.convertedDealId.toHexString() : null,
    convertedAt: doc.convertedAt ? doc.convertedAt.toISOString() : null,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeAccount(doc: CrmAccountDoc): CrmAccountDTO {
  return {
    id: doc._id.toHexString(),
    name: doc.name,
    normalizedDomain: doc.normalizedDomain,
    industry: doc.industry,
    country: doc.country,
    website: doc.website,
    status: doc.status,
    ownerId: doc.ownerId,
    notes: doc.notes,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeContact(doc: CrmContactDoc): CrmContactDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId ? doc.accountId.toHexString() : null,
    fullName: doc.fullName,
    email: doc.email,
    phone: doc.phone,
    roleTitle: doc.roleTitle,
    status: doc.status,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeDeal(doc: CrmDealDoc): CrmDealDTO {
  return {
    id: doc._id.toHexString(),
    accountId: doc.accountId.toHexString(),
    primaryContactId: doc.primaryContactId ? doc.primaryContactId.toHexString() : null,
    title: doc.title,
    stage: doc.stage,
    currency: doc.currency,
    estimatedValue: formatMoneyMinor(parseMoneyMinor(doc.estimatedValue)),
    probability: doc.probability,
    expectedCloseDate: doc.expectedCloseDate,
    ownerId: doc.ownerId,
    lostReason: doc.lostReason,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listLeads(params: {
  status?: CrmLeadStatus;
  source?: CrmLeadSource;
  cursor?: string;
  limit?: string;
}): Promise<PaginatedResult<CrmLeadDTO>> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.source) filter.source = params.source;

  const keyset = buildKeysetFilter('createdAt', cursor, { direction: 'desc', isDate: true });
  const query = keyset ? { $and: [filter, keyset] } : filter;

  const docs = await Collections.crmLeads()
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.createdAt, id: doc._id }));
  return {
    items: page.items.map(serializeLead),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function createLead(
  input: {
    source: CrmLeadSource;
    name?: string;
    email: string;
    phone?: string;
    company?: string;
    notes?: string;
    payload?: Record<string, unknown>;
    utm?: Record<string, unknown>;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CrmLeadDTO> {
  const now = new Date();
  const doc: CrmLeadDoc = {
    _id: new ObjectId(),
    source: input.source,
    status: 'NEW',
    name: (input.name ?? '').trim(),
    email: input.email.trim().toLowerCase(),
    phone: (input.phone ?? '').trim(),
    company: (input.company ?? '').trim(),
    notes: (input.notes ?? '').trim(),
    payload: input.payload ?? {},
    utm: input.utm ?? {},
    convertedAccountId: null,
    convertedContactId: null,
    convertedDealId: null,
    convertedAt: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await Collections.crmLeads().insertOne(doc);
  const dto = serializeLead(doc);

  await writeAuditLog({
    ...actor,
    action: 'CRM_LEAD_CREATED',
    resourceType: 'crm_lead',
    resourceId: dto.id,
    afterSnapshot: { source: dto.source, email: dto.email, company: dto.company },
  });

  return dto;
}

export async function updateLead(
  id: string,
  input: { status?: CrmLeadStatus; notes?: string; version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CrmLeadDTO> {
  if (!ObjectId.isValid(id)) throw AppError.badRequest('Invalid lead ID.');
  const oid = new ObjectId(id);
  const existing = await Collections.crmLeads().findOne({ _id: oid });
  if (!existing) throw AppError.notFound('Lead not found.');

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes.trim();

  const updated = await Collections.crmLeads().findOneAndUpdate(
    filter,
    { $set: patch, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.conflict(`Lead version conflict. Current version is ${existing.version}.`, 'version-conflict');
  }

  const dto = serializeLead(updated);
  await writeAuditLog({
    ...actor,
    action: 'CRM_LEAD_UPDATED',
    resourceType: 'crm_lead',
    resourceId: dto.id,
    beforeSnapshot: { status: existing.status, notes: existing.notes },
    afterSnapshot: { status: dto.status, notes: dto.notes },
  });
  return dto;
}

export async function convertLead(
  id: string,
  input: {
    accountName: string;
    website?: string;
    industry?: string;
    country?: string;
    dealTitle: string;
    currency: CurrencyCode;
    estimatedValue: string;
    probability?: number;
    expectedCloseDate?: string | null;
    version?: number;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<{
  lead: CrmLeadDTO;
  account: CrmAccountDTO;
  contact: CrmContactDTO;
  deal: CrmDealDTO;
}> {
  if (!ObjectId.isValid(id)) throw AppError.badRequest('Invalid lead ID.');
  const leadOid = new ObjectId(id);
  const estMinor = parseMoneyMinor(input.estimatedValue, 'estimatedValue');
  if (estMinor < 0n) {
    throw AppError.badRequest('estimatedValue cannot be negative.');
  }

  return await withTransaction(async (session) => {
    const lead = await Collections.crmLeads().findOne(
      { _id: leadOid },
      session ? { session } : undefined
    );
    if (!lead) throw AppError.notFound('Lead not found.');
    if (lead.status === 'CONVERTED') {
      throw AppError.conflict('Lead has already been converted.', 'lead-already-converted');
    }
    if (input.version !== undefined && lead.version !== input.version) {
      throw AppError.conflict(`Lead version conflict. Current version is ${lead.version}.`, 'version-conflict');
    }

    const now = new Date();
    const domain = normalizeDomain(input.website, lead.email);

    // Upsert account by normalizedDomain when available, otherwise create new
    let accountDoc: CrmAccountDoc | null = null;
    if (domain) {
      accountDoc = await Collections.crmAccounts().findOne(
        { normalizedDomain: domain },
        session ? { session } : undefined
      );
    }
    if (!accountDoc) {
      const newAccount: CrmAccountDoc = {
        _id: new ObjectId(),
        name: input.accountName.trim(),
        normalizedDomain: domain,
        industry: (input.industry ?? '').trim(),
        country: (input.country ?? '').trim(),
        website: (input.website ?? '').trim(),
        status: 'PROSPECT',
        ownerId: actor.actorId,
        notes: lead.notes,
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await Collections.crmAccounts().insertOne(newAccount, session ? { session } : undefined);
      accountDoc = newAccount;
    }

    // Upsert contact by normalized email
    let contactDoc = await Collections.crmContacts().findOne(
      { email: lead.email },
      session ? { session } : undefined
    );
    if (!contactDoc) {
      const newContact: CrmContactDoc = {
        _id: new ObjectId(),
        accountId: accountDoc._id,
        fullName: lead.name || lead.email.split('@')[0] || 'Unknown Contact',
        email: lead.email,
        phone: lead.phone,
        roleTitle: '',
        status: 'ACTIVE',
        version: 1,
        createdAt: now,
        updatedAt: now,
      };
      await Collections.crmContacts().insertOne(newContact, session ? { session } : undefined);
      contactDoc = newContact;
    } else if (!contactDoc.accountId) {
      const updatedContact = await Collections.crmContacts().findOneAndUpdate(
        { _id: contactDoc._id },
        { $set: { accountId: accountDoc._id, updatedAt: now }, $inc: { version: 1 } },
        { returnDocument: 'after', ...(session ? { session } : {}) }
      );
      if (updatedContact) contactDoc = updatedContact;
    }

    const dealDoc: CrmDealDoc = {
      _id: new ObjectId(),
      accountId: accountDoc._id,
      primaryContactId: contactDoc._id,
      title: input.dealTitle.trim(),
      stage: 'DISCOVERY',
      currency: input.currency,
      estimatedValue: moneyMinorToDecimal128(estMinor),
      probability: input.probability ?? 25,
      expectedCloseDate: input.expectedCloseDate ?? null,
      ownerId: actor.actorId,
      lostReason: null,
      version: 1,
      createdAt: now,
      updatedAt: now,
    };
    await Collections.crmDeals().insertOne(dealDoc, session ? { session } : undefined);

    const updatedLead = await Collections.crmLeads().findOneAndUpdate(
      { _id: leadOid, version: lead.version },
      {
        $set: {
          status: 'CONVERTED',
          convertedAccountId: accountDoc._id,
          convertedContactId: contactDoc._id,
          convertedDealId: dealDoc._id,
          convertedAt: now,
          updatedAt: now,
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );

    if (!updatedLead) {
      throw AppError.conflict('Lead changed concurrently during conversion.', 'version-conflict');
    }

    const result = {
      lead: serializeLead(updatedLead),
      account: serializeAccount(accountDoc),
      contact: serializeContact(contactDoc),
      deal: serializeDeal(dealDoc),
    };

    await writeAuditLog(
      {
        ...actor,
        action: 'CRM_LEAD_CONVERTED',
        resourceType: 'crm_lead',
        resourceId: result.lead.id,
        afterSnapshot: {
          accountId: result.account.id,
          contactId: result.contact.id,
          dealId: result.deal.id,
        },
      },
      session
    );

    return result;
  });
}

export async function listAccounts(params: {
  status?: CrmAccountStatus;
  search?: string;
  cursor?: string;
  limit?: string;
}): Promise<PaginatedResult<CrmAccountDTO>> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);
  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.search && params.search.trim().length > 0) {
    const escaped = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ name: regex }, { normalizedDomain: regex }, { industry: regex }];
  }

  const keyset = buildKeysetFilter('createdAt', cursor, { direction: 'desc', isDate: true });
  const query = keyset ? { $and: [filter, keyset] } : filter;

  const docs = await Collections.crmAccounts()
    .find(query)
    .sort({ createdAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.createdAt, id: doc._id }));
  return {
    items: page.items.map(serializeAccount),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function createAccount(
  input: {
    name: string;
    website?: string;
    industry?: string;
    country?: string;
    status?: CrmAccountStatus;
    notes?: string;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CrmAccountDTO> {
  const now = new Date();
  const doc: CrmAccountDoc = {
    _id: new ObjectId(),
    name: input.name.trim(),
    normalizedDomain: normalizeDomain(input.website),
    industry: (input.industry ?? '').trim(),
    country: (input.country ?? '').trim(),
    website: (input.website ?? '').trim(),
    status: input.status ?? 'PROSPECT',
    ownerId: actor.actorId,
    notes: (input.notes ?? '').trim(),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  await Collections.crmAccounts().insertOne(doc);
  const dto = serializeAccount(doc);
  await writeAuditLog({
    ...actor,
    action: 'CRM_ACCOUNT_CREATED',
    resourceType: 'crm_account',
    resourceId: dto.id,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });
  return dto;
}

export async function updateAccount(
  id: string,
  input: {
    name?: string;
    website?: string;
    industry?: string;
    country?: string;
    status?: CrmAccountStatus;
    notes?: string;
    version?: number;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CrmAccountDTO> {
  if (!ObjectId.isValid(id)) throw AppError.badRequest('Invalid account ID.');
  const oid = new ObjectId(id);
  const existing = await Collections.crmAccounts().findOne({ _id: oid });
  if (!existing) throw AppError.notFound('Account not found.');

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.website !== undefined) {
    patch.website = input.website.trim();
    patch.normalizedDomain = normalizeDomain(input.website);
  }
  if (input.industry !== undefined) patch.industry = input.industry.trim();
  if (input.country !== undefined) patch.country = input.country.trim();
  if (input.status !== undefined) patch.status = input.status;
  if (input.notes !== undefined) patch.notes = input.notes.trim();

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const updated = await Collections.crmAccounts().findOneAndUpdate(
    filter,
    { $set: patch, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    throw AppError.conflict(`Account version conflict. Current version is ${existing.version}.`, 'version-conflict');
  }
  const dto = serializeAccount(updated);
  await writeAuditLog({
    ...actor,
    action: 'CRM_ACCOUNT_UPDATED',
    resourceType: 'crm_account',
    resourceId: dto.id,
    beforeSnapshot: serializeAccount(existing) as unknown as Record<string, unknown>,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });
  return dto;
}

export async function listContacts(params: {
  accountId?: string;
  cursor?: string;
  limit?: string;
}): Promise<PaginatedResult<CrmContactDTO>> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);
  const filter: Record<string, unknown> = {};
  if (params.accountId && ObjectId.isValid(params.accountId)) {
    filter.accountId = new ObjectId(params.accountId);
  }

  const keyset = buildKeysetFilter('fullName', cursor, { direction: 'asc' });
  const query = keyset ? { $and: [filter, keyset] } : filter;

  const docs = await Collections.crmContacts()
    .find(query)
    .sort({ fullName: 1, _id: 1 })
    .limit(limit + 1)
    .toArray();

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.fullName, id: doc._id }));
  return {
    items: page.items.map(serializeContact),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function createContact(
  input: {
    accountId?: string | null;
    fullName: string;
    email: string;
    phone?: string;
    roleTitle?: string;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CrmContactDTO> {
  const accountOid =
    input.accountId && ObjectId.isValid(input.accountId) ? new ObjectId(input.accountId) : null;
  if (input.accountId && !accountOid) throw AppError.badRequest('Invalid accountId.');

  const now = new Date();
  const doc: CrmContactDoc = {
    _id: new ObjectId(),
    accountId: accountOid,
    fullName: input.fullName.trim(),
    email: input.email.trim().toLowerCase(),
    phone: (input.phone ?? '').trim(),
    roleTitle: (input.roleTitle ?? '').trim(),
    status: 'ACTIVE',
    version: 1,
    createdAt: now,
    updatedAt: now,
  };
  await Collections.crmContacts().insertOne(doc);
  const dto = serializeContact(doc);
  await writeAuditLog({
    ...actor,
    action: 'CRM_CONTACT_CREATED',
    resourceType: 'crm_contact',
    resourceId: dto.id,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });
  return dto;
}

export async function updateContact(
  id: string,
  input: {
    accountId?: string | null;
    fullName?: string;
    email?: string;
    phone?: string;
    roleTitle?: string;
    status?: 'ACTIVE' | 'INACTIVE';
    version?: number;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CrmContactDTO> {
  if (!ObjectId.isValid(id)) throw AppError.badRequest('Invalid contact ID.');
  const oid = new ObjectId(id);
  const existing = await Collections.crmContacts().findOne({ _id: oid });
  if (!existing) throw AppError.notFound('Contact not found.');

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.accountId !== undefined) {
    if (input.accountId === null || input.accountId === '') {
      patch.accountId = null;
    } else if (ObjectId.isValid(input.accountId)) {
      patch.accountId = new ObjectId(input.accountId);
    } else {
      throw AppError.badRequest('Invalid accountId.');
    }
  }
  if (input.fullName !== undefined) patch.fullName = input.fullName.trim();
  if (input.email !== undefined) patch.email = input.email.trim().toLowerCase();
  if (input.phone !== undefined) patch.phone = input.phone.trim();
  if (input.roleTitle !== undefined) patch.roleTitle = input.roleTitle.trim();
  if (input.status !== undefined) patch.status = input.status;

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const updated = await Collections.crmContacts().findOneAndUpdate(
    filter,
    { $set: patch, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    throw AppError.conflict(`Contact version conflict. Current version is ${existing.version}.`, 'version-conflict');
  }
  const dto = serializeContact(updated);
  await writeAuditLog({
    ...actor,
    action: 'CRM_CONTACT_UPDATED',
    resourceType: 'crm_contact',
    resourceId: dto.id,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });
  return dto;
}

export async function listDeals(params: {
  stage?: CrmDealStage;
  accountId?: string;
  cursor?: string;
  limit?: string;
}): Promise<PaginatedResult<CrmDealDTO>> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);
  const filter: Record<string, unknown> = {};
  if (params.stage) filter.stage = params.stage;
  if (params.accountId && ObjectId.isValid(params.accountId)) {
    filter.accountId = new ObjectId(params.accountId);
  }

  const keyset = buildKeysetFilter('updatedAt', cursor, { direction: 'desc', isDate: true });
  const query = keyset ? { $and: [filter, keyset] } : filter;

  const docs = await Collections.crmDeals()
    .find(query)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.updatedAt, id: doc._id }));
  return {
    items: page.items.map(serializeDeal),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function createDeal(
  input: {
    accountId: string;
    primaryContactId?: string | null;
    title: string;
    stage?: CrmDealStage;
    currency: CurrencyCode;
    estimatedValue: string;
    probability?: number;
    expectedCloseDate?: string | null;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CrmDealDTO> {
  if (!ObjectId.isValid(input.accountId)) throw AppError.badRequest('Invalid accountId.');
  const accountOid = new ObjectId(input.accountId);
  const account = await Collections.crmAccounts().findOne({ _id: accountOid }, { projection: { _id: 1 } });
  if (!account) throw AppError.badRequest('Referenced CRM account does not exist.');

  let contactOid: ObjectId | null = null;
  if (input.primaryContactId) {
    if (!ObjectId.isValid(input.primaryContactId)) throw AppError.badRequest('Invalid primaryContactId.');
    contactOid = new ObjectId(input.primaryContactId);
  }

  const estMinor = parseMoneyMinor(input.estimatedValue, 'estimatedValue');
  if (estMinor < 0n) throw AppError.badRequest('estimatedValue cannot be negative.');

  const now = new Date();
  const doc: CrmDealDoc = {
    _id: new ObjectId(),
    accountId: accountOid,
    primaryContactId: contactOid,
    title: input.title.trim(),
    stage: input.stage ?? 'DISCOVERY',
    currency: input.currency,
    estimatedValue: moneyMinorToDecimal128(estMinor),
    probability: input.probability ?? 25,
    expectedCloseDate: input.expectedCloseDate ?? null,
    ownerId: actor.actorId,
    lostReason: null,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await Collections.crmDeals().insertOne(doc);
  const dto = serializeDeal(doc);
  await writeAuditLog({
    ...actor,
    action: 'CRM_DEAL_CREATED',
    resourceType: 'crm_deal',
    resourceId: dto.id,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });
  return dto;
}

export async function updateDeal(
  id: string,
  input: {
    title?: string;
    stage?: CrmDealStage;
    currency?: CurrencyCode;
    estimatedValue?: string;
    probability?: number;
    expectedCloseDate?: string | null;
    lostReason?: string | null;
    version?: number;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CrmDealDTO> {
  if (!ObjectId.isValid(id)) throw AppError.badRequest('Invalid deal ID.');
  const oid = new ObjectId(id);
  const existing = await Collections.crmDeals().findOne({ _id: oid });
  if (!existing) throw AppError.notFound('Deal not found.');

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.stage !== undefined) patch.stage = input.stage;
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.estimatedValue !== undefined) {
    const estMinor = parseMoneyMinor(input.estimatedValue, 'estimatedValue');
    if (estMinor < 0n) throw AppError.badRequest('estimatedValue cannot be negative.');
    patch.estimatedValue = moneyMinorToDecimal128(estMinor);
  }
  if (input.probability !== undefined) patch.probability = input.probability;
  if (input.expectedCloseDate !== undefined) patch.expectedCloseDate = input.expectedCloseDate;
  if (input.lostReason !== undefined) patch.lostReason = input.lostReason;

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const updated = await Collections.crmDeals().findOneAndUpdate(
    filter,
    { $set: patch, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );
  if (!updated) {
    throw AppError.conflict(`Deal version conflict. Current version is ${existing.version}.`, 'version-conflict');
  }
  const dto = serializeDeal(updated);
  await writeAuditLog({
    ...actor,
    action: 'CRM_DEAL_UPDATED',
    resourceType: 'crm_deal',
    resourceId: dto.id,
    beforeSnapshot: { stage: existing.stage, estimatedValue: formatMoneyMinor(parseMoneyMinor(existing.estimatedValue)) },
    afterSnapshot: { stage: dto.stage, estimatedValue: dto.estimatedValue },
  });
  return dto;
}
