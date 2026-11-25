import { ObjectId } from 'mongodb';
import { AppError } from '../../domain/errors';
import {
  buildKeysetFilter,
  clampLimit,
  decodeCursor,
  slicePaginated,
  type PaginatedResult,
} from '../../domain/pagination';
import {
  CMS_SECTIONS,
  Collections,
  type CmsDocumentDoc,
  type CmsRevisionDoc,
  type CmsSectionKey,
} from '../../infrastructure/db/collections';
import { withTransaction } from '../../infrastructure/db/mongo';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';
import { validateCmsSectionData } from './cmsSchemas';

export interface CmsSectionSummaryDTO {
  section: CmsSectionKey;
  status: 'draft' | 'published';
  version: number;
  publishedVersion: number;
  hasUnpublishedChanges: boolean;
  updatedBy: string;
  publishedBy: string | null;
  publishedAt: string | null;
  updatedAt: string;
}

export interface CmsDocumentDTO extends CmsSectionSummaryDTO {
  id: string;
  draftData: Record<string, unknown>;
  publishedData: Record<string, unknown> | null;
  createdAt: string;
}

export interface CmsRevisionDTO {
  id: string;
  section: CmsSectionKey;
  version: number;
  data: Record<string, unknown>;
  changeSummary: string;
  publishedBy: string;
  publishedAt: string;
}

export function assertValidCmsSection(raw: string): CmsSectionKey {
  if (!(CMS_SECTIONS as readonly string[]).includes(raw)) {
    throw AppError.badRequest(`Unknown CMS section "${raw}".`, [
      { field: 'section', message: `Allowed sections: ${CMS_SECTIONS.join(', ')}` },
    ]);
  }
  return raw as CmsSectionKey;
}

export function serializeCmsDocument(doc: CmsDocumentDoc): CmsDocumentDTO {
  return {
    id: doc._id.toHexString(),
    section: doc.section,
    status: doc.status,
    version: doc.version,
    publishedVersion: doc.publishedVersion,
    hasUnpublishedChanges: doc.hasUnpublishedChanges,
    draftData: doc.draftData,
    publishedData: doc.publishedData,
    updatedBy: doc.updatedBy,
    publishedBy: doc.publishedBy,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

export function serializeCmsRevision(doc: CmsRevisionDoc): CmsRevisionDTO {
  return {
    id: doc._id.toHexString(),
    section: doc.section,
    version: doc.version,
    data: doc.data,
    changeSummary: doc.changeSummary,
    publishedBy: doc.publishedBy,
    publishedAt: doc.publishedAt.toISOString(),
  };
}

export async function listCmsSections(): Promise<CmsSectionSummaryDTO[]> {
  const docs = await Collections.cmsDocuments().find({}).sort({ section: 1 }).toArray();
  return docs.map((doc) => ({
    section: doc.section,
    status: doc.status,
    version: doc.version,
    publishedVersion: doc.publishedVersion,
    hasUnpublishedChanges: doc.hasUnpublishedChanges,
    updatedBy: doc.updatedBy,
    publishedBy: doc.publishedBy,
    publishedAt: doc.publishedAt ? doc.publishedAt.toISOString() : null,
    updatedAt: doc.updatedAt.toISOString(),
  }));
}

export async function getCmsSection(section: CmsSectionKey): Promise<CmsDocumentDTO> {
  const doc = await Collections.cmsDocuments().findOne({ section });
  if (!doc) {
    throw AppError.notFound(`CMS section "${section}" not found.`);
  }
  return serializeCmsDocument(doc);
}

export async function updateCmsDraft(
  section: CmsSectionKey,
  input: { draftData: Record<string, unknown>; version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CmsDocumentDTO> {
  const validatedData = validateCmsSectionData(section, input.draftData);
  const existing = await Collections.cmsDocuments().findOne({ section });
  const now = new Date();

  if (!existing) {
    const doc: CmsDocumentDoc = {
      _id: new ObjectId(),
      section,
      status: 'draft',
      version: 1,
      publishedVersion: 0,
      hasUnpublishedChanges: true,
      draftData: validatedData,
      publishedData: null,
      updatedBy: actor.actorId,
      publishedBy: null,
      publishedAt: null,
      createdAt: now,
      updatedAt: now,
    };
    await Collections.cmsDocuments().insertOne(doc);
    const dto = serializeCmsDocument(doc);
    await writeAuditLog({
      ...actor,
      action: 'CMS_DRAFT_SAVED',
      resourceType: 'cms_document',
      resourceId: section,
      afterSnapshot: { section, version: dto.version },
    });
    return dto;
  }

  const filter: Record<string, unknown> = { section };
  if (input.version !== undefined) filter.version = input.version;

  const updated = await Collections.cmsDocuments().findOneAndUpdate(
    filter,
    {
      $set: {
        draftData: validatedData,
        hasUnpublishedChanges: true,
        updatedBy: actor.actorId,
        updatedAt: now,
      },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.conflict(
      `CMS section "${section}" was modified concurrently. Current version is ${existing.version}.`,
      'version-conflict'
    );
  }

  const dto = serializeCmsDocument(updated);
  await writeAuditLog({
    ...actor,
    action: 'CMS_DRAFT_SAVED',
    resourceType: 'cms_document',
    resourceId: section,
    beforeSnapshot: { section, version: existing.version },
    afterSnapshot: { section, version: dto.version },
  });

  return dto;
}

export async function publishCmsSection(
  section: CmsSectionKey,
  input: { changeSummary?: string; version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CmsDocumentDTO> {
  return await withTransaction(async (session) => {
    const existing = await Collections.cmsDocuments().findOne(
      { section },
      session ? { session } : undefined
    );
    if (!existing) {
      throw AppError.notFound(`CMS section "${section}" not found.`);
    }
    if (input.version !== undefined && existing.version !== input.version) {
      throw AppError.conflict(
        `Version conflict on CMS section "${section}". Expected ${input.version}, current is ${existing.version}.`,
        'version-conflict'
      );
    }

    const validatedData = validateCmsSectionData(section, existing.draftData);
    const nextPublishedVersion = existing.publishedVersion + 1;
    const now = new Date();

    const updated = await Collections.cmsDocuments().findOneAndUpdate(
      { section, version: existing.version },
      {
        $set: {
          status: 'published',
          publishedData: validatedData,
          publishedVersion: nextPublishedVersion,
          hasUnpublishedChanges: false,
          publishedBy: actor.actorId,
          publishedAt: now,
          updatedBy: actor.actorId,
          updatedAt: now,
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );

    if (!updated) {
      throw AppError.conflict('CMS section modified concurrently during publish.', 'version-conflict');
    }

    await Collections.cmsRevisions().insertOne(
      {
        _id: new ObjectId(),
        section,
        version: nextPublishedVersion,
        data: validatedData,
        changeSummary: (input.changeSummary ?? `Published version ${nextPublishedVersion}`).trim(),
        publishedBy: actor.actorId,
        publishedAt: now,
      },
      session ? { session } : undefined
    );

    const dto = serializeCmsDocument(updated);
    await writeAuditLog(
      {
        ...actor,
        action: 'CMS_PUBLISHED',
        resourceType: 'cms_document',
        resourceId: section,
        afterSnapshot: {
          section,
          publishedVersion: dto.publishedVersion,
          changeSummary: input.changeSummary ?? '',
        },
      },
      session
    );

    return dto;
  });
}

export async function listCmsRevisions(
  section: CmsSectionKey,
  params: { cursor?: string; limit?: string }
): Promise<PaginatedResult<CmsRevisionDTO>> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);
  const baseFilter = { section };
  const keyset = buildKeysetFilter('version', cursor, { direction: 'desc' });
  const query = keyset ? { $and: [baseFilter, keyset] } : baseFilter;

  const docs = await Collections.cmsRevisions()
    .find(query)
    .sort({ version: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.version, id: doc._id }));
  return {
    items: page.items.map(serializeCmsRevision),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function rollbackCmsSection(
  section: CmsSectionKey,
  input: { targetVersion: number; changeSummary?: string; version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<CmsDocumentDTO> {
  return await withTransaction(async (session) => {
    const [existing, revision] = await Promise.all([
      Collections.cmsDocuments().findOne({ section }, session ? { session } : undefined),
      Collections.cmsRevisions().findOne(
        { section, version: input.targetVersion },
        session ? { session } : undefined
      ),
    ]);

    if (!existing) {
      throw AppError.notFound(`CMS section "${section}" not found.`);
    }
    if (!revision) {
      throw AppError.notFound(
        `Revision v${input.targetVersion} not found for CMS section "${section}".`
      );
    }
    if (input.version !== undefined && existing.version !== input.version) {
      throw AppError.conflict(
        `Version conflict on CMS section "${section}". Current version is ${existing.version}.`,
        'version-conflict'
      );
    }

    const nextPublishedVersion = existing.publishedVersion + 1;
    const now = new Date();
    const summary =
      input.changeSummary?.trim() || `Rolled back to revision v${input.targetVersion}`;

    const updated = await Collections.cmsDocuments().findOneAndUpdate(
      { section, version: existing.version },
      {
        $set: {
          status: 'published',
          draftData: revision.data,
          publishedData: revision.data,
          publishedVersion: nextPublishedVersion,
          hasUnpublishedChanges: false,
          publishedBy: actor.actorId,
          publishedAt: now,
          updatedBy: actor.actorId,
          updatedAt: now,
        },
        $inc: { version: 1 },
      },
      { returnDocument: 'after', ...(session ? { session } : {}) }
    );

    if (!updated) {
      throw AppError.conflict('CMS section modified concurrently during rollback.', 'version-conflict');
    }

    await Collections.cmsRevisions().insertOne(
      {
        _id: new ObjectId(),
        section,
        version: nextPublishedVersion,
        data: revision.data,
        changeSummary: summary,
        publishedBy: actor.actorId,
        publishedAt: now,
      },
      session ? { session } : undefined
    );

    const dto = serializeCmsDocument(updated);
    await writeAuditLog(
      {
        ...actor,
        action: 'CMS_ROLLED_BACK',
        resourceType: 'cms_document',
        resourceId: section,
        afterSnapshot: {
          section,
          targetVersion: input.targetVersion,
          newPublishedVersion: nextPublishedVersion,
        },
      },
      session
    );

    return dto;
  });
}

export async function getPublicCmsSection(section: CmsSectionKey): Promise<{
  section: CmsSectionKey;
  version: number;
  publishedAt: string;
  data: Record<string, unknown>;
}> {
  const doc = await Collections.cmsDocuments().findOne(
    { section, status: 'published', publishedData: { $ne: null } },
    { projection: { section: 1, publishedVersion: 1, publishedAt: 1, publishedData: 1 } }
  );
  if (!doc || !doc.publishedData) {
    throw AppError.notFound(`Published CMS section "${section}" not found.`);
  }
  return {
    section: doc.section,
    version: doc.publishedVersion,
    publishedAt: (doc.publishedAt ?? doc.updatedAt).toISOString(),
    data: doc.publishedData,
  };
}

export async function getPublicCmsSectionsBatch(sections: CmsSectionKey[]): Promise<
  Record<string, { version: number; publishedAt: string; data: Record<string, unknown> }>
> {
  const docs = await Collections.cmsDocuments()
    .find(
      { section: { $in: sections }, status: 'published', publishedData: { $ne: null } },
      { projection: { section: 1, publishedVersion: 1, publishedAt: 1, publishedData: 1 } }
    )
    .toArray();

  const result: Record<
    string,
    { version: number; publishedAt: string; data: Record<string, unknown> }
  > = {};

  for (const doc of docs) {
    if (!doc.publishedData) continue;
    result[doc.section] = {
      version: doc.publishedVersion,
      publishedAt: (doc.publishedAt ?? new Date()).toISOString(),
      data: doc.publishedData,
    };
  }
  return result;
}
