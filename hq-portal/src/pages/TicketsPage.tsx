import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Clock,
  LifeBuoy,
  Lock,
  MessageSquare,
  Plus,
  Search,
  Send,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { canEditTickets } from '@/lib/rbac';
import { formatDateShort, formatDateTime } from '@/lib/format';
import {
  EmptyState,
  ErrorBanner,
  Modal,
  SlideOver,
  StatusPill,
  TableSkeleton,
} from '@/components/ui/Primitives';
import type {
  AssociateDTO,
  CrmAccountDTO,
  CursorPage,
  ProjectDTO,
  TicketCategory,
  TicketDTO,
  TicketPriority,
  TicketStatus,
  TicketSummaryDTO,
} from '@/types/hq';

const TICKET_STATUSES: Array<'ALL' | TicketStatus> = [
  'ALL',
  'OPEN',
  'IN_PROGRESS',
  'WAITING_CLIENT',
  'RESOLVED',
  'CLOSED',
];

const TICKET_PRIORITIES: TicketPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const TICKET_CATEGORIES: TicketCategory[] = [
  'BUG',
  'FEATURE_REQUEST',
  'SUPPORT',
  'INFRASTRUCTURE',
  'BILLING',
  'TRAINING',
];

function priorityTone(priority: TicketPriority): 'neutral' | 'brand' | 'warn' | 'out' {
  if (priority === 'URGENT') return 'out';
  if (priority === 'HIGH') return 'warn';
  if (priority === 'MEDIUM') return 'brand';
  return 'neutral';
}

function ticketStatusTone(status: TicketStatus): 'in' | 'warn' | 'out' | 'brand' | 'neutral' {
  if (status === 'OPEN') return 'out';
  if (status === 'IN_PROGRESS') return 'brand';
  if (status === 'WAITING_CLIENT') return 'warn';
  if (status === 'RESOLVED') return 'in';
  return 'neutral';
}

export default function TicketsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const editable = canEditTickets(user);

  const [tickets, setTickets] = useState<TicketDTO[]>([]);
  const [summary, setSummary] = useState<TicketSummaryDTO | null>(null);
  const [accounts, setAccounts] = useState<CrmAccountDTO[]>([]);
  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [associates, setAssociates] = useState<AssociateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [projectFilter, setProjectFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | TicketStatus>('ALL');
  const [priorityFilter, setPriorityFilter] = useState<'ALL' | TicketPriority>('ALL');
  const [categoryFilter, setCategoryFilter] = useState<'ALL' | TicketCategory>('ALL');
  const [search, setSearch] = useState('');

  // Detail Drawer
  const [activeTicket, setActiveTicket] = useState<TicketDTO | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [updatingTriage, setUpdatingTriage] = useState(false);
  const [replyBody, setReplyBody] = useState('');
  const [replyInternal, setReplyInternal] = useState(false);
  const [sendingReply, setSendingReply] = useState(false);

  // Create Ticket Modal
  const [createOpen, setCreateOpen] = useState(false);
  const [createForm, setCreateForm] = useState({
    accountId: '',
    projectId: '',
    title: '',
    description: '',
    category: 'SUPPORT' as TicketCategory,
    priority: 'MEDIUM' as TicketPriority,
    requesterName: '',
    requesterEmail: '',
    assignedAssociateId: '',
  });
  const [creating, setCreating] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [tktRes, acctRes, projRes, assocRes] = await Promise.all([
        apiRequest<CursorPage<TicketDTO> & { summary?: TicketSummaryDTO }>('/api/v1/tickets?limit=100'),
        apiRequest<CursorPage<CrmAccountDTO>>('/api/v1/crm/accounts?limit=100').catch(() => ({
          items: [],
          nextCursor: null,
          hasMore: false,
        })),
        apiRequest<CursorPage<ProjectDTO>>('/api/v1/projects?limit=100').catch(() => ({
          items: [],
          nextCursor: null,
          hasMore: false,
        })),
        apiRequest<CursorPage<AssociateDTO>>('/api/v1/associates?limit=100').catch(() => ({
          items: [],
          nextCursor: null,
          hasMore: false,
        })),
      ]);
      setTickets(tktRes.items || []);
      setSummary(tktRes.summary ?? null);
      setAccounts(acctRes.items || []);
      setProjects(projRes.items || []);
      setAssociates(assocRes.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load support tickets.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const computedSummary = useMemo<TicketSummaryDTO>(() => {
    if (summary) return summary;
    return {
      open: tickets.filter((t) => t.status === 'OPEN').length,
      inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
      waitingClient: tickets.filter((t) => t.status === 'WAITING_CLIENT').length,
      urgentOpen: tickets.filter(
        (t) => t.priority === 'URGENT' && t.status !== 'RESOLVED' && t.status !== 'CLOSED'
      ).length,
      resolved: tickets.filter((t) => t.status === 'RESOLVED').length,
      closed: tickets.filter((t) => t.status === 'CLOSED').length,
    };
  }, [summary, tickets]);

  const filteredTickets = useMemo(() => {
    const q = search.trim().toLowerCase();
    return tickets.filter((t) => {
      if (accountFilter !== 'ALL' && t.accountId !== accountFilter) return false;
      if (projectFilter !== 'ALL' && t.projectId !== projectFilter) return false;
      if (statusFilter !== 'ALL' && t.status !== statusFilter) return false;
      if (priorityFilter !== 'ALL' && t.priority !== priorityFilter) return false;
      if (categoryFilter !== 'ALL' && t.category !== categoryFilter) return false;
      if (!q) return true;
      return (
        t.ticketNumber.toLowerCase().includes(q) ||
        t.title.toLowerCase().includes(q) ||
        t.accountName.toLowerCase().includes(q) ||
        (t.projectName || '').toLowerCase().includes(q) ||
        t.requesterName.toLowerCase().includes(q)
      );
    });
  }, [tickets, accountFilter, projectFilter, statusFilter, priorityFilter, categoryFilter, search]);

  const openTicketDetail = async (ticket: TicketDTO) => {
    setActiveTicket(ticket);
    setReplyBody('');
    setReplyInternal(false);
    setDetailLoading(true);
    try {
      const full = await apiRequest<TicketDTO>(`/api/v1/tickets/${ticket.id}`);
      setActiveTicket(full);
    } catch {
      // Keep list preview if detail call fails
    } finally {
      setDetailLoading(false);
    }
  };

  const handleTriagePatch = async (patch: Record<string, unknown>) => {
    if (!activeTicket || !editable) return;
    setUpdatingTriage(true);
    try {
      const updated = await apiRequest<TicketDTO>(`/api/v1/tickets/${activeTicket.id}`, {
        method: 'PATCH',
        body: { ...patch, version: activeTicket.version },
      });
      setActiveTicket(updated);
      pushToast({ variant: 'success', title: `Ticket ${updated.ticketNumber} updated` });
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Triage update failed',
        description: err instanceof ApiError ? err.message : 'Unable to update ticket.',
      });
    } finally {
      setUpdatingTriage(false);
    }
  };

  const handleSendReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeTicket || !replyBody.trim() || !editable) return;
    setSendingReply(true);
    try {
      const updated = await apiRequest<TicketDTO>(`/api/v1/tickets/${activeTicket.id}/comments`, {
        method: 'POST',
        body: {
          message: replyBody.trim(),
          isInternalNote: replyInternal,
        },
      });
      setActiveTicket(updated);
      setReplyBody('');
      setReplyInternal(false);
      pushToast({
        variant: 'success',
        title: replyInternal ? 'Internal note added' : 'Reply sent to client',
      });
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Failed to post comment',
        description: err instanceof ApiError ? err.message : 'Unable to add reply.',
      });
    } finally {
      setSendingReply(false);
    }
  };

  const handleCreateTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!createForm.accountId || !createForm.title.trim()) {
      pushToast({ variant: 'error', title: 'Select a client account and enter a subject' });
      return;
    }
    setCreating(true);
    try {
      const created = await apiRequest<TicketDTO>('/api/v1/tickets', {
        method: 'POST',
        body: {
          accountId: createForm.accountId,
          projectId: createForm.projectId || null,
          title: createForm.title.trim(),
          description: createForm.description.trim(),
          category: createForm.category,
          priority: createForm.priority,
          requesterName: createForm.requesterName.trim() || 'Client Contact',
          requesterEmail: createForm.requesterEmail.trim() || 'client@example.com',
          assignedAssociateId: createForm.assignedAssociateId || null,
        },
      });
      pushToast({
        variant: 'success',
        title: `Created ${created.ticketNumber}`,
        description: created.title,
      });
      setCreateOpen(false);
      await loadAll();
      void openTicketDetail(created);
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Ticket creation failed',
        description: err instanceof ApiError ? err.message : 'Unable to create support ticket.',
      });
    } finally {
      setCreating(false);
    }
  };

  const accountProjectsForCreate = useMemo(
    () => projects.filter((p) => !createForm.accountId || p.accountId === createForm.accountId),
    [projects, createForm.accountId]
  );

  const accountProjectsForActive = useMemo(
    () => projects.filter((p) => !activeTicket || p.accountId === activeTicket.accountId),
    [projects, activeTicket]
  );

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-ds-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-hq-textPrimary">
            Support Tickets
          </h1>
          <p className="mt-1 text-sm text-hq-textSecondary">
            Client support requests, bug reports, and change orders synced live with the Client Portal.
          </p>
        </div>

        {editable && (
          <button
            type="button"
            onClick={() => {
              setCreateForm({
                accountId: accounts[0]?.id || '',
                projectId: '',
                title: '',
                description: '',
                category: 'SUPPORT',
                priority: 'MEDIUM',
                requesterName: '',
                requesterEmail: '',
                assignedAssociateId: '',
              });
              setCreateOpen(true);
            }}
            className="hq-btn-primary inline-flex h-10 items-center gap-1.5 px-4 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Ticket</span>
          </button>
        )}
      </div>

      {/* 5-KPI Strip */}
      <section className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        <div className="hq-card p-4">
          <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">Open</p>
          <p className="mt-1.5 font-ds-mono text-2xl font-semibold tabular-nums text-hq-out">
            {computedSummary.open}
          </p>
        </div>
        <div className="hq-card p-4">
          <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
            In Progress
          </p>
          <p className="mt-1.5 font-ds-mono text-2xl font-semibold tabular-nums text-hq-brandSoft">
            {computedSummary.inProgress}
          </p>
        </div>
        <div className="hq-card p-4">
          <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
            Waiting on Client
          </p>
          <p className="mt-1.5 font-ds-mono text-2xl font-semibold tabular-nums text-hq-warn">
            {computedSummary.waitingClient}
          </p>
        </div>
        <div className="hq-card border-hq-out/35 p-4">
          <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-out">
            Urgent Open
          </p>
          <p className="mt-1.5 font-ds-mono text-2xl font-semibold tabular-nums text-hq-out">
            {computedSummary.urgentOpen}
          </p>
        </div>
        <div className="hq-card p-4">
          <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
            Resolved
          </p>
          <p className="mt-1.5 font-ds-mono text-2xl font-semibold tabular-nums text-hq-in">
            {computedSummary.resolved + (computedSummary.closed ?? 0)}
          </p>
        </div>
      </section>

      {error && <ErrorBanner message={error} onRetry={loadAll} />}

      {/* Filter Bar */}
      <div className="hq-card p-4 space-y-3">
        <div className="grid grid-cols-1 gap-3 md:grid-cols-12">
          <div className="relative md:col-span-4">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hq-textMuted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search TKT-XXXX, subject, client..."
              className="hq-input h-9 w-full pl-9 pr-3 text-xs"
            />
          </div>

          <select
            aria-label="Filter by Client"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="hq-input h-9 px-2.5 text-xs md:col-span-3"
          >
            <option value="ALL">All Clients</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Project"
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="hq-input h-9 px-2.5 text-xs md:col-span-2"
          >
            <option value="ALL">All Projects</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>
                {p.code} — {p.name}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Priority"
            value={priorityFilter}
            onChange={(e) => setPriorityFilter(e.target.value as 'ALL' | TicketPriority)}
            className="hq-input h-9 px-2.5 font-ds-mono text-xs md:col-span-1"
          >
            <option value="ALL">Priority</option>
            {TICKET_PRIORITIES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>

          <select
            aria-label="Filter by Category"
            value={categoryFilter}
            onChange={(e) => setCategoryFilter(e.target.value as 'ALL' | TicketCategory)}
            className="hq-input h-9 px-2.5 font-ds-mono text-xs md:col-span-2"
          >
            <option value="ALL">All Categories</option>
            {TICKET_CATEGORIES.map((c) => (
              <option key={c} value={c}>
                {c.replace('_', ' ')}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            {TICKET_STATUSES.map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-full px-3 py-1 font-ds-mono text-[11px] transition-colors ${
                  statusFilter === st
                    ? 'bg-hq-brand text-white font-semibold'
                    : 'border border-hq-borderDefault text-hq-textSecondary hover:bg-hq-elevated'
                }`}
              >
                {st.replace(/_/g, ' ')}
              </button>
            ))}
          </div>
          <span className="font-ds-mono text-xs text-hq-textMuted tabular-nums">
            Showing {filteredTickets.length} of {tickets.length}
          </span>
        </div>
      </div>

      {/* Tickets Table */}
      <div className="hq-card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : filteredTickets.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<LifeBuoy className="h-5 w-5" />}
              title="No Support Tickets Found"
              description="Tickets submitted via the Client Portal or logged internally appear here."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
                  <th className="px-4 py-3 whitespace-nowrap">Ticket #</th>
                  <th className="px-4 py-3">Subject &amp; Client / Project</th>
                  <th className="px-4 py-3 whitespace-nowrap">Category</th>
                  <th className="px-4 py-3 whitespace-nowrap">Priority</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 whitespace-nowrap">Assigned To</th>
                  <th className="px-4 py-3 whitespace-nowrap">Updated / SLA</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hq-borderSubtle text-sm">
                {filteredTickets.map((ticket) => (
                  <tr
                    key={ticket.id}
                    onClick={() => void openTicketDetail(ticket)}
                    className="cursor-pointer hover:bg-hq-elevated/60 transition-colors"
                  >
                    <td className="px-4 py-3 font-ds-mono text-xs font-semibold tabular-nums text-hq-brandSoft whitespace-nowrap">
                      {ticket.ticketNumber}
                    </td>
                    <td className="px-4 py-3 max-w-[300px]">
                      <p className="font-semibold text-hq-textPrimary truncate">{ticket.title}</p>
                      <p className="text-xs text-hq-textSecondary truncate">
                        {ticket.accountName}
                        {ticket.projectName ? ` · ${ticket.projectName}` : ''}
                      </p>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="rounded-md border border-hq-borderSubtle bg-hq-subtle px-2 py-0.5 font-ds-mono text-[11px] text-hq-textSecondary">
                        {ticket.category.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusPill tone={priorityTone(ticket.priority)}>{ticket.priority}</StatusPill>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusPill tone={ticketStatusTone(ticket.status)}>
                        {ticket.status.replace(/_/g, ' ')}
                      </StatusPill>
                    </td>
                    <td className="px-4 py-3 text-xs text-hq-textSecondary whitespace-nowrap">
                      {ticket.assignedAssociateName || 'Unassigned'}
                    </td>
                    <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                      <div>{formatDateShort(ticket.updatedAt)}</div>
                      {ticket.slaDueAt && (
                        <div className="text-[10px] text-hq-textMuted">
                          SLA: {formatDateShort(ticket.slaDueAt)}
                        </div>
                      )}
                    </td>
                    <td className="px-4 py-3 text-right whitespace-nowrap">
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          void openTicketDetail(ticket);
                        }}
                        className="rounded-md border border-hq-borderDefault px-3 py-1 text-xs font-medium text-hq-textPrimary hover:bg-hq-elevated"
                      >
                        View
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expandable Ticket Detail & Conversation Drawer */}
      <SlideOver
        open={Boolean(activeTicket)}
        onClose={() => setActiveTicket(null)}
        title={activeTicket ? `${activeTicket.ticketNumber} · ${activeTicket.title}` : 'Ticket Details'}
        subtitle={
          activeTicket
            ? `${activeTicket.accountName}${activeTicket.projectName ? ` · ${activeTicket.projectName}` : ''}`
            : undefined
        }
        widthClass="max-w-[720px]"
      >
        {activeTicket && (
          <div className="space-y-5">
            {/* Quick Triage Bar */}
            <div className="rounded-xl border border-hq-borderSubtle bg-hq-subtle p-4 space-y-3">
              <div className="grid grid-cols-1 gap-2.5 sm:grid-cols-2 lg:grid-cols-3">
                <div>
                  <label className="mb-1 block font-ds-mono text-[10px] uppercase text-hq-textMuted">
                    Status
                  </label>
                  <select
                    disabled={!editable || updatingTriage}
                    value={activeTicket.status}
                    onChange={(e) => void handleTriagePatch({ status: e.target.value })}
                    className="hq-input h-9 w-full px-2.5 font-ds-mono text-xs"
                  >
                    {TICKET_STATUSES.filter((s) => s !== 'ALL').map((st) => (
                      <option key={st} value={st}>
                        {st}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-ds-mono text-[10px] uppercase text-hq-textMuted">
                    Priority
                  </label>
                  <select
                    disabled={!editable || updatingTriage}
                    value={activeTicket.priority}
                    onChange={(e) => void handleTriagePatch({ priority: e.target.value })}
                    className="hq-input h-9 w-full px-2.5 font-ds-mono text-xs"
                  >
                    {TICKET_PRIORITIES.map((p) => (
                      <option key={p} value={p}>
                        {p}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-ds-mono text-[10px] uppercase text-hq-textMuted">
                    Category
                  </label>
                  <select
                    disabled={!editable || updatingTriage}
                    value={activeTicket.category}
                    onChange={(e) => void handleTriagePatch({ category: e.target.value })}
                    className="hq-input h-9 w-full px-2.5 font-ds-mono text-xs"
                  >
                    {TICKET_CATEGORIES.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label className="mb-1 block font-ds-mono text-[10px] uppercase text-hq-textMuted">
                    Assigned Associate
                  </label>
                  <select
                    disabled={!editable || updatingTriage}
                    value={activeTicket.assignedAssociateId || ''}
                    onChange={(e) =>
                      void handleTriagePatch({ assignedAssociateId: e.target.value || null })
                    }
                    className="hq-input h-9 w-full px-2.5 text-xs"
                  >
                    <option value="">Unassigned</option>
                    {associates.map((a) => (
                      <option key={a.id} value={a.id}>
                        {a.name}
                      </option>
                    ))}
                  </select>
                </div>

                <div className="sm:col-span-2">
                  <label className="mb-1 block font-ds-mono text-[10px] uppercase text-hq-textMuted">
                    Linked Project
                  </label>
                  <select
                    disabled={!editable || updatingTriage}
                    value={activeTicket.projectId || ''}
                    onChange={(e) => void handleTriagePatch({ projectId: e.target.value || null })}
                    className="hq-input h-9 w-full px-2.5 text-xs"
                  >
                    <option value="">General Account Support (No Project)</option>
                    {accountProjectsForActive.map((p) => (
                      <option key={p.id} value={p.id}>
                        {p.code} — {p.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hq-borderSubtle pt-2.5 text-xs text-hq-textSecondary">
                <span>
                  Requester: <strong className="text-hq-textPrimary">{activeTicket.requesterName}</strong>{' '}
                  <span className="font-ds-mono text-[11px] text-hq-textMuted">
                    ({activeTicket.requesterEmail})
                  </span>
                </span>
                {activeTicket.slaDueAt && (
                  <span className="inline-flex items-center gap-1 font-ds-mono text-[11px]">
                    <Clock className="h-3 w-3 text-hq-brandSoft" />
                    SLA Due: {formatDateTime(activeTicket.slaDueAt)}
                  </span>
                )}
              </div>
            </div>

            {/* Ticket Description */}
            <div className="rounded-xl border border-hq-borderSubtle bg-hq-surface p-4 space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
                  Reported Issue / Request
                </span>
                {activeTicket.phaseId && (
                  <StatusPill tone="brand">
                    Phase:{' '}
                    {projects
                      .find((p) => p.id === activeTicket.projectId)
                      ?.phases.find((ph) => ph.id === activeTicket.phaseId)?.name ||
                      activeTicket.phaseId}
                  </StatusPill>
                )}
              </div>
              <p className="text-sm text-hq-textPrimary whitespace-pre-wrap leading-relaxed">
                {activeTicket.description}
              </p>
            </div>

            {/* Conversation Thread */}
            <div className="space-y-3">
              <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-hq-brandSoft" />
                <span>Conversation Thread ({activeTicket.comments?.length || 0})</span>
              </h3>

              {detailLoading ? (
                <div className="hq-skeleton h-20 w-full" />
              ) : !activeTicket.comments || activeTicket.comments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-hq-borderDefault p-4 text-center text-xs text-hq-textMuted">
                  No replies yet. Post a public client response or an internal engineering note below.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeTicket.comments.map((comment) => {
                    const isInternal = comment.isInternalNote;
                    const isTeam = comment.authorType === 'TEAM';

                    return (
                      <article
                        key={comment.id}
                        className={`rounded-xl border p-4 space-y-1.5 ${
                          isInternal
                            ? 'border-hq-warn/50 bg-hq-warnBg/70'
                            : isTeam
                              ? 'border-hq-brand/45 bg-hq-surface'
                              : 'border-hq-borderSubtle bg-hq-subtle'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="text-xs font-semibold text-hq-textPrimary">
                              {comment.authorName}
                            </span>
                            {isInternal ? (
                              <StatusPill tone="warn">
                                <Lock className="h-2.5 w-2.5" />
                                INTERNAL NOTE — HIDDEN FROM CLIENT
                              </StatusPill>
                            ) : isTeam ? (
                              <StatusPill tone="brand">Thea Team Reply</StatusPill>
                            ) : (
                              <StatusPill tone="neutral">Client Message</StatusPill>
                            )}
                          </div>
                          <span className="font-ds-mono text-[11px] tabular-nums text-hq-textMuted">
                            {formatDateTime(comment.createdAt)}
                          </span>
                        </div>
                        <p className="text-sm text-hq-textPrimary whitespace-pre-wrap leading-relaxed">
                          {comment.message}
                        </p>
                      </article>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Reply Composer */}
            {editable && (
              <form
                onSubmit={handleSendReply}
                className={`rounded-xl border p-4 space-y-3 ${
                  replyInternal
                    ? 'border-hq-warn/60 bg-hq-warnBg/50'
                    : 'border-hq-borderSubtle bg-hq-subtle'
                }`}
              >
                <label className="block text-xs font-semibold text-hq-textPrimary">
                  {replyInternal ? 'Add Internal Team Note (Hidden from Client)' : 'Reply to Client'}
                </label>
                <textarea
                  rows={3}
                  required
                  value={replyBody}
                  onChange={(e) => setReplyBody(e.target.value)}
                  placeholder={
                    replyInternal
                      ? 'Internal debugging context, root cause, or handoff instructions...'
                      : 'Write an update visible to the client in their portal...'
                  }
                  className="hq-input w-full px-3 py-2 text-sm"
                />
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <label className="inline-flex items-center gap-2 text-xs font-medium text-hq-textPrimary cursor-pointer">
                    <input
                      type="checkbox"
                      checked={replyInternal}
                      onChange={(e) => setReplyInternal(e.target.checked)}
                      className="h-4 w-4 accent-[#B45309]"
                    />
                    <Lock className="h-3.5 w-3.5 text-hq-warn" />
                    <span>Internal Note (hidden from client)</span>
                  </label>

                  <button
                    type="submit"
                    disabled={sendingReply || !replyBody.trim()}
                    className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>
                      {sendingReply
                        ? 'Sending...'
                        : replyInternal
                          ? 'Save Internal Note'
                          : 'Send Public Reply'}
                    </span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </SlideOver>

      {/* Create Ticket Modal */}
      <Modal
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        title="Create Support Ticket"
        subtitle="Log an issue, change request, or support inquiry on behalf of a client"
        maxWidthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setCreateOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="create-ticket-form"
              disabled={creating}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {creating ? 'Creating...' : 'Create Ticket'}
            </button>
          </>
        }
      >
        <form id="create-ticket-form" onSubmit={handleCreateTicket} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Client Account *
              </label>
              <select
                required
                value={createForm.accountId}
                onChange={(e) =>
                  setCreateForm({ ...createForm, accountId: e.target.value, projectId: '' })
                }
                className="hq-input h-10 w-full px-3 text-sm"
              >
                <option value="">Select client...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Linked Project
              </label>
              <select
                value={createForm.projectId}
                onChange={(e) => setCreateForm({ ...createForm, projectId: e.target.value })}
                className="hq-input h-10 w-full px-3 text-sm"
              >
                <option value="">General Account Support</option>
                {accountProjectsForCreate.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Subject *</label>
            <input
              type="text"
              required
              value={createForm.title}
              onChange={(e) => setCreateForm({ ...createForm, title: e.target.value })}
              placeholder="Cold-chain temperature sensor export timeout"
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Category</label>
              <select
                value={createForm.category}
                onChange={(e) =>
                  setCreateForm({ ...createForm, category: e.target.value as TicketCategory })
                }
                className="hq-input h-10 w-full px-2.5 font-ds-mono text-xs"
              >
                {TICKET_CATEGORIES.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Priority</label>
              <select
                value={createForm.priority}
                onChange={(e) =>
                  setCreateForm({ ...createForm, priority: e.target.value as TicketPriority })
                }
                className="hq-input h-10 w-full px-2.5 font-ds-mono text-xs"
              >
                {TICKET_PRIORITIES.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Assign To
              </label>
              <select
                value={createForm.assignedAssociateId}
                onChange={(e) =>
                  setCreateForm({ ...createForm, assignedAssociateId: e.target.value })
                }
                className="hq-input h-10 w-full px-2.5 text-xs"
              >
                <option value="">Unassigned</option>
                {associates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Requester Name *
              </label>
              <input
                type="text"
                required
                value={createForm.requesterName}
                onChange={(e) => setCreateForm({ ...createForm, requesterName: e.target.value })}
                placeholder="Aung Kyaw"
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Requester Email *
              </label>
              <input
                type="email"
                required
                value={createForm.requesterEmail}
                onChange={(e) => setCreateForm({ ...createForm, requesterEmail: e.target.value })}
                placeholder="aung@client.com"
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              Detailed Description *
            </label>
            <textarea
              rows={4}
              required
              value={createForm.description}
              onChange={(e) => setCreateForm({ ...createForm, description: e.target.value })}
              className="hq-input w-full px-3 py-2 text-sm"
            />
          </div>

          <div className="flex items-center gap-2 rounded-lg bg-hq-subtle px-3 py-2 text-xs text-hq-textMuted">
            <AlertCircle className="h-3.5 w-3.5 shrink-0 text-hq-brandSoft" />
            <span>Tickets created here are immediately visible to the client in their Client Portal.</span>
          </div>
        </form>
      </Modal>
    </div>
  );
}
