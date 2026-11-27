import { randomUUID } from 'node:crypto';
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
  Collections,
  type TicketCategory,
  type TicketCommentDoc,
  type TicketDoc,
  type TicketPriority,
  type TicketSource,
  type TicketStatus,
} from '../../infrastructure/db/collections';
import { writeAuditLog, type AuditEntryInput } from '../../infrastructure/audit/auditLogger';
import type { ClientPortalUser } from '../../middleware/context';
import {
  computeSlaStatus,
  coverageLabel,
  derivePriorityFromSeverity,
  deriveSeverityFromPriority,
  formatStampedTarget,
  stampTicketSla,
  type ProjectSlaDoc,
  type SlaCoverage,
  type SlaPlan,
  type SlaStatus,
  type TicketSeverity,
} from '../../domain/sla';

export interface TicketCommentDTO {
  id: string;
  authorType: 'CLIENT' | 'TEAM';
  authorName: string;
  authorEmail: string;
  message: string;
  isInternalNote: boolean;
  createdAt: string;
}

export interface TicketDTO {
  id: string;
  ticketNumber: string;
  accountId: string;
  accountName: string;
  projectId: string | null;
  projectCode: string | null;
  projectName: string | null;
  phaseId: string | null;
  title: string;
  description: string;
  category: TicketCategory;
  priority: TicketPriority;
  severity: TicketSeverity;
  status: TicketStatus;
  source: TicketSource;
  requesterName: string;
  requesterEmail: string;
  assignedAssociateId: string | null;
  assignedAssociateName: string | null;
  slaPlan: SlaPlan;
  slaTargetMinutes: number | null;
  slaTargetLabel: string | null;
  slaCoverageLabel: string | null;
  slaDueAt: string | null;
  slaResponseDueAt: string | null;
  firstRespondedAt: string | null;
  slaStatus: SlaStatus;
  engineeringHours: number;
  resolvedAt: string | null;
  comments: TicketCommentDTO[];
  version: number;
  createdBy: string;
  createdAt: string;
  updatedAt: string;
}

export interface TicketSummaryCounts {
  open: number;
  inProgress: number;
  waitingClient: number;
  resolved: number;
  closed: number;
  urgentOpen: number;
  slaBreached: number;
  slaAtRisk: number;
}

function serializeComment(c: TicketCommentDoc): TicketCommentDTO {
  return {
    id: c.id,
    authorType: c.authorType,
    authorName: c.authorName,
    authorEmail: c.authorEmail,
    message: c.message,
    isInternalNote: c.isInternalNote,
    createdAt: c.createdAt.toISOString(),
  };
}

function effectiveSeverity(doc: Pick<TicketDoc, 'severity' | 'priority'>): TicketSeverity {
  return doc.severity ?? deriveSeverityFromPriority(doc.priority);
}

function slaFieldsFor(doc: TicketDoc, now: Date) {
  const severity = effectiveSeverity(doc);
  const plan: SlaPlan = doc.slaPlan ?? 'NONE';
  const dueAt = plan === 'NONE' ? null : (doc.slaDueAt ?? null);
  const firstRespondedAt = doc.firstRespondedAt ?? null;
  const coverage: SlaCoverage | null = doc.slaCoverage ?? null;
  const slaStatus = computeSlaStatus({
    plan,
    dueAt,
    firstRespondedAt,
    createdAt: doc.createdAt,
    now,
  });
  return {
    severity,
    plan,
    dueAt,
    firstRespondedAt,
    targetMinutes: doc.slaTargetMinutes ?? null,
    targetLabel: formatStampedTarget(plan, severity, doc.slaTargetMinutes ?? null),
    coverageText: coverage ? coverageLabel(coverage) : null,
    slaStatus,
  };
}

async function loadProjectSla(projectOid: ObjectId | null): Promise<ProjectSlaDoc | null> {
  if (!projectOid) return null;
  const project = await Collections.projects().findOne(
    { _id: projectOid },
    { projection: { sla: 1 } }
  );
  return project?.sla ?? null;
}

async function hydrateTickets(
  docs: TicketDoc[],
  options: { stripInternalNotes?: boolean } = {}
): Promise<TicketDTO[]> {
  if (docs.length === 0) return [];

  const accountIds = [...new Set(docs.map((d) => d.accountId.toHexString()))].map(
    (id) => new ObjectId(id)
  );
  const projectIds = [
    ...new Set(docs.map((d) => d.projectId?.toHexString()).filter((id): id is string => Boolean(id))),
  ].map((id) => new ObjectId(id));
  const associateIds = [
    ...new Set(
      docs
        .map((d) => d.assignedAssociateId?.toHexString())
        .filter((id): id is string => Boolean(id))
    ),
  ].map((id) => new ObjectId(id));

  const [accounts, projects, associates] = await Promise.all([
    Collections.crmAccounts()
      .find({ _id: { $in: accountIds } }, { projection: { name: 1 } })
      .toArray(),
    projectIds.length > 0
      ? Collections.projects()
          .find({ _id: { $in: projectIds } }, { projection: { code: 1, name: 1 } })
          .toArray()
      : Promise.resolve([]),
    associateIds.length > 0
      ? Collections.associates()
          .find({ _id: { $in: associateIds } }, { projection: { name: 1 } })
          .toArray()
      : Promise.resolve([]),
  ]);

  const accountMap = new Map(accounts.map((a) => [a._id.toHexString(), a.name]));
  const projectMap = new Map(
    projects.map((p) => [p._id.toHexString(), { code: p.code, name: p.name }])
  );
  const assocMap = new Map(associates.map((a) => [a._id.toHexString(), a.name]));

  const now = new Date();
  return docs.map((doc) => {
    const proj = doc.projectId ? projectMap.get(doc.projectId.toHexString()) : undefined;
    const assignedId = doc.assignedAssociateId ? doc.assignedAssociateId.toHexString() : null;
    const visibleComments = options.stripInternalNotes
      ? doc.comments.filter((c) => !c.isInternalNote)
      : doc.comments;
    const sla = slaFieldsFor(doc, now);

    return {
      id: doc._id.toHexString(),
      ticketNumber: doc.ticketNumber,
      accountId: doc.accountId.toHexString(),
      accountName: accountMap.get(doc.accountId.toHexString()) ?? 'Unknown Client',
      projectId: doc.projectId ? doc.projectId.toHexString() : null,
      projectCode: proj?.code ?? null,
      projectName: proj?.name ?? null,
      phaseId: doc.phaseId,
      title: doc.title,
      description: doc.description,
      category: doc.category,
      priority: doc.priority,
      severity: sla.severity,
      status: doc.status,
      source: doc.source,
      requesterName: doc.requesterName,
      requesterEmail: doc.requesterEmail,
      assignedAssociateId: assignedId,
      assignedAssociateName: assignedId ? (assocMap.get(assignedId) ?? null) : null,
      slaPlan: sla.plan,
      slaTargetMinutes: sla.targetMinutes,
      slaTargetLabel: sla.targetLabel,
      slaCoverageLabel: sla.coverageText,
      slaDueAt: sla.dueAt ? sla.dueAt.toISOString() : null,
      slaResponseDueAt: sla.dueAt ? sla.dueAt.toISOString() : null,
      firstRespondedAt: sla.firstRespondedAt ? sla.firstRespondedAt.toISOString() : null,
      slaStatus: sla.slaStatus,
      engineeringHours: doc.engineeringHours ?? 0,
      resolvedAt: doc.resolvedAt ? doc.resolvedAt.toISOString() : null,
      comments: visibleComments.map(serializeComment),
      version: doc.version,
      createdBy: doc.createdBy,
      createdAt: doc.createdAt.toISOString(),
      updatedAt: doc.updatedAt.toISOString(),
    };
  });
}

async function generateTicketNumber(now: Date = new Date()): Promise<string> {
  const year = now.getUTCFullYear();
  const counterId = `TKT-${year}`;
  const updated = await Collections.counters().findOneAndUpdate(
    { _id: counterId },
    { $inc: { seq: 1 } },
    { upsert: true, returnDocument: 'after' }
  );
  const seq = updated?.seq ?? 1;
  return `${counterId}-${String(seq).padStart(4, '0')}`;
}

async function computeTicketSummary(
  baseFilter: Record<string, unknown>
): Promise<TicketSummaryCounts> {
  const agg = await Collections.tickets()
    .aggregate<{ _id: { status: TicketStatus; priority: TicketPriority }; count: number }>([
      { $match: baseFilter },
      { $group: { _id: { status: '$status', priority: '$priority' }, count: { $sum: 1 } } },
    ])
    .toArray();

  const summary: TicketSummaryCounts = {
    open: 0,
    inProgress: 0,
    waitingClient: 0,
    resolved: 0,
    closed: 0,
    urgentOpen: 0,
    slaBreached: 0,
    slaAtRisk: 0,
  };

  for (const row of agg) {
    const { status, priority } = row._id;
    if (status === 'OPEN') summary.open += row.count;
    else if (status === 'IN_PROGRESS') summary.inProgress += row.count;
    else if (status === 'WAITING_CLIENT') summary.waitingClient += row.count;
    else if (status === 'RESOLVED') summary.resolved += row.count;
    else if (status === 'CLOSED') summary.closed += row.count;

    if (
      priority === 'URGENT' &&
      (status === 'OPEN' || status === 'IN_PROGRESS' || status === 'WAITING_CLIENT')
    ) {
      summary.urgentOpen += row.count;
    }
  }

  const awaitingResponse = await Collections.tickets()
    .find(
      {
        ...baseFilter,
        status: { $in: ['OPEN', 'IN_PROGRESS', 'WAITING_CLIENT'] },
        firstRespondedAt: null,
        slaDueAt: { $ne: null },
      },
      { projection: { slaPlan: 1, slaDueAt: 1, firstRespondedAt: 1, createdAt: 1 } }
    )
    .toArray();
  const now = new Date();
  for (const t of awaitingResponse) {
    const status = computeSlaStatus({
      plan: t.slaPlan ?? 'NONE',
      dueAt: t.slaDueAt,
      firstRespondedAt: null,
      createdAt: t.createdAt,
      now,
    });
    if (status === 'BREACHED') summary.slaBreached += 1;
    else if (status === 'AT_RISK') summary.slaAtRisk += 1;
  }

  return summary;
}

export async function listTickets(params: {
  accountId?: string;
  projectId?: string;
  status?: TicketStatus;
  priority?: TicketPriority;
  category?: TicketCategory;
  search?: string;
  cursor?: string;
  limit?: string;
}): Promise<PaginatedResult<TicketDTO> & { summary: TicketSummaryCounts }> {
  const limit = clampLimit(params.limit, 25, 100);
  const cursor = decodeCursor(params.cursor);

  const summaryBaseFilter: Record<string, unknown> = {};
  if (params.accountId && ObjectId.isValid(params.accountId)) {
    summaryBaseFilter.accountId = new ObjectId(params.accountId);
  }
  if (params.projectId && ObjectId.isValid(params.projectId)) {
    summaryBaseFilter.projectId = new ObjectId(params.projectId);
  }

  const filter: Record<string, unknown> = { ...summaryBaseFilter };
  if (params.status) filter.status = params.status;
  if (params.priority) filter.priority = params.priority;
  if (params.category) filter.category = params.category;
  if (params.search && params.search.trim().length > 0) {
    const escaped = params.search.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'i');
    filter.$or = [
      { title: regex },
      { ticketNumber: regex },
      { description: regex },
      { requesterName: regex },
      { requesterEmail: regex },
    ];
  }

  const keyset = buildKeysetFilter('updatedAt', cursor, { direction: 'desc', isDate: true });
  const query = keyset ? { $and: [filter, keyset] } : filter;

  const [docs, summary] = await Promise.all([
    Collections.tickets()
      .find(query)
      .sort({ updatedAt: -1, _id: -1 })
      .limit(limit + 1)
      .toArray(),
    computeTicketSummary(summaryBaseFilter),
  ]);

  const page = slicePaginated(docs, limit, (doc) => ({ sortValue: doc.updatedAt, id: doc._id }));
  const items = await hydrateTickets(page.items, { stripInternalNotes: false });
  return { items, summary, nextCursor: page.nextCursor, hasMore: page.hasMore };
}

export async function getTicketById(id: string): Promise<TicketDTO> {
  if (!ObjectId.isValid(id)) throw AppError.badRequest('Invalid ticket ID.');
  const doc = await Collections.tickets().findOne({ _id: new ObjectId(id) });
  if (!doc) throw AppError.notFound('Ticket not found.');
  const [dto] = await hydrateTickets([doc], { stripInternalNotes: false });
  return dto!;
}

export async function createTicket(
  input: {
    accountId: string;
    projectId?: string | null;
    phaseId?: string | null;
    title: string;
    description: string;
    category: TicketCategory;
    severity: TicketSeverity;
    priority?: TicketPriority;
    status?: TicketStatus;
    source?: TicketSource;
    requesterName: string;
    requesterEmail: string;
    assignedAssociateId?: string | null;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<TicketDTO> {
  if (!ObjectId.isValid(input.accountId)) throw AppError.badRequest('Invalid accountId.');
  const accountOid = new ObjectId(input.accountId);
  const account = await Collections.crmAccounts().findOne(
    { _id: accountOid },
    { projection: { _id: 1 } }
  );
  if (!account) throw AppError.badRequest('Referenced CRM account does not exist.');

  let projectOid: ObjectId | null = null;
  if (input.projectId) {
    if (!ObjectId.isValid(input.projectId)) throw AppError.badRequest('Invalid projectId.');
    projectOid = new ObjectId(input.projectId);
    const project = await Collections.projects().findOne(
      { _id: projectOid, accountId: accountOid },
      { projection: { _id: 1 } }
    );
    if (!project) {
      throw AppError.badRequest('Referenced project does not belong to this client account.');
    }
  }

  let assignedOid: ObjectId | null = null;
  if (input.assignedAssociateId) {
    if (!ObjectId.isValid(input.assignedAssociateId)) {
      throw AppError.badRequest('Invalid assignedAssociateId.');
    }
    assignedOid = new ObjectId(input.assignedAssociateId);
  }

  const now = new Date();
  const ticketNumber = await generateTicketNumber(now);
  const status: TicketStatus = input.status ?? 'OPEN';
  const projectSla = await loadProjectSla(projectOid);
  const slaStamp = stampTicketSla(projectSla, input.severity, now);

  const doc: TicketDoc = {
    _id: new ObjectId(),
    ticketNumber,
    accountId: accountOid,
    projectId: projectOid,
    phaseId: input.phaseId?.trim() || null,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: input.priority ?? derivePriorityFromSeverity(input.severity),
    severity: input.severity,
    status,
    source: input.source ?? 'INTERNAL',
    requesterName: input.requesterName.trim(),
    requesterEmail: input.requesterEmail.trim().toLowerCase(),
    assignedAssociateId: assignedOid,
    slaPlan: slaStamp.slaPlan,
    slaTargetMinutes: slaStamp.slaTargetMinutes,
    slaCoverage: slaStamp.slaCoverage,
    slaDueAt: slaStamp.slaDueAt,
    firstRespondedAt: null,
    engineeringHours: 0,
    resolvedAt: status === 'RESOLVED' || status === 'CLOSED' ? now : null,
    comments: [],
    version: 1,
    createdBy: actor.actorId,
    createdAt: now,
    updatedAt: now,
  };

  await Collections.tickets().insertOne(doc);
  const [dto] = await hydrateTickets([doc], { stripInternalNotes: false });

  await writeAuditLog({
    ...actor,
    action: 'TICKET_CREATED',
    resourceType: 'ticket',
    resourceId: dto!.id,
    afterSnapshot: {
      ticketNumber: dto!.ticketNumber,
      severity: dto!.severity,
      slaPlan: dto!.slaPlan,
      status: dto!.status,
    },
  });

  return dto!;
}

export async function updateTicket(
  id: string,
  input: {
    status?: TicketStatus;
    priority?: TicketPriority;
    severity?: TicketSeverity;
    category?: TicketCategory;
    assignedAssociateId?: string | null;
    projectId?: string | null;
    phaseId?: string | null;
    engineeringHours?: number;
    version?: number;
  },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'>
): Promise<TicketDTO> {
  if (!ObjectId.isValid(id)) throw AppError.badRequest('Invalid ticket ID.');
  const oid = new ObjectId(id);
  const existing = await Collections.tickets().findOne({ _id: oid });
  if (!existing) throw AppError.notFound('Ticket not found.');

  const now = new Date();
  const patch: Record<string, unknown> = { updatedAt: now };

  if (input.status !== undefined) {
    patch.status = input.status;
    if (
      (input.status === 'RESOLVED' || input.status === 'CLOSED') &&
      existing.resolvedAt === null
    ) {
      patch.resolvedAt = now;
    } else if (
      input.status === 'OPEN' ||
      input.status === 'IN_PROGRESS' ||
      input.status === 'WAITING_CLIENT'
    ) {
      patch.resolvedAt = null;
    }
    // Moving a ticket out of OPEN is the team acknowledging it and starting triage.
    if (existing.status === 'OPEN' && input.status !== 'OPEN' && !existing.firstRespondedAt) {
      patch.firstRespondedAt = now;
    }
  }
  if (input.severity !== undefined) {
    patch.severity = input.severity;
    patch.priority = input.priority ?? derivePriorityFromSeverity(input.severity);
  } else if (input.priority !== undefined) {
    patch.priority = input.priority;
  }
  if (input.category !== undefined) patch.category = input.category;
  if (input.assignedAssociateId !== undefined) {
    patch.assignedAssociateId =
      input.assignedAssociateId && ObjectId.isValid(input.assignedAssociateId)
        ? new ObjectId(input.assignedAssociateId)
        : null;
  }
  let nextProjectOid: ObjectId | null = existing.projectId;
  if (input.projectId !== undefined) {
    if (input.projectId === null || input.projectId === '') {
      patch.projectId = null;
      nextProjectOid = null;
    } else if (ObjectId.isValid(input.projectId)) {
      const proj = await Collections.projects().findOne(
        { _id: new ObjectId(input.projectId), accountId: existing.accountId },
        { projection: { _id: 1 } }
      );
      if (!proj) throw AppError.badRequest('Project does not belong to this ticket account.');
      patch.projectId = proj._id;
      nextProjectOid = proj._id;
    } else {
      throw AppError.badRequest('Invalid projectId.');
    }
  }
  if (input.phaseId !== undefined) patch.phaseId = input.phaseId?.trim() || null;
  if (input.engineeringHours !== undefined) patch.engineeringHours = input.engineeringHours;

  if (input.severity !== undefined || input.projectId !== undefined) {
    // The response clock keeps running from ticket creation. Only the target changes.
    const nextSeverity = input.severity ?? effectiveSeverity(existing);
    const projectSla = await loadProjectSla(nextProjectOid);
    const stamp = stampTicketSla(projectSla, nextSeverity, existing.createdAt);
    patch.slaPlan = stamp.slaPlan;
    patch.slaTargetMinutes = stamp.slaTargetMinutes;
    patch.slaCoverage = stamp.slaCoverage;
    patch.slaDueAt = stamp.slaDueAt;
  }

  const filter: Record<string, unknown> = { _id: oid };
  if (input.version !== undefined) filter.version = input.version;

  const updated = await Collections.tickets().findOneAndUpdate(
    filter,
    { $set: patch, $inc: { version: 1 } },
    { returnDocument: 'after' }
  );

  if (!updated) {
    throw AppError.conflict(
      `Ticket version conflict. Current version is ${existing.version}.`,
      'version-conflict'
    );
  }

  const [dto] = await hydrateTickets([updated], { stripInternalNotes: false });
  await writeAuditLog({
    ...actor,
    action: 'TICKET_UPDATED',
    resourceType: 'ticket',
    resourceId: dto!.id,
    beforeSnapshot: { status: existing.status, priority: existing.priority },
    afterSnapshot: { status: dto!.status, priority: dto!.priority },
  });

  return dto!;
}

export async function addTeamTicketComment(
  ticketId: string,
  input: { message: string; isInternalNote?: boolean },
  actor: Omit<AuditEntryInput, 'action' | 'resourceType' | 'resourceId'> & { actorName: string }
): Promise<TicketDTO> {
  if (!ObjectId.isValid(ticketId)) throw AppError.badRequest('Invalid ticket ID.');
  const oid = new ObjectId(ticketId);
  const now = new Date();
  const comment: TicketCommentDoc = {
    id: `cmt-${randomUUID().slice(0, 8)}`,
    authorType: 'TEAM',
    authorName: actor.actorName,
    authorEmail: actor.actorEmail,
    message: input.message.trim(),
    isInternalNote: Boolean(input.isInternalNote),
    createdAt: now,
  };

  const existingTicket = await Collections.tickets().findOne(
    { _id: oid },
    { projection: { firstRespondedAt: 1 } }
  );
  if (!existingTicket) throw AppError.notFound('Ticket not found.');

  const setPatch: Record<string, unknown> = { updatedAt: now };
  // Only a public team reply counts as the first response under the SLA.
  if (!comment.isInternalNote && !existingTicket.firstRespondedAt) {
    setPatch.firstRespondedAt = now;
  }

  const updated = await Collections.tickets().findOneAndUpdate(
    { _id: oid },
    {
      $push: { comments: comment },
      $set: setPatch,
      $inc: { version: 1 },
    },
    { returnDocument: 'after' }
  );

  if (!updated) throw AppError.notFound('Ticket not found.');

  const [dto] = await hydrateTickets([updated], { stripInternalNotes: false });
  await writeAuditLog({
    ...actor,
    action: comment.isInternalNote ? 'TICKET_INTERNAL_NOTE_ADDED' : 'TICKET_TEAM_REPLY_ADDED',
    resourceType: 'ticket',
    resourceId: dto!.id,
    afterSnapshot: { commentId: comment.id, isInternalNote: comment.isInternalNote },
  });

  return dto!;
}

// =============================================================================
// Client-Facing Portal Scoped Operations (Strict Tenant Isolation + Redaction)
// =============================================================================

export async function listClientPortalTickets(
  accountId: string,
  params: { status?: TicketStatus; projectId?: string }
): Promise<{ items: TicketDTO[]; summary: TicketSummaryCounts }> {
  const accountOid = new ObjectId(accountId);
  const filter: Record<string, unknown> = { accountId: accountOid };
  if (params.status) filter.status = params.status;
  if (params.projectId && ObjectId.isValid(params.projectId)) {
    filter.projectId = new ObjectId(params.projectId);
  }

  const [docs, summary] = await Promise.all([
    Collections.tickets().find(filter).sort({ updatedAt: -1, _id: -1 }).limit(100).toArray(),
    computeTicketSummary({ accountId: accountOid }),
  ]);

  const items = await hydrateTickets(docs, { stripInternalNotes: true });
  return { items, summary };
}

export async function getClientPortalTicketById(
  accountId: string,
  ticketId: string
): Promise<TicketDTO> {
  if (!ObjectId.isValid(ticketId)) throw AppError.badRequest('Invalid ticket ID.');
  const doc = await Collections.tickets().findOne({
    _id: new ObjectId(ticketId),
    accountId: new ObjectId(accountId),
  });
  if (!doc) {
    throw AppError.notFound('Ticket not found.');
  }
  const [dto] = await hydrateTickets([doc], { stripInternalNotes: true });
  return dto!;
}

export async function createClientPortalTicket(
  client: ClientPortalUser,
  input: {
    projectId?: string | null;
    phaseId?: string | null;
    title: string;
    description: string;
    category: TicketCategory;
    severity?: TicketSeverity;
    priority?: TicketPriority;
    requesterName?: string;
    requesterEmail?: string;
  },
  meta: { requestId: string; ipAddress: string; userAgent: string }
): Promise<TicketDTO> {
  const accountOid = new ObjectId(client.accountId);
  let projectOid: ObjectId | null = null;

  if (input.projectId) {
    if (!ObjectId.isValid(input.projectId)) throw AppError.badRequest('Invalid projectId.');
    projectOid = new ObjectId(input.projectId);
    const project = await Collections.projects().findOne(
      { _id: projectOid, accountId: accountOid },
      { projection: { _id: 1 } }
    );
    if (!project) {
      throw AppError.notFound('Referenced project not found for your account.');
    }
  }

  const now = new Date();
  const ticketNumber = await generateTicketNumber(now);
  const requesterName = (input.requesterName?.trim() || client.requesterName || client.accountName).trim();
  const requesterEmail = (input.requesterEmail?.trim() || client.requesterEmail || '').toLowerCase();
  const severity: TicketSeverity =
    input.severity ?? (input.priority ? deriveSeverityFromPriority(input.priority) : 'P3');
  const projectSla = await loadProjectSla(projectOid);
  const slaStamp = stampTicketSla(projectSla, severity, now);

  const doc: TicketDoc = {
    _id: new ObjectId(),
    ticketNumber,
    accountId: accountOid,
    projectId: projectOid,
    phaseId: input.phaseId?.trim() || null,
    title: input.title.trim(),
    description: input.description.trim(),
    category: input.category,
    priority: derivePriorityFromSeverity(severity),
    severity,
    status: 'OPEN',
    source: 'CLIENT_PORTAL',
    requesterName,
    requesterEmail,
    assignedAssociateId: null,
    slaPlan: slaStamp.slaPlan,
    slaTargetMinutes: slaStamp.slaTargetMinutes,
    slaCoverage: slaStamp.slaCoverage,
    slaDueAt: slaStamp.slaDueAt,
    firstRespondedAt: null,
    engineeringHours: 0,
    resolvedAt: null,
    comments: [],
    version: 1,
    createdBy: `client:${client.portalSlug}`,
    createdAt: now,
    updatedAt: now,
  };

  await Collections.tickets().insertOne(doc);
  const [dto] = await hydrateTickets([doc], { stripInternalNotes: true });

  await writeAuditLog({
    actorId: `client:${client.accountId}`,
    actorEmail: requesterEmail,
    actorRole: 'PUBLIC_INGEST',
    isStaticSuperAdmin: false,
    action: 'CLIENT_PORTAL_TICKET_CREATED',
    resourceType: 'ticket',
    resourceId: dto!.id,
    requestId: meta.requestId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    afterSnapshot: { ticketNumber: dto!.ticketNumber, accountId: client.accountId },
  });

  return dto!;
}

export async function addClientPortalComment(
  client: ClientPortalUser,
  ticketId: string,
  input: { message: string; authorName?: string; authorEmail?: string },
  meta: { requestId: string; ipAddress: string; userAgent: string }
): Promise<TicketDTO> {
  if (!ObjectId.isValid(ticketId)) throw AppError.badRequest('Invalid ticket ID.');
  const oid = new ObjectId(ticketId);
  const accountOid = new ObjectId(client.accountId);

  const existing = await Collections.tickets().findOne({ _id: oid, accountId: accountOid });
  if (!existing) {
    throw AppError.notFound('Ticket not found.');
  }

  const now = new Date();
  const comment: TicketCommentDoc = {
    id: `cmt-${randomUUID().slice(0, 8)}`,
    authorType: 'CLIENT',
    authorName: (input.authorName?.trim() || client.requesterName || client.accountName).trim(),
    authorEmail: (input.authorEmail?.trim() || client.requesterEmail || '').toLowerCase(),
    message: input.message.trim(),
    isInternalNote: false,
    createdAt: now,
  };

  const setPatch: Record<string, unknown> = { updatedAt: now };
  if (existing.status === 'WAITING_CLIENT') {
    setPatch.status = 'IN_PROGRESS';
  }

  const updated = await Collections.tickets().findOneAndUpdate(
    { _id: oid, accountId: accountOid },
    {
      $push: { comments: comment },
      $set: setPatch,
      $inc: { version: 1 },
    },
    { returnDocument: 'after' }
  );

  if (!updated) throw AppError.notFound('Ticket not found.');

  const [dto] = await hydrateTickets([updated], { stripInternalNotes: true });

  await writeAuditLog({
    actorId: `client:${client.accountId}`,
    actorEmail: comment.authorEmail,
    actorRole: 'PUBLIC_INGEST',
    isStaticSuperAdmin: false,
    action: 'CLIENT_PORTAL_TICKET_REPLY',
    resourceType: 'ticket',
    resourceId: dto!.id,
    requestId: meta.requestId,
    ipAddress: meta.ipAddress,
    userAgent: meta.userAgent,
    afterSnapshot: { commentId: comment.id, newStatus: dto!.status },
  });

  return dto!;
}
