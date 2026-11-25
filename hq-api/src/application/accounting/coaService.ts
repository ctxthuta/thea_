import { ObjectId } from 'mongodb';
import { AppError } from '../../domain/errors';
import {
  Collections,
  type CoaAccountDoc,
  type CoaCategory,
  type NormalBalance,
} from '../../infrastructure/db/collections';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';

export interface CoaAccountDTO {
  id: string;
  code: string;
  name: string;
  category: CoaCategory;
  normalBalance: NormalBalance;
  parentCode: string | null;
  description: string;
  isSystem: boolean;
  isActive: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export function deriveNormalBalance(category: CoaCategory): NormalBalance {
  return category === 'ASSET' || category === 'COGS' || category === 'OPEX' ? 'DEBIT' : 'CREDIT';
}

export function serializeCoaAccount(doc: CoaAccountDoc): CoaAccountDTO {
  return {
    id: doc._id.toHexString(),
    code: doc.code,
    name: doc.name,
    category: doc.category,
    normalBalance: doc.normalBalance,
    parentCode: doc.parentCode,
    description: doc.description,
    isSystem: doc.isSystem,
    isActive: doc.isActive,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export async function listCoaAccounts(params: {
  category?: CoaCategory;
  activeOnly?: boolean;
}): Promise<CoaAccountDTO[]> {
  const filter: Record<string, unknown> = {};
  if (params.category) filter.category = params.category;
  if (params.activeOnly) filter.isActive = true;

  const docs = await Collections.coaAccounts().find(filter).sort({ code: 1 }).toArray();
  return docs.map(serializeCoaAccount);
}

export async function createCoaAccount(
  input: {
    code: string;
    name: string;
    category: CoaCategory;
    parentCode?: string | null;
    description?: string;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CoaAccountDTO> {
  if (input.parentCode) {
    const parent = await Collections.coaAccounts().findOne({ code: input.parentCode });
    if (!parent) {
      throw AppError.badRequest(`Parent account code ${input.parentCode} does not exist.`, [
        { field: 'parentCode', message: 'Parent COA account not found.' },
      ]);
    }
  }

  const now = new Date();
  const doc: CoaAccountDoc = {
    _id: new ObjectId(),
    code: input.code,
    name: input.name.trim(),
    category: input.category,
    normalBalance: deriveNormalBalance(input.category),
    parentCode: input.parentCode ?? null,
    description: (input.description ?? '').trim(),
    isSystem: false,
    isActive: true,
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await Collections.coaAccounts().insertOne(doc);
  const dto = serializeCoaAccount(doc);

  await writeAuditLog({
    ...actor,
    action: 'COA_ACCOUNT_CREATED',
    resourceType: 'coa_account',
    resourceId: doc.code,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });

  return dto;
}

export async function updateCoaAccount(
  code: string,
  input: {
    name?: string;
    description?: string;
    isActive?: boolean;
    version?: number;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CoaAccountDTO> {
  const existing = await Collections.coaAccounts().findOne({ code });
  if (!existing) {
    throw AppError.notFound(`COA account ${code} not found.`);
  }

  const filter: Record<string, unknown> = { code };
  if (input.version !== undefined) {
    filter.version = input.version;
  }

  const patch: Partial<CoaAccountDoc> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.description !== undefined) patch.description = input.description.trim();
  if (input.isActive !== undefined) patch.isActive = input.isActive;

  const updated = await Collections.coaAccounts().findOneAndUpdate(
    filter,
    { $set: patch, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.conflict(
      `COA account ${code} was modified by another request. Current version is ${existing.version}.`,
      'version-conflict'
    );
  }

  const dto = serializeCoaAccount(updated);
  await writeAuditLog({
    ...actor,
    action: 'COA_ACCOUNT_UPDATED',
    resourceType: 'coa_account',
    resourceId: code,
    beforeSnapshot: serializeCoaAccount(existing) as unknown as Record<string, unknown>,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });

  return dto;
}
