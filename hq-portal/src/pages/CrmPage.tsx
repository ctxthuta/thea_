import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  ArrowRight,
  Briefcase,
  Building2,
  Inbox,
  Kanban,
  Plus,
  Table2,
  UserCheck,
  Users,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useToast } from '@/context/ToastContext';
import { canEditCrm } from '@/lib/rbac';
import {
  formatDateShort,
  formatDecimalInput,
  formatMoney,
  parseDecimal,
} from '@/lib/format';
import {
  EmptyState,
  ErrorBanner,
  Modal,
  SlideOver,
  StatusPill,
  TableSkeleton,
} from '@/components/ui/Primitives';
import DriveSyncSection from '@/pages/crm/DriveSyncSection';
import type {
  CrmAccountDTO,
  CrmAccountStatus,
  CrmContactDTO,
  CrmDealDTO,
  CrmLeadDTO,
  CurrencyCode,
  CursorPage,
  DealStage,
  LeadSource,
  LeadStatus,
} from '@/types/hq';

type CrmTab = 'pipeline' | 'accounts' | 'leads';

const DEAL_STAGES: Array<{ key: DealStage; label: string; defaultProb: number }> = [
  { key: 'DISCOVERY', label: 'Discovery', defaultProb: 20 },
  { key: 'SCOPING', label: 'Scoping', defaultProb: 40 },
  { key: 'PROPOSAL', label: 'Proposal', defaultProb: 60 },
  { key: 'NEGOTIATION', label: 'Negotiation', defaultProb: 80 },
  { key: 'WON', label: 'Won', defaultProb: 100 },
  { key: 'LOST', label: 'Lost', defaultProb: 0 },
];

export default function CrmPage() {
  const { user } = useAuth();
  const { displayCurrency, formatInDisplay, convertToDisplay } = useCurrency();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const editable = canEditCrm(user);

  const initialTab = (searchParams.get('tab') as CrmTab) || 'pipeline';
  const [activeTab, setActiveTab] = useState<CrmTab>(
    ['pipeline', 'accounts', 'leads'].includes(initialTab) ? initialTab : 'pipeline'
  );
  const [pipelineView, setPipelineView] = useState<'board' | 'table'>('board');

  const [deals, setDeals] = useState<CrmDealDTO[]>([]);
  const [accounts, setAccounts] = useState<CrmAccountDTO[]>([]);
  const [contacts, setContacts] = useState<CrmContactDTO[]>([]);
  const [leads, setLeads] = useState<CrmLeadDTO[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Lead Filters & Detail
  const [leadSourceFilter, setLeadSourceFilter] = useState<'ALL' | LeadSource>('ALL');
  const [leadStatusFilter, setLeadStatusFilter] = useState<'ALL' | LeadStatus>('ALL');
  const [inspectLead, setInspectLead] = useState<CrmLeadDTO | null>(null);

  // Convert Lead Modal
  const [convertLead, setConvertLead] = useState<CrmLeadDTO | null>(null);
  const [convertForm, setConvertForm] = useState({
    accountName: '',
    dealTitle: '',
    currency: 'MMK' as CurrencyCode,
    estimatedValue: '15000000.00',
    expectedCloseDate: '',
  });
  const [converting, setConverting] = useState(false);

  // Deal Modal
  const [dealModalOpen, setDealModalOpen] = useState(false);
  const [editingDeal, setEditingDeal] = useState<CrmDealDTO | null>(null);
  const [dealForm, setDealForm] = useState({
    accountId: '',
    primaryContactId: '',
    title: '',
    stage: 'DISCOVERY' as DealStage,
    currency: 'MMK' as CurrencyCode,
    estimatedValue: '',
    probability: '25',
    expectedCloseDate: '',
  });
  const [dealSaving, setDealSaving] = useState(false);

  // Account Modal
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CrmAccountDTO | null>(null);
  const [accountForm, setAccountForm] = useState({
    name: '',
    website: '',
    industry: '',
    country: 'MM',
    status: 'PROSPECT' as CrmAccountStatus,
    notes: '',
  });
  const [accountSaving, setAccountSaving] = useState(false);

  // Contact Modal
  const [contactModalOpen, setContactModalOpen] = useState(false);
  const [editingContact, setEditingContact] = useState<CrmContactDTO | null>(null);
  const [contactForm, setContactForm] = useState({
    accountId: '',
    fullName: '',
    email: '',
    phone: '',
    roleTitle: '',
  });
  const [contactSaving, setContactSaving] = useState(false);

  const switchTab = (tab: CrmTab) => {
    setActiveTab(tab);
    setSearchParams({ tab }, { replace: true });
  };

  const loadAll = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [dealsRes, accountsRes, contactsRes, leadsRes] = await Promise.all([
        apiRequest<CursorPage<CrmDealDTO>>('/api/v1/crm/deals?limit=100'),
        apiRequest<CursorPage<CrmAccountDTO>>('/api/v1/crm/accounts?limit=100'),
        apiRequest<CursorPage<CrmContactDTO>>('/api/v1/crm/contacts?limit=100'),
        apiRequest<CursorPage<CrmLeadDTO>>('/api/v1/crm/leads?limit=100'),
      ]);
      setDeals(dealsRes.items || []);
      setAccounts(accountsRes.items || []);
      setContacts(contactsRes.items || []);
      setLeads(leadsRes.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load CRM pipeline data.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  const accountMap = useMemo(() => {
    const map = new Map<string, CrmAccountDTO>();
    accounts.forEach((a) => map.set(a.id, a));
    return map;
  }, [accounts]);

  const weightedPipelineDisplay = useMemo(() => {
    return deals
      .filter((d) => d.stage !== 'LOST')
      .reduce(
        (sum, deal) =>
          sum + convertToDisplay(deal.estimatedValue, deal.currency) * (deal.probability / 100),
        0
      );
  }, [deals, convertToDisplay]);

  const filteredLeads = useMemo(() => {
    return leads.filter((l) => {
      if (leadSourceFilter !== 'ALL' && l.source !== leadSourceFilter) return false;
      if (leadStatusFilter !== 'ALL' && l.status !== leadStatusFilter) return false;
      return true;
    });
  }, [leads, leadSourceFilter, leadStatusFilter]);

  // Deal Actions
  const openCreateDeal = () => {
    setEditingDeal(null);
    setDealForm({
      accountId: accounts[0]?.id || '',
      primaryContactId: '',
      title: '',
      stage: 'DISCOVERY',
      currency: displayCurrency,
      estimatedValue: '',
      probability: '25',
      expectedCloseDate: '',
    });
    setDealModalOpen(true);
  };

  const openEditDeal = (deal: CrmDealDTO) => {
    setEditingDeal(deal);
    setDealForm({
      accountId: deal.accountId,
      primaryContactId: deal.primaryContactId || '',
      title: deal.title,
      stage: deal.stage,
      currency: deal.currency,
      estimatedValue: deal.estimatedValue,
      probability: String(deal.probability),
      expectedCloseDate: deal.expectedCloseDate || '',
    });
    setDealModalOpen(true);
  };

  const handleSaveDeal = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!dealForm.accountId || !dealForm.title.trim()) {
      pushToast({ variant: 'error', title: 'Select an account and provide a deal title' });
      return;
    }
    const val = parseDecimal(dealForm.estimatedValue);
    setDealSaving(true);
    try {
      if (editingDeal) {
        await apiRequest(`/api/v1/crm/deals/${editingDeal.id}`, {
          method: 'PATCH',
          body: {
            stage: dealForm.stage,
            estimatedValue: formatDecimalInput(val, 2),
            probability: Number.parseInt(dealForm.probability, 10) || 0,
            expectedCloseDate: dealForm.expectedCloseDate || undefined,
            version: editingDeal.version,
          },
        });
        pushToast({ variant: 'success', title: 'Deal updated' });
      } else {
        await apiRequest('/api/v1/crm/deals', {
          method: 'POST',
          body: {
            accountId: dealForm.accountId,
            primaryContactId: dealForm.primaryContactId || undefined,
            title: dealForm.title.trim(),
            stage: dealForm.stage,
            currency: dealForm.currency,
            estimatedValue: formatDecimalInput(val, 2),
            probability: Number.parseInt(dealForm.probability, 10) || 25,
            expectedCloseDate: dealForm.expectedCloseDate || undefined,
          },
        });
        pushToast({ variant: 'success', title: 'Deal created' });
      }
      setDealModalOpen(false);
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Deal save failed',
        description: err instanceof ApiError ? err.message : 'Unable to save deal.',
      });
    } finally {
      setDealSaving(false);
    }
  };

  const handleMoveStage = async (deal: CrmDealDTO, nextStage: DealStage) => {
    if (!editable || deal.stage === nextStage) return;
    const stageMeta = DEAL_STAGES.find((s) => s.key === nextStage);
    try {
      await apiRequest(`/api/v1/crm/deals/${deal.id}`, {
        method: 'PATCH',
        body: {
          stage: nextStage,
          probability: stageMeta?.defaultProb ?? deal.probability,
          version: deal.version,
        },
      });
      pushToast({
        variant: 'success',
        title: `Moved to ${stageMeta?.label || nextStage}`,
        description: deal.title,
      });
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Stage transition failed',
        description: err instanceof ApiError ? err.message : 'Unable to move deal.',
      });
    }
  };

  // Account Actions
  const handleSaveAccount = async (event: React.FormEvent) => {
    event.preventDefault();
    setAccountSaving(true);
    try {
      if (editingAccount) {
        await apiRequest(`/api/v1/crm/accounts/${editingAccount.id}`, {
          method: 'PUT',
          body: { ...accountForm, version: editingAccount.version },
        });
        pushToast({ variant: 'success', title: 'Account updated' });
      } else {
        await apiRequest('/api/v1/crm/accounts', {
          method: 'POST',
          body: accountForm,
        });
        pushToast({ variant: 'success', title: 'Account created' });
      }
      setAccountModalOpen(false);
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Account save failed',
        description: err instanceof ApiError ? err.message : 'Unable to save account.',
      });
    } finally {
      setAccountSaving(false);
    }
  };

  // Contact Actions
  const handleSaveContact = async (event: React.FormEvent) => {
    event.preventDefault();
    setContactSaving(true);
    try {
      const payload = {
        accountId: contactForm.accountId || undefined,
        fullName: contactForm.fullName.trim(),
        email: contactForm.email.trim(),
        phone: contactForm.phone.trim() || undefined,
        roleTitle: contactForm.roleTitle.trim() || undefined,
      };
      if (editingContact) {
        await apiRequest(`/api/v1/crm/contacts/${editingContact.id}`, {
          method: 'PUT',
          body: { ...payload, version: editingContact.version },
        });
        pushToast({ variant: 'success', title: 'Contact updated' });
      } else {
        await apiRequest('/api/v1/crm/contacts', {
          method: 'POST',
          body: payload,
        });
        pushToast({ variant: 'success', title: 'Contact created' });
      }
      setContactModalOpen(false);
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Contact save failed',
        description: err instanceof ApiError ? err.message : 'Unable to save contact.',
      });
    } finally {
      setContactSaving(false);
    }
  };

  // Lead Conversion
  const openConvertModal = (lead: CrmLeadDTO) => {
    setConvertLead(lead);
    const companyGuess =
      lead.company?.trim() ||
      (lead.email.includes('@') ? lead.email.split('@')[1].split('.')[0] : 'New Client');
    setConvertForm({
      accountName: companyGuess,
      dealTitle: `${companyGuess} — ${lead.source === 'WEB_DEMO_REQUEST' ? 'Enterprise AI Demo' : 'Software & Automation Scope'}`,
      currency: displayCurrency,
      estimatedValue: displayCurrency === 'MMK' ? '15000000.00' : '120000.00',
      expectedCloseDate: '',
    });
  };

  const handleConvertLead = async (event: React.FormEvent) => {
    event.preventDefault();
    if (!convertLead) return;
    setConverting(true);
    try {
      await apiRequest(`/api/v1/crm/leads/${convertLead.id}/convert`, {
        method: 'POST',
        idempotent: true,
        body: {
          accountName: convertForm.accountName.trim(),
          dealTitle: convertForm.dealTitle.trim(),
          currency: convertForm.currency,
          estimatedValue: formatDecimalInput(parseDecimal(convertForm.estimatedValue), 2),
          expectedCloseDate: convertForm.expectedCloseDate || undefined,
          version: convertLead.version,
        },
      });
      pushToast({
        variant: 'success',
        title: 'Lead converted',
        description: 'Created Account, Contact, and Pipeline Deal atomically.',
      });
      setConvertLead(null);
      await loadAll();
      switchTab('pipeline');
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Lead conversion failed',
        description: err instanceof ApiError ? err.message : 'Unable to convert lead.',
      });
    } finally {
      setConverting(false);
    }
  };

  const handleUpdateLeadStatus = async (lead: CrmLeadDTO, nextStatus: LeadStatus) => {
    try {
      await apiRequest(`/api/v1/crm/leads/${lead.id}`, {
        method: 'PATCH',
        body: { status: nextStatus, version: lead.version },
      });
      pushToast({ variant: 'success', title: `Lead marked ${nextStatus}` });
      await loadAll();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Status update failed',
        description: err instanceof ApiError ? err.message : 'Unable to update lead.',
      });
    }
  };

  const newLeadCount = leads.filter((l) => l.status === 'NEW').length;

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-ds-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-hq-textPrimary">
            CRM &amp; Revenue Pipeline
          </h1>
          <p className="mt-1 text-sm text-hq-textSecondary">
            Weighted active pipeline:{' '}
            <span className="font-ds-mono font-semibold tabular-nums text-hq-textPrimary">
              {formatMoney(weightedPipelineDisplay, displayCurrency)}
            </span>
          </p>
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            {activeTab === 'accounts' && (
              <>
                <button
                  type="button"
                  onClick={() => {
                    setEditingAccount(null);
                    setAccountForm({
                      name: '',
                      website: '',
                      industry: '',
                      country: 'MM',
                      status: 'PROSPECT',
                      notes: '',
                    });
                    setAccountModalOpen(true);
                  }}
                  className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                >
                  <Building2 className="h-3.5 w-3.5" />
                  Add Account
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingContact(null);
                    setContactForm({
                      accountId: accounts[0]?.id || '',
                      fullName: '',
                      email: '',
                      phone: '',
                      roleTitle: '',
                    });
                    setContactModalOpen(true);
                  }}
                  className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
                >
                  <Users className="h-3.5 w-3.5" />
                  Add Contact
                </button>
              </>
            )}
            <button
              type="button"
              onClick={openCreateDeal}
              className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              New Deal
            </button>
          </div>
        )}
      </div>

      {/* Sub-Tabs */}
      <div role="tablist" className="flex flex-wrap gap-1 border-b border-hq-borderSubtle">
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'pipeline'}
          onClick={() => switchTab('pipeline')}
          className={`border-b-2 px-4 py-2.5 text-xs font-medium ${
            activeTab === 'pipeline'
              ? 'border-hq-brandVibrant text-hq-textPrimary'
              : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
          }`}
        >
          Deals Pipeline ({deals.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'accounts'}
          onClick={() => switchTab('accounts')}
          className={`border-b-2 px-4 py-2.5 text-xs font-medium ${
            activeTab === 'accounts'
              ? 'border-hq-brandVibrant text-hq-textPrimary'
              : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
          }`}
        >
          Accounts &amp; Contacts ({accounts.length})
        </button>
        <button
          type="button"
          role="tab"
          aria-selected={activeTab === 'leads'}
          onClick={() => switchTab('leads')}
          className={`inline-flex items-center gap-2 border-b-2 px-4 py-2.5 text-xs font-medium ${
            activeTab === 'leads'
              ? 'border-hq-brandVibrant text-hq-textPrimary'
              : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
          }`}
        >
          <span>Website Leads Inbox</span>
          {newLeadCount > 0 && <StatusPill tone="brand">{newLeadCount} new</StatusPill>}
        </button>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadAll} />}

      {/* SUB-TAB 1: PIPELINE */}
      {activeTab === 'pipeline' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="inline-flex rounded-full border border-hq-borderDefault bg-hq-subtle p-0.5">
              <button
                type="button"
                onClick={() => setPipelineView('board')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  pipelineView === 'board'
                    ? 'bg-hq-brand text-white'
                    : 'text-hq-textSecondary hover:text-hq-textPrimary'
                }`}
              >
                <Kanban className="h-3.5 w-3.5" />
                Kanban
              </button>
              <button
                type="button"
                onClick={() => setPipelineView('table')}
                className={`inline-flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium ${
                  pipelineView === 'table'
                    ? 'bg-hq-brand text-white'
                    : 'text-hq-textSecondary hover:text-hq-textPrimary'
                }`}
              >
                <Table2 className="h-3.5 w-3.5" />
                Table
              </button>
            </div>
          </div>

          {loading ? (
            <TableSkeleton rows={5} cols={5} />
          ) : deals.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-5 w-5" />}
              title="No Deals in Pipeline"
              description="Convert an inbound website lead or create a new B2B opportunity."
            />
          ) : pipelineView === 'board' ? (
            <div className="overflow-x-auto pb-2">
              <div className="grid min-w-[1100px] grid-cols-6 gap-3">
                {DEAL_STAGES.map((stage) => {
                  const stageDeals = deals.filter((d) => d.stage === stage.key);
                  const stageSumDisplay = stageDeals.reduce(
                    (s, d) => s + convertToDisplay(d.estimatedValue, d.currency),
                    0
                  );

                  return (
                    <div
                      key={stage.key}
                      className="flex flex-col rounded-xl border border-hq-borderSubtle bg-hq-subtle/70 p-3 min-h-[360px]"
                    >
                      <div className="border-b border-hq-borderSubtle pb-2.5 mb-3">
                        <div className="flex items-center justify-between">
                          <span className="font-ds-mono text-[11px] font-semibold uppercase tracking-wider text-hq-textPrimary">
                            {stage.label}
                          </span>
                          <span className="rounded-full bg-hq-elevated px-2 py-0.5 font-ds-mono text-[10px] text-hq-textSecondary">
                            {stageDeals.length}
                          </span>
                        </div>
                        <p className="mt-1 font-ds-mono text-[11px] tabular-nums text-hq-brandSoft">
                          {formatMoney(stageSumDisplay, displayCurrency, { compact: true })}
                        </p>
                      </div>

                      <div className="space-y-2.5 flex-1">
                        {stageDeals.map((deal) => {
                          const acct = accountMap.get(deal.accountId);
                          return (
                            <article
                              key={deal.id}
                              className="hq-card p-3 space-y-2 hover:border-hq-brand/60 transition-colors"
                            >
                              <div className="flex items-start justify-between gap-2">
                                <button
                                  type="button"
                                  onClick={() => openEditDeal(deal)}
                                  className="text-left text-xs font-semibold text-hq-textPrimary hover:text-hq-brandSoft line-clamp-2"
                                >
                                  {deal.title}
                                </button>
                              </div>
                              <p className="text-[11px] text-hq-textSecondary truncate">
                                {acct?.name || 'Linked Account'}
                              </p>
                              <div className="flex items-center justify-between font-ds-mono text-[11px] tabular-nums">
                                <span className="font-semibold text-hq-textPrimary">
                                  {formatMoney(deal.estimatedValue, deal.currency, { compact: true })}
                                </span>
                                <span className="text-hq-textMuted">{deal.probability}%</span>
                              </div>
                              {editable && (
                                <select
                                  aria-label={`Change stage for ${deal.title}`}
                                  value={deal.stage}
                                  onChange={(e) =>
                                    void handleMoveStage(deal, e.target.value as DealStage)
                                  }
                                  className="hq-input h-7 w-full px-2 font-ds-mono text-[10px]"
                                >
                                  {DEAL_STAGES.map((st) => (
                                    <option key={st.key} value={st.key}>
                                      Stage: {st.label}
                                    </option>
                                  ))}
                                </select>
                              )}
                            </article>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ) : (
            <div className="hq-card overflow-hidden">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[760px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase text-hq-textMuted">
                      <th className="px-4 py-3">Deal Title</th>
                      <th className="px-4 py-3">Account</th>
                      <th className="px-4 py-3">Stage</th>
                      <th className="px-4 py-3 text-right">Native Value</th>
                      <th className="px-4 py-3 text-right">Display ({displayCurrency})</th>
                      <th className="px-4 py-3 text-right">Prob.</th>
                      {editable && <th className="px-4 py-3 text-right">Edit</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle text-sm">
                    {deals.map((deal) => (
                      <tr key={deal.id} className="hover:bg-hq-elevated/50">
                        <td className="px-4 py-3 font-medium text-hq-textPrimary">{deal.title}</td>
                        <td className="px-4 py-3 text-xs text-hq-textSecondary">
                          {accountMap.get(deal.accountId)?.name || '--'}
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill
                            tone={
                              deal.stage === 'WON'
                                ? 'in'
                                : deal.stage === 'LOST'
                                  ? 'out'
                                  : 'brand'
                            }
                          >
                            {deal.stage}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3 text-right font-ds-mono text-xs tabular-nums text-hq-textSecondary">
                          {formatMoney(deal.estimatedValue, deal.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-ds-mono text-xs font-semibold tabular-nums">
                          {formatInDisplay(deal.estimatedValue, deal.currency)}
                        </td>
                        <td className="px-4 py-3 text-right font-ds-mono text-xs tabular-nums">
                          {deal.probability}%
                        </td>
                        {editable && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => openEditDeal(deal)}
                              className="rounded border border-hq-borderDefault px-2.5 py-1 text-xs hover:bg-hq-elevated"
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {/* SUB-TAB 2: ACCOUNTS & CONTACTS */}
      {activeTab === 'accounts' && (
        <div className="grid grid-cols-1 gap-5 xl:grid-cols-2">
          <div className="hq-card overflow-hidden">
            <div className="border-b border-hq-borderSubtle px-5 py-3.5 flex items-center justify-between">
              <h2 className="font-ds-display text-base font-semibold">Client &amp; Prospect Accounts</h2>
              <span className="font-ds-mono text-xs text-hq-textMuted">{accounts.length}</span>
            </div>
            {accounts.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<Building2 className="h-5 w-5" />}
                  title="No Accounts Yet"
                  description="Add an account manually or convert a website lead."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[10px] uppercase text-hq-textMuted">
                      <th className="px-4 py-2.5">Organization</th>
                      <th className="px-4 py-2.5">Status</th>
                      {editable && <th className="px-4 py-2.5 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle">
                    {accounts.map((acct) => (
                      <tr key={acct.id} className="hover:bg-hq-elevated/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-hq-textPrimary">{acct.name}</p>
                          <p className="text-xs text-hq-textMuted">
                            {[acct.industry, acct.country, acct.website].filter(Boolean).join(' · ') || '--'}
                          </p>
                        </td>
                        <td className="px-4 py-3">
                          <StatusPill tone={acct.status === 'ACTIVE_CLIENT' ? 'in' : 'neutral'}>
                            {acct.status}
                          </StatusPill>
                        </td>
                        {editable && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingAccount(acct);
                                setAccountForm({
                                  name: acct.name,
                                  website: acct.website || '',
                                  industry: acct.industry || '',
                                  country: acct.country || 'MM',
                                  status: acct.status,
                                  notes: acct.notes || '',
                                });
                                setAccountModalOpen(true);
                              }}
                              className="rounded border border-hq-borderDefault px-2.5 py-1 text-xs hover:bg-hq-elevated"
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          <div className="hq-card overflow-hidden">
            <div className="border-b border-hq-borderSubtle px-5 py-3.5 flex items-center justify-between">
              <h2 className="font-ds-display text-base font-semibold">Contacts</h2>
              <span className="font-ds-mono text-xs text-hq-textMuted">{contacts.length}</span>
            </div>
            {contacts.length === 0 ? (
              <div className="p-5">
                <EmptyState
                  icon={<Users className="h-5 w-5" />}
                  title="No Contacts Yet"
                  description="Track decision-makers and client stakeholders linked to accounts."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full border-collapse text-left text-sm">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[10px] uppercase text-hq-textMuted">
                      <th className="px-4 py-2.5">Stakeholder</th>
                      <th className="px-4 py-2.5">Account</th>
                      {editable && <th className="px-4 py-2.5 text-right">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle">
                    {contacts.map((c) => (
                      <tr key={c.id} className="hover:bg-hq-elevated/50">
                        <td className="px-4 py-3">
                          <p className="font-medium text-hq-textPrimary">{c.fullName}</p>
                          <p className="font-ds-mono text-[11px] text-hq-textMuted">
                            {c.email}
                            {c.roleTitle ? ` · ${c.roleTitle}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 text-xs text-hq-textSecondary">
                          {c.accountId ? accountMap.get(c.accountId)?.name || '--' : '--'}
                        </td>
                        {editable && (
                          <td className="px-4 py-3 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingContact(c);
                                setContactForm({
                                  accountId: c.accountId || '',
                                  fullName: c.fullName,
                                  email: c.email,
                                  phone: c.phone || '',
                                  roleTitle: c.roleTitle || '',
                                });
                                setContactModalOpen(true);
                              }}
                              className="rounded border border-hq-borderDefault px-2.5 py-1 text-xs hover:bg-hq-elevated"
                            >
                              Edit
                            </button>
                          </td>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* SUB-TAB 3: WEBSITE LEADS INBOX */}
      {activeTab === 'leads' && (
        <div className="space-y-4">
          <DriveSyncSection editable={editable} onLeadsSynced={() => void loadAll()} />

          <div className="hq-card p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-ds-mono text-[11px] uppercase text-hq-textMuted mr-1">Source:</span>
              {(['ALL', 'WEB_CONTACT', 'WEB_QUOTE', 'WEB_DEMO_REQUEST', 'MANUAL'] as const).map(
                (src) => (
                  <button
                    key={src}
                    type="button"
                    onClick={() => setLeadSourceFilter(src)}
                    className={`rounded-full px-3 py-1 font-ds-mono text-[11px] ${
                      leadSourceFilter === src
                        ? 'bg-hq-brand text-white font-semibold'
                        : 'border border-hq-borderDefault text-hq-textSecondary hover:bg-hq-elevated'
                    }`}
                  >
                    {src.replace('WEB_', '')}
                  </button>
                )
              )}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-ds-mono text-[11px] uppercase text-hq-textMuted mr-1">Status:</span>
              {(['ALL', 'NEW', 'CONTACTED', 'QUALIFIED', 'CONVERTED', 'DISQUALIFIED'] as const).map(
                (st) => (
                  <button
                    key={st}
                    type="button"
                    onClick={() => setLeadStatusFilter(st)}
                    className={`rounded-full px-3 py-1 font-ds-mono text-[11px] ${
                      leadStatusFilter === st
                        ? 'bg-hq-brand text-white font-semibold'
                        : 'border border-hq-borderDefault text-hq-textSecondary hover:bg-hq-elevated'
                    }`}
                  >
                    {st}
                  </button>
                )
              )}
            </div>
          </div>

          <div className="hq-card overflow-hidden">
            {filteredLeads.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Inbox className="h-5 w-5" />}
                  title="Inbox Clear"
                  description="Submissions from theasolutions.co contact, quote, and schedule-demo forms arrive here automatically."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase text-hq-textMuted">
                      <th className="px-4 py-3">Status</th>
                      <th className="px-4 py-3">Submitted</th>
                      <th className="px-4 py-3">Lead &amp; Company</th>
                      <th className="px-4 py-3">Source</th>
                      <th className="px-4 py-3 text-right">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle text-sm">
                    {filteredLeads.map((lead) => (
                      <tr key={lead.id} className="hover:bg-hq-elevated/50">
                        <td className="px-4 py-3">
                          <StatusPill
                            tone={
                              lead.status === 'NEW'
                                ? 'brand'
                                : lead.status === 'CONVERTED'
                                  ? 'in'
                                  : lead.status === 'DISQUALIFIED'
                                    ? 'out'
                                    : 'warn'
                            }
                          >
                            {lead.status}
                          </StatusPill>
                        </td>
                        <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textSecondary">
                          {formatDateShort(lead.createdAt)}
                        </td>
                        <td className="px-4 py-3">
                          <p className="font-medium text-hq-textPrimary">
                            {lead.name || lead.email}
                            {lead.company ? ` · ${lead.company}` : ''}
                          </p>
                          <p className="font-ds-mono text-[11px] text-hq-textMuted">
                            {lead.email}
                            {lead.phone ? ` · ${lead.phone}` : ''}
                          </p>
                        </td>
                        <td className="px-4 py-3 font-ds-mono text-xs text-hq-textSecondary">
                          {lead.source}
                        </td>
                        <td className="px-4 py-3 text-right">
                          <div className="inline-flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setInspectLead(lead)}
                              className="rounded border border-hq-borderDefault px-2.5 py-1 text-xs hover:bg-hq-elevated"
                            >
                              Details
                            </button>
                            {editable && lead.status !== 'CONVERTED' && (
                              <>
                                <select
                                  aria-label={`Update status for ${lead.email}`}
                                  value={lead.status}
                                  onChange={(e) =>
                                    void handleUpdateLeadStatus(lead, e.target.value as LeadStatus)
                                  }
                                  className="hq-input h-7 px-2 font-ds-mono text-[10px]"
                                >
                                  <option value="NEW">NEW</option>
                                  <option value="CONTACTED">CONTACTED</option>
                                  <option value="QUALIFIED">QUALIFIED</option>
                                  <option value="DISQUALIFIED">DISQUALIFIED</option>
                                </select>
                                <button
                                  type="button"
                                  onClick={() => openConvertModal(lead)}
                                  className="hq-btn-primary inline-flex h-7 items-center gap-1 px-3 text-[11px]"
                                >
                                  <span>Convert to Deal</span>
                                  <ArrowRight className="h-3 w-3" />
                                </button>
                              </>
                            )}
                            {lead.status === 'CONVERTED' && (
                              <span className="inline-flex items-center gap-1 font-ds-mono text-[11px] text-hq-in">
                                <UserCheck className="h-3.5 w-3.5" /> Converted
                              </span>
                            )}
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

      {/* Lead Inspector Slide-Over */}
      <SlideOver
        open={Boolean(inspectLead)}
        onClose={() => setInspectLead(null)}
        title={inspectLead?.name || inspectLead?.email || 'Lead Details'}
        subtitle={inspectLead ? `${inspectLead.source} · ${inspectLead.status}` : undefined}
      >
        {inspectLead && (
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3 rounded-xl border border-hq-borderSubtle bg-hq-subtle p-4 text-xs">
              <div>
                <p className="text-hq-textMuted">Email</p>
                <p className="font-ds-mono text-hq-textPrimary">{inspectLead.email}</p>
              </div>
              <div>
                <p className="text-hq-textMuted">Phone</p>
                <p className="font-ds-mono text-hq-textPrimary">{inspectLead.phone || '--'}</p>
              </div>
              <div>
                <p className="text-hq-textMuted">Company</p>
                <p className="text-hq-textPrimary">{inspectLead.company || '--'}</p>
              </div>
              <div>
                <p className="text-hq-textMuted">Captured</p>
                <p className="font-ds-mono text-hq-textPrimary">{formatDateShort(inspectLead.createdAt)}</p>
              </div>
            </div>

            <div>
              <p className="mb-1.5 font-ds-mono text-[11px] uppercase text-hq-textMuted">
                Form Submission Payload
              </p>
              <pre className="overflow-auto rounded-xl bg-hq-subtle p-4 font-ds-mono text-xs text-hq-textSecondary">
                {JSON.stringify(inspectLead.payload || {}, null, 2)}
              </pre>
            </div>

            {inspectLead.utm && Object.keys(inspectLead.utm).length > 0 && (
              <div>
                <p className="mb-1.5 font-ds-mono text-[11px] uppercase text-hq-textMuted">
                  Attribution / UTM
                </p>
                <pre className="overflow-auto rounded-xl bg-hq-subtle p-4 font-ds-mono text-xs text-hq-textSecondary">
                  {JSON.stringify(inspectLead.utm, null, 2)}
                </pre>
              </div>
            )}
          </div>
        )}
      </SlideOver>

      {/* Convert Lead Modal */}
      <Modal
        open={Boolean(convertLead)}
        onClose={() => setConvertLead(null)}
        title="Convert Website Lead to Account & Deal"
        subtitle={convertLead ? `${convertLead.name || convertLead.email} (${convertLead.source})` : undefined}
        footer={
          <>
            <button
              type="button"
              onClick={() => setConvertLead(null)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="convert-lead-form"
              disabled={converting}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {converting ? 'Converting...' : 'Convert Atomically'}
            </button>
          </>
        }
      >
        <form id="convert-lead-form" onSubmit={handleConvertLead} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Account Name *</label>
            <input
              type="text"
              required
              value={convertForm.accountName}
              onChange={(e) => setConvertForm({ ...convertForm, accountName: e.target.value })}
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Deal Title *</label>
            <input
              type="text"
              required
              value={convertForm.dealTitle}
              onChange={(e) => setConvertForm({ ...convertForm, dealTitle: e.target.value })}
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Currency</label>
              <select
                value={convertForm.currency}
                onChange={(e) =>
                  setConvertForm({ ...convertForm, currency: e.target.value as CurrencyCode })
                }
                className="hq-input h-10 w-full px-3 font-ds-mono text-sm"
              >
                <option value="MMK">MMK</option>
                <option value="THB">THB</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Estimated Value *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={convertForm.estimatedValue}
                onChange={(e) => setConvertForm({ ...convertForm, estimatedValue: e.target.value })}
                className="hq-input h-10 w-full px-3 text-right font-ds-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Expected Close
              </label>
              <input
                type="date"
                value={convertForm.expectedCloseDate}
                onChange={(e) =>
                  setConvertForm({ ...convertForm, expectedCloseDate: e.target.value })
                }
                className="hq-input h-10 w-full px-3 font-ds-mono text-xs tabular-nums"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Add/Edit Deal Modal */}
      <Modal
        open={dealModalOpen}
        onClose={() => setDealModalOpen(false)}
        title={editingDeal ? 'Edit Deal' : 'New Pipeline Deal'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setDealModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="deal-form"
              disabled={dealSaving}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {dealSaving ? 'Saving...' : 'Save Deal'}
            </button>
          </>
        }
      >
        <form id="deal-form" onSubmit={handleSaveDeal} className="space-y-4">
          {!editingDeal && (
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Account *</label>
              <select
                required
                value={dealForm.accountId}
                onChange={(e) => setDealForm({ ...dealForm, accountId: e.target.value })}
                className="hq-input h-10 w-full px-3 text-sm"
              >
                <option value="">Select account...</option>
                {accounts.map((a) => (
                  <option key={a.id} value={a.id}>
                    {a.name}
                  </option>
                ))}
              </select>
            </div>
          )}
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Deal Title *</label>
            <input
              type="text"
              required
              disabled={Boolean(editingDeal)}
              value={dealForm.title}
              onChange={(e) => setDealForm({ ...dealForm, title: e.target.value })}
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Stage</label>
              <select
                value={dealForm.stage}
                onChange={(e) => setDealForm({ ...dealForm, stage: e.target.value as DealStage })}
                className="hq-input h-10 w-full px-3 text-sm"
              >
                {DEAL_STAGES.map((st) => (
                  <option key={st.key} value={st.key}>
                    {st.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Probability (%)
              </label>
              <input
                type="number"
                min="0"
                max="100"
                value={dealForm.probability}
                onChange={(e) => setDealForm({ ...dealForm, probability: e.target.value })}
                className="hq-input h-10 w-full px-3 font-ds-mono text-sm tabular-nums"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Currency</label>
              <select
                disabled={Boolean(editingDeal)}
                value={dealForm.currency}
                onChange={(e) =>
                  setDealForm({ ...dealForm, currency: e.target.value as CurrencyCode })
                }
                className="hq-input h-10 w-full px-3 font-ds-mono text-sm"
              >
                <option value="MMK">MMK</option>
                <option value="THB">THB</option>
              </select>
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Value *</label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={dealForm.estimatedValue}
                onChange={(e) => setDealForm({ ...dealForm, estimatedValue: e.target.value })}
                className="hq-input h-10 w-full px-3 text-right font-ds-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Close Date</label>
              <input
                type="date"
                value={dealForm.expectedCloseDate}
                onChange={(e) => setDealForm({ ...dealForm, expectedCloseDate: e.target.value })}
                className="hq-input h-10 w-full px-3 font-ds-mono text-xs tabular-nums"
              />
            </div>
          </div>
        </form>
      </Modal>

      {/* Account Modal */}
      <Modal
        open={accountModalOpen}
        onClose={() => setAccountModalOpen(false)}
        title={editingAccount ? 'Edit Account' : 'Add CRM Account'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setAccountModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="account-form"
              disabled={accountSaving}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {accountSaving ? 'Saving...' : 'Save Account'}
            </button>
          </>
        }
      >
        <form id="account-form" onSubmit={handleSaveAccount} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Company Name *</label>
            <input
              type="text"
              required
              value={accountForm.name}
              onChange={(e) => setAccountForm({ ...accountForm, name: e.target.value })}
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Industry</label>
              <input
                type="text"
                value={accountForm.industry}
                onChange={(e) => setAccountForm({ ...accountForm, industry: e.target.value })}
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Status</label>
              <select
                value={accountForm.status}
                onChange={(e) =>
                  setAccountForm({ ...accountForm, status: e.target.value as CrmAccountStatus })
                }
                className="hq-input h-10 w-full px-3 text-sm"
              >
                <option value="PROSPECT">PROSPECT</option>
                <option value="ACTIVE_CLIENT">ACTIVE_CLIENT</option>
                <option value="PAST_CLIENT">PAST_CLIENT</option>
                <option value="CHURNED">CHURNED</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Website</label>
              <input
                type="url"
                value={accountForm.website}
                onChange={(e) => setAccountForm({ ...accountForm, website: e.target.value })}
                placeholder="https://..."
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Country Code</label>
              <input
                type="text"
                value={accountForm.country}
                onChange={(e) => setAccountForm({ ...accountForm, country: e.target.value.toUpperCase() })}
                placeholder="MM / TH / SG"
                className="hq-input h-10 w-full px-3 font-ds-mono text-xs uppercase"
              />
            </div>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Notes</label>
            <textarea
              rows={3}
              value={accountForm.notes}
              onChange={(e) => setAccountForm({ ...accountForm, notes: e.target.value })}
              className="hq-input w-full px-3 py-2 text-sm"
            />
          </div>
        </form>
      </Modal>

      {/* Contact Modal */}
      <Modal
        open={contactModalOpen}
        onClose={() => setContactModalOpen(false)}
        title={editingContact ? 'Edit Contact' : 'Add Contact'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setContactModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="contact-form"
              disabled={contactSaving}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {contactSaving ? 'Saving...' : 'Save Contact'}
            </button>
          </>
        }
      >
        <form id="contact-form" onSubmit={handleSaveContact} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Linked Account</label>
            <select
              value={contactForm.accountId}
              onChange={(e) => setContactForm({ ...contactForm, accountId: e.target.value })}
              className="hq-input h-10 w-full px-3 text-sm"
            >
              <option value="">No account</option>
              {accounts.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Full Name *</label>
              <input
                type="text"
                required
                value={contactForm.fullName}
                onChange={(e) => setContactForm({ ...contactForm, fullName: e.target.value })}
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Email *</label>
              <input
                type="email"
                required
                value={contactForm.email}
                onChange={(e) => setContactForm({ ...contactForm, email: e.target.value })}
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
          </div>
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Phone</label>
              <input
                type="text"
                value={contactForm.phone}
                onChange={(e) => setContactForm({ ...contactForm, phone: e.target.value })}
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Role / Title</label>
              <input
                type="text"
                value={contactForm.roleTitle}
                onChange={(e) => setContactForm({ ...contactForm, roleTitle: e.target.value })}
                className="hq-input h-10 w-full px-3 text-sm"
              />
            </div>
          </div>
        </form>
      </Modal>
    </div>
  );
}
