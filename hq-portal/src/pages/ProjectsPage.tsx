import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Circle,
  Clock,
  Copy,
  Edit3,
  ExternalLink,
  FolderKanban,
  Layers,
  Plus,
  Save,
  Search,
  Ticket,
  Trash2,
  AlertTriangle,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useToast } from '@/context/ToastContext';
import { canEditProjects } from '@/lib/rbac';
import { formatDateShort, formatDecimalInput, getTodayIso, parseDecimal } from '@/lib/format';
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
  CurrencyCode,
  CursorPage,
  MilestoneStatus,
  PhaseStatus,
  ProjectDTO,
  ProjectHealth,
  ProjectMilestoneDTO,
  ProjectPhaseDTO,
  ProjectStatus,
} from '@/types/hq';

const PROJECT_STATUSES: Array<'ALL' | ProjectStatus> = [
  'ALL',
  'PLANNING',
  'ACTIVE',
  'ON_HOLD',
  'COMPLETED',
  'CANCELLED',
];

const DEFAULT_DELIVERY_PHASES = (startDate: string, targetDate: string): ProjectPhaseDTO[] => [
  {
    id: `phase-1-${Date.now()}`,
    order: 1,
    name: 'Discovery & Architecture Blueprint',
    summary: 'Stakeholder workshops, workflow mapping, and technical specification sign-off.',
    status: 'IN_PROGRESS',
    startDate,
    targetDate,
    progressPct: 25,
    milestones: [
      {
        id: `ms-1-${Date.now()}`,
        title: 'Technical Architecture & PRD Sign-off',
        deliveryDate: startDate,
        completedAt: null,
        status: 'IN_PROGRESS',
        deliverableNote: 'Approved system design, ERD, and milestone schedule',
      },
    ],
  },
  {
    id: `phase-2-${Date.now() + 1}`,
    order: 2,
    name: 'Core Foundation & UI Prototype',
    summary: 'Interactive wireframes, database schema, and core authentication.',
    status: 'UPCOMING',
    startDate,
    targetDate,
    progressPct: 0,
    milestones: [],
  },
  {
    id: `phase-3-${Date.now() + 2}`,
    order: 3,
    name: 'Production Launch & Handover',
    summary: 'UAT sign-off, production deployment, team training, and SLA activation.',
    status: 'UPCOMING',
    startDate,
    targetDate,
    progressPct: 0,
    milestones: [],
  },
];

function deriveProjectHealth(project: Pick<ProjectDTO, 'status' | 'phases'>): ProjectHealth {
  if (project.phases.some((ph) => ph.status === 'DELAYED')) return 'DELAYED';
  if (
    project.status === 'ON_HOLD' ||
    project.phases.some((ph) => ph.milestones.some((ms) => ms.status === 'AT_RISK'))
  ) {
    return 'AT_RISK';
  }
  return 'ON_TRACK';
}

function statusTone(status: ProjectStatus | PhaseStatus | MilestoneStatus): 'in' | 'warn' | 'out' | 'brand' | 'neutral' {
  switch (status) {
    case 'COMPLETED':
      return 'in';
    case 'ACTIVE':
    case 'IN_PROGRESS':
      return 'brand';
    case 'DELAYED':
    case 'CANCELLED':
      return 'out';
    case 'ON_HOLD':
    case 'AT_RISK':
      return 'warn';
    default:
      return 'neutral';
  }
}

function healthTone(health: ProjectHealth): 'in' | 'warn' | 'out' {
  if (health === 'ON_TRACK') return 'in';
  if (health === 'AT_RISK') return 'warn';
  return 'out';
}

function nextMilestoneStatus(current: MilestoneStatus): MilestoneStatus {
  const cycle: MilestoneStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'AT_RISK'];
  const idx = cycle.indexOf(current);
  return cycle[(idx + 1) % cycle.length];
}

function toMilestonePayload(ms: ProjectMilestoneDTO) {
  return {
    id: ms.id,
    title: ms.title,
    deliveryDate: ms.deliveryDate,
    status: ms.status,
    completedAt: ms.completedAt ?? null,
    deliverableNote: ms.deliverableNote ?? '',
  };
}

function toPhasePayload(ph: ProjectPhaseDTO, order: number) {
  return {
    id: ph.id,
    name: ph.name,
    order,
    status: ph.status,
    startDate: ph.startDate,
    targetDate: ph.targetDate,
    progressPct: ph.progressPct,
    summary: ph.summary ?? '',
    milestones: ph.milestones.map(toMilestonePayload),
  };
}

export default function ProjectsPage() {
  const { user } = useAuth();
  const { pushToast } = useToast();
  const editable = canEditProjects(user);

  const [projects, setProjects] = useState<ProjectDTO[]>([]);
  const [accounts, setAccounts] = useState<CrmAccountDTO[]>([]);
  const [associates, setAssociates] = useState<AssociateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Filters
  const [accountFilter, setAccountFilter] = useState('ALL');
  const [statusFilter, setStatusFilter] = useState<'ALL' | ProjectStatus>('ALL');
  const [search, setSearch] = useState('');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Roadmap Drawer
  const [selectedProject, setSelectedProject] = useState<ProjectDTO | null>(null);
  const [phasesDraft, setPhasesDraft] = useState<ProjectPhaseDTO[]>([]);
  const [savingPhaseId, setSavingPhaseId] = useState<string | null>(null);
  const [savingAllPhases, setSavingAllPhases] = useState(false);

  // Inline Add Phase Form
  const [showAddPhase, setShowAddPhase] = useState(false);
  const [newPhaseForm, setNewPhaseForm] = useState({
    name: '',
    summary: '',
    startDate: getTodayIso(),
    targetDate: getTodayIso(),
  });

  // Inline Add Milestone per Phase
  const [addingMilestonePhaseId, setAddingMilestonePhaseId] = useState<string | null>(null);
  const [newMilestoneForm, setNewMilestoneForm] = useState({
    title: '',
    deliveryDate: getTodayIso(),
    deliverableNote: '',
  });

  // Create / Edit Project Modal
  const [projectModalOpen, setProjectModalOpen] = useState(false);
  const [editingProject, setEditingProject] = useState<ProjectDTO | null>(null);
  const [projectForm, setProjectForm] = useState({
    accountId: '',
    name: '',
    summary: '',
    status: 'ACTIVE' as ProjectStatus,
    startDate: getTodayIso(),
    targetEndDate: getTodayIso(),
    currency: 'MMK' as CurrencyCode,
    budgetAmount: '15000000.00',
    leadAssociateId: '',
    includeDefaultPhases: true,
  });
  const [projectSaving, setProjectSaving] = useState(false);

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [projRes, acctRes, assocRes] = await Promise.all([
        apiRequest<CursorPage<ProjectDTO>>('/api/v1/projects?limit=100'),
        apiRequest<CursorPage<CrmAccountDTO>>('/api/v1/crm/accounts?limit=100').catch(() => ({
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
      const items = projRes.items || [];
      setProjects(items);
      setAccounts(acctRes.items || []);
      setAssociates(assocRes.items || []);

      setSelectedProject((prev) => {
        if (!prev) return null;
        const fresh = items.find((p) => p.id === prev.id) || null;
        if (fresh) {
          setPhasesDraft(fresh.phases.map((ph) => ({ ...ph, milestones: [...ph.milestones] })));
        }
        return fresh;
      });
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load projects & delivery roadmaps.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const accountById = useMemo(() => {
    const map = new Map<string, CrmAccountDTO>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const filteredProjects = useMemo(() => {
    const q = search.trim().toLowerCase();
    return projects.filter((p) => {
      if (accountFilter !== 'ALL' && p.accountId !== accountFilter) return false;
      if (statusFilter !== 'ALL' && p.status !== statusFilter) return false;
      if (!q) return true;
      return (
        p.name.toLowerCase().includes(q) ||
        p.code.toLowerCase().includes(q) ||
        p.accountName.toLowerCase().includes(q) ||
        (p.leadAssociateName || '').toLowerCase().includes(q)
      );
    });
  }, [projects, accountFilter, statusFilter, search]);

  const kpis = useMemo(() => {
    const active = projects.filter((p) => p.status !== 'CANCELLED' && p.status !== 'COMPLETED');
    const onTrack = active.filter((p) => deriveProjectHealth(p) === 'ON_TRACK').length;
    const atRisk = active.filter((p) => {
      const h = deriveProjectHealth(p);
      return h === 'AT_RISK' || h === 'DELAYED';
    }).length;
    const avgCompletion =
      projects.length > 0
        ? Math.round(projects.reduce((s, p) => s + (p.overallProgressPct || 0), 0) / projects.length)
        : 0;
    const activeMilestones = projects.reduce(
      (sum, p) =>
        sum +
        p.phases.reduce(
          (pSum, ph) => pSum + ph.milestones.filter((m) => m.status !== 'COMPLETED').length,
          0
        ),
      0
    );
    return { activeCount: active.length, onTrack, atRisk, avgCompletion, activeMilestones };
  }, [projects]);

  const getPortalUrl = (project: ProjectDTO): string | null => {
    const slug = project.accountPortalSlug || accountById.get(project.accountId)?.portalSlug;
    if (!slug) return null;
    return `${window.location.origin}/client/${slug}`;
  };

  const copyPortalLink = async (key: string, url: string, label = 'Client Portal Link') => {
    try {
      await navigator.clipboard.writeText(url);
      setCopiedId(key);
      pushToast({ variant: 'info', title: `${label} copied`, description: url });
      window.setTimeout(() => setCopiedId(null), 1800);
    } catch {
      pushToast({ variant: 'error', title: 'Clipboard unavailable' });
    }
  };

  const openRoadmap = (project: ProjectDTO) => {
    setSelectedProject(project);
    setPhasesDraft(project.phases.map((ph) => ({ ...ph, milestones: [...ph.milestones] })));
    setShowAddPhase(false);
    setAddingMilestonePhaseId(null);
  };

  const openCreateModal = () => {
    setEditingProject(null);
    const today = getTodayIso();
    const target = new Date();
    target.setUTCDate(target.getUTCDate() + 60);
    setProjectForm({
      accountId: accounts[0]?.id || '',
      name: '',
      summary: '',
      status: 'ACTIVE',
      startDate: today,
      targetEndDate: target.toISOString().slice(0, 10),
      currency: 'MMK',
      budgetAmount: '15000000.00',
      leadAssociateId: associates[0]?.id || '',
      includeDefaultPhases: true,
    });
    setProjectModalOpen(true);
  };

  const openEditModal = (project: ProjectDTO) => {
    setEditingProject(project);
    setProjectForm({
      accountId: project.accountId,
      name: project.name,
      summary: project.summary || '',
      status: project.status,
      startDate: project.startDate,
      targetEndDate: project.targetEndDate,
      currency: project.currency || 'MMK',
      budgetAmount: project.budgetAmount || '0.00',
      leadAssociateId: project.leadAssociateId || '',
      includeDefaultPhases: false,
    });
    setProjectModalOpen(true);
  };

  const handleSaveProject = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!projectForm.accountId || !projectForm.name.trim()) {
      pushToast({ variant: 'error', title: 'Select a Client Account and provide a Project Name' });
      return;
    }

    setProjectSaving(true);
    try {
      if (editingProject) {
        await apiRequest<ProjectDTO>(`/api/v1/projects/${editingProject.id}`, {
          method: 'PUT',
          body: {
            name: projectForm.name.trim(),
            summary: projectForm.summary.trim(),
            status: projectForm.status,
            startDate: projectForm.startDate,
            targetEndDate: projectForm.targetEndDate,
            currency: projectForm.currency,
            budgetAmount: formatDecimalInput(parseDecimal(projectForm.budgetAmount), 2),
            leadAssociateId: projectForm.leadAssociateId || null,
            version: editingProject.version,
          },
        });
        pushToast({ variant: 'success', title: 'Project updated' });
      } else {
        const starterPhases = projectForm.includeDefaultPhases
          ? DEFAULT_DELIVERY_PHASES(projectForm.startDate, projectForm.targetEndDate).map((ph, idx) =>
              toPhasePayload(ph, idx + 1)
            )
          : [];
        await apiRequest<ProjectDTO>('/api/v1/projects', {
          method: 'POST',
          body: {
            accountId: projectForm.accountId,
            name: projectForm.name.trim(),
            summary: projectForm.summary.trim(),
            status: projectForm.status,
            startDate: projectForm.startDate,
            targetEndDate: projectForm.targetEndDate,
            currency: projectForm.currency,
            budgetAmount: formatDecimalInput(parseDecimal(projectForm.budgetAmount), 2),
            leadAssociateId: projectForm.leadAssociateId || null,
            phases: starterPhases,
          },
        });
        pushToast({ variant: 'success', title: 'Project created' });
      }
      setProjectModalOpen(false);
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Project save failed',
        description: err instanceof ApiError ? err.message : 'Unable to save project.',
      });
    } finally {
      setProjectSaving(false);
    }
  };

  const updatePhaseDraft = (phaseId: string, patch: Partial<ProjectPhaseDTO>) => {
    setPhasesDraft((prev) =>
      prev.map((ph) => {
        if (ph.id !== phaseId) return ph;
        const next = { ...ph, ...patch };
        if (patch.status === 'COMPLETED') {
          next.progressPct = 100;
        }
        return next;
      })
    );
  };

  const toggleMilestoneDraft = (phaseId: string, milestoneId: string) => {
    setPhasesDraft((prev) =>
      prev.map((ph) => {
        if (ph.id !== phaseId) return ph;
        const nextMilestones = ph.milestones.map((m) => {
          if (m.id !== milestoneId) return m;
          const nextStatus = nextMilestoneStatus(m.status);
          return {
            ...m,
            status: nextStatus,
            completedAt: nextStatus === 'COMPLETED' ? getTodayIso() : null,
          };
        });
        const completedCount = nextMilestones.filter((m) => m.status === 'COMPLETED').length;
        const autoProgress =
          nextMilestones.length > 0
            ? Math.round((completedCount / nextMilestones.length) * 100)
            : ph.progressPct;
        return {
          ...ph,
          milestones: nextMilestones,
          progressPct: autoProgress,
          status:
            nextMilestones.length > 0 && completedCount === nextMilestones.length
              ? 'COMPLETED'
              : ph.status === 'UPCOMING' && completedCount > 0
                ? 'IN_PROGRESS'
                : ph.status,
        };
      })
    );
  };

  const handleSaveSinglePhase = async (phase: ProjectPhaseDTO) => {
    if (!selectedProject || !editable) return;
    setSavingPhaseId(phase.id);
    try {
      const updated = await apiRequest<ProjectDTO>(
        `/api/v1/projects/${selectedProject.id}/phases/${encodeURIComponent(phase.id)}`,
        {
          method: 'PATCH',
          body: {
            name: phase.name,
            summary: phase.summary || '',
            status: phase.status,
            startDate: phase.startDate,
            targetDate: phase.targetDate,
            progressPct: phase.progressPct,
            milestones: phase.milestones.map(toMilestonePayload),
            version: selectedProject.version,
          },
        }
      );
      setSelectedProject(updated);
      setPhasesDraft(updated.phases.map((ph) => ({ ...ph, milestones: [...ph.milestones] })));
      pushToast({
        variant: 'success',
        title: `Phase ${String(phase.order).padStart(2, '0')} saved`,
        description: `Overall project completion is now ${updated.overallProgressPct}%.`,
      });
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Phase update failed',
        description: err instanceof ApiError ? err.message : 'Unable to save phase changes.',
      });
    } finally {
      setSavingPhaseId(null);
    }
  };

  const handleSaveFullRoadmap = async (nextPhases: ProjectPhaseDTO[], successTitle: string) => {
    if (!selectedProject || !editable) return;
    setSavingAllPhases(true);
    try {
      const updated = await apiRequest<ProjectDTO>(`/api/v1/projects/${selectedProject.id}`, {
        method: 'PUT',
        body: {
          phases: nextPhases.map((ph, idx) => toPhasePayload(ph, idx + 1)),
          version: selectedProject.version,
        },
      });
      setSelectedProject(updated);
      setPhasesDraft(updated.phases.map((ph) => ({ ...ph, milestones: [...ph.milestones] })));
      pushToast({
        variant: 'success',
        title: successTitle,
        description: `Project progress recalculated to ${updated.overallProgressPct}%.`,
      });
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Roadmap save failed',
        description: err instanceof ApiError ? err.message : 'Unable to update delivery roadmap.',
      });
    } finally {
      setSavingAllPhases(false);
    }
  };

  const handleAddPhase = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!newPhaseForm.name.trim()) return;
    const nextPhase: ProjectPhaseDTO = {
      id: `phase-${Date.now()}`,
      order: phasesDraft.length + 1,
      name: newPhaseForm.name.trim(),
      summary: newPhaseForm.summary.trim(),
      status: 'UPCOMING',
      startDate: newPhaseForm.startDate,
      targetDate: newPhaseForm.targetDate,
      progressPct: 0,
      milestones: [],
    };
    const nextPhases = [...phasesDraft, nextPhase];
    setPhasesDraft(nextPhases);
    setNewPhaseForm({ name: '', summary: '', startDate: getTodayIso(), targetDate: getTodayIso() });
    setShowAddPhase(false);
    await handleSaveFullRoadmap(nextPhases, 'Delivery phase added');
  };

  const handleAddMilestone = async (phaseId: string) => {
    if (!newMilestoneForm.title.trim()) return;
    const nextMilestone: ProjectMilestoneDTO = {
      id: `ms-${Date.now()}`,
      title: newMilestoneForm.title.trim(),
      deliveryDate: newMilestoneForm.deliveryDate,
      completedAt: null,
      status: 'PENDING',
      deliverableNote: newMilestoneForm.deliverableNote.trim(),
    };
    const nextPhases = phasesDraft.map((ph) =>
      ph.id === phaseId ? { ...ph, milestones: [...ph.milestones, nextMilestone] } : ph
    );
    setPhasesDraft(nextPhases);
    setAddingMilestonePhaseId(null);
    setNewMilestoneForm({ title: '', deliveryDate: getTodayIso(), deliverableNote: '' });
    const targetPhase = nextPhases.find((p) => p.id === phaseId);
    if (targetPhase) {
      await handleSaveSinglePhase(targetPhase);
    }
  };

  const handleRemoveMilestone = (phaseId: string, milestoneId: string) => {
    setPhasesDraft((prev) =>
      prev.map((ph) =>
        ph.id === phaseId
          ? { ...ph, milestones: ph.milestones.filter((m) => m.id !== milestoneId) }
          : ph
      )
    );
  };

  const selectedAccount = selectedProject ? accountById.get(selectedProject.accountId) : null;
  const selectedPortalSlug = selectedProject?.accountPortalSlug || selectedAccount?.portalSlug;
  const selectedAccessCode = selectedAccount?.portalAccessCode;
  const selectedHealth = selectedProject ? deriveProjectHealth(selectedProject) : 'ON_TRACK';

  return (
    <div className="space-y-5">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-ds-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-hq-textPrimary">
            Projects &amp; Delivery Milestones
          </h1>
          <p className="mt-1 text-sm text-hq-textSecondary">
            Track client software engagements, phase completion, and live deliverables shared with the Client Portal.
          </p>
        </div>

        {editable && (
          <button
            type="button"
            onClick={openCreateModal}
            className="hq-btn-primary inline-flex h-10 items-center gap-1.5 px-4 text-xs"
          >
            <Plus className="h-4 w-4" />
            <span>New Project</span>
          </button>
        )}
      </div>

      {/* KPI Strip */}
      <section className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="hq-card p-4">
          <p className="font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
            Active Projects
          </p>
          <p className="mt-2 font-ds-mono text-2xl font-semibold tabular-nums text-hq-textPrimary">
            {kpis.activeCount}
          </p>
          <p className="mt-1 text-xs text-hq-textSecondary">{projects.length} total tracked</p>
        </article>

        <article className="hq-card p-4">
          <p className="font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
            Delivery Health
          </p>
          <div className="mt-2 flex items-baseline gap-3 font-ds-mono tabular-nums">
            <span className="text-2xl font-semibold text-hq-in">{kpis.onTrack}</span>
            <span className="text-xs text-hq-textSecondary">On Track</span>
            <span className="text-lg font-semibold text-hq-out">{kpis.atRisk}</span>
            <span className="text-xs text-hq-textSecondary">At Risk / Delayed</span>
          </div>
        </article>

        <article className="hq-card p-4">
          <p className="font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
            Average Completion
          </p>
          <p className="mt-2 font-ds-mono text-2xl font-semibold tabular-nums text-hq-brandSoft">
            {kpis.avgCompletion}%
          </p>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-hq-elevated">
            <div
              className="h-full rounded-full bg-gradient-to-r from-hq-brand to-hq-brandVibrant"
              style={{ width: `${kpis.avgCompletion}%` }}
            />
          </div>
        </article>

        <article className="hq-card p-4">
          <p className="font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
            Active Milestones
          </p>
          <p className="mt-2 font-ds-mono text-2xl font-semibold tabular-nums text-hq-textPrimary">
            {kpis.activeMilestones}
          </p>
          <p className="mt-1 text-xs text-hq-textSecondary">Open deliverables across all phases</p>
        </article>
      </section>

      {error && <ErrorBanner message={error} onRetry={loadAll} />}

      {/* Filter Bar */}
      <div className="hq-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hq-textMuted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search project code, name, client, or lead..."
              className="hq-input h-10 w-full pl-9 pr-3 text-sm"
            />
          </div>

          <select
            aria-label="Filter by Client Account"
            value={accountFilter}
            onChange={(e) => setAccountFilter(e.target.value)}
            className="hq-input h-10 min-w-[200px] px-3 text-xs"
          >
            <option value="ALL">All Client Accounts</option>
            {accounts.map((a) => (
              <option key={a.id} value={a.id}>
                {a.name}
              </option>
            ))}
          </select>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-ds-mono text-[11px] uppercase text-hq-textMuted mr-1">Status:</span>
            {PROJECT_STATUSES.map((st) => (
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
                {st.replace('_', ' ')}
              </button>
            ))}
          </div>
          <span className="font-ds-mono text-xs text-hq-textMuted tabular-nums">
            Showing {filteredProjects.length} of {projects.length}
          </span>
        </div>
      </div>

      {/* Projects Table */}
      <div className="hq-card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={7} />
        ) : filteredProjects.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<FolderKanban className="h-5 w-5" />}
              title="No Projects Match Your Filters"
              description="Create a new client delivery project or adjust your client and status filters."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
                  <th className="px-4 py-3 whitespace-nowrap">Code</th>
                  <th className="px-4 py-3">Project &amp; Client</th>
                  <th className="px-4 py-3 whitespace-nowrap">Lead Associate</th>
                  <th className="px-4 py-3 whitespace-nowrap">Target Delivery</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status &amp; Health</th>
                  <th className="px-4 py-3 w-44">Progress</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hq-borderSubtle text-sm">
                {filteredProjects.map((project) => {
                  const portalUrl = getPortalUrl(project);
                  const projectHealth = deriveProjectHealth(project);
                  return (
                    <tr key={project.id} className="hover:bg-hq-elevated/60 transition-colors">
                      <td className="px-4 py-3 font-ds-mono text-xs font-semibold tabular-nums text-hq-brandSoft whitespace-nowrap">
                        {project.code}
                      </td>
                      <td className="px-4 py-3 max-w-[280px]">
                        <button
                          type="button"
                          onClick={() => openRoadmap(project)}
                          className="text-left font-semibold text-hq-textPrimary hover:text-hq-brandSoft transition-colors truncate block w-full"
                        >
                          {project.name}
                        </button>
                        <div className="mt-0.5 flex flex-wrap items-center gap-2 text-xs text-hq-textSecondary">
                          <span className="truncate">{project.accountName}</span>
                          {typeof project.openTicketCount === 'number' && project.openTicketCount > 0 && (
                            <span className="inline-flex items-center gap-1 rounded-full bg-hq-warnBg px-2 py-0.5 font-ds-mono text-[10px] font-semibold text-hq-warn">
                              <Ticket className="h-2.5 w-2.5" />
                              {project.openTicketCount} open
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-4 py-3 text-xs text-hq-textSecondary whitespace-nowrap">
                        {project.leadAssociateName || '--'}
                      </td>
                      <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                        {formatDateShort(project.targetEndDate)}
                      </td>
                      <td className="px-4 py-3 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <StatusPill tone={statusTone(project.status)}>
                            {project.status.replace('_', ' ')}
                          </StatusPill>
                          <StatusPill tone={healthTone(projectHealth)}>
                            {projectHealth.replace('_', ' ')}
                          </StatusPill>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-2">
                          <div className="h-2 flex-1 overflow-hidden rounded-full bg-hq-elevated">
                            <div
                              className="h-full rounded-full bg-gradient-to-r from-hq-brand to-hq-brandVibrant transition-all"
                              style={{ width: `${Math.min(project.overallProgressPct || 0, 100)}%` }}
                            />
                          </div>
                          <span className="font-ds-mono text-xs font-semibold tabular-nums text-hq-textPrimary w-10 text-right">
                            {project.overallProgressPct || 0}%
                          </span>
                        </div>
                        <p className="mt-0.5 font-ds-mono text-[10px] text-hq-textMuted">
                          {project.phases.length} phases
                        </p>
                      </td>
                      <td className="px-4 py-3 text-right whitespace-nowrap">
                        <div className="inline-flex items-center gap-1.5">
                          <button
                            type="button"
                            onClick={() => openRoadmap(project)}
                            className="inline-flex items-center gap-1 rounded-md border border-hq-brand/40 bg-hq-brand/10 px-2.5 py-1.5 text-xs font-medium text-hq-brandSoft hover:bg-hq-brand hover:text-white transition-colors"
                          >
                            <Layers className="h-3.5 w-3.5" />
                            Roadmap
                          </button>
                          {portalUrl && (
                            <button
                              type="button"
                              title="Copy Client Portal Link"
                              onClick={() => void copyPortalLink(`p-${project.id}`, portalUrl)}
                              className="inline-flex items-center gap-1 rounded-md border border-hq-borderDefault px-2.5 py-1.5 text-xs text-hq-textSecondary hover:bg-hq-elevated hover:text-hq-textPrimary"
                            >
                              {copiedId === `p-${project.id}` ? (
                                <Check className="h-3.5 w-3.5 text-hq-in" />
                              ) : (
                                <Copy className="h-3.5 w-3.5" />
                              )}
                              <span>Portal</span>
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Expandable Delivery Roadmap Slide-Over Drawer */}
      <SlideOver
        open={Boolean(selectedProject)}
        onClose={() => setSelectedProject(null)}
        title={selectedProject ? `${selectedProject.code} · ${selectedProject.name}` : 'Project Roadmap'}
        subtitle={
          selectedProject
            ? `${selectedProject.accountName} · Target Delivery ${selectedProject.targetEndDate} · ${selectedProject.overallProgressPct}% Complete`
            : undefined
        }
        widthClass="max-w-[760px]"
        footer={
          selectedProject ? (
            <>
              <button
                type="button"
                onClick={() => setSelectedProject(null)}
                className="hq-btn-secondary h-9 px-4 text-xs"
              >
                Close
              </button>
              {editable && (
                <button
                  type="button"
                  disabled={savingAllPhases}
                  onClick={() => void handleSaveFullRoadmap(phasesDraft, 'All roadmap phases saved')}
                  className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-5 text-xs"
                >
                  <Save className="h-3.5 w-3.5" />
                  <span>{savingAllPhases ? 'Saving Roadmap...' : 'Save All Changes'}</span>
                </button>
              )}
            </>
          ) : undefined
        }
      >
        {selectedProject && (
          <div className="space-y-5">
            {/* Project Meta + Client Portal Share Card */}
            <div className="rounded-xl border border-hq-borderSubtle bg-hq-subtle p-4 space-y-3">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-1 min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <StatusPill tone={statusTone(selectedProject.status)}>
                      {selectedProject.status.replace('_', ' ')}
                    </StatusPill>
                    <StatusPill tone={healthTone(selectedHealth)}>
                      {selectedHealth.replace('_', ' ')}
                    </StatusPill>
                    <span className="font-ds-mono text-xs tabular-nums text-hq-textSecondary">
                      {selectedProject.startDate} → {selectedProject.targetEndDate}
                    </span>
                  </div>
                  <p className="text-xs text-hq-textSecondary leading-relaxed pt-1">
                    {selectedProject.summary || 'No project executive summary recorded.'}
                  </p>
                </div>

                {editable && (
                  <button
                    type="button"
                    onClick={() => openEditModal(selectedProject)}
                    className="hq-btn-secondary inline-flex h-8 items-center gap-1.5 px-3 text-xs shrink-0"
                  >
                    <Edit3 className="h-3.5 w-3.5" />
                    Edit Metadata
                  </button>
                )}
              </div>

              {selectedPortalSlug && (
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-hq-borderSubtle pt-3 text-xs">
                  <div className="flex flex-wrap items-center gap-2 font-ds-mono text-[11px]">
                    <span className="text-hq-textMuted">Client Portal:</span>
                    <a
                      href={`/client/${selectedPortalSlug}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center gap-1 text-hq-brandSoft hover:underline"
                    >
                      <span>/client/{selectedPortalSlug}</span>
                      <ExternalLink className="h-3 w-3" />
                    </a>
                    {selectedAccessCode && (
                      <button
                        type="button"
                        onClick={() =>
                          void copyPortalLink('drawer-code', selectedAccessCode, 'Access Code')
                        }
                        className="inline-flex items-center gap-1 rounded-md border border-hq-borderDefault bg-hq-surface px-2 py-0.5 text-[11px] text-hq-textPrimary hover:bg-hq-elevated"
                      >
                        <span>Code: {selectedAccessCode}</span>
                        <Copy className="h-2.5 w-2.5" />
                      </button>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() =>
                      void copyPortalLink(
                        'drawer-url',
                        `${window.location.origin}/client/${selectedPortalSlug}`
                      )
                    }
                    className="inline-flex items-center gap-1 rounded-md border border-hq-borderDefault px-2.5 py-1 text-[11px] font-medium hover:bg-hq-elevated"
                  >
                    <Copy className="h-3 w-3" />
                    Copy Link
                  </button>
                </div>
              )}
            </div>

            {/* Phase Tracker Header */}
            <div className="flex items-center justify-between">
              <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
                Delivery Phases &amp; Milestones ({phasesDraft.length})
              </h3>
              {editable && (
                <button
                  type="button"
                  onClick={() => setShowAddPhase((prev) => !prev)}
                  className="hq-btn-secondary inline-flex h-8 items-center gap-1 px-3 text-xs"
                >
                  <Plus className="h-3.5 w-3.5" />
                  Add Phase
                </button>
              )}
            </div>

            {/* Inline Add Phase Form */}
            {showAddPhase && editable && (
              <form
                onSubmit={handleAddPhase}
                className="rounded-xl border border-hq-brand/40 bg-hq-subtle p-4 space-y-3"
              >
                <p className="font-ds-mono text-[11px] uppercase tracking-wider text-hq-brandSoft">
                  New Delivery Phase #{phasesDraft.length + 1}
                </p>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <input
                    type="text"
                    required
                    placeholder="Phase Name (e.g. Phase 04: UAT & Hardening)"
                    value={newPhaseForm.name}
                    onChange={(e) => setNewPhaseForm({ ...newPhaseForm, name: e.target.value })}
                    className="hq-input h-9 px-3 text-xs sm:col-span-2"
                  />
                  <input
                    type="date"
                    value={newPhaseForm.startDate}
                    onChange={(e) =>
                      setNewPhaseForm({ ...newPhaseForm, startDate: e.target.value })
                    }
                    className="hq-input h-9 px-3 font-ds-mono text-xs tabular-nums"
                  />
                  <input
                    type="date"
                    value={newPhaseForm.targetDate}
                    onChange={(e) => setNewPhaseForm({ ...newPhaseForm, targetDate: e.target.value })}
                    className="hq-input h-9 px-3 font-ds-mono text-xs tabular-nums"
                  />
                  <input
                    type="text"
                    placeholder="Brief phase deliverable scope"
                    value={newPhaseForm.summary}
                    onChange={(e) => setNewPhaseForm({ ...newPhaseForm, summary: e.target.value })}
                    className="hq-input h-9 px-3 text-xs sm:col-span-2"
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowAddPhase(false)}
                    className="hq-btn-secondary h-8 px-3 text-xs"
                  >
                    Cancel
                  </button>
                  <button type="submit" className="hq-btn-primary h-8 px-4 text-xs">
                    Append Phase
                  </button>
                </div>
              </form>
            )}

            {/* Phase Cards */}
            {phasesDraft.length === 0 ? (
              <EmptyState
                icon={<Layers className="h-5 w-5" />}
                title="No Delivery Phases Configured"
                description="Add delivery phases and milestones so both the engineering team and client can track progress."
              />
            ) : (
              <div className="space-y-4">
                {phasesDraft.map((phase, idx) => (
                  <div
                    key={phase.id}
                    className="rounded-xl border border-hq-borderSubtle bg-hq-surface p-4 space-y-3.5 shadow-sm"
                  >
                    <div className="flex flex-wrap items-start justify-between gap-3 border-b border-hq-borderSubtle pb-3">
                      <div className="min-w-0 flex-1 space-y-1">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="inline-flex h-6 w-7 items-center justify-center rounded-md bg-hq-brand/15 font-ds-mono text-xs font-bold text-hq-brandSoft">
                            {String(phase.order || idx + 1).padStart(2, '0')}
                          </span>
                          <h4 className="font-ds-display text-sm font-semibold text-hq-textPrimary">
                            {phase.name}
                          </h4>
                          <StatusPill tone={statusTone(phase.status)}>
                            {phase.status.replace('_', ' ')}
                          </StatusPill>
                        </div>
                        {phase.summary && (
                          <p className="text-xs text-hq-textSecondary">{phase.summary}</p>
                        )}
                      </div>

                      {editable && (
                        <div className="flex items-center gap-2 shrink-0">
                          <select
                            aria-label={`Phase ${phase.order} status`}
                            value={phase.status}
                            onChange={(e) =>
                              updatePhaseDraft(phase.id, { status: e.target.value as PhaseStatus })
                            }
                            className="hq-input h-8 px-2 font-ds-mono text-[11px]"
                          >
                            <option value="UPCOMING">UPCOMING</option>
                            <option value="IN_PROGRESS">IN_PROGRESS</option>
                            <option value="COMPLETED">COMPLETED</option>
                            <option value="DELAYED">DELAYED</option>
                          </select>
                          <button
                            type="button"
                            disabled={savingPhaseId === phase.id}
                            onClick={() => void handleSaveSinglePhase(phase)}
                            className="hq-btn-secondary inline-flex h-8 items-center gap-1 px-3 text-[11px]"
                          >
                            <Save className="h-3 w-3" />
                            {savingPhaseId === phase.id ? 'Saving...' : 'Save Phase'}
                          </button>
                        </div>
                      )}
                    </div>

                    {/* Phase Dates & Progress Slider */}
                    <div className="grid grid-cols-1 gap-3 sm:grid-cols-3 items-center">
                      <div className="flex items-center gap-2 font-ds-mono text-[11px] tabular-nums text-hq-textSecondary sm:col-span-2">
                        <Clock className="h-3.5 w-3.5 text-hq-brandSoft shrink-0" />
                        <span>
                          {phase.startDate} → {phase.targetDate}
                        </span>
                      </div>
                      <div className="flex items-center gap-2">
                        <input
                          type="range"
                          min={0}
                          max={100}
                          step={5}
                          disabled={!editable}
                          value={phase.progressPct}
                          onChange={(e) =>
                            updatePhaseDraft(phase.id, { progressPct: Number(e.target.value) })
                          }
                          aria-label={`Phase ${phase.order} completion percentage`}
                          className="w-full accent-[#5F1F2F]"
                        />
                        <span className="font-ds-mono text-xs font-semibold tabular-nums w-10 text-right">
                          {phase.progressPct}%
                        </span>
                      </div>
                    </div>

                    {/* Milestones Checklist */}
                    <div className="space-y-2 pt-1">
                      <div className="flex items-center justify-between">
                        <span className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
                          Milestones ({phase.milestones.length})
                        </span>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => {
                              setAddingMilestonePhaseId(
                                addingMilestonePhaseId === phase.id ? null : phase.id
                              );
                              setNewMilestoneForm({
                                title: '',
                                deliveryDate: phase.targetDate || getTodayIso(),
                                deliverableNote: '',
                              });
                            }}
                            className="inline-flex items-center gap-1 text-[11px] font-medium text-hq-brandSoft hover:underline"
                          >
                            <Plus className="h-3 w-3" />
                            Add Milestone
                          </button>
                        )}
                      </div>

                      {addingMilestonePhaseId === phase.id && editable && (
                        <div className="rounded-lg border border-hq-brand/35 bg-hq-subtle p-3 space-y-2">
                          <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <input
                              type="text"
                              placeholder="Milestone title"
                              value={newMilestoneForm.title}
                              onChange={(e) =>
                                setNewMilestoneForm({ ...newMilestoneForm, title: e.target.value })
                              }
                              className="hq-input h-8 px-2.5 text-xs sm:col-span-2"
                            />
                            <input
                              type="date"
                              value={newMilestoneForm.deliveryDate}
                              onChange={(e) =>
                                setNewMilestoneForm({
                                  ...newMilestoneForm,
                                  deliveryDate: e.target.value,
                                })
                              }
                              className="hq-input h-8 px-2.5 font-ds-mono text-xs tabular-nums"
                            />
                          </div>
                          <input
                            type="text"
                            placeholder="Deliverable description shown to client"
                            value={newMilestoneForm.deliverableNote}
                            onChange={(e) =>
                              setNewMilestoneForm({
                                ...newMilestoneForm,
                                deliverableNote: e.target.value,
                              })
                            }
                            className="hq-input h-8 w-full px-2.5 text-xs"
                          />
                          <div className="flex justify-end gap-2">
                            <button
                              type="button"
                              onClick={() => setAddingMilestonePhaseId(null)}
                              className="hq-btn-secondary h-7 px-2.5 text-[11px]"
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleAddMilestone(phase.id)}
                              className="hq-btn-primary h-7 px-3 text-[11px]"
                            >
                              Save Milestone
                            </button>
                          </div>
                        </div>
                      )}

                      {phase.milestones.length === 0 ? (
                        <p className="text-xs italic text-hq-textMuted">No milestones logged yet.</p>
                      ) : (
                        <ul className="divide-y divide-hq-borderSubtle rounded-lg border border-hq-borderSubtle bg-hq-subtle/50">
                          {phase.milestones.map((ms) => (
                            <li
                              key={ms.id}
                              className="flex flex-wrap items-start justify-between gap-2 px-3 py-2.5"
                            >
                              <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                <button
                                  type="button"
                                  disabled={!editable}
                                  onClick={() => toggleMilestoneDraft(phase.id, ms.id)}
                                  title="Click to cycle milestone status"
                                  className="mt-0.5 shrink-0 text-hq-brandSoft hover:opacity-80 disabled:opacity-60"
                                >
                                  {ms.status === 'COMPLETED' ? (
                                    <CheckCircle2 className="h-4 w-4 text-hq-in" />
                                  ) : ms.status === 'AT_RISK' ? (
                                    <AlertTriangle className="h-4 w-4 text-hq-warn" />
                                  ) : (
                                    <Circle className="h-4 w-4 text-hq-textMuted" />
                                  )}
                                </button>
                                <div className="min-w-0">
                                  <p
                                    className={`text-xs font-medium ${
                                      ms.status === 'COMPLETED'
                                        ? 'text-hq-textSecondary line-through'
                                        : 'text-hq-textPrimary'
                                    }`}
                                  >
                                    {ms.title}
                                  </p>
                                  {ms.deliverableNote && (
                                    <p className="text-[11px] text-hq-textMuted mt-0.5">
                                      {ms.deliverableNote}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="font-ds-mono text-[11px] tabular-nums text-hq-textSecondary whitespace-nowrap">
                                  {ms.deliveryDate}
                                </span>
                                <button
                                  type="button"
                                  disabled={!editable}
                                  onClick={() => toggleMilestoneDraft(phase.id, ms.id)}
                                >
                                  <StatusPill tone={statusTone(ms.status)}>{ms.status}</StatusPill>
                                </button>
                                {editable && (
                                  <button
                                    type="button"
                                    onClick={() => handleRemoveMilestone(phase.id, ms.id)}
                                    aria-label="Remove milestone"
                                    className="rounded p-1 text-hq-out hover:bg-hq-outBg"
                                  >
                                    <Trash2 className="h-3 w-3" />
                                  </button>
                                )}
                              </div>
                            </li>
                          ))}
                        </ul>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
      </SlideOver>

      {/* Create / Edit Project Modal */}
      <Modal
        open={projectModalOpen}
        onClose={() => setProjectModalOpen(false)}
        title={editingProject ? `Edit Project ${editingProject.code}` : 'Create Client Project'}
        subtitle="Link engagement to a CRM client account and delivery lead"
        maxWidthClass="max-w-2xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setProjectModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="project-crud-form"
              disabled={projectSaving}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {projectSaving ? 'Saving...' : editingProject ? 'Save Project' : 'Create Project'}
            </button>
          </>
        }
      >
        <form id="project-crud-form" onSubmit={handleSaveProject} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Client Account *
              </label>
              <select
                required
                disabled={Boolean(editingProject)}
                value={projectForm.accountId}
                onChange={(e) => setProjectForm({ ...projectForm, accountId: e.target.value })}
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
                Lead Associate
              </label>
              <select
                value={projectForm.leadAssociateId}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, leadAssociateId: e.target.value })
                }
                className="hq-input h-10 w-full px-3 text-sm"
              >
                <option value="">Unassigned</option>
                {associates.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name} ({a.title})
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              Project Name *
            </label>
            <input
              type="text"
              required
              value={projectForm.name}
              onChange={(e) => setProjectForm({ ...projectForm, name: e.target.value })}
              placeholder="LIMS & Cold-Chain Inventory Modernization"
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              Executive Summary (visible to client)
            </label>
            <textarea
              rows={3}
              value={projectForm.summary}
              onChange={(e) => setProjectForm({ ...projectForm, summary: e.target.value })}
              className="hq-input w-full px-3 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Status</label>
              <select
                value={projectForm.status}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, status: e.target.value as ProjectStatus })
                }
                className="hq-input h-10 w-full px-3 text-sm"
              >
                <option value="PLANNING">PLANNING</option>
                <option value="ACTIVE">ACTIVE</option>
                <option value="ON_HOLD">ON_HOLD</option>
                <option value="COMPLETED">COMPLETED</option>
                <option value="CANCELLED">CANCELLED</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Currency</label>
              <select
                value={projectForm.currency}
                onChange={(e) =>
                  setProjectForm({
                    ...projectForm,
                    currency: e.target.value as CurrencyCode,
                  })
                }
                className="hq-input h-10 w-full px-3 font-ds-mono text-sm"
              >
                <option value="MMK">MMK</option>
                <option value="THB">THB</option>
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Start Date *
              </label>
              <input
                type="date"
                required
                value={projectForm.startDate}
                onChange={(e) => setProjectForm({ ...projectForm, startDate: e.target.value })}
                className="hq-input h-10 w-full px-2.5 font-ds-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Target End Date *
              </label>
              <input
                type="date"
                required
                value={projectForm.targetEndDate}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, targetEndDate: e.target.value })
                }
                className="hq-input h-10 w-full px-2.5 font-ds-mono text-xs tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Contract Budget
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                value={projectForm.budgetAmount}
                onChange={(e) => setProjectForm({ ...projectForm, budgetAmount: e.target.value })}
                className="hq-input h-10 w-full px-2.5 text-right font-ds-mono text-xs tabular-nums"
              />
            </div>
          </div>

          {!editingProject && (
            <label className="inline-flex items-center gap-2 text-xs text-hq-textPrimary">
              <input
                type="checkbox"
                checked={projectForm.includeDefaultPhases}
                onChange={(e) =>
                  setProjectForm({ ...projectForm, includeDefaultPhases: e.target.checked })
                }
                className="h-4 w-4 accent-[#5F1F2F]"
              />
              Initialize with starter 3-phase delivery roadmap template
            </label>
          )}
        </form>
      </Modal>
    </div>
  );
}
