import React, { useCallback, useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowLeftRight,
  Crown,
  FileSearch,
  Lock,
  Plus,
  Save,
  Settings2,
  ShieldCheck,
  UserPlus,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useToast } from '@/context/ToastContext';
import { canEditFinance, canManageAdmin } from '@/lib/rbac';
import { formatDateTime, formatDecimalInput, getTodayIso, parseDecimal } from '@/lib/format';
import {
  EmptyState,
  ErrorBanner,
  Modal,
  SlideOver,
  StatusPill,
  TableSkeleton,
} from '@/components/ui/Primitives';
import type {
  AuditLogDTO,
  CurrencyCode,
  CursorPage,
  DbUserRole,
  ExchangeRateDTO,
  SystemSettingsDTO,
  UserDTO,
} from '@/types/hq';

type AdminTab = 'users' | 'fx' | 'settings' | 'audit';

const DB_ROLES: DbUserRole[] = ['ADMIN', 'FINANCE', 'CMS_EDITOR', 'CRM_MANAGER', 'VIEWER'];

export default function AdminPage() {
  const { user } = useAuth();
  const { thbToMmkRate, refreshFx } = useCurrency();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();

  const isAdmin = canManageAdmin(user);
  const isFinance = canEditFinance(user);

  const requestedTab = (searchParams.get('tab') as AdminTab) || (isAdmin ? 'users' : 'fx');
  const [activeTab, setActiveTab] = useState<AdminTab>(
    !isAdmin && requestedTab !== 'fx' ? 'fx' : requestedTab
  );

  const [error, setError] = useState<string | null>(null);

  // Users
  const [users, setUsers] = useState<UserDTO[]>([]);
  const [usersLoading, setUsersLoading] = useState(false);
  const [userModalOpen, setUserModalOpen] = useState(false);
  const [editingUser, setEditingUser] = useState<UserDTO | null>(null);
  const [userForm, setUserForm] = useState({
    email: '',
    name: '',
    password: '',
    role: 'FINANCE' as DbUserRole,
    status: 'ACTIVE' as 'ACTIVE' | 'DISABLED',
  });
  const [userSaving, setUserSaving] = useState(false);

  // FX Rates
  const [fxRates, setFxRates] = useState<ExchangeRateDTO[]>([]);
  const [fxNextCursor, setFxNextCursor] = useState<string | null>(null);
  const [fxLoading, setFxLoading] = useState(false);
  const [fxForm, setFxForm] = useState({
    date: getTodayIso(),
    rate: '',
    source: 'Market Mid-Rate',
    notes: '',
  });
  const [fxSaving, setFxSaving] = useState(false);

  // System Settings
  const [settings, setSettings] = useState<SystemSettingsDTO | null>(null);
  const [settingsForm, setSettingsForm] = useState({
    baseCurrency: 'MMK' as CurrencyCode,
    companyLegalName: 'Thea Solutions',
    fiscalYearStartMonth: '1',
    defaultBadgeValidityDays: '365',
  });
  const [settingsSaving, setSettingsSaving] = useState(false);

  // Audit Logs
  const [auditLogs, setAuditLogs] = useState<AuditLogDTO[]>([]);
  const [auditCursor, setAuditCursor] = useState<string | null>(null);
  const [auditLoading, setAuditLoading] = useState(false);
  const [auditResourceFilter, setAuditResourceFilter] = useState('');
  const [auditActionFilter, setAuditActionFilter] = useState('');
  const [selectedAudit, setSelectedAudit] = useState<AuditLogDTO | null>(null);

  const switchTab = (tab: AdminTab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const loadUsers = useCallback(async () => {
    if (!isAdmin) return;
    setUsersLoading(true);
    try {
      const res = await apiRequest<CursorPage<UserDTO>>('/api/v1/admin/users?limit=100');
      setUsers(res.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load internal users.');
    } finally {
      setUsersLoading(false);
    }
  }, [isAdmin]);

  const loadFxRates = useCallback(async (cursor?: string) => {
    setFxLoading(true);
    try {
      const params = new URLSearchParams({ limit: '100' });
      if (cursor) params.set('cursor', cursor);
      const res = await apiRequest<CursorPage<ExchangeRateDTO>>(
        `/api/v1/accounting/fx-rates?${params.toString()}`
      );
      setFxRates((prev) => (cursor ? [...prev, ...(res.items || [])] : res.items || []));
      setFxNextCursor(res.nextCursor);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load FX rates.');
    } finally {
      setFxLoading(false);
    }
  }, []);

  const loadSettings = useCallback(async () => {
    if (!isAdmin) return;
    try {
      const res = await apiRequest<SystemSettingsDTO>('/api/v1/admin/settings');
      setSettings(res);
      setSettingsForm({
        baseCurrency: res.baseCurrency || 'MMK',
        companyLegalName: res.companyLegalName || 'Thea Solutions',
        fiscalYearStartMonth: String(res.fiscalYearStartMonth || 1),
        defaultBadgeValidityDays: String(res.defaultBadgeValidityDays || 365),
      });
    } catch {
      // Non-admin roles cannot fetch settings
    }
  }, [isAdmin]);

  const loadAuditLogs = useCallback(
    async (cursor?: string) => {
      if (!isAdmin) return;
      setAuditLoading(true);
      try {
        const params = new URLSearchParams({ limit: '30' });
        if (auditResourceFilter) params.set('resourceType', auditResourceFilter);
        if (auditActionFilter) params.set('action', auditActionFilter);
        if (cursor) params.set('cursor', cursor);

        const res = await apiRequest<CursorPage<AuditLogDTO>>(
          `/api/v1/admin/audit-logs?${params.toString()}`
        );
        setAuditLogs((prev) => (cursor ? [...prev, ...(res.items || [])] : res.items || []));
        setAuditCursor(res.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load audit logs.');
      } finally {
        setAuditLoading(false);
      }
    },
    [isAdmin, auditResourceFilter, auditActionFilter]
  );

  useEffect(() => {
    if (activeTab === 'users') {
      void loadUsers();
    } else if (activeTab === 'fx') {
      void loadFxRates();
      void loadSettings();
    } else if (activeTab === 'settings') {
      void loadSettings();
    } else if (activeTab === 'audit') {
      void loadAuditLogs();
    }
  }, [activeTab, loadUsers, loadFxRates, loadSettings, loadAuditLogs]);

  // User CRUD
  const handleSaveUser = async (event: React.FormEvent) => {
    event.preventDefault();
    setUserSaving(true);
    try {
      if (editingUser) {
        const patch: Record<string, unknown> = {
          name: userForm.name.trim(),
          role: userForm.role,
          status: userForm.status,
          version: editingUser.version,
        };
        if (userForm.password.trim()) {
          patch.password = userForm.password.trim();
        }
        await apiRequest(`/api/v1/admin/users/${editingUser.id}`, {
          method: 'PATCH',
          body: patch,
        });
        pushToast({ variant: 'success', title: 'User updated' });
      } else {
        if (userForm.password.length < 12) {
          pushToast({ variant: 'error', title: 'Password must be at least 12 characters' });
          setUserSaving(false);
          return;
        }
        await apiRequest('/api/v1/admin/users', {
          method: 'POST',
          body: {
            email: userForm.email.trim().toLowerCase(),
            name: userForm.name.trim(),
            password: userForm.password,
            role: userForm.role,
          },
        });
        pushToast({ variant: 'success', title: 'Internal user created' });
      }
      setUserModalOpen(false);
      await loadUsers();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'User save failed',
        description: err instanceof ApiError ? err.message : 'Unable to save user.',
      });
    } finally {
      setUserSaving(false);
    }
  };

  const handleToggleUserStatus = async (u: UserDTO) => {
    const nextStatus = u.status === 'ACTIVE' ? 'DISABLED' : 'ACTIVE';
    try {
      await apiRequest(`/api/v1/admin/users/${u.id}`, {
        method: 'PATCH',
        body: { status: nextStatus, version: u.version },
      });
      pushToast({ variant: 'success', title: `User ${nextStatus.toLowerCase()}` });
      await loadUsers();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Status update failed',
        description: err instanceof ApiError ? err.message : 'Unable to toggle user status.',
      });
    }
  };

  // FX Rate Upsert
  const handleSaveFx = async (event: React.FormEvent) => {
    event.preventDefault();
    const numeric = parseDecimal(fxForm.rate);
    if (numeric <= 0) {
      pushToast({ variant: 'error', title: 'Enter a valid positive exchange rate' });
      return;
    }

    setFxSaving(true);
    try {
      const existing = fxRates.find(
        (r) => r.date === fxForm.date && r.fromCurrency === 'THB' && r.toCurrency === 'MMK'
      );
      if (existing) {
        await apiRequest(`/api/v1/accounting/fx-rates/${existing.id}`, {
          method: 'PUT',
          body: {
            rate: formatDecimalInput(numeric, 6),
            source: fxForm.source.trim() || 'Market Reference',
            notes: fxForm.notes.trim() || undefined,
          },
        });
        pushToast({
          variant: 'success',
          title: `Updated FX rate for ${fxForm.date}`,
          description: `1 THB = ${numeric.toFixed(2)} MMK`,
        });
      } else {
        await apiRequest('/api/v1/accounting/fx-rates', {
          method: 'POST',
          body: {
            date: fxForm.date,
            fromCurrency: 'THB',
            toCurrency: 'MMK',
            rate: formatDecimalInput(numeric, 6),
            source: fxForm.source.trim() || 'Market Reference',
            notes: fxForm.notes.trim() || undefined,
          },
        });
        pushToast({
          variant: 'success',
          title: `Logged FX rate for ${fxForm.date}`,
          description: `1 THB = ${numeric.toFixed(2)} MMK`,
        });
      }
      setFxForm({ ...fxForm, rate: '', notes: '' });
      await Promise.all([loadFxRates(), refreshFx()]);
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'FX rate save failed',
        description: err instanceof ApiError ? err.message : 'Unable to store FX rate.',
      });
    } finally {
      setFxSaving(false);
    }
  };

  // System Settings Save
  const handleSaveSettings = async (overrideBaseCurrency?: CurrencyCode) => {
    if (!isAdmin || !settings) return;
    setSettingsSaving(true);
    try {
      const nextBase = overrideBaseCurrency || settingsForm.baseCurrency;
      const updated = await apiRequest<SystemSettingsDTO>('/api/v1/admin/settings', {
        method: 'PUT',
        body: {
          baseCurrency: nextBase,
          companyLegalName: settingsForm.companyLegalName.trim(),
          fiscalYearStartMonth: Number.parseInt(settingsForm.fiscalYearStartMonth, 10) || 1,
          defaultBadgeValidityDays: Number.parseInt(settingsForm.defaultBadgeValidityDays, 10) || 365,
          version: settings.version,
        },
      });
      setSettings(updated);
      setSettingsForm((prev) => ({ ...prev, baseCurrency: updated.baseCurrency }));
      await refreshFx();
      pushToast({
        variant: 'success',
        title: 'System settings saved',
        description: `Base reporting currency is ${updated.baseCurrency}.`,
      });
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Settings save failed',
        description: err instanceof ApiError ? err.message : 'Unable to save system settings.',
      });
    } finally {
      setSettingsSaving(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="font-ds-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-hq-textPrimary">
          Administration
        </h1>
        <p className="mt-1 text-sm text-hq-textSecondary">
          Governance controls for internal RBAC users, daily THB/MMK FX rates, workspace settings, and immutable audit trails.
        </p>
      </div>

      {/* Sub-Tabs */}
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-hq-borderSubtle">
        {isAdmin && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'users'}
            onClick={() => switchTab('users')}
            className={`border-b-2 px-4 py-2.5 text-xs font-medium ${
              activeTab === 'users'
                ? 'border-hq-brandVibrant text-hq-textPrimary'
                : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
            }`}
          >
            Users &amp; RBAC
          </button>
        )}
        {isFinance && (
          <button
            type="button"
            role="tab"
            aria-selected={activeTab === 'fx'}
            onClick={() => switchTab('fx')}
            className={`border-b-2 px-4 py-2.5 text-xs font-medium ${
              activeTab === 'fx'
                ? 'border-hq-brandVibrant text-hq-textPrimary'
                : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
            }`}
          >
            Currency &amp; Daily FX Rates
          </button>
        )}
        {isAdmin && (
          <>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'settings'}
              onClick={() => switchTab('settings')}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium ${
                activeTab === 'settings'
                  ? 'border-hq-brandVibrant text-hq-textPrimary'
                  : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
              }`}
            >
              System Settings
            </button>
            <button
              type="button"
              role="tab"
              aria-selected={activeTab === 'audit'}
              onClick={() => switchTab('audit')}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium ${
                activeTab === 'audit'
                  ? 'border-hq-brandVibrant text-hq-textPrimary'
                  : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
              }`}
            >
              Audit Logs
            </button>
          </>
        )}
      </div>

      {error && <ErrorBanner message={error} />}

      {/* TAB 1: USERS & RBAC */}
      {activeTab === 'users' && isAdmin && (
        <div className="space-y-4">
          {/* Protected Static Super Admin Card */}
          <div className="hq-card border-hq-brand/60 p-5 flex flex-wrap items-center justify-between gap-4">
            <div className="flex items-center gap-3.5">
              <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-hq-brand text-white">
                <Crown className="h-5 w-5" />
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <p className="font-ds-display text-base font-semibold text-hq-textPrimary">
                    {user?.isStaticSuperAdmin ? user.name : 'Static Super Admin'}
                  </p>
                  <StatusPill tone="brand">
                    <Crown className="h-3 w-3" /> SUPER ADMIN
                  </StatusPill>
                  <StatusPill tone="neutral">
                    <Lock className="h-3 w-3" /> Static Root
                  </StatusPill>
                </div>
                <p className="mt-0.5 text-xs text-hq-textSecondary">
                  Provisioned via server environment policy with unrestricted wildcard permissions. Protected from modification or deactivation.
                </p>
              </div>
            </div>
            <button
              type="button"
              disabled
              title="Static Super Admin is locked by environment policy and cannot be modified or removed."
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Protected
            </button>
          </div>

          <div className="flex items-center justify-between">
            <h2 className="font-ds-display text-base font-semibold">Internal Staff Accounts</h2>
            <button
              type="button"
              onClick={() => {
                setEditingUser(null);
                setUserForm({
                  email: '',
                  name: '',
                  password: '',
                  role: 'FINANCE',
                  status: 'ACTIVE',
                });
                setUserModalOpen(true);
              }}
              className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
            >
              <UserPlus className="h-3.5 w-3.5" />
              Create User
            </button>
          </div>

          <div className="hq-card overflow-hidden">
            {usersLoading ? (
              <TableSkeleton rows={5} cols={5} />
            ) : users.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<ShieldCheck className="h-5 w-5" />}
                  title="No Database Staff Accounts Yet"
                  description="Create role-scoped accounts for Finance, CMS Editors, CRM Managers, or Viewers."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[700px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase text-hq-textMuted">
                      <th className="px-4 py-3">User</th>
                      <th className="px-4 py-3">Role</th>
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Last Login</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle text-sm">
                    {users.map((u) => (
                      <tr key={u.id} className="hover:bg-hq-elevated/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-hq-textPrimary">{u.name}</p>
                          <p className="font-ds-mono text-[11px] text-hq-textMuted">{u.email}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone="brand">{u.role}</StatusPill>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={u.status === 'ACTIVE' ? 'in' : 'out'}>
                            {u.status}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3 font-ds-mono text-xs text-hq-textSecondary">
                          {formatDateTime(u.lastLoginAt)}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingUser(u);
                                setUserForm({
                                  email: u.email,
                                  name: u.name,
                                  password: '',
                                  role: u.role,
                                  status: u.status,
                                });
                                setUserModalOpen(true);
                              }}
                              className="rounded border border-hq-borderDefault px-2.5 py-1 text-xs hover:bg-hq-elevated"
                            >
                              Edit
                            </button>
                            <button
                              type="button"
                              onClick={() => void handleToggleUserStatus(u)}
                              className={`rounded border px-2.5 py-1 text-xs ${
                                u.status === 'ACTIVE'
                                  ? 'border-hq-out/40 text-hq-out hover:bg-hq-outBg'
                                  : 'border-hq-in/40 text-hq-in hover:bg-hq-inBg'
                              }`}
                            >
                              {u.status === 'ACTIVE' ? 'Disable' : 'Enable'}
                            </button>
                          </div>
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

      {/* TAB 2: CURRENCY & DAILY FX */}
      {activeTab === 'fx' && isFinance && (
        <div className="space-y-5">
          <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
            {/* Log Daily FX Rate Form */}
            <form onSubmit={handleSaveFx} className="hq-card p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-ds-display text-base font-semibold">Log Daily THB → MMK Rate</h2>
                <ArrowLeftRight className="h-4 w-4 text-hq-brandSoft" />
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Effective Date *
                  </label>
                  <input
                    type="date"
                    required
                    value={fxForm.date}
                    onChange={(e) => setFxForm({ ...fxForm, date: e.target.value })}
                    className="hq-input h-10 w-full px-3 font-ds-mono text-xs tabular-nums"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                    Rate (MMK per 1 THB) *
                  </label>
                  <input
                    type="number"
                    step="0.0001"
                    min="0.0001"
                    required
                    value={fxForm.rate}
                    onChange={(e) => setFxForm({ ...fxForm, rate: e.target.value })}
                    placeholder={thbToMmkRate.toFixed(2)}
                    className="hq-input h-10 w-full px-3 text-right font-ds-mono text-sm tabular-nums"
                  />
                </div>
              </div>

              <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Source *</label>
                  <input
                    type="text"
                    required
                    value={fxForm.source}
                    onChange={(e) => setFxForm({ ...fxForm, source: e.target.value })}
                    className="hq-input h-10 w-full px-3 text-sm"
                  />
                </div>
                <div>
                  <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Notes</label>
                  <input
                    type="text"
                    value={fxForm.notes}
                    onChange={(e) => setFxForm({ ...fxForm, notes: e.target.value })}
                    placeholder="Morning desk reference"
                    className="hq-input h-10 w-full px-3 text-sm"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={fxSaving}
                className="hq-btn-primary inline-flex h-10 items-center gap-1.5 px-5 text-xs"
              >
                <Plus className="h-4 w-4" />
                <span>{fxSaving ? 'Saving Rate...' : 'Save Daily FX Rate'}</span>
              </button>
            </form>

            {/* Active Rate & Base Currency Card */}
            <div className="hq-card p-5 flex flex-col justify-between space-y-4">
              <div>
                <p className="font-ds-mono text-[11px] uppercase tracking-wider text-hq-brandSoft">
                  Active Portal Exchange Rate
                </p>
                <p className="mt-3 font-ds-mono text-3xl font-semibold tabular-nums text-hq-textPrimary">
                  1 THB = {thbToMmkRate.toFixed(2)} MMK
                </p>
                <p className="mt-1 font-ds-mono text-xs tabular-nums text-hq-textSecondary">
                  Inverse: 1 MMK = {(1 / thbToMmkRate).toFixed(6)} THB
                </p>
              </div>

              {isAdmin && settings && (
                <div className="border-t border-hq-borderSubtle pt-4 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold text-hq-textPrimary">
                      Base Accounting Currency
                    </p>
                    <p className="text-xs text-hq-textSecondary">
                      Controls ledger base currency stamped on posted journals
                    </p>
                  </div>
                  <div className="inline-flex rounded-full border border-hq-borderDefault bg-hq-subtle p-0.5">
                    {(['MMK', 'THB'] as CurrencyCode[]).map((code) => (
                      <button
                        key={code}
                        type="button"
                        disabled={settingsSaving}
                        onClick={() => void handleSaveSettings(code)}
                        className={`rounded-full px-3.5 py-1 font-ds-mono text-xs font-semibold ${
                          settings.baseCurrency === code
                            ? 'bg-hq-brand text-white'
                            : 'text-hq-textSecondary hover:text-hq-textPrimary'
                        }`}
                      >
                        {code}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Historical FX Table */}
          <div className="hq-card overflow-hidden">
            <div className="border-b border-hq-borderSubtle px-5 py-3.5 flex flex-wrap items-center justify-between gap-2">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="font-ds-display text-base font-semibold">FX Rate History</h2>
                  <StatusPill tone="neutral">{fxRates.length} rates</StatusPill>
                </div>
                <p className="mt-0.5 text-xs text-hq-textSecondary">
                  Each journal entry locks immutably to its entry date&apos;s exchange rate; logging new rates never alters historical records.
                </p>
              </div>
            </div>
            {fxLoading && fxRates.length === 0 ? (
              <TableSkeleton rows={5} cols={6} />
            ) : fxRates.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<ArrowLeftRight className="h-5 w-5" />}
                  title="No FX Rates Logged"
                  description="Add today's THB to MMK exchange rate above before posting cross-currency journals."
                />
              </div>
            ) : (
              <>
                <div className="hq-scroll-table h-[320px] max-h-[320px]">
                  <table className="w-full min-w-[680px] border-separate border-spacing-0 text-left">
                    <thead>
                      <tr className="font-ds-mono text-[11px] uppercase text-hq-textMuted">
                        <th className="sticky top-0 z-10 border-b border-hq-borderDefault bg-hq-subtle px-4 py-3 whitespace-nowrap">
                          Effective Date
                        </th>
                        <th className="sticky top-0 z-10 border-b border-hq-borderDefault bg-hq-subtle px-4 py-3 whitespace-nowrap">
                          Pair
                        </th>
                        <th className="sticky top-0 z-10 border-b border-hq-borderDefault bg-hq-subtle px-4 py-3 text-right whitespace-nowrap">
                          Rate
                        </th>
                        <th className="sticky top-0 z-10 border-b border-hq-borderDefault bg-hq-subtle px-4 py-3 text-right whitespace-nowrap">
                          Delta vs Prev
                        </th>
                        <th className="sticky top-0 z-10 border-b border-hq-borderDefault bg-hq-subtle px-4 py-3 whitespace-nowrap">
                          Source
                        </th>
                        <th className="sticky top-0 z-10 border-b border-hq-borderDefault bg-hq-subtle px-4 py-3">
                          Notes
                        </th>
                      </tr>
                    </thead>
                    <tbody className="text-sm">
                      {fxRates.map((row, idx) => {
                        const prev = fxRates[idx + 1];
                        const currVal = parseDecimal(row.rate);
                        const prevVal = prev ? parseDecimal(prev.rate) : null;
                        const delta = prevVal !== null ? currVal - prevVal : null;
                        return (
                          <tr key={row.id} className="hover:bg-hq-elevated/50">
                            <td className="border-b border-hq-borderSubtle px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textPrimary whitespace-nowrap">
                              {row.date}
                            </td>
                            <td className="border-b border-hq-borderSubtle px-4 py-3 font-ds-mono text-xs text-hq-brandSoft whitespace-nowrap">
                              {row.fromCurrency} → {row.toCurrency}
                            </td>
                            <td className="border-b border-hq-borderSubtle px-4 py-3 text-right font-ds-mono text-xs font-semibold tabular-nums whitespace-nowrap">
                              {currVal.toFixed(4)}
                            </td>
                            <td
                              className={`border-b border-hq-borderSubtle px-4 py-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap ${
                                delta === null
                                  ? 'text-hq-textMuted'
                                  : delta >= 0
                                    ? 'text-hq-in'
                                    : 'text-hq-out'
                              }`}
                            >
                              {delta === null ? '--' : `${delta >= 0 ? '+' : ''}${delta.toFixed(2)}`}
                            </td>
                            <td className="border-b border-hq-borderSubtle px-4 py-3 text-xs text-hq-textSecondary whitespace-nowrap">
                              {row.source}
                            </td>
                            <td className="border-b border-hq-borderSubtle px-4 py-3 text-xs text-hq-textMuted">
                              {row.notes || '--'}
                            </td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
                <div className="flex items-center justify-between border-t border-hq-borderSubtle bg-hq-subtle/50 px-5 py-2.5 text-xs text-hq-textMuted">
                  <span>Showing {fxRates.length} daily rates · Scroll inside table to browse history</span>
                  {fxNextCursor && (
                    <button
                      type="button"
                      disabled={fxLoading}
                      onClick={() => void loadFxRates(fxNextCursor)}
                      className="hq-btn-secondary h-7 px-3 text-[11px]"
                    >
                      {fxLoading ? 'Loading...' : 'Load Older Rates'}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: SYSTEM SETTINGS */}
      {activeTab === 'settings' && isAdmin && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          <div className="hq-card p-5 space-y-4">
            <div className="flex items-center gap-2">
              <Settings2 className="h-4 w-4 text-hq-brandSoft" />
              <h2 className="font-ds-display text-base font-semibold">Organization &amp; Ledger Defaults</h2>
            </div>

            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Company Legal Name
              </label>
              <input
                type="text"
                value={settingsForm.companyLegalName}
                onChange={(e) =>
                  setSettingsForm({ ...settingsForm, companyLegalName: e.target.value })
                }
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>

            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                  Base Currency
                </label>
                <select
                  value={settingsForm.baseCurrency}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      baseCurrency: e.target.value as CurrencyCode,
                    })
                  }
                  className="hq-input h-10 w-full px-3 font-ds-mono text-sm"
                >
                  <option value="MMK">MMK</option>
                  <option value="THB">THB</option>
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                  Fiscal Year Start Month
                </label>
                <input
                  type="number"
                  min="1"
                  max="12"
                  value={settingsForm.fiscalYearStartMonth}
                  onChange={(e) =>
                    setSettingsForm({ ...settingsForm, fiscalYearStartMonth: e.target.value })
                  }
                  className="hq-input h-10 w-full px-3 font-ds-mono text-sm tabular-nums"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                  Default Badge Validity (Days)
                </label>
                <input
                  type="number"
                  min="30"
                  max="1825"
                  value={settingsForm.defaultBadgeValidityDays}
                  onChange={(e) =>
                    setSettingsForm({
                      ...settingsForm,
                      defaultBadgeValidityDays: e.target.value,
                    })
                  }
                  className="hq-input h-10 w-full px-3 font-ds-mono text-sm tabular-nums"
                />
              </div>
            </div>

            <button
              type="button"
              disabled={settingsSaving || !settings}
              onClick={() => void handleSaveSettings()}
              className="hq-btn-primary inline-flex h-10 items-center gap-1.5 px-5 text-xs"
            >
              <Save className="h-4 w-4" />
              <span>{settingsSaving ? 'Saving...' : 'Save System Settings'}</span>
            </button>
          </div>

          <div className="hq-card p-5 space-y-3">
            <h2 className="font-ds-display text-base font-semibold">
              Public Website Integration Endpoints
            </h2>
            <p className="text-xs text-hq-textSecondary">
              Endpoints consumed by <span className="font-ds-mono text-hq-brandSoft">theasolutions.co</span> with graceful static fallback.
            </p>
            <div className="space-y-2.5 font-ds-mono text-xs">
              {[
                ['GET', '/api/v1/public/cms/:section', 'Cached 60s · Live CMS sections'],
                ['GET', '/api/v1/public/associates/:slug', 'Cached 60s · Digital business cards'],
                ['GET', '/api/v1/public/verify/:employeeId', 'no-store · Instant badge verification'],
                ['POST', '/api/v1/public/leads/ingest', 'X-HQ-Ingest-Key · Website form CRM intake'],
              ].map(([method, path, note]) => (
                <div
                  key={path}
                  className="rounded-lg border border-hq-borderSubtle bg-hq-subtle px-3 py-2.5"
                >
                  <div className="flex items-center gap-2">
                    <StatusPill tone={method === 'POST' ? 'brand' : 'in'}>{method}</StatusPill>
                    <span className="text-hq-textPrimary break-all">{path}</span>
                  </div>
                  <p className="mt-1 font-sans text-[11px] text-hq-textMuted">{note}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* TAB 4: AUDIT LOGS */}
      {activeTab === 'audit' && isAdmin && (
        <div className="space-y-4">
          <div className="hq-card p-4 flex flex-wrap items-center gap-3">
            <select
              value={auditResourceFilter}
              onChange={(e) => setAuditResourceFilter(e.target.value)}
              className="hq-input h-9 px-3 text-xs"
            >
              <option value="">All Resources</option>
              <option value="journal_entry">Journal Entry</option>
              <option value="coa_account">COA Account</option>
              <option value="exchange_rate">Exchange Rate</option>
              <option value="associate">Associate</option>
              <option value="cms_document">CMS Document</option>
              <option value="crm_lead">CRM Lead</option>
              <option value="crm_deal">CRM Deal</option>
              <option value="user">User</option>
              <option value="system_settings">System Settings</option>
            </select>

            <input
              type="text"
              value={auditActionFilter}
              onChange={(e) => setAuditActionFilter(e.target.value.toUpperCase())}
              placeholder="Filter action (e.g. JOURNAL_POSTED)"
              className="hq-input h-9 w-64 px-3 font-ds-mono text-xs uppercase"
            />
          </div>

          <div className="hq-card overflow-hidden">
            {auditLoading && auditLogs.length === 0 ? (
              <TableSkeleton rows={6} cols={5} />
            ) : auditLogs.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<FileSearch className="h-5 w-5" />}
                  title="No Matching Audit Records"
                  description="Every mutating internal action appends an immutable record here."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase text-hq-textMuted">
                      <th className="px-4 py-3">Timestamp</th>
                      <th className="px-4 py-3">Actor</th>
                      <th className="px-4 py-3">Action</th>
                      <th className="px-4 py-3">Resource</th>
                      <th className="px-4 py-3 text-right">Diff</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle text-sm">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-hq-elevated/50">
                        <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textSecondary">
                          {formatDateTime(log.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="text-xs font-medium text-hq-textPrimary">{log.actorEmail}</p>
                          <p className="font-ds-mono text-[10px] text-hq-textMuted">{log.actorRole}</p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone="brand">{log.action}</StatusPill>
                        </td>
                        <td className="px-4 py-3 font-ds-mono text-xs text-hq-textSecondary">
                          {log.resourceType} · {log.resourceId}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <button
                            type="button"
                            onClick={() => setSelectedAudit(log)}
                            className="rounded border border-hq-borderDefault px-2.5 py-1 text-xs hover:bg-hq-elevated"
                          >
                            Inspect JSON
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            {auditCursor && (
              <div className="border-t border-hq-borderSubtle p-3 text-center">
                <button
                  type="button"
                  disabled={auditLoading}
                  onClick={() => void loadAuditLogs(auditCursor)}
                  className="hq-btn-secondary h-9 px-5 text-xs"
                >
                  {auditLoading ? 'Loading...' : 'Load Older Audit Entries'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* User Modal */}
      <Modal
        open={userModalOpen}
        onClose={() => setUserModalOpen(false)}
        title={editingUser ? `Edit User: ${editingUser.email}` : 'Create Internal Staff Account'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setUserModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="admin-user-form"
              disabled={userSaving}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {userSaving ? 'Saving...' : 'Save User'}
            </button>
          </>
        }
      >
        <form id="admin-user-form" onSubmit={handleSaveUser} className="space-y-4">
          {!editingUser && (
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Work Email *
              </label>
              <input
                type="email"
                required
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                placeholder="finance@theasolutions.co"
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Full Name *</label>
            <input
              type="text"
              required
              value={userForm.name}
              onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">RBAC Role *</label>
              <select
                value={userForm.role}
                onChange={(e) => setUserForm({ ...userForm, role: e.target.value as DbUserRole })}
                className="hq-input h-10 w-full px-3 font-ds-mono text-xs"
              >
                {DB_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {r}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                {editingUser ? 'Reset Password (Optional)' : 'Initial Password (min 12 chars) *'}
              </label>
              <input
                type="password"
                required={!editingUser}
                minLength={editingUser ? undefined : 12}
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Audit Diff Slide-Over */}
      <SlideOver
        open={Boolean(selectedAudit)}
        onClose={() => setSelectedAudit(null)}
        title={selectedAudit?.action || 'Audit Entry'}
        subtitle={
          selectedAudit
            ? `${selectedAudit.resourceType} · ${selectedAudit.resourceId}`
            : undefined
        }
        widthClass="max-w-[620px]"
      >
        {selectedAudit && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-hq-borderSubtle bg-hq-subtle p-4 text-xs">
              <div>
                <p className="text-hq-textMuted">Actor</p>
                <p className="font-ds-mono text-hq-textPrimary">{selectedAudit.actorEmail}</p>
              </div>
              <div>
                <p className="text-hq-textMuted">Role</p>
                <p className="font-ds-mono text-hq-brandSoft">{selectedAudit.actorRole}</p>
              </div>
              <div>
                <p className="text-hq-textMuted">IP Address</p>
                <p className="font-ds-mono text-hq-textPrimary">{selectedAudit.ipAddress || '--'}</p>
              </div>
              <div>
                <p className="text-hq-textMuted">Request ID</p>
                <p className="font-ds-mono text-hq-textPrimary truncate">{selectedAudit.requestId}</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 font-ds-mono text-[11px] uppercase text-hq-out">
                Before Snapshot
              </p>
              <pre className="max-h-60 overflow-auto rounded-xl border border-hq-borderSubtle bg-hq-subtle p-3.5 font-ds-mono text-[11px] text-hq-textSecondary">
                {JSON.stringify(selectedAudit.beforeSnapshot, null, 2)}
              </pre>
            </div>

            <div>
              <p className="mb-1.5 font-ds-mono text-[11px] uppercase text-hq-in">
                After Snapshot
              </p>
              <pre className="max-h-60 overflow-auto rounded-xl border border-hq-borderSubtle bg-hq-subtle p-3.5 font-ds-mono text-[11px] text-hq-textSecondary">
                {JSON.stringify(selectedAudit.afterSnapshot, null, 2)}
              </pre>
            </div>
          </div>
        )}
      </SlideOver>
    </div>
  );
}
