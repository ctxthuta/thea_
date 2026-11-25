import { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Check,
  Copy,
  CreditCard,
  ExternalLink,
  Plus,
  RotateCcw,
  Search,
  ShieldAlert,
  ShieldCheck,
  Trash2,
  UserPlus,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useToast } from '@/context/ToastContext';
import { canEditAssociates } from '@/lib/rbac';
import {
  convertCurrencyAmount,
  daysUntil,
  formatMoney,
  getTodayIso,
  parseDecimal,
  slugify,
} from '@/lib/format';
import {
  EmptyState,
  ErrorBanner,
  Modal,
  SlideOver,
  StatusPill,
  TableSkeleton,
} from '@/components/ui/Primitives';
import QrCode from '@/components/ui/QrCode';
import type {
  AssociateDTO,
  AssociateEducation,
  AssociateExperience,
  AssociateProject,
  AssociatePublication,
  AssociateType,
  CompensationRateType,
  CurrencyCode,
  CursorPage,
} from '@/types/hq';

type FilterStatus = 'all' | 'active' | 'expired' | 'revoked';

function computeEffectiveStatus(associate: AssociateDTO): 'active' | 'expiring' | 'expired' | 'revoked' {
  if (associate.status === 'REVOKED' || associate.revokedAt) {
    return 'revoked';
  }
  const remaining = daysUntil(associate.cardExpirationDate);
  if (remaining < 0 || associate.status === 'INACTIVE') {
    return 'expired';
  }
  if (remaining <= 30) {
    return 'expiring';
  }
  return 'active';
}

function getBusinessCardUrl(slug: string): string {
  return `https://theasolutions.co/${slug}?utm_source=${slug}&utm_medium=business-card`;
}

function getVerificationUrl(employeeId: string): string {
  return `https://theasolutions.co/verify/${employeeId}?utm_medium=employee-card`;
}

function defaultExpiryOneYear(): string {
  const d = new Date();
  d.setUTCFullYear(d.getUTCFullYear() + 1);
  return d.toISOString().slice(0, 10);
}

interface AssociateFormState {
  slug: string;
  employeeId: string;
  associateType: AssociateType;
  name: string;
  title: string;
  department: string;
  profileImage: string;
  bio: string;
  cardExpirationDate: string;
  isPublicCardEnabled: boolean;
  email: string;
  phone: string;
  location: string;
  linkedin: string;
  github: string;
  twitter: string;
  website: string;
  skillsText: string;
  education: AssociateEducation[];
  experience: AssociateExperience[];
  projects: AssociateProject[];
  publications: AssociatePublication[];
  rateType: CompensationRateType;
  rateAmount: string;
  rateCurrency: CurrencyCode;
  payoutMethod: string;
  ndaSigned: boolean;
  msaSigned: boolean;
  internalNotes: string;
}

function createBlankForm(): AssociateFormState {
  return {
    slug: '',
    employeeId: '',
    associateType: 'contractor',
    name: '',
    title: '',
    department: 'Engineering',
    profileImage: '',
    bio: '',
    cardExpirationDate: defaultExpiryOneYear(),
    isPublicCardEnabled: true,
    email: '',
    phone: '',
    location: 'Remote / APAC',
    linkedin: '',
    github: '',
    twitter: '',
    website: '',
    skillsText: '',
    education: [],
    experience: [],
    projects: [],
    publications: [],
    rateType: 'MONTHLY_RETAINER',
    rateAmount: '0.00',
    rateCurrency: 'MMK',
    payoutMethod: 'Bank Transfer',
    ndaSigned: true,
    msaSigned: true,
    internalNotes: '',
  };
}

function associateToForm(a: AssociateDTO): AssociateFormState {
  return {
    slug: a.slug || '',
    employeeId: a.employeeId || '',
    associateType: a.associateType || 'contractor',
    name: a.name || '',
    title: a.title || '',
    department: a.department || '',
    profileImage: a.profileImage || '',
    bio: a.bio || '',
    cardExpirationDate: a.cardExpirationDate || defaultExpiryOneYear(),
    isPublicCardEnabled: a.isPublicCardEnabled ?? true,
    email: a.contact?.email || '',
    phone: a.contact?.phone || '',
    location: a.contact?.location || '',
    linkedin: a.socialLinks?.linkedin || '',
    github: a.socialLinks?.github || '',
    twitter: a.socialLinks?.twitter || '',
    website: a.socialLinks?.website || '',
    skillsText: (a.skills || []).join(', '),
    education: a.education || [],
    experience: a.experience || [],
    projects: a.projects || [],
    publications: a.publications || [],
    rateType: a.compensation?.rateType || 'MONTHLY_RETAINER',
    rateAmount: a.compensation?.rateAmount || '0.00',
    rateCurrency: a.compensation?.currency || 'MMK',
    payoutMethod: a.compensation?.payoutMethod || 'Bank Transfer',
    ndaSigned: a.compensation?.ndaSigned ?? false,
    msaSigned: a.compensation?.msaSigned ?? false,
    internalNotes: a.internalNotes || '',
  };
}

export default function AssociatesPage() {
  const { user } = useAuth();
  const { thbToMmkRate } = useCurrency();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const editable = canEditAssociates(user);

  const [associates, setAssociates] = useState<AssociateDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | AssociateType>('all');
  const [statusFilter, setStatusFilter] = useState<FilterStatus>('all');
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [drawerTab, setDrawerTab] = useState<'profile' | 'contract' | 'badge'>('profile');
  const [editing, setEditing] = useState<AssociateDTO | null>(null);
  const [form, setForm] = useState<AssociateFormState>(createBlankForm);
  const [saving, setSaving] = useState(false);

  const [revokeTarget, setRevokeTarget] = useState<AssociateDTO | null>(null);
  const [revokeReason, setRevokeReason] = useState('Contract Ended');
  const [reinstateTarget, setReinstateTarget] = useState<AssociateDTO | null>(null);
  const [reinstateExpiry, setReinstateExpiry] = useState(defaultExpiryOneYear());
  const [actionBusy, setActionBusy] = useState(false);

  const loadAssociates = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest<CursorPage<AssociateDTO>>('/api/v1/associates?limit=100');
      setAssociates(res.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load associates directory.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAssociates();
  }, [loadAssociates]);

  const openEditDrawer = useCallback((associate: AssociateDTO) => {
    setEditing(associate);
    setForm(associateToForm(associate));
    setDrawerTab('profile');
    setDrawerOpen(true);
  }, []);

  useEffect(() => {
    const editParam = searchParams.get('edit');
    if (editParam && associates.length > 0) {
      const found = associates.find(
        (a) => a.employeeId === editParam || a.id === editParam || a.slug === editParam
      );
      if (found) {
        openEditDrawer(found);
        searchParams.delete('edit');
        setSearchParams(searchParams, { replace: true });
      }
    }
  }, [searchParams, setSearchParams, associates, openEditDrawer]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return associates.filter((a) => {
      if (typeFilter !== 'all' && a.associateType !== typeFilter) return false;
      const eff = computeEffectiveStatus(a);
      if (statusFilter === 'active' && eff !== 'active' && eff !== 'expiring') return false;
      if (statusFilter === 'expired' && eff !== 'expired') return false;
      if (statusFilter === 'revoked' && eff !== 'revoked') return false;
      if (!q) return true;
      return (
        a.name.toLowerCase().includes(q) ||
        a.title.toLowerCase().includes(q) ||
        a.employeeId.toLowerCase().includes(q) ||
        a.slug.toLowerCase().includes(q) ||
        a.department.toLowerCase().includes(q)
      );
    });
  }, [associates, search, typeFilter, statusFilter]);

  const copyText = async (key: string, text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedKey(key);
      pushToast({ variant: 'info', title: `${label} copied`, description: text });
      window.setTimeout(() => setCopiedKey(null), 1600);
    } catch {
      pushToast({ variant: 'error', title: 'Clipboard unavailable' });
    }
  };

  const openCreateDrawer = () => {
    setEditing(null);
    setForm(createBlankForm());
    setDrawerTab('profile');
    setDrawerOpen(true);
  };

  const handleSave = async () => {
    if (!editable) return;
    if (!form.name.trim() || !form.title.trim()) {
      pushToast({ variant: 'error', title: 'Name and Title are required' });
      return;
    }

    const computedSlug = form.slug.trim() || slugify(form.name);
    if (!computedSlug) {
      pushToast({ variant: 'error', title: 'A valid public slug is required' });
      return;
    }

    const payload: Record<string, unknown> = {
      slug: computedSlug,
      associateType: form.associateType,
      name: form.name.trim(),
      title: form.title.trim(),
      department: form.department.trim() || 'Operations',
      profileImage: form.profileImage.trim(),
      bio: form.bio.trim(),
      cardExpirationDate: form.cardExpirationDate,
      isPublicCardEnabled: form.isPublicCardEnabled,
      contact: {
        email: form.email.trim(),
        phone: form.phone.trim(),
        location: form.location.trim(),
      },
      socialLinks: {
        linkedin: form.linkedin.trim(),
        github: form.github.trim(),
        twitter: form.twitter.trim(),
        website: form.website.trim(),
      },
      skills: form.skillsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      education: form.education,
      experience: form.experience,
      projects: form.projects,
      publications: form.publications,
      compensation: {
        rateType: form.rateType,
        rateAmount: parseDecimal(form.rateAmount).toFixed(2),
        currency: form.rateCurrency,
        payoutMethod: form.payoutMethod.trim() || 'Bank Transfer',
        ndaSigned: form.ndaSigned,
        msaSigned: form.msaSigned,
      },
      internalNotes: form.internalNotes.trim(),
    };

    if (form.employeeId.trim()) {
      payload.employeeId = form.employeeId.trim().toUpperCase();
    }

    setSaving(true);
    try {
      if (editing) {
        await apiRequest<AssociateDTO>(`/api/v1/associates/${editing.id}`, {
          method: 'PUT',
          body: { ...payload, version: editing.version },
        });
        pushToast({
          variant: 'success',
          title: 'Associate updated',
          description: `${form.name} changes are live.`,
        });
      } else {
        const created = await apiRequest<AssociateDTO>('/api/v1/associates', {
          method: 'POST',
          body: payload,
        });
        pushToast({
          variant: 'success',
          title: 'Associate created',
          description: `Issued verification ID ${created.employeeId}.`,
        });
      }
      setDrawerOpen(false);
      await loadAssociates();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Save failed',
        description: err instanceof ApiError ? err.message : 'Unable to save associate.',
      });
    } finally {
      setSaving(false);
    }
  };

  const handleConfirmRevoke = async () => {
    if (!revokeTarget) return;
    setActionBusy(true);
    try {
      await apiRequest<AssociateDTO>(`/api/v1/associates/${revokeTarget.id}/revoke`, {
        method: 'POST',
        body: {
          reason: revokeReason.trim() || 'Administrative revocation',
          version: revokeTarget.version,
        },
      });
      pushToast({
        variant: 'success',
        title: 'Credential revoked',
        description: `${revokeTarget.employeeId} now reports revoked on theasolutions.co/verify.`,
      });
      setRevokeTarget(null);
      setDrawerOpen(false);
      await loadAssociates();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Revocation failed',
        description: err instanceof ApiError ? err.message : 'Could not revoke badge.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const handleConfirmReinstate = async () => {
    if (!reinstateTarget) return;
    setActionBusy(true);
    try {
      await apiRequest<AssociateDTO>(`/api/v1/associates/${reinstateTarget.id}/reinstate`, {
        method: 'POST',
        body: {
          cardExpirationDate: reinstateExpiry || undefined,
          version: reinstateTarget.version,
        },
      });
      pushToast({
        variant: 'success',
        title: 'Credential reinstated',
        description: `${reinstateTarget.employeeId} is verified until ${reinstateExpiry}.`,
      });
      setReinstateTarget(null);
      setDrawerOpen(false);
      await loadAssociates();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Reinstatement failed',
        description: err instanceof ApiError ? err.message : 'Could not reinstate badge.',
      });
    } finally {
      setActionBusy(false);
    }
  };

  const convertedRatePreview = useMemo(() => {
    const val = parseDecimal(form.rateAmount);
    if (val <= 0) return null;
    const other: CurrencyCode = form.rateCurrency === 'THB' ? 'MMK' : 'THB';
    const converted = convertCurrencyAmount(val, form.rateCurrency, other, thbToMmkRate);
    return `${formatMoney(converted, other)} @ 1 THB = ${thbToMmkRate.toFixed(2)} MMK`;
  }, [form.rateAmount, form.rateCurrency, thbToMmkRate]);

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-ds-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-hq-textPrimary">
            Associates &amp; Digital Identity
          </h1>
          <p className="mt-1 text-sm text-hq-textSecondary">
            Contractor-first directory managing public business cards and <span className="font-ds-mono text-hq-brandSoft">THEA-XXXX</span> verification badges.
          </p>
        </div>

        {editable && (
          <button
            type="button"
            onClick={openCreateDrawer}
            className="hq-btn-primary inline-flex h-10 items-center gap-1.5 px-4 text-xs"
          >
            <UserPlus className="h-4 w-4" />
            <span>Add Associate</span>
          </button>
        )}
      </div>

      {error && <ErrorBanner message={error} onRetry={loadAssociates} />}

      {/* Filter Bar */}
      <div className="hq-card p-4 space-y-3">
        <div className="flex flex-wrap items-center gap-3">
          <div className="relative flex-1 min-w-[220px]">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-hq-textMuted" />
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search name, role, slug, or THEA-XXXX..."
              className="hq-input h-10 w-full pl-9 pr-3 text-sm"
            />
          </div>
          <span className="font-ds-mono text-xs text-hq-textMuted tabular-nums">
            Showing {filtered.length} of {associates.length}
          </span>
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-ds-mono text-[11px] uppercase text-hq-textMuted mr-1">Type:</span>
            {(['all', 'contractor', 'freelancer', 'advisor', 'executive'] as const).map((t) => (
              <button
                key={t}
                type="button"
                onClick={() => setTypeFilter(t)}
                className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                  typeFilter === t
                    ? 'bg-hq-brand text-white font-medium'
                    : 'border border-hq-borderDefault text-hq-textSecondary hover:bg-hq-elevated'
                }`}
              >
                {t}
              </button>
            ))}
          </div>

          <div className="flex flex-wrap items-center gap-1.5">
            <span className="font-ds-mono text-[11px] uppercase text-hq-textMuted mr-1">Status:</span>
            {(['all', 'active', 'expired', 'revoked'] as const).map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                className={`rounded-full px-3 py-1 text-xs capitalize transition-colors ${
                  statusFilter === st
                    ? 'bg-hq-brand text-white font-medium'
                    : 'border border-hq-borderDefault text-hq-textSecondary hover:bg-hq-elevated'
                }`}
              >
                {st}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Directory Table */}
      <div className="hq-card overflow-hidden">
        {loading ? (
          <TableSkeleton rows={6} cols={6} />
        ) : filtered.length === 0 ? (
          <div className="p-6">
            <EmptyState
              icon={<CreditCard className="h-5 w-5" />}
              title="No Associates Match Your Filters"
              description="Adjust your search criteria or add a new contractor, freelancer, advisor, or executive."
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[820px] border-collapse text-left">
              <thead>
                <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
                  <th className="px-4 py-3 whitespace-nowrap">Badge ID</th>
                  <th className="px-4 py-3">Associate</th>
                  <th className="px-4 py-3 whitespace-nowrap">Type</th>
                  <th className="px-4 py-3 whitespace-nowrap">Card Expiration</th>
                  <th className="px-4 py-3 whitespace-nowrap">Status</th>
                  <th className="px-4 py-3 text-right whitespace-nowrap">Quick Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-hq-borderSubtle text-sm">
                {filtered.map((assoc) => {
                  const eff = computeEffectiveStatus(assoc);
                  const pillTone =
                    eff === 'active' ? 'in' : eff === 'expiring' ? 'warn' : 'out';
                  const pillLabel =
                    eff === 'active'
                      ? 'Verified'
                      : eff === 'expiring'
                        ? 'Expiring Soon'
                        : eff === 'revoked'
                          ? 'Revoked'
                          : 'Expired';

                  return (
                    <tr
                      key={assoc.id}
                      className="hover:bg-hq-elevated/60 transition-colors"
                    >
                      <td className="px-4 py-3.5 font-ds-mono text-xs font-semibold tabular-nums text-hq-brandSoft">
                        {assoc.employeeId}
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center gap-3">
                          {assoc.profileImage ? (
                            <img
                              src={assoc.profileImage}
                              alt={assoc.name}
                              className="h-9 w-9 rounded-full object-cover border border-hq-brand/40 shrink-0"
                            />
                          ) : (
                            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-hq-brand/30 font-ds-display text-xs font-bold text-hq-brandSoft shrink-0">
                              {assoc.name
                                .split(/\s+/)
                                .map((n) => n[0])
                                .join('')
                                .slice(0, 2)}
                            </div>
                          )}
                          <div className="min-w-0">
                            <p className="font-medium text-hq-textPrimary truncate">{assoc.name}</p>
                            <p className="text-xs text-hq-textSecondary truncate">
                              {assoc.title} · {assoc.department}
                            </p>
                          </div>
                        </div>
                      </td>
                      <td className="px-4 py-3.5">
                        <span className="rounded-md bg-hq-subtle border border-hq-borderSubtle px-2 py-0.5 font-ds-mono text-[11px] capitalize text-hq-textSecondary">
                          {assoc.associateType}
                        </span>
                      </td>
                      <td className="px-4 py-3.5 font-ds-mono text-xs tabular-nums text-hq-textSecondary">
                        {assoc.cardExpirationDate}
                      </td>
                      <td className="px-4 py-3.5">
                        <StatusPill tone={pillTone}>{pillLabel}</StatusPill>
                      </td>
                      <td className="px-4 py-3.5">
                        <div className="flex items-center justify-end gap-1.5">
                          <button
                            type="button"
                            title="Copy Business Card URL"
                            onClick={() =>
                              void copyText(
                                `card-${assoc.id}`,
                                getBusinessCardUrl(assoc.slug),
                                'Business Card URL'
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-hq-borderDefault px-2 py-1 text-xs text-hq-textSecondary hover:bg-hq-elevated hover:text-hq-textPrimary"
                          >
                            {copiedKey === `card-${assoc.id}` ? (
                              <Check className="h-3 w-3 text-hq-in" />
                            ) : (
                              <Copy className="h-3 w-3" />
                            )}
                            <span>Card URL</span>
                          </button>

                          <button
                            type="button"
                            title="Copy Verification URL"
                            onClick={() =>
                              void copyText(
                                `verify-${assoc.id}`,
                                getVerificationUrl(assoc.employeeId),
                                'Verification URL'
                              )
                            }
                            className="inline-flex items-center gap-1 rounded-md border border-hq-borderDefault px-2 py-1 text-xs text-hq-textSecondary hover:bg-hq-elevated hover:text-hq-textPrimary"
                          >
                            {copiedKey === `verify-${assoc.id}` ? (
                              <Check className="h-3 w-3 text-hq-in" />
                            ) : (
                              <ShieldCheck className="h-3 w-3" />
                            )}
                            <span>Verify URL</span>
                          </button>

                          <button
                            type="button"
                            onClick={() => openEditDrawer(assoc)}
                            className="rounded-md border border-hq-borderDefault px-2.5 py-1 text-xs font-medium text-hq-textPrimary hover:bg-hq-elevated"
                          >
                            {editable ? 'Edit' : 'Inspect'}
                          </button>

                          {editable &&
                            (eff === 'revoked' ? (
                              <button
                                type="button"
                                onClick={() => {
                                  setReinstateTarget(assoc);
                                  setReinstateExpiry(defaultExpiryOneYear());
                                }}
                                className="rounded-md border border-hq-in/50 bg-hq-inBg px-2.5 py-1 text-xs font-medium text-hq-in hover:opacity-90"
                              >
                                Reinstate
                              </button>
                            ) : (
                              <button
                                type="button"
                                onClick={() => {
                                  setRevokeTarget(assoc);
                                  setRevokeReason('Contract Ended');
                                }}
                                className="rounded-md border border-hq-out/40 bg-hq-outBg px-2.5 py-1 text-xs font-medium text-hq-out hover:bg-hq-out hover:text-white transition-colors"
                              >
                                Revoke
                              </button>
                            ))}
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

      {/* Create / Edit Slide-Over Drawer */}
      <SlideOver
        open={drawerOpen}
        onClose={() => setDrawerOpen(false)}
        title={editing ? `Edit Associate: ${editing.name}` : 'Add New Associate'}
        subtitle={
          editing
            ? `${editing.employeeId} · /${editing.slug}`
            : 'Generates THEA-XXXX verification credential automatically if omitted'
        }
        widthClass="max-w-[640px]"
        footer={
          <>
            <button
              type="button"
              onClick={() => setDrawerOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            {editable && (
              <button
                type="button"
                disabled={saving}
                onClick={() => void handleSave()}
                className="hq-btn-primary h-9 px-5 text-xs"
              >
                {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Associate'}
              </button>
            )}
          </>
        }
      >
        <div className="space-y-5">
          {/* Sub-tabs inside drawer */}
          <div role="tablist" className="flex gap-1 rounded-full border border-hq-borderDefault bg-hq-subtle p-1">
            {(
              [
                ['profile', 'Profile & Digital Card'],
                ['contract', 'Engagement & Rate'],
                ['badge', 'Verification Badge'],
              ] as const
            ).map(([tabKey, label]) => (
              <button
                key={tabKey}
                type="button"
                role="tab"
                aria-selected={drawerTab === tabKey}
                onClick={() => setDrawerTab(tabKey)}
                className={`flex-1 rounded-full px-3 py-1.5 text-xs font-medium transition-colors ${
                  drawerTab === tabKey
                    ? 'bg-hq-brand text-white'
                    : 'text-hq-textSecondary hover:text-hq-textPrimary'
                }`}
              >
                {label}
              </button>
            ))}
          </div>

          {drawerTab === 'profile' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Full Name *
                  </label>
                  <input
                    type="text"
                    disabled={!editable}
                    value={form.name}
                    onChange={(e) => {
                      const nextName = e.target.value;
                      setForm((prev) => ({
                        ...prev,
                        name: nextName,
                        slug: !editing && !prev.slug ? slugify(nextName) : prev.slug,
                      }));
                    }}
                    className="hq-input h-10 w-full px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Public Card Slug *
                  </label>
                  <input
                    type="text"
                    disabled={!editable}
                    value={form.slug}
                    onChange={(e) => setForm({ ...form, slug: slugify(e.target.value) })}
                    placeholder="e.g. aung-ko-min"
                    className="hq-input h-10 w-full px-3 font-ds-mono text-xs"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Associate Type
                  </label>
                  <select
                    disabled={!editable}
                    value={form.associateType}
                    onChange={(e) =>
                      setForm({ ...form, associateType: e.target.value as AssociateType })
                    }
                    className="hq-input h-10 w-full px-3 text-sm"
                  >
                    <option value="contractor">Contractor</option>
                    <option value="freelancer">Freelancer</option>
                    <option value="advisor">Advisor</option>
                    <option value="executive">Executive</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Title *
                  </label>
                  <input
                    type="text"
                    disabled={!editable}
                    value={form.title}
                    onChange={(e) => setForm({ ...form, title: e.target.value })}
                    className="hq-input h-10 w-full px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Department
                  </label>
                  <input
                    type="text"
                    disabled={!editable}
                    value={form.department}
                    onChange={(e) => setForm({ ...form, department: e.target.value })}
                    className="hq-input h-10 w-full px-3 text-sm"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                  Profile Image URL
                </label>
                <input
                  type="url"
                  disabled={!editable}
                  value={form.profileImage}
                  onChange={(e) => setForm({ ...form, profileImage: e.target.value })}
                  placeholder="https://..."
                  className="hq-input h-10 w-full px-3 text-sm"
                />
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                  Public Bio
                </label>
                <textarea
                  rows={3}
                  disabled={!editable}
                  value={form.bio}
                  onChange={(e) => setForm({ ...form, bio: e.target.value })}
                  className="hq-input w-full px-3 py-2 text-sm"
                />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Email</label>
                  <input
                    type="email"
                    disabled={!editable}
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className="hq-input h-10 w-full px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Phone</label>
                  <input
                    type="text"
                    disabled={!editable}
                    value={form.phone}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className="hq-input h-10 w-full px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Location</label>
                  <input
                    type="text"
                    disabled={!editable}
                    value={form.location}
                    onChange={(e) => setForm({ ...form, location: e.target.value })}
                    className="hq-input h-10 w-full px-3 text-sm"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">LinkedIn</label>
                  <input
                    type="url"
                    disabled={!editable}
                    value={form.linkedin}
                    onChange={(e) => setForm({ ...form, linkedin: e.target.value })}
                    className="hq-input h-9 w-full px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">GitHub</label>
                  <input
                    type="url"
                    disabled={!editable}
                    value={form.github}
                    onChange={(e) => setForm({ ...form, github: e.target.value })}
                    className="hq-input h-9 w-full px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Twitter / X</label>
                  <input
                    type="url"
                    disabled={!editable}
                    value={form.twitter}
                    onChange={(e) => setForm({ ...form, twitter: e.target.value })}
                    className="hq-input h-9 w-full px-3 text-xs"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Website</label>
                  <input
                    type="url"
                    disabled={!editable}
                    value={form.website}
                    onChange={(e) => setForm({ ...form, website: e.target.value })}
                    className="hq-input h-9 w-full px-3 text-xs"
                  />
                </div>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                  Skills (comma-separated)
                </label>
                <input
                  type="text"
                  disabled={!editable}
                  value={form.skillsText}
                  onChange={(e) => setForm({ ...form, skillsText: e.target.value })}
                  placeholder="TypeScript, Go, Cloud Architecture, Financial Modeling"
                  className="hq-input h-10 w-full px-3 text-sm"
                />
              </div>

              <label className="inline-flex items-center gap-2 text-xs text-hq-textPrimary">
                <input
                  type="checkbox"
                  disabled={!editable}
                  checked={form.isPublicCardEnabled}
                  onChange={(e) => setForm({ ...form, isPublicCardEnabled: e.target.checked })}
                  className="h-4 w-4 accent-[#5F1F2F]"
                />
                Enable public digital business card at theasolutions.co/{form.slug || '<slug>'}
              </label>

              {/* Digital Business Card Scannable QR Preview */}
              {(form.slug || editing?.slug) && (
                <div className="rounded-xl border border-hq-borderSubtle bg-hq-subtle p-4 flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1 space-y-1.5">
                    <p className="font-ds-mono text-[11px] font-semibold uppercase tracking-wider text-hq-brandSoft">
                      Digital Business Card QR (ISO/IEC 18004)
                    </p>
                    <p className="text-xs text-hq-textSecondary">
                      Scan to open the live public portfolio and business card with UTM attribution.
                    </p>
                    <p className="font-ds-mono text-[11px] text-hq-textPrimary break-all">
                      {getBusinessCardUrl(form.slug || editing?.slug || '')}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 pt-1">
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            'profile-card-qr',
                            getBusinessCardUrl(form.slug || editing?.slug || ''),
                            'Business Card URL'
                          )
                        }
                        className="hq-btn-secondary inline-flex h-7 items-center gap-1 px-3 text-[11px]"
                      >
                        <Copy className="h-3 w-3" />
                        <span>Copy URL</span>
                      </button>
                      <a
                        href={getBusinessCardUrl(form.slug || editing?.slug || '')}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hq-btn-secondary inline-flex h-7 items-center gap-1 px-3 text-[11px]"
                      >
                        <ExternalLink className="h-3 w-3" />
                        <span>Open Card</span>
                      </a>
                    </div>
                  </div>
                  <QrCode
                    value={getBusinessCardUrl(form.slug || editing?.slug || '')}
                    size={112}
                    label={`Digital business card QR code for ${form.name || form.slug}`}
                    downloadFileName={`thea-card-${form.slug || editing?.slug || 'associate'}.png`}
                  />
                </div>
              )}

              {/* Experience & Education Lists */}
              <div className="space-y-3 border-t border-hq-borderSubtle pt-4">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-hq-textPrimary">
                    Experience ({form.experience.length})
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          experience: [
                            ...form.experience,
                            {
                              position: '',
                              company: 'Thea Solutions',
                              location: 'Remote',
                              startDate: String(new Date().getFullYear()),
                              endDate: 'Present',
                              current: true,
                              description: [''],
                            },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs text-hq-brandSoft hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Experience
                    </button>
                  )}
                </div>
                {form.experience.map((exp, idx) => (
                  <div key={idx} className="rounded-lg border border-hq-borderSubtle bg-hq-subtle p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-ds-mono text-[11px] text-hq-textMuted">Role #{idx + 1}</span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              experience: form.experience.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-hq-out hover:opacity-80"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Position"
                        disabled={!editable}
                        value={exp.position}
                        onChange={(e) => {
                          const next = [...form.experience];
                          next[idx] = { ...exp, position: e.target.value };
                          setForm({ ...form, experience: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Company"
                        disabled={!editable}
                        value={exp.company}
                        onChange={(e) => {
                          const next = [...form.experience];
                          next[idx] = { ...exp, company: e.target.value };
                          setForm({ ...form, experience: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Start (e.g. 2024)"
                        disabled={!editable}
                        value={exp.startDate}
                        onChange={(e) => {
                          const next = [...form.experience];
                          next[idx] = { ...exp, startDate: e.target.value };
                          setForm({ ...form, experience: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="End (or Present)"
                        disabled={!editable}
                        value={exp.endDate}
                        onChange={(e) => {
                          const next = [...form.experience];
                          next[idx] = { ...exp, endDate: e.target.value };
                          setForm({ ...form, experience: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                    </div>
                    <textarea
                      rows={2}
                      disabled={!editable}
                      placeholder="Highlights (one per line)"
                      value={exp.description.join('\n')}
                      onChange={(e) => {
                        const next = [...form.experience];
                        next[idx] = { ...exp, description: e.target.value.split('\n') };
                        setForm({ ...form, experience: next });
                      }}
                      className="hq-input w-full px-2.5 py-1.5 text-xs"
                    />
                  </div>
                ))}

                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-semibold text-hq-textPrimary">
                    Education ({form.education.length})
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          education: [
                            ...form.education,
                            { degree: '', institution: '', location: '', startDate: '', endDate: '' },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs text-hq-brandSoft hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Education
                    </button>
                  )}
                </div>
                {form.education.map((edu, idx) => (
                  <div key={idx} className="rounded-lg border border-hq-borderSubtle bg-hq-subtle p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-ds-mono text-[11px] text-hq-textMuted">Education #{idx + 1}</span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              education: form.education.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-hq-out"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Degree"
                        disabled={!editable}
                        value={edu.degree}
                        onChange={(e) => {
                          const next = [...form.education];
                          next[idx] = { ...edu, degree: e.target.value };
                          setForm({ ...form, education: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Institution"
                        disabled={!editable}
                        value={edu.institution}
                        onChange={(e) => {
                          const next = [...form.education];
                          next[idx] = { ...edu, institution: e.target.value };
                          setForm({ ...form, education: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="Start Year"
                        disabled={!editable}
                        value={edu.startDate}
                        onChange={(e) => {
                          const next = [...form.education];
                          next[idx] = { ...edu, startDate: e.target.value };
                          setForm({ ...form, education: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                      <input
                        type="text"
                        placeholder="End Year"
                        disabled={!editable}
                        value={edu.endDate}
                        onChange={(e) => {
                          const next = [...form.education];
                          next[idx] = { ...edu, endDate: e.target.value };
                          setForm({ ...form, education: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                    </div>
                  </div>
                ))}

                {/* Projects */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-semibold text-hq-textPrimary">
                    Projects ({form.projects.length})
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          projects: [
                            ...form.projects,
                            { name: '', description: '', technologies: [], url: '' },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs text-hq-brandSoft hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Project
                    </button>
                  )}
                </div>
                {form.projects.map((proj, idx) => (
                  <div key={idx} className="rounded-lg border border-hq-borderSubtle bg-hq-subtle p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-ds-mono text-[11px] text-hq-textMuted">Project #{idx + 1}</span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              projects: form.projects.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-hq-out"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Project Name"
                        disabled={!editable}
                        value={proj.name}
                        onChange={(e) => {
                          const next = [...form.projects];
                          next[idx] = { ...proj, name: e.target.value };
                          setForm({ ...form, projects: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                      <input
                        type="url"
                        placeholder="Project URL"
                        disabled={!editable}
                        value={proj.url || ''}
                        onChange={(e) => {
                          const next = [...form.projects];
                          next[idx] = { ...proj, url: e.target.value };
                          setForm({ ...form, projects: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                    </div>
                    <input
                      type="text"
                      placeholder="Description"
                      disabled={!editable}
                      value={proj.description}
                      onChange={(e) => {
                        const next = [...form.projects];
                        next[idx] = { ...proj, description: e.target.value };
                        setForm({ ...form, projects: next });
                      }}
                      className="hq-input h-8 w-full px-2.5 text-xs"
                    />
                  </div>
                ))}

                {/* Publications */}
                <div className="flex items-center justify-between pt-2">
                  <span className="text-xs font-semibold text-hq-textPrimary">
                    Publications ({form.publications.length})
                  </span>
                  {editable && (
                    <button
                      type="button"
                      onClick={() =>
                        setForm({
                          ...form,
                          publications: [
                            ...form.publications,
                            { title: '', type: 'Article', date: '', authors: [], description: '', url: '' },
                          ],
                        })
                      }
                      className="inline-flex items-center gap-1 text-xs text-hq-brandSoft hover:underline"
                    >
                      <Plus className="h-3.5 w-3.5" /> Add Publication
                    </button>
                  )}
                </div>
                {form.publications.map((pub, idx) => (
                  <div key={idx} className="rounded-lg border border-hq-borderSubtle bg-hq-subtle p-3 space-y-2">
                    <div className="flex items-center justify-between">
                      <span className="font-ds-mono text-[11px] text-hq-textMuted">Publication #{idx + 1}</span>
                      {editable && (
                        <button
                          type="button"
                          onClick={() =>
                            setForm({
                              ...form,
                              publications: form.publications.filter((_, i) => i !== idx),
                            })
                          }
                          className="text-hq-out"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        type="text"
                        placeholder="Title"
                        disabled={!editable}
                        value={pub.title}
                        onChange={(e) => {
                          const next = [...form.publications];
                          next[idx] = { ...pub, title: e.target.value };
                          setForm({ ...form, publications: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                      <input
                        type="url"
                        placeholder="URL"
                        disabled={!editable}
                        value={pub.url}
                        onChange={(e) => {
                          const next = [...form.publications];
                          next[idx] = { ...pub, url: e.target.value };
                          setForm({ ...form, publications: next });
                        }}
                        className="hq-input h-8 px-2.5 text-xs"
                      />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {drawerTab === 'contract' && (
            <div className="space-y-4">
              <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Rate Type
                  </label>
                  <select
                    disabled={!editable}
                    value={form.rateType}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        rateType: e.target.value as CompensationRateType,
                      })
                    }
                    className="hq-input h-10 w-full px-3 text-sm"
                  >
                    <option value="MONTHLY_RETAINER">Monthly Retainer</option>
                    <option value="DAILY">Daily</option>
                    <option value="HOURLY">Hourly</option>
                    <option value="MILESTONE">Milestone</option>
                    <option value="ADVISORY">Advisory</option>
                    <option value="NONE">None</option>
                  </select>
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Contract Rate Amount
                  </label>
                  <input
                    type="text"
                    disabled={!editable}
                    value={form.rateAmount}
                    onChange={(e) => setForm({ ...form, rateAmount: e.target.value })}
                    placeholder="2500000.00"
                    className="hq-input h-10 w-full px-3 text-right font-ds-mono text-sm tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Currency
                  </label>
                  <select
                    disabled={!editable}
                    value={form.rateCurrency}
                    onChange={(e) =>
                      setForm({ ...form, rateCurrency: e.target.value as CurrencyCode })
                    }
                    className="hq-input h-10 w-full px-3 font-ds-mono text-sm"
                  >
                    <option value="MMK">MMK</option>
                    <option value="THB">THB</option>
                  </select>
                </div>
              </div>

              {convertedRatePreview && (
                <p className="rounded-lg border border-hq-borderSubtle bg-hq-subtle px-3 py-2 font-ds-mono text-xs tabular-nums text-hq-textSecondary">
                  Equivalent: <strong className="text-hq-textPrimary">{convertedRatePreview}</strong>
                </p>
              )}

              <div className="flex flex-wrap gap-6 pt-1">
                <label className="inline-flex items-center gap-2 text-xs text-hq-textPrimary">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={form.ndaSigned}
                    onChange={(e) => setForm({ ...form, ndaSigned: e.target.checked })}
                    className="h-4 w-4 accent-[#5F1F2F]"
                  />
                  Mutual NDA Executed
                </label>
                <label className="inline-flex items-center gap-2 text-xs text-hq-textPrimary">
                  <input
                    type="checkbox"
                    disabled={!editable}
                    checked={form.msaSigned}
                    onChange={(e) => setForm({ ...form, msaSigned: e.target.checked })}
                    className="h-4 w-4 accent-[#5F1F2F]"
                  />
                  Contractor MSA / SOW Signed
                </label>
              </div>

              <div>
                <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                  Internal Notes (never exposed on public endpoints)
                </label>
                <textarea
                  rows={4}
                  disabled={!editable}
                  value={form.internalNotes}
                  onChange={(e) => setForm({ ...form, internalNotes: e.target.value })}
                  placeholder="Contract renewal schedule, payout notes, assignment pod..."
                  className="hq-input w-full px-3 py-2 text-sm"
                />
              </div>
            </div>
          )}

          {drawerTab === 'badge' && (
            <div className="space-y-5">
              {/* Visual Verification Badge Preview */}
              <div className="rounded-2xl border border-hq-brand/60 bg-gradient-to-br from-[#23171B] to-[#181816] p-5 text-[#F1F1F0] shadow-xl">
                <div className="flex items-center justify-between gap-3 border-b border-white/10 pb-3.5 mb-4">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <img
                      src="/dark_tranStacked_logo.png"
                      alt="Thea Solutions"
                      className="h-9 w-auto object-contain shrink-0"
                    />
                    <span className="font-ds-mono text-[10px] uppercase tracking-[0.12em] text-[#F3A6B7] truncate">
                      Verified Associate
                    </span>
                  </div>
                  <StatusPill
                    tone={
                      editing?.status === 'REVOKED'
                        ? 'out'
                        : daysUntil(form.cardExpirationDate) < 0
                          ? 'out'
                          : 'in'
                    }
                  >
                    {editing?.status === 'REVOKED'
                      ? 'Revoked'
                      : daysUntil(form.cardExpirationDate) < 0
                        ? 'Expired'
                        : 'Active'}
                  </StatusPill>
                </div>

                <div className="flex flex-wrap items-center justify-between gap-4">
                  <div className="min-w-0 flex-1">
                    <p className="font-ds-display text-lg font-bold truncate">
                      {form.name || 'Associate Name'}
                    </p>
                    <p className="text-xs text-[#F3A6B7] truncate">
                      {form.title || 'Title'} · {form.department || 'Department'}
                    </p>
                    <p className="mt-2 font-ds-mono text-xs tabular-nums text-white/90">
                      ID: {form.employeeId || editing?.employeeId || 'THEA-AUTO'}
                    </p>
                    <p className="font-ds-mono text-[11px] tabular-nums text-white/60">
                      Valid Thru: {form.cardExpirationDate}
                    </p>
                  </div>
                  <QrCode
                    value={getVerificationUrl(form.employeeId || editing?.employeeId || 'THEA-0000')}
                    size={104}
                    label={`Verification QR code for ${form.employeeId || editing?.employeeId || 'associate'}`}
                    downloadFileName={`thea-verify-${form.employeeId || editing?.employeeId || 'badge'}.png`}
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Credential ID (THEA-XXXX)
                  </label>
                  <input
                    type="text"
                    disabled={!editable || Boolean(editing)}
                    value={form.employeeId}
                    onChange={(e) => setForm({ ...form, employeeId: e.target.value.toUpperCase() })}
                    placeholder="Leave blank to auto-generate"
                    className="hq-input h-10 w-full px-3 font-ds-mono text-xs uppercase tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Card Expiration Date *
                  </label>
                  <input
                    type="date"
                    disabled={!editable}
                    value={form.cardExpirationDate}
                    onChange={(e) => setForm({ ...form, cardExpirationDate: e.target.value })}
                    className="hq-input h-10 w-full px-3 font-ds-mono text-xs tabular-nums"
                  />
                </div>
              </div>

              {editing && (
                <div className="space-y-3 border-t border-hq-borderSubtle pt-4">
                  <div>
                    <p className="mb-1 text-xs font-medium text-hq-textSecondary">
                      Public Digital Business Card URL
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={getBusinessCardUrl(editing.slug)}
                        className="hq-input h-9 flex-1 px-3 font-ds-mono text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void copyText('drawer-card', getBusinessCardUrl(editing.slug), 'Card URL')
                        }
                        className="hq-btn-secondary h-9 px-3 text-xs"
                      >
                        Copy
                      </button>
                      <a
                        href={getBusinessCardUrl(editing.slug)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open public business card"
                        className="rounded-full border border-hq-borderDefault p-2 text-hq-textSecondary hover:text-hq-textPrimary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>

                  <div>
                    <p className="mb-1 text-xs font-medium text-hq-textSecondary">
                      Public Verification Badge URL
                    </p>
                    <div className="flex items-center gap-2">
                      <input
                        readOnly
                        value={getVerificationUrl(editing.employeeId)}
                        className="hq-input h-9 flex-1 px-3 font-ds-mono text-[11px]"
                      />
                      <button
                        type="button"
                        onClick={() =>
                          void copyText(
                            'drawer-verify',
                            getVerificationUrl(editing.employeeId),
                            'Verification URL'
                          )
                        }
                        className="hq-btn-secondary h-9 px-3 text-xs"
                      >
                        Copy
                      </button>
                      <a
                        href={getVerificationUrl(editing.employeeId)}
                        target="_blank"
                        rel="noopener noreferrer"
                        aria-label="Open public verification page"
                        className="rounded-full border border-hq-borderDefault p-2 text-hq-textSecondary hover:text-hq-textPrimary"
                      >
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  </div>

                  {editable && (
                    <div className="rounded-xl border border-hq-out/40 bg-hq-outBg/60 p-4 flex flex-wrap items-center justify-between gap-3 mt-4">
                      <div>
                        <p className="text-xs font-semibold text-hq-out flex items-center gap-1.5">
                          <ShieldAlert className="h-4 w-4" />
                          Credential Lifecycle Control
                        </p>
                        <p className="mt-0.5 text-xs text-hq-textSecondary">
                          {editing.status === 'REVOKED'
                            ? 'This credential is currently revoked. Reinstate to restore public verification.'
                            : 'Revoking immediately flips theasolutions.co/verify to REVOKED with zero cache lag.'}
                        </p>
                      </div>
                      {editing.status === 'REVOKED' ? (
                        <button
                          type="button"
                          onClick={() => {
                            setReinstateTarget(editing);
                            setReinstateExpiry(defaultExpiryOneYear());
                          }}
                          className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hq-in bg-hq-inBg px-4 text-xs font-semibold text-hq-in"
                        >
                          <RotateCcw className="h-3.5 w-3.5" />
                          Reinstate Badge
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => {
                            setRevokeTarget(editing);
                            setRevokeReason('Contract Ended');
                          }}
                          className="hq-btn-danger h-9 px-4 text-xs"
                        >
                          Revoke Badge
                        </button>
                      )}
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </SlideOver>

      {/* Revoke Confirmation Modal */}
      <Modal
        open={Boolean(revokeTarget)}
        onClose={() => setRevokeTarget(null)}
        title="Revoke Verification Credential"
        subtitle={revokeTarget ? `${revokeTarget.name} (${revokeTarget.employeeId})` : undefined}
        footer={
          <>
            <button
              type="button"
              onClick={() => setRevokeTarget(null)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void handleConfirmRevoke()}
              className="hq-btn-danger h-9 px-5 text-xs"
            >
              {actionBusy ? 'Revoking...' : 'Confirm Revocation'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-hq-textSecondary">
            Revoking immediately invalidates the public verification endpoint and logs an immutable audit entry.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-hq-textSecondary">
              Revocation Reason *
            </label>
            <select
              value={revokeReason}
              onChange={(e) => setRevokeReason(e.target.value)}
              className="hq-input h-10 w-full px-3 text-sm"
            >
              <option value="Contract Ended">Contract Ended</option>
              <option value="Security Incident">Security Incident</option>
              <option value="Role Transition">Role Transition</option>
              <option value="Administrative Hold">Administrative Hold</option>
            </select>
          </div>
        </div>
      </Modal>

      {/* Reinstate Confirmation Modal */}
      <Modal
        open={Boolean(reinstateTarget)}
        onClose={() => setReinstateTarget(null)}
        title="Reinstate Associate Credential"
        subtitle={reinstateTarget ? `${reinstateTarget.name} (${reinstateTarget.employeeId})` : undefined}
        footer={
          <>
            <button
              type="button"
              onClick={() => setReinstateTarget(null)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={actionBusy}
              onClick={() => void handleConfirmReinstate()}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {actionBusy ? 'Reinstating...' : 'Confirm Reinstate'}
            </button>
          </>
        }
      >
        <div className="space-y-4">
          <p className="text-sm text-hq-textSecondary">
            Restores active status and clears the revocation timestamp immediately.
          </p>
          <div>
            <label className="mb-1.5 block text-xs font-medium text-hq-textSecondary">
              Updated Expiration Date
            </label>
            <input
              type="date"
              min={getTodayIso()}
              value={reinstateExpiry}
              onChange={(e) => setReinstateExpiry(e.target.value)}
              className="hq-input h-10 w-full px-3 font-ds-mono text-xs tabular-nums"
            />
          </div>
        </div>
      </Modal>
    </div>
  );
}
