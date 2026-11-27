import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import {
  AlertCircle,
  AlertTriangle,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Circle,
  Clock,
  FolderKanban,
  LifeBuoy,
  Lock,
  LogOut,
  MessageSquare,
  Moon,
  Plus,
  Send,
  Sun,
} from 'lucide-react';
import { useTheme } from '@/context/ThemeContext';
import { useToast } from '@/context/ToastContext';
import { formatDateShort, formatDateTime } from '@/lib/format';
import { EmptyState, Modal, SlideOver, StatusPill } from '@/components/ui/Primitives';
import type {
  ClientPortalSessionDTO,
  ClientProjectDTO,
  ClientTicketDTO,
  MilestoneStatus,
  PhaseStatus,
  ProblemDetail,
  ProjectHealth,
  ProjectStatus,
  TicketCategory,
  TicketPriority,
  TicketStatus,
} from '@/types/hq';

let clientBearerToken: string | null = null;

async function clientApi<T>(
  path: string,
  options: { method?: 'GET' | 'POST'; body?: unknown } = {}
): Promise<T> {
  const { method = 'GET', body } = options;
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (body !== undefined) {
    headers['Content-Type'] = 'application/json';
  }
  if (clientBearerToken) {
    headers.Authorization = `Bearer ${clientBearerToken}`;
  }

  const res = await fetch(path, {
    method,
    headers,
    credentials: 'include',
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });

  if (res.status === 204) {
    return undefined as unknown as T;
  }

  const raw = await res.text();
  let parsed: unknown = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw);
    } catch {
      parsed = { detail: raw };
    }
  }

  if (!res.ok) {
    const prob = (parsed && typeof parsed === 'object' ? parsed : {}) as Partial<ProblemDetail>;
    throw new Error(prob.detail || prob.title || `Request failed (${res.status})`);
  }

  return parsed as T;
}

function deriveClientProjectHealth(
  project: Pick<ClientProjectDTO, 'status' | 'phases'>
): ProjectHealth {
  if (project.phases.some((ph) => ph.status === 'DELAYED')) return 'DELAYED';
  if (
    project.status === 'ON_HOLD' ||
    project.phases.some((ph) => ph.milestones.some((ms) => ms.status === 'AT_RISK'))
  ) {
    return 'AT_RISK';
  }
  return 'ON_TRACK';
}

function phaseBadgeTone(status: ProjectStatus | PhaseStatus | MilestoneStatus): 'in' | 'warn' | 'out' | 'brand' | 'neutral' {
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

function healthBadgeTone(health: ProjectHealth): 'in' | 'warn' | 'out' {
  if (health === 'ON_TRACK') return 'in';
  if (health === 'AT_RISK') return 'warn';
  return 'out';
}

function ticketStatusTone(status: TicketStatus): 'in' | 'warn' | 'out' | 'brand' | 'neutral' {
  if (status === 'OPEN') return 'out';
  if (status === 'IN_PROGRESS') return 'brand';
  if (status === 'WAITING_CLIENT') return 'warn';
  if (status === 'RESOLVED') return 'in';
  return 'neutral';
}

function priorityTone(priority: TicketPriority): 'neutral' | 'brand' | 'warn' | 'out' {
  if (priority === 'URGENT') return 'out';
  if (priority === 'HIGH') return 'warn';
  if (priority === 'MEDIUM') return 'brand';
  return 'neutral';
}

export default function ClientPortalPage() {
  const { slug } = useParams<{ slug?: string }>();
  const navigate = useNavigate();
  const { theme, toggleTheme } = useTheme();
  const { pushToast } = useToast();

  // Session State
  const [session, setSession] = useState<ClientPortalSessionDTO | null>(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // Login Form
  const [portalSlug, setPortalSlug] = useState(slug || '');
  const [accessCode, setAccessCode] = useState('');
  const [contactName, setContactName] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [loginError, setLoginError] = useState<string | null>(null);
  const [loggingIn, setLoggingIn] = useState(false);

  // Workspace State
  const [activeTab, setActiveTab] = useState<'projects' | 'tickets'>('projects');
  const [projects, setProjects] = useState<ClientProjectDTO[]>([]);
  const [tickets, setTickets] = useState<ClientTicketDTO[]>([]);
  const [loadingWorkspace, setLoadingWorkspace] = useState(false);
  const [expandedProjectId, setExpandedProjectId] = useState<string | null>(null);

  // Submit New Ticket Modal
  const [ticketModalOpen, setTicketModalOpen] = useState(false);
  const [ticketForm, setTicketForm] = useState({
    projectId: '',
    phaseId: '',
    category: 'SUPPORT' as TicketCategory,
    priority: 'MEDIUM' as TicketPriority,
    title: '',
    description: '',
  });
  const [submittingTicket, setSubmittingTicket] = useState(false);

  // Ticket Detail Drawer
  const [activeTicket, setActiveTicket] = useState<ClientTicketDTO | null>(null);
  const [replyText, setReplyText] = useState('');
  const [postingReply, setPostingReply] = useState(false);

  useEffect(() => {
    if (slug && !portalSlug) {
      setPortalSlug(slug);
    }
  }, [slug, portalSlug]);

  const loadWorkspaceData = useCallback(async () => {
    setLoadingWorkspace(true);
    try {
      const [projRes, tktRes] = await Promise.all([
        clientApi<{ items: ClientProjectDTO[] }>('/api/v1/client-portal/projects'),
        clientApi<{ items: ClientTicketDTO[] }>('/api/v1/client-portal/tickets'),
      ]);
      const nextProjects = projRes.items || [];
      setProjects(nextProjects);
      setTickets(tktRes.items || []);
      setExpandedProjectId((prev) => prev || nextProjects[0]?.id || null);
    } catch {
      // Session may have expired
    } finally {
      setLoadingWorkspace(false);
    }
  }, []);

  const hydrateSession = useCallback(async () => {
    try {
      const res = await clientApi<{ client: ClientPortalSessionDTO }>('/api/v1/client-portal/me');
      setSession(res.client);
      await loadWorkspaceData();
    } catch {
      setSession(null);
      clientBearerToken = null;
    } finally {
      setCheckingSession(false);
    }
  }, [loadWorkspaceData]);

  useEffect(() => {
    void hydrateSession();
  }, [hydrateSession]);

  const handleLogin = async (event: React.FormEvent) => {
    event.preventDefault();
    setLoginError(null);
    if (!portalSlug.trim() || !accessCode.trim()) {
      setLoginError('Enter both your Client Workspace ID and Access Code.');
      return;
    }

    setLoggingIn(true);
    try {
      const res = await clientApi<{ client: ClientPortalSessionDTO; token?: string }>(
        '/api/v1/client-portal/login',
        {
          method: 'POST',
          body: {
            portalSlug: portalSlug.trim().toLowerCase(),
            accessCode: accessCode.trim(),
            requesterName: contactName.trim() || undefined,
            requesterEmail: contactEmail.trim() || undefined,
          },
        }
      );
      if (res.token) {
        clientBearerToken = res.token;
      }
      setSession(res.client);
      setAccessCode('');
      if (res.client.portalSlug) {
        navigate(`/client/${res.client.portalSlug}`, { replace: true });
      }
      await loadWorkspaceData();
    } catch (err) {
      setLoginError(err instanceof Error ? err.message : 'Invalid workspace ID or access code.');
    } finally {
      setLoggingIn(false);
    }
  };

  const handleLogout = async () => {
    try {
      await clientApi('/api/v1/client-portal/logout', { method: 'POST' });
    } catch {
      // Clear local client state regardless
    } finally {
      clientBearerToken = null;
      setSession(null);
      setProjects([]);
      setTickets([]);
      setActiveTicket(null);
    }
  };

  const openSubmitTicketForProject = (projectId = '') => {
    setTicketForm({
      projectId: projectId || projects[0]?.id || '',
      phaseId: '',
      category: 'SUPPORT',
      priority: 'MEDIUM',
      title: '',
      description: '',
    });
    setTicketModalOpen(true);
  };

  const handleSubmitTicket = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!ticketForm.title.trim() || !ticketForm.description.trim()) return;

    setSubmittingTicket(true);
    try {
      const created = await clientApi<ClientTicketDTO>('/api/v1/client-portal/tickets', {
        method: 'POST',
        body: {
          projectId: ticketForm.projectId || null,
          phaseId: ticketForm.phaseId || null,
          category: ticketForm.category,
          priority: ticketForm.priority,
          title: ticketForm.title.trim(),
          description: ticketForm.description.trim(),
        },
      });
      pushToast({
        variant: 'success',
        title: `Ticket ${created.ticketNumber} submitted`,
        description: 'Our engineering team has been notified.',
      });
      setTicketModalOpen(false);
      setActiveTab('tickets');
      await loadWorkspaceData();
      setActiveTicket(created);
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Ticket submission failed',
        description: err instanceof Error ? err.message : 'Please try again.',
      });
    } finally {
      setSubmittingTicket(false);
    }
  };

  const openTicketDetail = async (ticket: ClientTicketDTO) => {
    setActiveTicket(ticket);
    setReplyText('');
    try {
      const full = await clientApi<ClientTicketDTO>(`/api/v1/client-portal/tickets/${ticket.id}`);
      setActiveTicket(full);
    } catch {
      // Retain list view data
    }
  };

  const handlePostReply = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!activeTicket || !replyText.trim()) return;
    setPostingReply(true);
    try {
      const updated = await clientApi<ClientTicketDTO>(
        `/api/v1/client-portal/tickets/${activeTicket.id}/comments`,
        {
          method: 'POST',
          body: { message: replyText.trim() },
        }
      );
      setActiveTicket(updated);
      setReplyText('');
      pushToast({ variant: 'success', title: 'Reply posted' });
      await loadWorkspaceData();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Could not send reply',
        description: err instanceof Error ? err.message : 'Try again.',
      });
    } finally {
      setPostingReply(false);
    }
  };

  const selectedModalProject = useMemo(
    () => projects.find((p) => p.id === ticketForm.projectId) || null,
    [projects, ticketForm.projectId]
  );

  const ticketCounts = useMemo(
    () => ({
      open: tickets.filter((t) => t.status === 'OPEN').length,
      inProgress: tickets.filter((t) => t.status === 'IN_PROGRESS').length,
      waiting: tickets.filter((t) => t.status === 'WAITING_CLIENT').length,
      resolved: tickets.filter((t) => t.status === 'RESOLVED' || t.status === 'CLOSED').length,
    }),
    [tickets]
  );

  const horizontalLogoSrc =
    theme === 'dark' ? '/thea_light_horizontal.png' : '/thea_dark_horizontal.png';
  const stackedLogoSrc =
    theme === 'dark' ? '/dark_tranStacked_logo.png' : '/light_tranStacked_logo.png';

  if (checkingSession) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hq-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-hq-brandVibrant border-t-transparent" />
          <span className="font-ds-mono text-xs uppercase tracking-wider text-hq-textMuted">
            Loading Client Portal...
          </span>
        </div>
      </div>
    );
  }

  // SIGN-IN GATE
  if (!session) {
    return (
      <div className="relative flex min-h-[100dvh] flex-col justify-between bg-hq-canvas px-4 py-6 text-hq-textPrimary">
        <header className="mx-auto flex w-full max-w-5xl items-center justify-between">
          <img src={horizontalLogoSrc} alt="Thea Solutions" className="h-7 w-auto object-contain" />
          <button
            type="button"
            onClick={toggleTheme}
            aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
            className="inline-flex h-10 items-center gap-2 rounded-full border border-hq-borderDefault bg-hq-surface px-3.5 text-xs font-medium text-hq-textSecondary hover:bg-hq-elevated"
          >
            {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
            <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
          </button>
        </header>

        <main className="mx-auto my-8 w-full max-w-[440px]">
          <div className="hq-card overflow-hidden border-hq-brand/40">
            <div className="h-1 w-full bg-gradient-to-r from-hq-brand via-hq-brandVibrant to-hq-brand" />
            <div className="p-6 sm:p-8">
              <div className="flex flex-col items-center text-center">
                <img
                  src={stackedLogoSrc}
                  alt="Thea Solutions"
                  className="h-14 w-auto object-contain"
                />
                <h1 className="mt-4 font-ds-display text-2xl font-semibold tracking-[-0.02em] text-hq-textPrimary">
                  Client Delivery Portal
                </h1>
                <p className="mt-1 text-xs text-hq-textSecondary">
                  Inspect live project milestones, delivery schedules, and support requests.
                </p>
              </div>

              <div className="my-5 border-t border-hq-borderSubtle" />

              <form onSubmit={handleLogin} className="space-y-4">
                <div>
                  <label
                    htmlFor="client-workspace-id"
                    className="mb-1.5 block text-xs font-medium text-hq-textSecondary"
                  >
                    Client Workspace ID *
                  </label>
                  <input
                    id="client-workspace-id"
                    type="text"
                    required
                    value={portalSlug}
                    onChange={(e) => setPortalSlug(e.target.value)}
                    placeholder="e.g. meditrust-yangon"
                    className="hq-input h-10 w-full px-3.5 font-ds-mono text-sm"
                  />
                </div>

                <div>
                  <label
                    htmlFor="client-access-code"
                    className="mb-1.5 block text-xs font-medium text-hq-textSecondary"
                  >
                    Workspace Access Code *
                  </label>
                  <input
                    id="client-access-code"
                    type="password"
                    required
                    value={accessCode}
                    onChange={(e) => setAccessCode(e.target.value)}
                    placeholder="Enter access code provided by your delivery lead"
                    className="hq-input h-10 w-full px-3.5 font-ds-mono text-sm"
                  />
                </div>

                <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="client-contact-name"
                      className="mb-1 block text-xs font-medium text-hq-textSecondary"
                    >
                      Your Name (Optional)
                    </label>
                    <input
                      id="client-contact-name"
                      type="text"
                      value={contactName}
                      onChange={(e) => setContactName(e.target.value)}
                      placeholder="Aung Kyaw"
                      className="hq-input h-10 w-full px-3 text-sm"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="client-contact-email"
                      className="mb-1 block text-xs font-medium text-hq-textSecondary"
                    >
                      Work Email (Optional)
                    </label>
                    <input
                      id="client-contact-email"
                      type="email"
                      value={contactEmail}
                      onChange={(e) => setContactEmail(e.target.value)}
                      placeholder="name@company.com"
                      className="hq-input h-10 w-full px-3 text-sm"
                    />
                  </div>
                </div>

                {loginError && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-hq-out/40 bg-hq-outBg px-3 py-2.5 text-xs text-hq-out"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{loginError}</span>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={loggingIn}
                  className="hq-btn-primary flex h-11 w-full items-center justify-center gap-2 px-5 text-sm"
                >
                  <Lock className="h-4 w-4" />
                  <span>{loggingIn ? 'Verifying Workspace...' : 'Enter Client Portal'}</span>
                </button>
              </form>

              <p className="mt-5 text-center text-[11px] text-hq-textMuted">
                Need your workspace ID or access code? Contact your Thea Solutions delivery lead.
              </p>
            </div>
          </div>
        </main>

        <footer className="mx-auto flex w-full max-w-5xl items-center justify-center gap-3 font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
          <span>THEA SOLUTIONS</span>
          <span aria-hidden="true">|</span>
          <span>CLIENT DELIVERY PORTAL</span>
        </footer>
      </div>
    );
  }

  // AUTHENTICATED CLIENT WORKSPACE
  return (
    <div className="min-h-screen bg-hq-canvas text-hq-textPrimary flex flex-col">
      {/* Client Topbar */}
      <header className="sticky top-0 z-20 border-b border-hq-borderSubtle bg-hq-surface/95 backdrop-blur-md">
        <div className="mx-auto flex h-16 max-w-6xl items-center justify-between gap-4 px-4 sm:px-6">
          <div className="flex items-center gap-3 min-w-0">
            <img src={horizontalLogoSrc} alt="Thea Solutions" className="h-6 w-auto object-contain shrink-0" />
            <span className="hidden sm:inline-block h-5 w-px bg-hq-borderSubtle" />
            <span className="inline-flex items-center gap-1.5 rounded-full border border-hq-brand/35 bg-hq-brand/10 px-3 py-1 text-xs font-semibold text-hq-brandSoft truncate">
              <Building2 className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{session.accountName}</span>
            </span>
          </div>

          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              className="flex h-9 w-9 items-center justify-center rounded-full border border-hq-borderDefault bg-hq-subtle text-hq-textSecondary hover:bg-hq-elevated"
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            <button
              type="button"
              onClick={() => void handleLogout()}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hq-borderDefault px-3 text-xs font-medium text-hq-textSecondary hover:border-hq-out/60 hover:text-hq-out transition-colors"
            >
              <LogOut className="h-3.5 w-3.5" />
              <span className="hidden sm:inline">Sign Out</span>
            </button>
          </div>
        </div>

        {/* Client Sub-Navigation Tabs */}
        <div className="mx-auto flex max-w-6xl items-center justify-between gap-3 px-4 sm:px-6 border-t border-hq-borderSubtle/70">
          <div role="tablist" className="flex gap-1">
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'projects'}
              onClick={() => setActiveTab('projects')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === 'projects'
                  ? 'border-hq-brandVibrant text-hq-textPrimary'
                  : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
              }`}
            >
              <FolderKanban className="h-3.5 w-3.5" />
              <span>Projects &amp; Milestones ({projects.length})</span>
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'tickets'}
              onClick={() => setActiveTab('tickets')}
              className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-semibold transition-colors ${
                activeTab === 'tickets'
                  ? 'border-hq-brandVibrant text-hq-textPrimary'
                  : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
              }`}
            >
              <LifeBuoy className="h-3.5 w-3.5" />
              <span>Support Tickets ({tickets.length})</span>
            </button>
          </div>

          <button
            type="button"
            onClick={() => openSubmitTicketForProject()}
            className="hq-btn-primary inline-flex h-8 items-center gap-1.5 px-3.5 text-xs my-1.5"
          >
            <Plus className="h-3.5 w-3.5" />
            <span>Submit Ticket</span>
          </button>
        </div>
      </header>

      {/* Workspace Body */}
      <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-6 sm:px-6 space-y-6">
        {loadingWorkspace && projects.length === 0 ? (
          <div className="space-y-4">
            <div className="hq-skeleton h-32 w-full" />
            <div className="hq-skeleton h-64 w-full" />
          </div>
        ) : activeTab === 'projects' ? (
          <div className="space-y-5">
            <div>
              <h1 className="font-ds-display text-2xl font-semibold text-hq-textPrimary">
                Active Engagements &amp; Delivery Roadmap
              </h1>
              <p className="mt-1 text-sm text-hq-textSecondary">
                Real-time visibility into completed deliverables, current sprint phases, and upcoming milestone dates.
              </p>
            </div>

            {projects.length === 0 ? (
              <EmptyState
                icon={<FolderKanban className="h-5 w-5" />}
                title="No Projects Published Yet"
                description="Your Thea Solutions project roadmap will appear here once initialized."
              />
            ) : (
              <div className="space-y-5">
                {projects.map((project) => {
                  const isExpanded = expandedProjectId === project.id;
                  const projectHealth = deriveClientProjectHealth(project);
                  const completedMilestones = project.phases.reduce(
                    (sum, ph) => sum + ph.milestones.filter((m) => m.status === 'COMPLETED').length,
                    0
                  );
                  const totalMilestones = project.phases.reduce(
                    (sum, ph) => sum + ph.milestones.length,
                    0
                  );

                  return (
                    <article key={project.id} className="hq-card overflow-hidden">
                      <div className="p-5 sm:p-6 space-y-4">
                        <div className="flex flex-wrap items-start justify-between gap-4">
                          <div className="space-y-1.5 min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <span className="font-ds-mono text-xs font-semibold text-hq-brandSoft">
                                {project.code}
                              </span>
                              <StatusPill tone={phaseBadgeTone(project.status)}>
                                {project.status.replace('_', ' ')}
                              </StatusPill>
                              <StatusPill tone={healthBadgeTone(projectHealth)}>
                                {projectHealth.replace('_', ' ')}
                              </StatusPill>
                            </div>
                            <h2 className="font-ds-display text-xl font-semibold text-hq-textPrimary">
                              {project.name}
                            </h2>
                            {project.summary && (
                              <p className="text-sm text-hq-textSecondary max-w-3xl leading-relaxed">
                                {project.summary}
                              </p>
                            )}
                          </div>

                          <div className="flex flex-wrap items-center gap-2 shrink-0">
                            <button
                              type="button"
                              onClick={() => openSubmitTicketForProject(project.id)}
                              className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-3.5 text-xs"
                            >
                              <LifeBuoy className="h-3.5 w-3.5" />
                              <span>Submit Ticket for Project</span>
                            </button>
                            <button
                              type="button"
                              onClick={() =>
                                setExpandedProjectId(isExpanded ? null : project.id)
                              }
                              className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                            >
                              <span>{isExpanded ? 'Hide Timeline' : 'View Timeline'}</span>
                              {isExpanded ? (
                                <ChevronUp className="h-3.5 w-3.5" />
                              ) : (
                                <ChevronDown className="h-3.5 w-3.5" />
                              )}
                            </button>
                          </div>
                        </div>

                        {/* Progress + Dates Bar */}
                        <div className="grid grid-cols-1 gap-4 rounded-xl border border-hq-borderSubtle bg-hq-subtle p-4 md:grid-cols-12 items-center">
                          <div className="md:col-span-6 space-y-1.5">
                            <div className="flex items-center justify-between text-xs">
                              <span className="font-medium text-hq-textSecondary">
                                Overall Delivery Progress
                              </span>
                              <span className="font-ds-mono font-bold tabular-nums text-hq-textPrimary">
                                {project.overallProgressPct || 0}% ({completedMilestones}/{totalMilestones}{' '}
                                milestones)
                              </span>
                            </div>
                            <div className="h-2.5 w-full overflow-hidden rounded-full bg-hq-elevated">
                              <div
                                className="h-full rounded-full bg-gradient-to-r from-hq-brand to-hq-brandVibrant transition-all"
                                style={{ width: `${Math.min(project.overallProgressPct || 0, 100)}%` }}
                              />
                            </div>
                          </div>

                          <div className="md:col-span-3 flex items-center gap-2 text-xs">
                            <Calendar className="h-4 w-4 text-hq-brandSoft shrink-0" />
                            <div>
                              <p className="font-ds-mono text-[10px] uppercase text-hq-textMuted">
                                Delivery Window
                              </p>
                              <p className="font-ds-mono font-medium tabular-nums text-hq-textPrimary">
                                {project.startDate} → {project.targetEndDate}
                              </p>
                            </div>
                          </div>

                          <div className="md:col-span-3 text-xs">
                            <p className="font-ds-mono text-[10px] uppercase text-hq-textMuted">
                              Delivery Lead
                            </p>
                            <p className="font-medium text-hq-textPrimary truncate">
                              {project.leadAssociateName || 'Thea Solutions Delivery Team'}
                            </p>
                          </div>
                        </div>
                      </div>

                      {/* Expanded Phase-by-Phase Delivery Timeline */}
                      {isExpanded && (
                        <div className="border-t border-hq-borderSubtle bg-hq-subtle/40 p-5 sm:p-6 space-y-4">
                          <h3 className="font-ds-mono text-xs font-semibold uppercase tracking-wider text-hq-textSecondary">
                            Phase-by-Phase Delivery Timeline ({project.phases.length} Phases)
                          </h3>

                          <div className="space-y-4">
                            {project.phases.map((phase, idx) => (
                              <div
                                key={phase.id}
                                className="rounded-xl border border-hq-borderSubtle bg-hq-surface p-4 sm:p-5 space-y-3"
                              >
                                <div className="flex flex-wrap items-start justify-between gap-3">
                                  <div className="flex items-start gap-3 min-w-0 flex-1">
                                    <div
                                      className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg font-ds-mono text-xs font-bold ${
                                        phase.status === 'COMPLETED'
                                          ? 'bg-hq-inBg text-hq-in'
                                          : phase.status === 'IN_PROGRESS'
                                            ? 'bg-hq-brand text-white'
                                            : 'bg-hq-elevated text-hq-textSecondary'
                                      }`}
                                    >
                                      {String(phase.order || idx + 1).padStart(2, '0')}
                                    </div>
                                    <div className="min-w-0">
                                      <div className="flex flex-wrap items-center gap-2">
                                        <h4 className="font-ds-display text-base font-semibold text-hq-textPrimary">
                                          {phase.name}
                                        </h4>
                                        <StatusPill tone={phaseBadgeTone(phase.status)}>
                                          {phase.status.replace('_', ' ')}
                                        </StatusPill>
                                      </div>
                                      {phase.summary && (
                                        <p className="mt-1 text-xs text-hq-textSecondary">
                                          {phase.summary}
                                        </p>
                                      )}
                                    </div>
                                  </div>

                                  <div className="text-right font-ds-mono text-xs tabular-nums shrink-0">
                                    <p className="font-semibold text-hq-textPrimary">
                                      {phase.progressPct}% Complete
                                    </p>
                                    <p className="text-[11px] text-hq-textMuted">
                                      {phase.startDate} → {phase.targetDate}
                                    </p>
                                  </div>
                                </div>

                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-hq-elevated">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      phase.status === 'COMPLETED'
                                        ? 'bg-hq-in'
                                        : phase.status === 'DELAYED'
                                          ? 'bg-hq-out'
                                          : 'bg-hq-brand'
                                    }`}
                                    style={{ width: `${Math.min(phase.progressPct || 0, 100)}%` }}
                                  />
                                </div>

                                {/* Milestones List */}
                                {phase.milestones.length > 0 && (
                                  <ul className="divide-y divide-hq-borderSubtle rounded-lg border border-hq-borderSubtle bg-hq-subtle/60">
                                    {phase.milestones.map((ms) => (
                                      <li
                                        key={ms.id}
                                        className="flex flex-wrap items-start justify-between gap-3 px-3.5 py-2.5"
                                      >
                                        <div className="flex items-start gap-2.5 min-w-0 flex-1">
                                          {ms.status === 'COMPLETED' ? (
                                            <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-hq-in" />
                                          ) : ms.status === 'AT_RISK' ? (
                                            <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0 text-hq-warn" />
                                          ) : ms.status === 'IN_PROGRESS' ? (
                                            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-hq-brandSoft" />
                                          ) : (
                                            <Circle className="mt-0.5 h-4 w-4 shrink-0 text-hq-textMuted" />
                                          )}
                                          <div className="min-w-0">
                                            <p className="text-xs font-semibold text-hq-textPrimary">
                                              {ms.title}
                                            </p>
                                            {ms.deliverableNote && (
                                              <p className="mt-0.5 text-[11px] text-hq-textSecondary">
                                                {ms.deliverableNote}
                                              </p>
                                            )}
                                          </div>
                                        </div>

                                        <div className="flex flex-wrap items-center gap-2 shrink-0">
                                          <span className="font-ds-mono text-[11px] tabular-nums text-hq-textSecondary whitespace-nowrap">
                                            {ms.completedAt
                                              ? `Delivered ${formatDateShort(ms.completedAt)}`
                                              : `Target ${ms.deliveryDate}`}
                                          </span>
                                          <StatusPill tone={phaseBadgeTone(ms.status)}>
                                            {ms.status}
                                          </StatusPill>
                                        </div>
                                      </li>
                                    ))}
                                  </ul>
                                )}
                              </div>
                            ))}
                          </div>
                        </div>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </div>
        ) : (
          /* TAB 2: CLIENT SUPPORT TICKETS */
          <div className="space-y-5">
            <div className="flex flex-wrap items-end justify-between gap-4">
              <div>
                <h1 className="font-ds-display text-2xl font-semibold text-hq-textPrimary">
                  Support &amp; Change Request Tickets
                </h1>
                <p className="mt-1 text-sm text-hq-textSecondary">
                  Submit bugs, feature requests, or questions directly to your assigned engineering pod.
                </p>
              </div>
              <button
                type="button"
                onClick={() => openSubmitTicketForProject()}
                className="hq-btn-primary inline-flex h-10 items-center gap-1.5 px-4 text-xs"
              >
                <Plus className="h-4 w-4" />
                <span>Submit New Ticket</span>
              </button>
            </div>

            {/* Status Strip */}
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
              <div className="hq-card p-4">
                <p className="font-ds-mono text-[10px] uppercase text-hq-textMuted">Open</p>
                <p className="mt-1 font-ds-mono text-2xl font-semibold tabular-nums text-hq-out">
                  {ticketCounts.open}
                </p>
              </div>
              <div className="hq-card p-4">
                <p className="font-ds-mono text-[10px] uppercase text-hq-textMuted">In Progress</p>
                <p className="mt-1 font-ds-mono text-2xl font-semibold tabular-nums text-hq-brandSoft">
                  {ticketCounts.inProgress}
                </p>
              </div>
              <div className="hq-card p-4">
                <p className="font-ds-mono text-[10px] uppercase text-hq-textMuted">
                  Waiting Your Reply
                </p>
                <p className="mt-1 font-ds-mono text-2xl font-semibold tabular-nums text-hq-warn">
                  {ticketCounts.waiting}
                </p>
              </div>
              <div className="hq-card p-4">
                <p className="font-ds-mono text-[10px] uppercase text-hq-textMuted">Resolved</p>
                <p className="mt-1 font-ds-mono text-2xl font-semibold tabular-nums text-hq-in">
                  {ticketCounts.resolved}
                </p>
              </div>
            </div>

            <div className="hq-card overflow-hidden">
              {tickets.length === 0 ? (
                <div className="p-6">
                  <EmptyState
                    icon={<LifeBuoy className="h-5 w-5" />}
                    title="No Tickets Submitted"
                    description="Need help with a deliverable or want to request a change? Submit your first ticket."
                  />
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full min-w-[780px] border-collapse text-left">
                    <thead>
                      <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase text-hq-textMuted">
                        <th className="px-4 py-3 whitespace-nowrap">Ticket #</th>
                        <th className="px-4 py-3">Subject &amp; Project</th>
                        <th className="px-4 py-3 whitespace-nowrap">Category</th>
                        <th className="px-4 py-3 whitespace-nowrap">Priority</th>
                        <th className="px-4 py-3 whitespace-nowrap">Status</th>
                        <th className="px-4 py-3 whitespace-nowrap">Last Updated</th>
                        <th className="px-4 py-3 text-right whitespace-nowrap">Details</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-hq-borderSubtle text-sm">
                      {tickets.map((tkt) => (
                        <tr
                          key={tkt.id}
                          onClick={() => void openTicketDetail(tkt)}
                          className="cursor-pointer hover:bg-hq-elevated/60 transition-colors"
                        >
                          <td className="px-4 py-3 font-ds-mono text-xs font-semibold tabular-nums text-hq-brandSoft whitespace-nowrap">
                            {tkt.ticketNumber}
                          </td>
                          <td className="px-4 py-3 max-w-[300px]">
                            <p className="font-semibold text-hq-textPrimary truncate">{tkt.title}</p>
                            <p className="text-xs text-hq-textSecondary truncate">
                              {tkt.projectName || 'General Support'}
                            </p>
                          </td>
                          <td className="px-4 py-3 font-ds-mono text-[11px] text-hq-textSecondary whitespace-nowrap">
                            {tkt.category.replace('_', ' ')}
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusPill tone={priorityTone(tkt.priority)}>{tkt.priority}</StatusPill>
                          </td>
                          <td className="px-4 py-3 whitespace-nowrap">
                            <StatusPill tone={ticketStatusTone(tkt.status)}>
                              {tkt.status.replace(/_/g, ' ')}
                            </StatusPill>
                          </td>
                          <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                            {formatDateShort(tkt.updatedAt)}
                          </td>
                          <td className="px-4 py-3 text-right whitespace-nowrap">
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                void openTicketDetail(tkt);
                              }}
                              className="rounded-md border border-hq-borderDefault px-3 py-1 text-xs font-medium hover:bg-hq-elevated"
                            >
                              Open
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        )}
      </main>

      {/* Client Submit Ticket Modal */}
      <Modal
        open={ticketModalOpen}
        onClose={() => setTicketModalOpen(false)}
        title="Submit Support or Change Request Ticket"
        subtitle={`Workspace: ${session.accountName}`}
        maxWidthClass="max-w-xl"
        footer={
          <>
            <button
              type="button"
              onClick={() => setTicketModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="client-ticket-form"
              disabled={submittingTicket}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {submittingTicket ? 'Submitting...' : 'Submit Ticket'}
            </button>
          </>
        }
      >
        <form id="client-ticket-form" onSubmit={handleSubmitTicket} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Project</label>
              <select
                value={ticketForm.projectId}
                onChange={(e) =>
                  setTicketForm({ ...ticketForm, projectId: e.target.value, phaseId: '' })
                }
                className="hq-input h-10 w-full px-3 text-sm"
              >
                <option value="">General Account Support</option>
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.code} — {p.name}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Related Phase (Optional)
              </label>
              <select
                disabled={!selectedModalProject}
                value={ticketForm.phaseId}
                onChange={(e) => setTicketForm({ ...ticketForm, phaseId: e.target.value })}
                className="hq-input h-10 w-full px-3 text-sm"
              >
                <option value="">All / Not Phase-Specific</option>
                {(selectedModalProject?.phases || []).map((ph) => (
                  <option key={ph.id} value={ph.id}>
                    Phase {String(ph.order).padStart(2, '0')} — {ph.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Category</label>
              <select
                value={ticketForm.category}
                onChange={(e) =>
                  setTicketForm({ ...ticketForm, category: e.target.value as TicketCategory })
                }
                className="hq-input h-10 w-full px-3 font-ds-mono text-xs"
              >
                <option value="SUPPORT">SUPPORT</option>
                <option value="BUG">BUG</option>
                <option value="FEATURE_REQUEST">FEATURE REQUEST</option>
                <option value="INFRASTRUCTURE">INFRASTRUCTURE</option>
                <option value="BILLING">BILLING</option>
                <option value="TRAINING">TRAINING</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Priority</label>
              <select
                value={ticketForm.priority}
                onChange={(e) =>
                  setTicketForm({ ...ticketForm, priority: e.target.value as TicketPriority })
                }
                className="hq-input h-10 w-full px-3 font-ds-mono text-xs"
              >
                <option value="LOW">LOW</option>
                <option value="MEDIUM">MEDIUM</option>
                <option value="HIGH">HIGH</option>
                <option value="URGENT">URGENT</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Subject *</label>
            <input
              type="text"
              required
              value={ticketForm.title}
              onChange={(e) => setTicketForm({ ...ticketForm, title: e.target.value })}
              placeholder="Brief summary of your issue or request"
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              Detailed Description *
            </label>
            <textarea
              rows={5}
              required
              value={ticketForm.description}
              onChange={(e) => setTicketForm({ ...ticketForm, description: e.target.value })}
              placeholder="Include steps to reproduce, expected outcome, or scope notes..."
              className="hq-input w-full px-3 py-2 text-sm"
            />
          </div>
        </form>
      </Modal>

      {/* Client Ticket Detail Drawer */}
      <SlideOver
        open={Boolean(activeTicket)}
        onClose={() => setActiveTicket(null)}
        title={activeTicket ? `${activeTicket.ticketNumber} · ${activeTicket.title}` : 'Ticket'}
        subtitle={activeTicket ? activeTicket.projectName || session.accountName : undefined}
        widthClass="max-w-[660px]"
      >
        {activeTicket && (
          <div className="space-y-5">
            <div className="flex flex-wrap items-center gap-2 rounded-xl border border-hq-borderSubtle bg-hq-subtle p-4">
              <StatusPill tone={ticketStatusTone(activeTicket.status)}>
                {activeTicket.status.replace(/_/g, ' ')}
              </StatusPill>
              <StatusPill tone={priorityTone(activeTicket.priority)}>
                {activeTicket.priority}
              </StatusPill>
              <StatusPill tone="neutral">{activeTicket.category.replace('_', ' ')}</StatusPill>
              {activeTicket.assignedAssociateName && (
                <span className="ml-auto text-xs text-hq-textSecondary">
                  Assigned: <strong className="text-hq-textPrimary">{activeTicket.assignedAssociateName}</strong>
                </span>
              )}
            </div>

            <div className="rounded-xl border border-hq-borderSubtle bg-hq-surface p-4 space-y-2">
              <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
                Original Submission · {formatDateTime(activeTicket.createdAt)}
              </p>
              <p className="text-sm text-hq-textPrimary whitespace-pre-wrap leading-relaxed">
                {activeTicket.description}
              </p>
            </div>

            <div className="space-y-3">
              <h3 className="font-ds-display text-sm font-semibold text-hq-textPrimary flex items-center gap-2">
                <MessageSquare className="h-4 w-4 text-hq-brandSoft" />
                <span>Updates &amp; Replies ({activeTicket.comments?.length || 0})</span>
              </h3>

              {!activeTicket.comments || activeTicket.comments.length === 0 ? (
                <p className="rounded-xl border border-dashed border-hq-borderDefault p-4 text-center text-xs text-hq-textMuted">
                  No replies yet. You can add additional context below at any time.
                </p>
              ) : (
                <div className="space-y-3">
                  {activeTicket.comments.map((comment) => {
                    const isTeam = comment.authorType === 'TEAM';
                    return (
                      <article
                        key={comment.id}
                        className={`rounded-xl border p-4 space-y-1.5 ${
                          isTeam
                            ? 'border-hq-brand/45 bg-hq-surface'
                            : 'border-hq-borderSubtle bg-hq-subtle'
                        }`}
                      >
                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold text-hq-textPrimary">
                              {comment.authorName}
                            </span>
                            <StatusPill tone={isTeam ? 'brand' : 'neutral'}>
                              {isTeam ? 'Thea Solutions Team' : 'You'}
                            </StatusPill>
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

            {activeTicket.status !== 'CLOSED' && (
              <form
                onSubmit={handlePostReply}
                className="rounded-xl border border-hq-borderSubtle bg-hq-subtle p-4 space-y-3"
              >
                <label className="block text-xs font-semibold text-hq-textPrimary">
                  Post a Reply
                </label>
                <textarea
                  rows={3}
                  required
                  value={replyText}
                  onChange={(e) => setReplyText(e.target.value)}
                  placeholder="Share feedback, screenshots links, or follow-up questions..."
                  className="hq-input w-full px-3 py-2 text-sm"
                />
                <div className="flex justify-end">
                  <button
                    type="submit"
                    disabled={postingReply || !replyText.trim()}
                    className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                  >
                    <Send className="h-3.5 w-3.5" />
                    <span>{postingReply ? 'Posting...' : 'Post Reply'}</span>
                  </button>
                </div>
              </form>
            )}
          </div>
        )}
      </SlideOver>
    </div>
  );
}
