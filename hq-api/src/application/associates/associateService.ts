import { ObjectId } from 'mongodb';
import { AppError } from '../../domain/errors';
import {
  assertValidPublicSlug,
  computeVerificationStatus,
  EMPLOYEE_ID_REGEX,
  generateAssociateBadgeId,
  type AssociateStatus,
  type AssociateType,
  type VerificationStatus,
} from '../../domain/associates/associateDomain';
import {
  buildKeysetFilter,
  clampLimit,
  decodeCursor,
  slicePaginated,
  type PaginatedResult,
} from '../../domain/pagination';
import {
  Collections,
  type AssociateCompensationDoc,
  type AssociateDoc,
} from '../../infrastructure/db/collections';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';

export interface AssociateDTO {
  id: string;
  slug: string;
  employeeId: string;
  associateType: AssociateType;
  name: string;
  title: string;
  department: string;
  status: AssociateStatus;
  profileImage: string;
  bio: string;
  cardExpirationDate: string;
  revokedAt: string | null;
  revocationReason: string | null;
  isPublicCardEnabled: boolean;
  contact: AssociateDoc['contact'];
  socialLinks: AssociateDoc['socialLinks'];
  skills: string[];
  education: AssociateDoc['education'];
  experience: AssociateDoc['experience'];
  certifications: AssociateDoc['certifications'];
  projects: AssociateDoc['projects'];
  publications: AssociateDoc['publications'];
  compensation?: AssociateCompensationDoc;
  internalNotes?: string;
  verificationStatus: VerificationStatus;
  isVerified: boolean;
  version: number;
  createdAt: string;
  updatedAt: string;
}

export interface PublicAssociateProfileDTO {
  slug: string;
  employeeId: string;
  associateType: AssociateType;
  name: string;
  title: string;
  department: string;
  profileImage: string;
  bio: string;
  contact: AssociateDoc['contact'];
  socialLinks: AssociateDoc['socialLinks'];
  skills: string[];
  education: AssociateDoc['education'];
  experience: AssociateDoc['experience'];
  certifications: AssociateDoc['certifications'];
  projects: AssociateDoc['projects'];
  publications: AssociateDoc['publications'];
}

export interface PublicVerificationDTO {
  employeeId: string;
  slug: string;
  name: string;
  title: string;
  department: string;
  associateType: AssociateType;
  profileImage: string;
  cardExpirationDate: string;
  email: string;
  isVerified: boolean;
  verificationStatus: VerificationStatus;
  verifiedAt: string;
}

export function serializeAssociate(
  doc: AssociateDoc,
  options: { includeCompensation?: boolean } = {}
): AssociateDTO {
  const includeCompensation = options.includeCompensation ?? true;
  const verification = computeVerificationStatus(doc);
  return {
    id: doc._id.toHexString(),
    slug: doc.slug,
    employeeId: doc.employeeId,
    associateType: doc.associateType,
    name: doc.name,
    title: doc.title,
    department: doc.department,
    status: doc.status,
    profileImage: doc.profileImage,
    bio: doc.bio,
    cardExpirationDate: doc.cardExpirationDate,
    revokedAt: doc.revokedAt ? doc.revokedAt.toISOString() : null,
    revocationReason: doc.revocationReason,
    isPublicCardEnabled: doc.isPublicCardEnabled,
    contact: doc.contact,
    socialLinks: doc.socialLinks,
    skills: doc.skills,
    education: doc.education,
    experience: doc.experience,
    certifications: doc.certifications,
    projects: doc.projects,
    publications: doc.publications,
    ...(includeCompensation && doc.compensation ? { compensation: doc.compensation } : {}),
    ...(includeCompensation ? { internalNotes: doc.internalNotes } : {}),
    verificationStatus: verification.verificationStatus,
    isVerified: verification.isVerified,
    version: doc.version,
    createdAt: doc.createdAt.toISOString(),
    updatedAt: doc.updatedAt.toISOString(),
  };
}

async function allocateUniqueBadgeId(preferred?: string): Promise<string> {
  if (preferred) {
    const normalized = preferred.trim().toUpperCase();
    if (!EMPLOYEE_ID_REGEX.test(normalized)) {
      throw AppError.badRequest('employeeId must match ^THEA-[A-Z0-9]{4}$.', [
        { field: 'employeeId', message: 'Expected format THEA-XXXX.' },
      ]);
    }
    return normalized;
  }

  for (let attempt = 0; attempt < 10; attempt++) {
    const candidate = generateAssociateBadgeId();
    const exists = await Collections.associates().findOne(
      { employeeId: candidate },
      { projection: { _id: 1 } }
    );
    if (!exists) return candidate;
  }
  throw new Error('Failed to generate unique THEA-XXXX associate badge ID after retries.');
}

export async function listAssociates(params: {
  status?: AssociateStatus;
  associateType?: AssociateType;
  search?: string;
  cursor?: string;
  limit?: string;
  includeCompensation?: boolean;
}): Promise<PaginatedResult<AssociateDTO>> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);

  const filter: Record<string, unknown> = {};
  if (params.status) filter.status = params.status;
  if (params.associateType) filter.associateType = params.associateType;
  if (params.search && params.search.trim().length > 0) {
    const escaped = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { name: regex },
      { employeeId: regex },
      { slug: regex },
      { title: regex },
      { department: regex },
    ];
  }

  const keyset = buildKeysetFilter('name', cursor, { direction: 'asc' });
  const query = keyset ? { $and: [filter, keyset] } : filter;

  const docs = await Collections.associates()
    .find(query)
    .sort({ name: 1, _id: 1 })
    .limit(limit + 1)
    .toArray();

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.name, id: doc._id }));
  return {
    items: page.items.map((doc) =>
      serializeAssociate(doc, { includeCompensation: params.includeCompensation })
    ),
    nextCursor: page.nextCursor,
    hasMore: page.hasMore,
  };
}

export async function getAssociateById(
  id: string,
  options: { includeCompensation?: boolean } = {}
): Promise<AssociateDTO> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid associate ID.');
  }
  const doc = await Collections.associates().findOne({ _id: new ObjectId(id) });
  if (!doc) {
    throw AppError.notFound('Associate not found.');
  }
  return serializeAssociate(doc, options);
}

export interface CreateAssociateInput {
  slug: string;
  employeeId?: string;
  associateType: AssociateType;
  name: string;
  title: string;
  department: string;
  status?: AssociateStatus;
  profileImage?: string;
  bio: string;
  cardExpirationDate: string;
  isPublicCardEnabled?: boolean;
  contact?: AssociateDoc['contact'];
  socialLinks?: AssociateDoc['socialLinks'];
  skills?: string[];
  education?: AssociateDoc['education'];
  experience?: AssociateDoc['experience'];
  certifications?: AssociateDoc['certifications'];
  projects?: AssociateDoc['projects'];
  publications?: AssociateDoc['publications'];
  compensation?: AssociateCompensationDoc;
  internalNotes?: string;
}

export async function createAssociate(
  input: CreateAssociateInput,
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<AssociateDTO> {
  const slug = input.slug.trim().toLowerCase();
  assertValidPublicSlug(slug);

  const employeeId = await allocateUniqueBadgeId(input.employeeId);
  const now = new Date();
  const status: AssociateStatus = input.status ?? 'ACTIVE';

  const doc: AssociateDoc = {
    _id: new ObjectId(),
    slug,
    employeeId,
    associateType: input.associateType,
    name: input.name.trim(),
    title: input.title.trim(),
    department: input.department.trim(),
    status,
    profileImage: (input.profileImage ?? '').trim(),
    bio: input.bio.trim(),
    cardExpirationDate: input.cardExpirationDate,
    revokedAt: status === 'REVOKED' ? now : null,
    revocationReason: null,
    isPublicCardEnabled: input.isPublicCardEnabled ?? true,
    contact: input.contact ?? { email: '' },
    socialLinks: input.socialLinks ?? {},
    skills: input.skills ?? [],
    education: input.education ?? [],
    experience: input.experience ?? [],
    certifications: input.certifications ?? [],
    projects: input.projects ?? [],
    publications: input.publications ?? [],
    ...(input.compensation ? { compensation: input.compensation } : {}),
    internalNotes: (input.internalNotes ?? '').trim(),
    version: 1,
    createdAt: now,
    updatedAt: now,
  };

  await Collections.associates().insertOne(doc);
  const dto = serializeAssociate(doc);

  await writeAuditLog({
    ...actor,
    action: 'ASSOCIATE_CREATED',
    resourceType: 'associate',
    resourceId: dto.id,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });

  return dto;
}

export async function updateAssociate(
  id: string,
  input: Partial<CreateAssociateInput> & { version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<AssociateDTO> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid associate ID.');
  }
  const oid = new ObjectId(id);
  const existing = await Collections.associates().findOne({ _id: oid });
  if (!existing) {
    throw AppError.notFound('Associate not found.');
  }

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.slug !== undefined) {
    const normalizedSlug = input.slug.trim().toLowerCase();
    assertValidPublicSlug(normalizedSlug);
    patch.slug = normalizedSlug;
  }
  if (input.employeeId !== undefined) {
    const normalizedId = input.employeeId.trim().toUpperCase();
    if (!EMPLOYEE_ID_REGEX.test(normalizedId)) {
      throw AppError.badRequest('employeeId must match ^THEA-[A-Z0-9]{4}$.');
    }
    patch.employeeId = normalizedId;
  }
  if (input.associateType !== undefined) patch.associateType = input.associateType;
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.title !== undefined) patch.title = input.title.trim();
  if (input.department !== undefined) patch.department = input.department.trim();
  if (input.status !== undefined) patch.status = input.status;
  if (input.profileImage !== undefined) patch.profileImage = input.profileImage.trim();
  if (input.bio !== undefined) patch.bio = input.bio.trim();
  if (input.cardExpirationDate !== undefined) patch.cardExpirationDate = input.cardExpirationDate;
  if (input.isPublicCardEnabled !== undefined) patch.isPublicCardEnabled = input.isPublicCardEnabled;
  if (input.contact !== undefined) patch.contact = input.contact;
  if (input.socialLinks !== undefined) patch.socialLinks = input.socialLinks;
  if (input.skills !== undefined) patch.skills = input.skills;
  if (input.education !== undefined) patch.education = input.education;
  if (input.experience !== undefined) patch.experience = input.experience;
  if (input.certifications !== undefined) patch.certifications = input.certifications;
  if (input.projects !== undefined) patch.projects = input.projects;
  if (input.publications !== undefined) patch.publications = input.publications;
  if (input.compensation !== undefined) patch.compensation = input.compensation;
  if (input.internalNotes !== undefined) patch.internalNotes = input.internalNotes.trim();

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const updated = await Collections.associates().findOneAndUpdate(
    filter,
    { $set: patch, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.conflict(
      `Associate was modified concurrently. Current version is ${existing.version}.`,
      'version-conflict'
    );
  }

  const dto = serializeAssociate(updated);
  await writeAuditLog({
    ...actor,
    action: 'ASSOCIATE_UPDATED',
    resourceType: 'associate',
    resourceId: dto.id,
    beforeSnapshot: serializeAssociate(existing) as unknown as Record<string, unknown>,
    afterSnapshot: dto as unknown as Record<string, unknown>,
  });

  return dto;
}

export async function revokeAssociate(
  id: string,
  input: { reason: string; version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<AssociateDTO> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid associate ID.');
  }
  const oid = new ObjectId(id);
  const existing = await Collections.associates().findOne({ _id: oid });
  if (!existing) {
    throw AppError.notFound('Associate not found.');
  }

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const now = new Date();
  const updated = await Collections.associates().findOneAndUpdate(
    filter,
    {
      $set: {
        status: 'REVOKED',
        revokedAt: now,
        revocationReason: input.reason.trim(),
        updatedAt: now,
      },
      $inc: { version: 1 },
    },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.conflict(
      `Associate version conflict. Current version is ${existing.version}.`,
      'version-conflict'
    );
  }

  const dto = serializeAssociate(updated);
  await writeAuditLog({
    ...actor,
    action: 'ASSOCIATE_REVOKED',
    resourceType: 'associate',
    resourceId: dto.id,
    beforeSnapshot: { status: existing.status, revokedAt: existing.revokedAt },
    afterSnapshot: { status: dto.status, revokedAt: dto.revokedAt, reason: input.reason.trim() },
  });

  return dto;
}

export async function reinstateAssociate(
  id: string,
  input: { cardExpirationDate?: string; version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<AssociateDTO> {
  if (!ObjectId.isValid(id)) {
    throw AppError.badRequest('Invalid associate ID.');
  }
  const oid = new ObjectId(id);
  const existing = await Collections.associates().findOne({ _id: oid });
  if (!existing) {
    throw AppError.notFound('Associate not found.');
  }

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const patch: Record<string, unknown> = {
    status: 'ACTIVE',
    revokedAt: null,
    revocationReason: null,
    updatedAt: new Date(),
  };
  if (input.cardExpirationDate) {
    patch.cardExpirationDate = input.cardExpirationDate;
  }

  const updated = await Collections.associates().findOneAndUpdate(
    filter,
    { $set: patch, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.conflict(
      `Associate version conflict. Current version is ${existing.version}.`,
      'version-conflict'
    );
  }

  const dto = serializeAssociate(updated);
  await writeAuditLog({
    ...actor,
    action: 'ASSOCIATE_REINSTATED',
    resourceType: 'associate',
    resourceId: dto.id,
    beforeSnapshot: { status: existing.status, revokedAt: existing.revokedAt },
    afterSnapshot: { status: dto.status, cardExpirationDate: dto.cardExpirationDate },
  });

  return dto;
}

export async function getPublicAssociateBySlug(slug: string): Promise<PublicAssociateProfileDTO> {
  const normalized = slug.trim().toLowerCase();
  const doc = await Collections.associates().findOne({ slug: normalized });
  if (!doc || !doc.isPublicCardEnabled || doc.status !== 'ACTIVE' || doc.revokedAt !== null) {
    throw AppError.notFound('Associate profile not found.');
  }

  return {
    slug: doc.slug,
    employeeId: doc.employeeId,
    associateType: doc.associateType,
    name: doc.name,
    title: doc.title,
    department: doc.department,
    profileImage: doc.profileImage,
    bio: doc.bio,
    contact: doc.contact,
    socialLinks: doc.socialLinks,
    skills: doc.skills,
    education: doc.education,
    experience: doc.experience,
    certifications: doc.certifications,
    projects: doc.projects,
    publications: doc.publications,
  };
}

export async function verifyPublicAssociateByEmployeeId(
  employeeId: string
): Promise<PublicVerificationDTO> {
  const normalized = employeeId.trim().toUpperCase();
  const doc = await Collections.associates().findOne({ employeeId: normalized });
  if (!doc) {
    throw AppError.notFound(`Credential badge ${normalized} not found.`);
  }

  const now = new Date();
  const { isVerified, verificationStatus } = computeVerificationStatus(doc, now);

  return {
    employeeId: doc.employeeId,
    slug: doc.slug,
    name: doc.name,
    title: doc.title,
    department: doc.department,
    associateType: doc.associateType,
    profileImage: doc.profileImage,
    cardExpirationDate: doc.cardExpirationDate,
    email: doc.contact?.email ?? '',
    isVerified,
    verificationStatus,
    verifiedAt: now.toISOString(),
  };
}
