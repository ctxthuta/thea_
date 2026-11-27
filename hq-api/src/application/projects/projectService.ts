import { randomUUID } from 'node:crypto';
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
  type ProjectDoc,
  type ProjectMilestoneDoc,
  type ProjectMilestoneStatus,
  type ProjectPhaseDoc,
  type ProjectPhaseStatus,
  type ProjectStatus,
} from '../../infrastructure/db/collections';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';
import {
  defaultMonthlyHours,
  describeProjectSla,
  type ProjectSlaDoc,
  type ProjectSlaView,
  type SlaCoverage,
  type SlaPlan,
} from '../../domain/sla';

export interface ProjectSlaInput {
  plan: SlaPlan;
  startDate?: string | null;
  endDate?: string | null;
  monthlyHours?: number;
  custom?: {
    p1Minutes: number;
    p2Minutes: number;
    p3Minutes: number;
    coverage: SlaCoverage;
  };
}

export function normalizeProjectSla(
  input: ProjectSlaInput | undefined,
  fallbackStartDate: string
): ProjectSlaDoc {
  if (!input || input.plan === 'NONE') {
    return { plan: 'NONE', startDate: null, endDate: null, monthlyHours: 0, custom: null };
  }
  if (input.plan === 'CUSTOM' && !input.custom) {
    throw AppError.badRequest('A CUSTOM SLA plan requires custom response targets and coverage.');
  }
  if (input.endDate && input.startDate && input.endDate < input.startDate) {
    throw AppError.badRequest('SLA endDate cannot be earlier than startDate.');
  }
  return {
    plan: input.plan,
    startDate: input.startDate ?? fallbackStartDate,
    endDate: input.endDate ?? null,
    monthlyHours: input.monthlyHours ?? defaultMonthlyHours(input.plan),
    custom: input.plan === 'CUSTOM' && input.custom ? { ...input.custom } : null,
  };
}

export interface ProjectDTO {
  id: string;
  code: string;
  name: string;
  accountId: string;
  accountName: string;
  accountPortalSlug: string | null;
  dealId: string | null;
  leadAssociateId: string | null;
  leadAssociateName: string | null;
  status: ProjectStatus;
  summary: string;
  currency: CurrencyCode;
  budgetAmount: string;
  startDate: string;
  targetEndDate: string;
  overallProgressPct: number;
  openTicketCount: number;
  sla: ProjectSlaView;
  phases: ProjectPhaseDoc[];
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface ClientPortalProjectDTO {
  id: string;
  code: string;
  name: string;
  accountName: string;
  leadAssociateName: string | null;
  status: ProjectStatus;
  summary: string;
  startDate: string;
  targetEndDate: string;
  overallProgressPct: number;
  openTicketCount: number;
  sla: ProjectSlaView;
  phases: ProjectPhaseDoc[];
  updatedAt: string;
}

export function computeProjectProgress(phases: ProjectPhaseDoc[]): number {
  if (phases.length === 0) return 0;
  let sum = 0;
  for (const phase of phases) {
    if (phase.status === 'COMPLETED') {
      sum += 100;
    } else if (phase.progressPct >= 0) {
      sum += Math.min(100, Math.max(0, phase.progressPct));
    }
  }
  return Math.round(sum / phases.length);
}

interface HydrationLookups {
  accounts: Map<string, { name: string; portalSlug: string | null }>;
  associates: Map<string, string>;
  openTicketsByProject: Map<string, number>;
  hoursByProject: Map<string, number>;
}

async function hydrateProjects(docs: ProjectDoc[]): Promise<ProjectDTO[]> {
  if (docs.length === 0) return [];

  const accountIds = [...new Set(docs.map((d) => d.accountId.toHexString()))].map(
    (id) => new ObjectId(id)
  );
  const associateIds = [
    ...new Set(
      docs.map((d) => d.leadAssociateId?.toHexString()).filter((id): id is string => Boolean(id))
    ),
  ].map((id) => new ObjectId(id));
  const projectIds = docs.map((d) => d._id);
  const now = new Date();
  const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));

  const [accountRows, assocRows, ticketAgg, hoursAgg] = await Promise.all([
    Collections.crmAccounts()
      .find({ _id: { $in: accountIds } }, { projection: { name: 1, portalSlug: 1 } })
      .toArray(),
    associateIds.length > 0
      ? Collections.associates()
          .find({ _id: { $in: associateIds } }, { projection: { name: 1 } })
          .toArray()
      : Promise.resolve([]),
    Collections.tickets()
      .aggregate<{ _id: ObjectId; count: number }>([
        {
          $match: {
            projectId: { $in: projectIds },
            status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_CLIENT'] },
          },
        },
        { $group: { _id: '$projectId', count: { $sum: 1 } } },
      ])
      .toArray(),
    Collections.tickets()
      .aggregate<{ _id: ObjectId; hours: number }>([
        { $match: { projectId: { $in: projectIds }, createdAt: { $gte: monthStart } } },
        { $group: { _id: '$projectId', hours: { $sum: '$engineeringHours' } } },
      ])
      .toArray(),
  ]);

  const lookups: HydrationLookups = {
    accounts: new Map(
      accountRows.map((a) => [
        a._id.toHexString(),
        { name: a.name, portalSlug: a.portalSlug ?? null },
      ])
    ),
    associates: new Map(assocRows.map((a) => [a._id.toHexString(), a.name])),
    openTicketsByProject: new Map(ticketAgg.map((t) => [t._id.toHexString(), t.count])),
    hoursByProject: new Map(hoursAgg.map((t) => [t._id.toHexString(), t.hours])),
  };

  return docs.map((doc) => {
    const acct = lookups.accounts.get(doc.accountId.toHexString());
    const leadId = doc.leadAssociateId ? doc.leadAssociateId.toHexString() : null;
    const sortedPhases = [...doc.phases].sort((a, b) => a.order - b.order);
    return {
      id: doc._id.toHexString(),
      code: doc.code,
      name: doc.name,
      accountId: doc.accountId.toHexString(),
      accountName: acct?.name ?? 'Unknown Client',
      accountPortalSlug: acct?.portalSlug ?? null,
      dealId: doc.dealId ? doc.dealId.toHexString() : null,
      leadAssociateId: leadId,
      leadAssociateName: leadId ? (lookups.associates.get(leadId) ?? null) : null,
      status: doc.status,
      summary: doc.summary,
      currency: doc.currency,
      budgetAmount: formatMoneyMinor(parseMoneyMinor(doc.budgetAmount)),
      startDate: doc.startDate,
      targetEndDate: doc.targetEndDate,
      overallProgressPct: computeProjectProgress(sortedPhases),
      openTicketCount: lookups.openTicketsByProject.get(doc._id.toHexString()) ?? 0,
      sla: describeProjectSla(doc.sla, now, lookups.hoursByProject.get(doc._id.toHexString()) ?? 0),
      phases: sortedPhases,
      version: doc.version,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  });
}

async function generateProjectCode(startDate: string): Promise<string> {
  const year = startDate.slice(0, 4);
  const counterId = `PRJ-${year}`;
  const updated = await Collections.counters().findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = updated?.seq ?? 1;
  return `${counterId}-${String(seq).padStart(3, '0')}`;
}

function normalizePhases(
  phases: Array<{
    id?: string;
    name: string;
    order?: number;
    status: ProjectPhaseStatus;
    startDate: string;
    targetDate: string;
    progressPct: number;
    summary?: string;
    milestones?: Array<{
      id?: string;
      title: string;
      deliveryDate: string;
      status: ProjectMilestoneStatus;
      completedAt?: string | null;
      deliverableNote?: string;
    }>;
  }>
): ProjectPhaseDoc[] {
  return phases.map((phase, idx) => ({
    id: phase.id?.trim() || `phase-${idx + 1}-${randomUUID().slice(0, 6)}`,
    name: phase.name.trim(),
    order: phase.order ?? idx + 1,
    status: phase.status,
    startDate: phase.startDate,
    targetDate: phase.targetDate,
    progressPct: phase.status === 'COMPLETED' ? 100 : Math.min(100, Math.max(0, phase.progressPct)),
    summary: (phase.summary ?? '').trim(),
    milestones: (phase.milestones ?? []).map((ms, mIdx): ProjectMilestoneDoc => ({
      id: ms.id?.trim() || `ms-${idx + 1}-${mIdx + 1}-${randomUUID().slice(0, 6)}`,
      title: ms.title.trim(),
      deliveryDate: ms.deliveryDate,
      status: ms.status,
      completedAt:
        ms.status === 'COMPLETED'
          ? (ms.completedAt ?? new Date().toISOString().slice(0, 10))
          : (ms.completedAt ?? null),
      deliverableNote: (ms.deliverableNote ?? '').trim(),
    })),
  }));
}

export async function listProjects(params: {
  accountId?: string;
  status?: ProjectStatus;
  search?: string;
  cursor?: string;
  limit?: string;
}): Promise<PaginatedResult<ProjectDTO>> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);

  const filter: Record<string, unknown> = {};
  if (params.accountId && ObjectId.isValid(params.accountId)) {
    filter.accountId = new ObjectId(params.accountId);
  }
  if (params.status) filter.status = params.status;
  if (params.search && params.search.trim().length > 0) {
    const escaped = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [{ name: regex }, { code: regex }, { summary: regex }];
  }

  const keyset = buildKeysetFilter('updatedAt', cursor, { direction: 'desc', isDate: true });
  const query = keyset ? { $and: [filter, keyset] } : filter;

  const docs = await Collections.projects()
    .find(query)
    .sort({ updatedAt: -1, _id: -1 })
    .limit(limit + 1)
    .toArray();

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.updatedAt, id: doc._id }));
  const items = await hydrateProjects(page.items);
  return { items, nextCursor: page.nextCursor, hasMore: page.hasMore };
}

export async function getProjectById(id: string): Promise<ProjectDTO> {
  if (!ObjectId.isValid(id)) throw AppError.badRequest('Invalid project ID.');
  const doc = await Collections.projects().findOne({ _id: new ObjectId(id) });
  if (!doc) throw AppError.notFound('Project not found.');
  const [hydrated] = await hydrateProjects([doc]);
  return hydrated!;
}

export interface CreateProjectInput {
  code?: string;
  name: string;
  accountId: string;
  dealId?: string | null;
  leadAssociateId?: string | null;
  status?: ProjectStatus;
  summary?: string;
  currency: CurrencyCode;
  budgetAmount: string;
  startDate: string;
  targetEndDate: string;
  phases?: Parameters<typeof normalizePhases>[0];
  sla?: ProjectSlaInput;
}

export async function createProject(
  input: CreateProjectInput,
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<ProjectDTO> {
  if (!ObjectId.isValid(input.accountId)) throw AppError.badRequest('Invalid accountId.');
  const accountOid = new ObjectId(input.accountId);
  const account = await Collections.crmAccounts().findOne(
    { _id: accountOid },
    { projection: { _id: 1 } }
  );
  if (!account) throw AppError.badRequest('Referenced CRM account does not exist.');

  let dealOid: ObjectId | null = null;
  if (input.dealId) {
    if (!ObjectId.isValid(input.dealId)) throw AppError.badRequest('Invalid dealId.');
    dealOid = new ObjectId(input.dealId);
  }

  let leadOid: ObjectId | null = null;
  if (input.leadAssociateId) {
    if (!ObjectId.isValid(input.leadAssociateId)) throw AppError.badRequest('Invalid leadAssociateId.');
    leadOid = new ObjectId(input.leadAssociateId);
  }

  const budgetMinor = parseMoneyMinor(input.budgetAmount, 'budgetAmount');
  if (budgetMinor < 0n) throw AppError.badRequest('budgetAmount cannot be negative.');

  const code = input.code?.trim().toUpperCase() || (await generateProjectCode(input.startDate));
  const now = new Date();

  const doc: ProjectDoc = {
    _id: new ObjectId(),
    code,
    name: input.name.trim(),
    accountId: accountOid,
    dealId: dealOid,
    leadAssociateId: leadOid,
    status: input.status ?? 'ACTIVE',
    summary: (input.summary ?? '').trim(),
    currency: input.currency,
    budgetAmount: moneyMinorToDecimal128(budgetMinor),
    startDate: input.startDate,
    targetEndDate: input.targetEndDate,
    phases: normalizePhases(input.phases ?? []),
    sla: normalizeProjectSla(input.sla, input.startDate),
    version: 1,
    createdBy: actor.actorId,
    createdAt: now,
    updatedAt: now,
  };

  await Collections.projects().insertOne(doc);
  const [dto] = await hydrateProjects([doc]);

  await writeAuditLog({
    ...actor,
    action: 'PROJECT_CREATED',
    resourceType: 'project',
    resourceId: dto!.id,
    afterSnapshot: { code: dto!.code, name: dto!.name, accountId: dto!.accountId },
  });

  return dto!;
}

export async function updateProject(
  id: string,
  input: Partial<CreateProjectInput> & { version?: number },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<ProjectDTO> {
  if (!ObjectId.isValid(id)) throw AppError.badRequest('Invalid project ID.');
  const oid = new ObjectId(id);
  const existing = await Collections.projects().findOne({ _id: oid });
  if (!existing) throw AppError.notFound('Project not found.');

  const patch: Record<string, unknown> = { updatedAt: new Date() };
  if (input.name !== undefined) patch.name = input.name.trim();
  if (input.accountId !== undefined) {
    if (!ObjectId.isValid(input.accountId)) throw AppError.badRequest('Invalid accountId.');
    patch.accountId = new ObjectId(input.accountId);
  }
  if (input.dealId !== undefined) {
    patch.dealId = input.dealId && ObjectId.isValid(input.dealId) ? new ObjectId(input.dealId) : null;
  }
  if (input.leadAssociateId !== undefined) {
    patch.leadAssociateId =
      input.leadAssociateId && ObjectId.isValid(input.leadAssociateId)
        ? new ObjectId(input.leadAssociateId)
        : null;
  }
  if (input.status !== undefined) patch.status = input.status;
  if (input.summary !== undefined) patch.summary = input.summary.trim();
  if (input.currency !== undefined) patch.currency = input.currency;
  if (input.budgetAmount !== undefined) {
    const budgetMinor = parseMoneyMinor(input.budgetAmount, 'budgetAmount');
    if (budgetMinor < 0n) throw AppError.badRequest('budgetAmount cannot be negative.');
    patch.budgetAmount = moneyMinorToDecimal128(budgetMinor);
  }
  if (input.startDate !== undefined) patch.startDate = input.startDate;
  if (input.targetEndDate !== undefined) patch.targetEndDate = input.targetEndDate;
  if (input.phases !== undefined) patch.phases = normalizePhases(input.phases);
  if (input.sla !== undefined) {
    patch.sla = normalizeProjectSla(input.sla, input.startDate ?? existing.startDate);
  }

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const updated = await Collections.projects().findOneAndUpdate(
    filter,
    { $set: patch, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.conflict(
      `Project version conflict. Current version is ${existing.version}.`,
      'version-conflict'
    );
  }

  const [dto] = await hydrateProjects([updated]);
  await writeAuditLog({
    ...actor,
    action: 'PROJECT_UPDATED',
    resourceType: 'project',
    resourceId: dto!.id,
    afterSnapshot: { code: dto!.code, status: dto!.status, progressPct: dto!.overallProgressPct },
  });

  return dto!;
}

export async function updateProjectPhase(
  projectId: string,
  phaseId: string,
  input: {
    name?: string;
    status?: ProjectPhaseStatus;
    startDate?: string;
    targetDate?: string;
    progressPct?: number;
    summary?: string;
    milestones?: Array<{
      id?: string;
      title: string;
      deliveryDate: string;
      status: ProjectMilestoneStatus;
      completedAt?: string | null;
      deliverableNote?: string;
    }>;
    version?: number;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<ProjectDTO> {
  if (!ObjectId.isValid(projectId)) throw AppError.badRequest('Invalid project ID.');
  const oid = new ObjectId(projectId);
  const existing = await Collections.projects().findOne({ _id: oid });
  if (!existing) throw AppError.notFound('Project not found.');

  const idx = existing.phases.findIndex((p) => p.id === phaseId);
  if (idx === -1) throw AppError.notFound(`Phase "${phaseId}" not found on project.`);

  const current = existing.phases[idx]!;
  const nextStatus = input.status ?? current.status;
  const nextMilestones: ProjectMilestoneDoc[] =
    input.milestones !== undefined
      ? input.milestones.map((ms, mIdx) => ({
          id: ms.id?.trim() || `ms-${idx + 1}-${mIdx + 1}-${randomUUID().slice(0, 6)}`,
          title: ms.title.trim(),
          deliveryDate: ms.deliveryDate,
          status: ms.status,
          completedAt:
            ms.status === 'COMPLETED'
              ? (ms.completedAt ?? new Date().toISOString().slice(0, 10))
              : (ms.completedAt ?? null),
          deliverableNote: (ms.deliverableNote ?? '').trim(),
        }))
      : current.milestones;

  const updatedPhase: ProjectPhaseDoc = {
    ...current,
    name: input.name !== undefined ? input.name.trim() : current.name,
    status: nextStatus,
    startDate: input.startDate ?? current.startDate,
    targetDate: input.targetDate ?? current.targetDate,
    progressPct:
      nextStatus === 'COMPLETED'
        ? 100
        : input.progressPct !== undefined
          ? Math.min(100, Math.max(0, input.progressPct))
          : current.progressPct,
    summary: input.summary !== undefined ? input.summary.trim() : current.summary,
    milestones: nextMilestones,
  };

  const nextPhases = [...existing.phases];
  nextPhases[idx] = updatedPhase;

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const updated = await Collections.projects().findOneAndUpdate(
    filter,
    { $set: { phases: nextPhases, updatedAt: new Date() }, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.conflict(
      `Project version conflict. Current version is ${existing.version}.`,
      'version-conflict'
    );
  }

  const [dto] = await hydrateProjects([updated]);
  await writeAuditLog({
    ...actor,
    action: 'PROJECT_PHASE_UPDATED',
    resourceType: 'project',
    resourceId: dto!.id,
    afterSnapshot: {
      phaseId,
      status: updatedPhase.status,
      progressPct: updatedPhase.progressPct,
    },
  });

  return dto!;
}

/**
 * Strictly client-scoped projects list for Client Portal (redacts internal budget amounts & currency).
 */
export async function listClientPortalProjects(
  accountId: string
): Promise<ClientPortalProjectDTO[]> {
  if (!ObjectId.isValid(accountId)) throw AppError.badRequest('Invalid account ID.');
  const docs = await Collections.projects()
    .find({ accountId: new ObjectId(accountId) })
    .sort({ updatedAt: -1, _id: -1 })
    .toArray();

  const hydrated = await hydrateProjects(docs);
  return hydrated.map((p) => ({
    id: p.id,
    code: p.code,
    name: p.name,
    accountName: p.accountName,
    leadAssociateName: p.leadAssociateName,
    status: p.status,
    summary: p.summary,
    startDate: p.startDate,
    targetEndDate: p.targetEndDate,
    overallProgressPct: p.overallProgressPct,
    openTicketCount: p.openTicketCount,
    sla: p.sla,
    phases: p.phases,
    updatedAt: p.updatedAt,
  }));
}
