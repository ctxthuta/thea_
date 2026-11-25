import React, { useCallback, useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import {
  Archive,
  ArrowDownLeft,
  ArrowUpRight,
  BookOpen,
  ChevronDown,
  ChevronRight,
  Download,
  FileSpreadsheet,
  Landmark,
  Plus,
  Printer,
  RotateCcw,
  Send,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useToast } from '@/context/ToastContext';
import { canEditFinance } from '@/lib/rbac';
import {
  formatDecimalInput,
  formatMoney,
  getCurrentMonthKey,
  getMonthBounds,
  getTodayIso,
  parseDecimal,
} from '@/lib/format';
import {
  EmptyState,
  ErrorBanner,
  Modal,
  StatusPill,
  TableSkeleton,
} from '@/components/ui/Primitives';
import {
  GeneralJournalModal,
  QuickJournalModal,
  ReverseJournalModal,
} from '@/pages/finance/JournalModals';
import OfficeReports, { type OfficeReportType } from '@/pages/finance/OfficeReports';
import type {
  AssociateDTO,
  BalanceSheetReport,
  BudgetPeriodType,
  BudgetVsActualReport,
  CoaAccountDTO,
  CoaCategory,
  CurrencyCode,
  CursorPage,
  GeneralLedgerResponse,
  IncomeStatementReport,
  JournalEntryDTO,
  JournalEntryType,
  JournalStatus,
  TrialBalanceReport,
} from '@/types/hq';

type FinanceTab = 'coa' | 'journals' | 'ledger' | 'budgets' | 'reports';

const COA_GROUPS: Array<{ code: string; label: string; category: CoaCategory }> = [
  { code: '1000', label: 'Assets', category: 'ASSET' },
  { code: '2000', label: 'Liabilities', category: 'LIABILITY' },
  { code: '3000', label: 'Equity', category: 'EQUITY' },
  { code: '4000', label: 'Revenue', category: 'REVENUE' },
  { code: '5000', label: 'Direct Costs (COGS)', category: 'COGS' },
  { code: '6000', label: 'Operating Expenses', category: 'OPEX' },
];

function getCurrentQuarterKey(): string {
  const now = new Date();
  const q = Math.floor(now.getUTCMonth() / 3) + 1;
  return `${now.getUTCFullYear()}-Q${q}`;
}

export default function FinancePage() {
  const { user } = useAuth();
  const { displayCurrency, thbToMmkRate, formatInDisplay } = useCurrency();
  const { pushToast } = useToast();
  const [searchParams, setSearchParams] = useSearchParams();
  const editable = canEditFinance(user);

  const initialTab = (searchParams.get('tab') as FinanceTab) || 'coa';
  const [activeTab, setActiveTab] = useState<FinanceTab>(
    ['coa', 'journals', 'ledger', 'budgets', 'reports'].includes(initialTab) ? initialTab : 'coa'
  );

  // Shared master data
  const [accounts, setAccounts] = useState<CoaAccountDTO[]>([]);
  const [associates, setAssociates] = useState<AssociateDTO[]>([]);
  const [trialBalance, setTrialBalance] = useState<TrialBalanceReport | null>(null);
  const [error, setError] = useState<string | null>(null);

  // COA state
  const [coaSearch, setCoaSearch] = useState('');
  const [coaLoading, setCoaLoading] = useState(true);
  const [collapsedGroups, setCollapsedGroups] = useState<Record<string, boolean>>({});
  const [coaModalOpen, setCoaModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<CoaAccountDTO | null>(null);
  const [coaForm, setCoaForm] = useState({
    code: '',
    name: '',
    category: 'OPEX' as CoaCategory,
    parentCode: '6000',
    description: '',
  });
  const [coaSaving, setCoaSaving] = useState(false);

  // Journals state
  const [journals, setJournals] = useState<JournalEntryDTO[]>([]);
  const [journalNextCursor, setJournalNextCursor] = useState<string | null>(null);
  const [journalsLoading, setJournalsLoading] = useState(false);
  const [journalTypeFilter, setJournalTypeFilter] = useState<'ALL' | JournalEntryType>('ALL');
  const [journalStatusFilter, setJournalStatusFilter] = useState<'ALL' | JournalStatus>('ALL');
  const [expandedJournalId, setExpandedJournalId] = useState<string | null>(null);
  const [quickModalMode, setQuickModalMode] = useState<'INCOME' | 'EXPENSE' | null>(null);
  const [generalModalOpen, setGeneralModalOpen] = useState(false);
  const [reversingEntry, setReversingEntry] = useState<JournalEntryDTO | null>(null);
  const [postingId, setPostingId] = useState<string | null>(null);

  // General Ledger state
  const defaultBounds = getMonthBounds(getCurrentMonthKey());
  const yearStart = `${new Date().getUTCFullYear()}-01-01`;
  const [ledgerAccountCode, setLedgerAccountCode] = useState(
    searchParams.get('account') || '1020'
  );
  const [ledgerDateFrom, setLedgerDateFrom] = useState(yearStart);
  const [ledgerDateTo, setLedgerDateTo] = useState(getTodayIso());
  const [ledgerData, setLedgerData] = useState<GeneralLedgerResponse | null>(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);

  // Budgets state
  const [budgetPeriodType, setBudgetPeriodType] = useState<BudgetPeriodType>('MONTHLY');
  const [budgetPeriodKey, setBudgetPeriodKey] = useState(getCurrentMonthKey());
  const [budgetReport, setBudgetReport] = useState<BudgetVsActualReport | null>(null);
  const [budgetsLoading, setBudgetsLoading] = useState(false);
  const [budgetModalOpen, setBudgetModalOpen] = useState(false);
  const [budgetForm, setBudgetForm] = useState({
    accountCode: '5010',
    currency: 'MMK' as CurrencyCode,
    targetAmount: '',
    notes: '',
  });
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Reports state
  const [reportView, setReportView] = useState<OfficeReportType>('pnl');
  const [reportDateFrom, setReportDateFrom] = useState(defaultBounds.dateFrom);
  const [reportDateTo, setReportDateTo] = useState(defaultBounds.dateTo);
  const [incomeStmt, setIncomeStmt] = useState<IncomeStatementReport | null>(null);
  const [balanceSheet, setBalanceSheet] = useState<BalanceSheetReport | null>(null);
  const [reportsLoading, setReportsLoading] = useState(false);

  const switchTab = (tab: FinanceTab, accountCode?: string) => {
    setActiveTab(tab);
    const nextParams: Record<string, string> = { tab };
    if (accountCode) {
      setLedgerAccountCode(accountCode);
      nextParams.account = accountCode;
    }
    setSearchParams(nextParams, { replace: true });
  };

  useEffect(() => {
    const action = searchParams.get('action');
    if (action === 'income' && editable) {
      setQuickModalMode('INCOME');
      searchParams.delete('action');
      setSearchParams(searchParams, { replace: true });
    }
  }, [searchParams, setSearchParams, editable]);

  const loadMasterData = useCallback(async () => {
    setCoaLoading(true);
    setError(null);
    try {
      const [coaRes, tbRes, assocRes] = await Promise.all([
        apiRequest<{ items: CoaAccountDTO[] }>('/api/v1/accounting/coa'),
        apiRequest<TrialBalanceReport>(
          `/api/v1/accounting/reports/trial-balance?asOf=${getTodayIso()}&displayCurrency=${displayCurrency}`
        ).catch(() => null),
        apiRequest<CursorPage<AssociateDTO>>('/api/v1/associates?limit=100').catch(() => ({
          items: [],
          nextCursor: null,
          hasMore: false,
        })),
      ]);
      setAccounts(coaRes.items || []);
      setTrialBalance(tbRes);
      setAssociates(assocRes.items || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load accounting ledger.');
    } finally {
      setCoaLoading(false);
    }
  }, [displayCurrency]);

  const loadJournals = useCallback(
    async (cursor?: string) => {
      setJournalsLoading(true);
      try {
        const params = new URLSearchParams({ limit: '25' });
        if (journalTypeFilter !== 'ALL') params.set('entryType', journalTypeFilter);
        if (journalStatusFilter !== 'ALL') params.set('status', journalStatusFilter);
        if (cursor) params.set('cursor', cursor);

        const res = await apiRequest<CursorPage<JournalEntryDTO>>(
          `/api/v1/accounting/journals?${params.toString()}`
        );
        setJournals((prev) => (cursor ? [...prev, ...(res.items || [])] : res.items || []));
        setJournalNextCursor(res.nextCursor);
      } catch (err) {
        setError(err instanceof ApiError ? err.message : 'Unable to load journal entries.');
      } finally {
        setJournalsLoading(false);
      }
    },
    [journalTypeFilter, journalStatusFilter]
  );

  const loadLedger = useCallback(async () => {
    if (!ledgerAccountCode) return;
    setLedgerLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams({
        accountCode: ledgerAccountCode,
        displayCurrency,
      });
      if (ledgerDateFrom) params.set('dateFrom', ledgerDateFrom);
      if (ledgerDateTo) params.set('dateTo', ledgerDateTo);

      const res = await apiRequest<GeneralLedgerResponse>(
        `/api/v1/accounting/ledger?${params.toString()}`
      );
      setLedgerData(res);
    } catch (err) {
      setLedgerData(null);
      setError(err instanceof ApiError ? err.message : 'Unable to load account general ledger.');
    } finally {
      setLedgerLoading(false);
    }
  }, [ledgerAccountCode, ledgerDateFrom, ledgerDateTo, displayCurrency]);

  const loadBudgets = useCallback(async () => {
    setBudgetsLoading(true);
    try {
      const res = await apiRequest<BudgetVsActualReport>(
        `/api/v1/accounting/reports/budget-vs-actual?periodType=${budgetPeriodType}&periodKey=${encodeURIComponent(budgetPeriodKey)}&displayCurrency=${displayCurrency}`
      );
      setBudgetReport(res);
    } catch {
      setBudgetReport(null);
    } finally {
      setBudgetsLoading(false);
    }
  }, [budgetPeriodType, budgetPeriodKey, displayCurrency]);

  const loadReports = useCallback(async () => {
    setReportsLoading(true);
    try {
      const [pnl, tb, bs] = await Promise.all([
        apiRequest<IncomeStatementReport>(
          `/api/v1/accounting/reports/income-statement?dateFrom=${reportDateFrom}&dateTo=${reportDateTo}&displayCurrency=${displayCurrency}`
        ).catch(() => null),
        apiRequest<TrialBalanceReport>(
          `/api/v1/accounting/reports/trial-balance?asOf=${reportDateTo}&displayCurrency=${displayCurrency}`
        ).catch(() => null),
        apiRequest<BalanceSheetReport>(
          `/api/v1/accounting/reports/balance-sheet?asOf=${reportDateTo}&displayCurrency=${displayCurrency}`
        ).catch(() => null),
      ]);
      setIncomeStmt(pnl);
      if (tb) setTrialBalance(tb);
      setBalanceSheet(bs);
    } finally {
      setReportsLoading(false);
    }
  }, [reportDateFrom, reportDateTo, displayCurrency]);

  useEffect(() => {
    void loadMasterData();
  }, [loadMasterData]);

  useEffect(() => {
    if (activeTab === 'journals') {
      void loadJournals();
    } else if (activeTab === 'ledger') {
      void loadLedger();
    } else if (activeTab === 'budgets') {
      void loadBudgets();
    } else if (activeTab === 'reports') {
      void loadReports();
    }
  }, [activeTab, loadJournals, loadLedger, loadBudgets, loadReports]);

  const balanceByCode = useMemo(() => {
    const map = new Map<string, number>();
    for (const row of trialBalance?.rows || []) {
      map.set(row.accountCode, parseDecimal(row.netBalanceBase));
    }
    return map;
  }, [trialBalance]);

  // COA Modal Handlers
  const openCreateCoa = () => {
    setEditingAccount(null);
    setCoaForm({ code: '', name: '', category: 'OPEX', parentCode: '6000', description: '' });
    setCoaModalOpen(true);
  };

  const openEditCoa = (acct: CoaAccountDTO) => {
    setEditingAccount(acct);
    setCoaForm({
      code: acct.code,
      name: acct.name,
      category: acct.category,
      parentCode: acct.parentCode || '',
      description: acct.description || '',
    });
    setCoaModalOpen(true);
  };

  const handleSaveCoa = async (event: React.FormEvent) => {
    event.preventDefault();
    setCoaSaving(true);
    try {
      if (editingAccount) {
        await apiRequest(`/api/v1/accounting/coa/${editingAccount.code}`, {
          method: 'PATCH',
          body: {
            name: coaForm.name.trim(),
            description: coaForm.description.trim(),
            version: editingAccount.version,
          },
        });
        pushToast({ variant: 'success', title: 'COA account updated' });
      } else {
        await apiRequest('/api/v1/accounting/coa', {
          method: 'POST',
          body: {
            code: coaForm.code.trim(),
            name: coaForm.name.trim(),
            category: coaForm.category,
            parentCode: coaForm.parentCode || undefined,
            description: coaForm.description.trim() || undefined,
          },
        });
        pushToast({ variant: 'success', title: `Account ${coaForm.code} created` });
      }
      setCoaModalOpen(false);
      await loadMasterData();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Account save failed',
        description: err instanceof ApiError ? err.message : 'Unable to save COA account.',
      });
    } finally {
      setCoaSaving(false);
    }
  };

  const handleToggleArchiveCoa = async (acct: CoaAccountDTO) => {
    try {
      await apiRequest(`/api/v1/accounting/coa/${acct.code}`, {
        method: 'PATCH',
        body: { isActive: !acct.isActive, version: acct.version },
      });
      pushToast({
        variant: 'success',
        title: acct.isActive ? `Archived ${acct.code}` : `Reactivated ${acct.code}`,
      });
      await loadMasterData();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Status update failed',
        description: err instanceof ApiError ? err.message : 'Could not update account status.',
      });
    }
  };

  // Post Draft Journal
  const handlePostDraft = async (entry: JournalEntryDTO) => {
    setPostingId(entry.id);
    try {
      await apiRequest(`/api/v1/accounting/journals/${entry.id}/post`, {
        method: 'POST',
        idempotent: true,
        body: { version: entry.version },
      });
      pushToast({
        variant: 'success',
        title: 'Journal posted',
        description: `${entry.entryNumber} is now immutable in the general ledger.`,
      });
      await Promise.all([loadJournals(), loadMasterData()]);
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Posting failed',
        description: err instanceof ApiError ? err.message : 'Verify FX rate and balance.',
      });
    } finally {
      setPostingId(null);
    }
  };

  // Save Budget Target
  const handleSaveBudget = async (event: React.FormEvent) => {
    event.preventDefault();
    const numeric = parseDecimal(budgetForm.targetAmount);
    if (numeric < 0) return;

    setBudgetSaving(true);
    try {
      await apiRequest('/api/v1/accounting/budgets', {
        method: 'PUT',
        body: {
          periodType: budgetPeriodType,
          periodKey: budgetPeriodKey,
          accountCode: budgetForm.accountCode,
          currency: budgetForm.currency,
          targetAmount: formatDecimalInput(numeric, 2),
          notes: budgetForm.notes.trim() || undefined,
        },
      });
      pushToast({
        variant: 'success',
        title: 'Budget target saved',
        description: `Updated ${budgetForm.accountCode} for ${budgetPeriodKey}.`,
      });
      setBudgetModalOpen(false);
      await loadBudgets();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Budget save failed',
        description: err instanceof ApiError ? err.message : 'Unable to save budget.',
      });
    } finally {
      setBudgetSaving(false);
    }
  };

  const downloadCsv = (filename: string, rows: string[][]) => {
    const csv = rows
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleExportLedgerCsv = () => {
    if (!ledgerData) return;
    const rows: string[][] = [
      [
        'Date',
        'Entry #',
        'Type',
        'Description',
        'Memo',
        'Counter-Account',
        'Native Currency',
        'FX Rate',
        'FX Date',
        `Debit (${ledgerData.displayCurrency})`,
        `Credit (${ledgerData.displayCurrency})`,
        `Running Balance (${ledgerData.displayCurrency})`,
      ],
    ];
    for (const e of ledgerData.entries) {
      rows.push([
        e.entryDate,
        e.entryNumber,
        e.entryType,
        e.description,
        e.memo || '',
        e.counterAccounts.join('; '),
        e.currency,
        e.fxRateUsed,
        e.fxRateDate,
        e.debitDisplay,
        e.creditDisplay,
        e.runningBalanceDisplay,
      ]);
    }
    downloadCsv(
      `thea-hq-ledger-${ledgerData.account.code}-${ledgerDateFrom}-${ledgerDateTo}.csv`,
      rows
    );
  };

  const handleExportReportCsv = () => {
    const rows: string[][] = [];
    if (reportView === 'trial-balance' && trialBalance) {
      rows.push([
        'Code',
        'Account',
        'Category',
        `Debit (${displayCurrency})`,
        `Credit (${displayCurrency})`,
        `Net (${displayCurrency})`,
      ]);
      for (const r of trialBalance.rows) {
        rows.push([
          r.accountCode,
          r.name,
          r.category,
          parseDecimal(r.debitBase).toFixed(2),
          parseDecimal(r.creditBase).toFixed(2),
          parseDecimal(r.netBalanceBase).toFixed(2),
        ]);
      }
    } else if (reportView === 'balance-sheet' && balanceSheet) {
      rows.push(['Section', 'Code', 'Account', `Balance (${displayCurrency})`]);
      for (const l of balanceSheet.sections.assets) {
        rows.push(['ASSET', l.accountCode, l.name, parseDecimal(l.amount).toFixed(2)]);
      }
      for (const l of balanceSheet.sections.liabilities) {
        rows.push(['LIABILITY', l.accountCode, l.name, parseDecimal(l.amount).toFixed(2)]);
      }
      for (const l of balanceSheet.sections.equity) {
        rows.push(['EQUITY', l.accountCode, l.name, parseDecimal(l.amount).toFixed(2)]);
      }
    } else if (incomeStmt) {
      rows.push(['Section', 'Code', 'Account', `Amount (${displayCurrency})`]);
      for (const l of incomeStmt.sections.revenue) {
        rows.push(['REVENUE', l.accountCode, l.name, parseDecimal(l.amount).toFixed(2)]);
      }
      for (const l of incomeStmt.sections.cogs) {
        rows.push(['COGS', l.accountCode, l.name, parseDecimal(l.amount).toFixed(2)]);
      }
      for (const l of incomeStmt.sections.opex) {
        rows.push(['OPEX', l.accountCode, l.name, parseDecimal(l.amount).toFixed(2)]);
      }
    }
    downloadCsv(`thea-hq-${reportView}-${reportDateFrom}-${reportDateTo}.csv`, rows);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="no-print flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-ds-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-hq-textPrimary">
            Finance Suite
          </h1>
          <p className="mt-1 text-sm text-hq-textSecondary">
            Double-entry multi-currency ledger · Displaying{' '}
            <span className="font-ds-mono font-semibold text-hq-textPrimary">{displayCurrency}</span>{' '}
            <span className="font-ds-mono text-xs text-hq-textMuted">
              (1 THB = {thbToMmkRate.toFixed(2)} MMK)
            </span>
          </p>
        </div>

        {editable && (
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setQuickModalMode('INCOME')}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hq-in/40 bg-hq-inBg px-3.5 text-xs font-semibold text-hq-in hover:opacity-90"
            >
              <ArrowDownLeft className="h-3.5 w-3.5" />
              <span>Quick Income</span>
            </button>
            <button
              type="button"
              onClick={() => setQuickModalMode('EXPENSE')}
              className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hq-out/40 bg-hq-outBg px-3.5 text-xs font-semibold text-hq-out hover:opacity-90"
            >
              <ArrowUpRight className="h-3.5 w-3.5" />
              <span>Quick Expense</span>
            </button>
            <button
              type="button"
              onClick={() => setGeneralModalOpen(true)}
              className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
            >
              <Plus className="h-3.5 w-3.5" />
              <span>General Journal</span>
            </button>
          </div>
        )}
      </div>

      {/* Sub-Tabs */}
      <div role="tablist" className="no-print flex flex-wrap gap-1 border-b border-hq-borderSubtle">
        {(
          [
            ['coa', 'Chart of Accounts'],
            ['journals', 'Journals'],
            ['ledger', 'General Ledger'],
            ['budgets', 'Budgets vs. Actual'],
            ['reports', 'Financial Reports'],
          ] as const
        ).map(([tabKey, label]) => {
          const active = activeTab === tabKey;
          return (
            <button
              key={tabKey}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => switchTab(tabKey)}
              className={`border-b-2 px-4 py-2.5 text-xs font-medium transition-colors whitespace-nowrap ${
                active
                  ? 'border-hq-brandVibrant text-hq-textPrimary'
                  : 'border-transparent text-hq-textSecondary hover:text-hq-textPrimary'
              }`}
            >
              {label}
            </button>
          );
        })}
      </div>

      {error && <ErrorBanner message={error} onRetry={loadMasterData} />}

      {/* TAB 1: CHART OF ACCOUNTS */}
      {activeTab === 'coa' && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <input
              type="search"
              value={coaSearch}
              onChange={(e) => setCoaSearch(e.target.value)}
              placeholder="Filter COA by code or account name..."
              className="hq-input h-10 w-full max-w-sm px-3 text-sm"
            />
            {editable && (
              <button
                type="button"
                onClick={openCreateCoa}
                className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Add Account
              </button>
            )}
          </div>

          <div className="hq-card overflow-hidden">
            {coaLoading ? (
              <TableSkeleton rows={8} cols={6} />
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
                      <th className="px-4 py-3 w-28 whitespace-nowrap">Code</th>
                      <th className="px-4 py-3">Account Name</th>
                      <th className="px-4 py-3 whitespace-nowrap">Normal</th>
                      <th className="px-4 py-3 whitespace-nowrap">Status</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">
                        Running Balance ({displayCurrency})
                      </th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle text-sm">
                    {COA_GROUPS.map((group) => {
                      const children = accounts
                        .filter((a) => {
                          if (a.category !== group.category) return false;
                          if (!coaSearch.trim()) return true;
                          const q = coaSearch.toLowerCase();
                          return a.code.includes(q) || a.name.toLowerCase().includes(q);
                        })
                        .sort((a, b) => a.code.localeCompare(b.code));

                      const groupTotalBase = children.reduce(
                        (sum, acct) => sum + (balanceByCode.get(acct.code) || 0),
                        0
                      );
                      const isCollapsed = Boolean(collapsedGroups[group.code]);

                      return (
                        <React.Fragment key={group.code}>
                          <tr className="bg-hq-subtle/80 font-semibold">
                            <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-brandSoft whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() =>
                                  setCollapsedGroups((prev) => ({
                                    ...prev,
                                    [group.code]: !prev[group.code],
                                  }))
                                }
                                className="inline-flex items-center gap-1.5"
                              >
                                {isCollapsed ? (
                                  <ChevronRight className="h-3.5 w-3.5" />
                                ) : (
                                  <ChevronDown className="h-3.5 w-3.5" />
                                )}
                                <span>{group.code}</span>
                              </button>
                            </td>
                            <td className="px-4 py-3 font-ds-display text-xs uppercase tracking-wider text-hq-textPrimary">
                              {group.label}
                            </td>
                            <td className="px-4 py-3 font-ds-mono text-[11px] text-hq-textMuted whitespace-nowrap">
                              {group.category === 'ASSET' ||
                              group.category === 'COGS' ||
                              group.category === 'OPEX'
                                ? 'DEBIT'
                                : 'CREDIT'}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <StatusPill tone="brand">Group</StatusPill>
                            </td>
                            <td className="px-4 py-3 text-right font-ds-mono text-xs tabular-nums text-hq-textPrimary whitespace-nowrap">
                              {formatMoney(groupTotalBase, displayCurrency)}
                            </td>
                            <td />
                          </tr>

                          {!isCollapsed &&
                            children
                              .filter((acct) => acct.code !== group.code)
                              .map((acct) => {
                                const bal = balanceByCode.get(acct.code) || 0;
                                return (
                                  <tr
                                    key={acct.code}
                                    className={`hover:bg-hq-elevated/60 transition-colors ${
                                      acct.isActive ? '' : 'opacity-55'
                                    }`}
                                  >
                                    <td className="px-4 py-3 pl-9 font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                                      {acct.code}
                                    </td>
                                    <td className="px-4 py-3">
                                      <p className="font-medium text-hq-textPrimary">{acct.name}</p>
                                      {acct.description && (
                                        <p className="text-xs text-hq-textMuted">{acct.description}</p>
                                      )}
                                    </td>
                                    <td className="px-4 py-3 font-ds-mono text-[11px] text-hq-textMuted whitespace-nowrap">
                                      {acct.normalBalance}
                                    </td>
                                    <td className="px-4 py-3 whitespace-nowrap">
                                      <StatusPill tone={acct.isActive ? 'in' : 'neutral'}>
                                        {acct.isActive ? 'Active' : 'Archived'}
                                      </StatusPill>
                                    </td>
                                    <td className="px-4 py-3 text-right font-ds-mono text-xs tabular-nums text-hq-textPrimary whitespace-nowrap">
                                      {formatMoney(bal, displayCurrency)}
                                    </td>
                                    <td className="px-4 py-3 text-right whitespace-nowrap">
                                      <div className="inline-flex items-center gap-1.5">
                                        <button
                                          type="button"
                                          onClick={() => switchTab('ledger', acct.code)}
                                          className="inline-flex items-center gap-1 rounded border border-hq-brand/40 bg-hq-brand/10 px-2.5 py-1 text-xs font-medium text-hq-brandSoft hover:bg-hq-brand hover:text-white transition-colors"
                                        >
                                          <BookOpen className="h-3 w-3" />
                                          Ledger
                                        </button>
                                        {editable && (
                                          <>
                                            <button
                                              type="button"
                                              onClick={() => openEditCoa(acct)}
                                              className="rounded border border-hq-borderDefault px-2.5 py-1 text-xs text-hq-textPrimary hover:bg-hq-elevated"
                                            >
                                              Edit
                                            </button>
                                            {!acct.isSystem && (
                                              <button
                                                type="button"
                                                onClick={() => void handleToggleArchiveCoa(acct)}
                                                className="inline-flex items-center gap-1 rounded border border-hq-borderDefault px-2.5 py-1 text-xs text-hq-textSecondary hover:bg-hq-elevated"
                                              >
                                                <Archive className="h-3 w-3" />
                                                {acct.isActive ? 'Archive' : 'Restore'}
                                              </button>
                                            )}
                                          </>
                                        )}
                                      </div>
                                    </td>
                                  </tr>
                                );
                              })}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 2: JOURNALS */}
      {activeTab === 'journals' && (
        <div className="space-y-4">
          <div className="hq-card p-3.5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-ds-mono text-[11px] uppercase text-hq-textMuted mr-1">Type:</span>
              {(['ALL', 'INCOME', 'EXPENSE', 'GENERAL'] as const).map((type) => (
                <button
                  key={type}
                  type="button"
                  onClick={() => setJournalTypeFilter(type)}
                  className={`rounded-full px-3 py-1 font-ds-mono text-[11px] transition-colors ${
                    journalTypeFilter === type
                      ? 'bg-hq-brand text-white font-semibold'
                      : 'border border-hq-borderDefault text-hq-textSecondary hover:bg-hq-elevated'
                  }`}
                >
                  {type}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-1.5">
              <span className="font-ds-mono text-[11px] uppercase text-hq-textMuted mr-1">Status:</span>
              {(['ALL', 'DRAFT', 'POSTED', 'REVERSED'] as const).map((status) => (
                <button
                  key={status}
                  type="button"
                  onClick={() => setJournalStatusFilter(status)}
                  className={`rounded-full px-3 py-1 font-ds-mono text-[11px] transition-colors ${
                    journalStatusFilter === status
                      ? 'bg-hq-brand text-white font-semibold'
                      : 'border border-hq-borderDefault text-hq-textSecondary hover:bg-hq-elevated'
                  }`}
                >
                  {status}
                </button>
              ))}
            </div>
          </div>

          <div className="hq-card overflow-hidden">
            {journalsLoading && journals.length === 0 ? (
              <TableSkeleton rows={6} cols={7} />
            ) : journals.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<Landmark className="h-5 w-5" />}
                  title="No Journal Entries Found"
                  description="Record your first income, expense, or general double-entry journal to populate the ledger."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[980px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
                      <th className="px-4 py-3 whitespace-nowrap">Entry #</th>
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 whitespace-nowrap">Type / Status</th>
                      <th className="px-4 py-3">Description</th>
                      <th className="px-4 py-3 whitespace-nowrap">FX Rate (Date)</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Native Amount</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">
                        Display ({displayCurrency})
                      </th>
                      {editable && <th className="px-4 py-3 text-right whitespace-nowrap">Actions</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle text-sm">
                    {journals.map((entry) => {
                      const isExpanded = expandedJournalId === entry.id;
                      const typeTone =
                        entry.entryType === 'INCOME'
                          ? 'in'
                          : entry.entryType === 'EXPENSE'
                            ? 'out'
                            : 'brand';
                      const statusTone =
                        entry.status === 'POSTED'
                          ? 'in'
                          : entry.status === 'DRAFT'
                            ? 'warn'
                            : 'out';
                      const isBaseCurrencyEntry = entry.currency === entry.baseCurrency;
                      const fxVal = parseDecimal(entry.fxRateUsed);

                      return (
                        <React.Fragment key={entry.id}>
                          <tr
                            onClick={() =>
                              setExpandedJournalId(isExpanded ? null : entry.id)
                            }
                            className="cursor-pointer hover:bg-hq-elevated/60 transition-colors"
                          >
                            <td className="px-4 py-3 font-ds-mono text-xs font-semibold tabular-nums text-hq-brandSoft whitespace-nowrap">
                              {entry.entryNumber}
                            </td>
                            <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                              {entry.entryDate}
                            </td>
                            <td className="px-4 py-3 whitespace-nowrap">
                              <div className="flex items-center gap-1.5">
                                <StatusPill tone={typeTone}>{entry.entryType}</StatusPill>
                                <StatusPill tone={statusTone}>{entry.status}</StatusPill>
                              </div>
                            </td>
                            <td className="px-4 py-3 max-w-[260px]">
                              <p className="truncate font-medium text-hq-textPrimary">
                                {entry.description}
                              </p>
                              {entry.reference && (
                                <p className="font-ds-mono text-[11px] text-hq-textMuted">
                                  Ref: {entry.reference}
                                </p>
                              )}
                            </td>
                            <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                              {isBaseCurrencyEntry
                                ? '1.00 (Base)'
                                : `${fxVal.toFixed(2)} (${entry.fxRateDate || entry.entryDate})`}
                            </td>
                            <td className="px-4 py-3 text-right font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                              {formatMoney(entry.totalDebitOrig, entry.currency)}
                            </td>
                            <td className="px-4 py-3 text-right font-ds-mono text-xs font-semibold tabular-nums text-hq-textPrimary whitespace-nowrap">
                              {displayCurrency === entry.currency
                                ? formatMoney(entry.totalDebitOrig, entry.currency)
                                : displayCurrency === entry.baseCurrency
                                  ? formatMoney(entry.totalDebitBase, entry.baseCurrency)
                                  : formatInDisplay(entry.totalDebitBase, entry.baseCurrency)}
                            </td>
                            {editable && (
                              <td
                                className="px-4 py-3 text-right whitespace-nowrap"
                                onClick={(e) => e.stopPropagation()}
                              >
                                {entry.status === 'DRAFT' && (
                                  <button
                                    type="button"
                                    disabled={postingId === entry.id}
                                    onClick={() => void handlePostDraft(entry)}
                                    className="inline-flex items-center gap-1 rounded-full bg-hq-inBg border border-hq-in/40 px-3 py-1 text-xs font-semibold text-hq-in hover:opacity-90"
                                  >
                                    <Send className="h-3 w-3" />
                                    {postingId === entry.id ? 'Posting...' : 'Post Draft'}
                                  </button>
                                )}
                                {entry.status === 'POSTED' && !entry.reversedByEntryId && (
                                  <button
                                    type="button"
                                    onClick={() => setReversingEntry(entry)}
                                    className="inline-flex items-center gap-1 rounded-full border border-hq-out/40 bg-hq-outBg px-3 py-1 text-xs font-medium text-hq-out hover:bg-hq-out hover:text-white transition-colors"
                                  >
                                    <RotateCcw className="h-3 w-3" />
                                    Reverse
                                  </button>
                                )}
                              </td>
                            )}
                          </tr>

                          {isExpanded && (
                            <tr className="bg-hq-subtle/70">
                              <td colSpan={editable ? 8 : 7} className="px-6 py-4">
                                <div className="mb-2 flex flex-wrap items-center justify-between gap-2 font-ds-mono text-[11px] text-hq-textMuted">
                                  <span>
                                    FX Stamped: {entry.fxRateUsed} ({entry.fxRateDate}) · Base:{' '}
                                    {entry.baseCurrency}
                                  </span>
                                  <span>Lines: {entry.lines.length}</span>
                                </div>
                                <table className="w-full text-xs">
                                  <thead>
                                    <tr className="border-b border-hq-borderSubtle font-ds-mono text-[10px] uppercase text-hq-textMuted">
                                      <th className="py-1.5 text-left">Account</th>
                                      <th className="py-1.5 text-left">Memo</th>
                                      <th className="py-1.5 text-right whitespace-nowrap">
                                        Debit ({entry.currency})
                                      </th>
                                      <th className="py-1.5 text-right whitespace-nowrap">
                                        Credit ({entry.currency})
                                      </th>
                                    </tr>
                                  </thead>
                                  <tbody className="divide-y divide-hq-borderSubtle/50">
                                    {entry.lines.map((line) => (
                                      <tr key={line.lineNo}>
                                        <td className="py-1.5 font-ds-mono text-hq-textPrimary">
                                          <button
                                            type="button"
                                            onClick={() => switchTab('ledger', line.accountCode)}
                                            className="hover:text-hq-brandSoft hover:underline"
                                          >
                                            {line.accountCode} {line.accountNameSnapshot || ''}
                                          </button>
                                        </td>
                                        <td className="py-1.5 text-hq-textSecondary">
                                          {line.memo || '--'}
                                        </td>
                                        <td className="py-1.5 text-right font-ds-mono tabular-nums text-hq-textPrimary whitespace-nowrap">
                                          {parseDecimal(line.debitOrig) > 0
                                            ? formatMoney(line.debitOrig, entry.currency)
                                            : '--'}
                                        </td>
                                        <td className="py-1.5 text-right font-ds-mono tabular-nums text-hq-textPrimary whitespace-nowrap">
                                          {parseDecimal(line.creditOrig) > 0
                                            ? formatMoney(line.creditOrig, entry.currency)
                                            : '--'}
                                        </td>
                                      </tr>
                                    ))}
                                  </tbody>
                                </table>
                              </td>
                            </tr>
                          )}
                        </React.Fragment>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            {journalNextCursor && (
              <div className="border-t border-hq-borderSubtle p-3 text-center">
                <button
                  type="button"
                  disabled={journalsLoading}
                  onClick={() => void loadJournals(journalNextCursor)}
                  className="hq-btn-secondary h-9 px-5 text-xs"
                >
                  {journalsLoading ? 'Loading...' : 'Load More Entries'}
                </button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 3: GENERAL LEDGER */}
      {activeTab === 'ledger' && (
        <div className="space-y-4">
          <div className="no-print hq-card p-4 flex flex-wrap items-end justify-between gap-3">
            <div className="flex flex-wrap items-end gap-3 flex-1 min-w-[280px]">
              <div className="min-w-[240px] flex-1 max-w-md">
                <label className="mb-1 block font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
                  COA Account
                </label>
                <select
                  value={ledgerAccountCode}
                  onChange={(e) => {
                    setLedgerAccountCode(e.target.value);
                    setSearchParams({ tab: 'ledger', account: e.target.value }, { replace: true });
                  }}
                  className="hq-input h-9 w-full px-3 text-xs"
                >
                  {COA_GROUPS.map((grp) => {
                    const items = accounts
                      .filter((a) => a.category === grp.category && a.code !== grp.code)
                      .sort((a, b) => a.code.localeCompare(b.code));
                    if (items.length === 0) return null;
                    return (
                      <optgroup key={grp.code} label={`${grp.code} — ${grp.label}`}>
                        {items.map((a) => (
                          <option key={a.code} value={a.code}>
                            {a.code} — {a.name}
                          </option>
                        ))}
                      </optgroup>
                    );
                  })}
                </select>
              </div>

              <div>
                <label className="mb-1 block font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
                  From Date
                </label>
                <input
                  type="date"
                  value={ledgerDateFrom}
                  onChange={(e) => setLedgerDateFrom(e.target.value)}
                  className="hq-input h-9 px-2.5 font-ds-mono text-xs tabular-nums"
                />
              </div>

              <div>
                <label className="mb-1 block font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
                  To Date
                </label>
                <input
                  type="date"
                  value={ledgerDateTo}
                  onChange={(e) => setLedgerDateTo(e.target.value)}
                  className="hq-input h-9 px-2.5 font-ds-mono text-xs tabular-nums"
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={!ledgerData}
                onClick={handleExportLedgerCsv}
                className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                Print
              </button>
            </div>
          </div>

          {/* 4-KPI Ledger Summary Strip */}
          {ledgerData && (
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
              <div className="hq-card p-4">
                <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
                  Opening Balance
                </p>
                <p className="mt-1.5 font-ds-mono text-lg font-semibold tabular-nums text-hq-textPrimary">
                  {formatMoney(ledgerData.openingBalanceDisplay, ledgerData.displayCurrency)}
                </p>
                <p className="mt-0.5 text-[11px] text-hq-textMuted">
                  Prior to {ledgerDateFrom || 'inception'}
                </p>
              </div>
              <div className="hq-card p-4">
                <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
                  Period Total Debits
                </p>
                <p className="mt-1.5 font-ds-mono text-lg font-semibold tabular-nums text-hq-in">
                  {formatMoney(ledgerData.periodDebitDisplay, ledgerData.displayCurrency)}
                </p>
                <p className="mt-0.5 font-ds-mono text-[11px] text-hq-textMuted">
                  Normal: {ledgerData.account.normalBalance}
                </p>
              </div>
              <div className="hq-card p-4">
                <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
                  Period Total Credits
                </p>
                <p className="mt-1.5 font-ds-mono text-lg font-semibold tabular-nums text-hq-out">
                  {formatMoney(ledgerData.periodCreditDisplay, ledgerData.displayCurrency)}
                </p>
                <p className="mt-0.5 font-ds-mono text-[11px] text-hq-textMuted">
                  {ledgerData.entries.length} ledger postings
                </p>
              </div>
              <div className="hq-card border-hq-brand/40 p-4">
                <p className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-brandSoft">
                  Closing Balance
                </p>
                <p className="mt-1.5 font-ds-mono text-lg font-bold tabular-nums text-hq-textPrimary">
                  {formatMoney(ledgerData.closingBalanceDisplay, ledgerData.displayCurrency)}
                </p>
                <p className="mt-0.5 text-[11px] text-hq-textMuted">
                  As of {ledgerData.dateTo}
                </p>
              </div>
            </div>
          )}

          {/* Chronological Ledger Table */}
          <div className="hq-card overflow-hidden">
            {ledgerLoading ? (
              <TableSkeleton rows={6} cols={8} />
            ) : !ledgerData ? (
              <div className="p-6">
                <EmptyState
                  icon={<BookOpen className="h-5 w-5" />}
                  title="Select a Chart of Accounts Code"
                  description="Choose an account above to inspect its chronological double-entry ledger and running balance."
                />
              </div>
            ) : ledgerData.entries.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<BookOpen className="h-5 w-5" />}
                  title={`No Activity in ${ledgerData.account.code} — ${ledgerData.account.name}`}
                  description={`No posted journal entries hit account ${ledgerData.account.code} between ${ledgerDateFrom} and ${ledgerDateTo}.`}
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[1040px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
                      <th className="px-4 py-3 whitespace-nowrap">Date</th>
                      <th className="px-4 py-3 whitespace-nowrap">Entry #</th>
                      <th className="px-4 py-3">Description &amp; Memo</th>
                      <th className="px-4 py-3">Counter-Account</th>
                      <th className="px-4 py-3 whitespace-nowrap">Currency &amp; FX</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">
                        Debit ({ledgerData.displayCurrency})
                      </th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">
                        Credit ({ledgerData.displayCurrency})
                      </th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">
                        Running Balance ({ledgerData.displayCurrency})
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle text-sm">
                    <tr className="bg-hq-subtle/50 font-ds-mono text-xs text-hq-textSecondary">
                      <td className="px-4 py-2.5 whitespace-nowrap">{ledgerDateFrom || '--'}</td>
                      <td className="px-4 py-2.5 whitespace-nowrap">--</td>
                      <td colSpan={5} className="px-4 py-2.5 italic">
                        Opening Balance Brought Forward ({ledgerData.account.code}{' '}
                        {ledgerData.account.name})
                      </td>
                      <td className="px-4 py-2.5 text-right font-semibold tabular-nums text-hq-textPrimary whitespace-nowrap">
                        {formatMoney(ledgerData.openingBalanceDisplay, ledgerData.displayCurrency)}
                      </td>
                    </tr>
                    {ledgerData.entries.map((row, idx) => (
                      <tr
                        key={`${row.entryId}-${idx}`}
                        className="hover:bg-hq-elevated/60 transition-colors"
                      >
                        <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                          {row.entryDate}
                        </td>
                        <td className="px-4 py-3 font-ds-mono text-xs font-semibold tabular-nums text-hq-brandSoft whitespace-nowrap">
                          {row.entryNumber}
                        </td>
                        <td className="px-4 py-3 max-w-[260px]">
                          <p className="font-medium text-hq-textPrimary truncate">
                            {row.description}
                          </p>
                          {row.memo && row.memo !== row.description && (
                            <p className="text-xs text-hq-textMuted truncate">{row.memo}</p>
                          )}
                        </td>
                        <td className="px-4 py-3 font-ds-mono text-xs text-hq-textSecondary max-w-[200px] truncate">
                          {row.counterAccounts.join(', ') || '--'}
                        </td>
                        <td className="px-4 py-3 font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                          {row.currency === ledgerData.baseCurrency
                            ? `${row.currency} (1.00)`
                            : `${row.currency} @ ${parseDecimal(row.fxRateUsed).toFixed(2)}`}
                        </td>
                        <td className="px-4 py-3 text-right font-ds-mono text-xs tabular-nums text-hq-textPrimary whitespace-nowrap">
                          {parseDecimal(row.debitDisplay) > 0
                            ? formatMoney(row.debitDisplay, ledgerData.displayCurrency)
                            : '--'}
                        </td>
                        <td className="px-4 py-3 text-right font-ds-mono text-xs tabular-nums text-hq-textPrimary whitespace-nowrap">
                          {parseDecimal(row.creditDisplay) > 0
                            ? formatMoney(row.creditDisplay, ledgerData.displayCurrency)
                            : '--'}
                        </td>
                        <td className="px-4 py-3 text-right font-ds-mono text-xs font-semibold tabular-nums text-hq-textPrimary whitespace-nowrap">
                          {formatMoney(row.runningBalanceDisplay, ledgerData.displayCurrency)}
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

      {/* TAB 4: BUDGETS VS ACTUAL */}
      {activeTab === 'budgets' && (
        <div className="space-y-4">
          <div className="hq-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="inline-flex rounded-full border border-hq-borderDefault bg-hq-subtle p-0.5">
                {(['MONTHLY', 'QUARTERLY'] as BudgetPeriodType[]).map((pt) => (
                  <button
                    key={pt}
                    type="button"
                    onClick={() => {
                      setBudgetPeriodType(pt);
                      setBudgetPeriodKey(
                        pt === 'MONTHLY' ? getCurrentMonthKey() : getCurrentQuarterKey()
                      );
                    }}
                    className={`rounded-full px-3 py-1 font-ds-mono text-[11px] transition-colors ${
                      budgetPeriodType === pt
                        ? 'bg-hq-brand text-white font-semibold'
                        : 'text-hq-textSecondary hover:text-hq-textPrimary'
                    }`}
                  >
                    {pt}
                  </button>
                ))}
              </div>

              {budgetPeriodType === 'MONTHLY' ? (
                <input
                  type="month"
                  value={budgetPeriodKey}
                  onChange={(e) => setBudgetPeriodKey(e.target.value)}
                  className="hq-input h-9 px-3 font-ds-mono text-xs tabular-nums"
                />
              ) : (
                <input
                  type="text"
                  value={budgetPeriodKey}
                  onChange={(e) => setBudgetPeriodKey(e.target.value.toUpperCase())}
                  placeholder="2026-Q4"
                  className="hq-input h-9 w-32 px-3 font-ds-mono text-xs uppercase tabular-nums"
                />
              )}
            </div>

            {editable && (
              <button
                type="button"
                onClick={() => {
                  setBudgetForm({
                    accountCode: '5010',
                    currency: displayCurrency,
                    targetAmount: '',
                    notes: '',
                  });
                  setBudgetModalOpen(true);
                }}
                className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
              >
                <Plus className="h-3.5 w-3.5" />
                Set Budget Target
              </button>
            )}
          </div>

          <div className="hq-card overflow-hidden">
            {budgetsLoading ? (
              <TableSkeleton rows={5} cols={6} />
            ) : !budgetReport || budgetReport.rows.length === 0 ? (
              <div className="p-6">
                <EmptyState
                  icon={<FileSpreadsheet className="h-5 w-5" />}
                  title={`No Budgets for ${budgetPeriodKey}`}
                  description="Assign monthly or quarterly COA targets to track actual ledger burn and variance."
                />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[780px] border-collapse text-left">
                  <thead>
                    <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase text-hq-textMuted">
                      <th className="px-4 py-3">COA Account</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Budget Target</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Actual</th>
                      <th className="px-4 py-3 text-right whitespace-nowrap">Variance</th>
                      <th className="px-4 py-3 w-52">Utilization</th>
                      {editable && <th className="px-4 py-3 text-right whitespace-nowrap">Action</th>}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-hq-borderSubtle text-sm">
                    {budgetReport.rows.map((row) => {
                      const target = parseDecimal(row.targetBase);
                      const actual = parseDecimal(row.actualBase);
                      const variance = parseDecimal(row.varianceBase);
                      const util = target > 0 ? (actual / target) * 100 : actual > 0 ? 100 : 0;
                      const tone: 'in' | 'warn' | 'out' =
                        util > 100 ? 'out' : util >= 80 ? 'warn' : 'in';
                      const barClass =
                        tone === 'out'
                          ? 'bg-hq-out'
                          : tone === 'warn'
                            ? 'bg-hq-warn'
                            : 'bg-hq-in';

                      return (
                        <tr key={row.accountCode} className="hover:bg-hq-elevated/60">
                          <td className="px-4 py-3">
                            <span className="font-ds-mono text-xs text-hq-brandSoft mr-2">
                              {row.accountCode}
                            </span>
                            <span className="font-medium text-hq-textPrimary">
                              {row.accountName}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-right font-ds-mono text-xs tabular-nums text-hq-textPrimary whitespace-nowrap">
                            {formatMoney(target, budgetReport.baseCurrency)}
                          </td>
                          <td className="px-4 py-3 text-right font-ds-mono text-xs tabular-nums text-hq-textSecondary whitespace-nowrap">
                            {formatMoney(actual, budgetReport.baseCurrency)}
                          </td>
                          <td
                            className={`px-4 py-3 text-right font-ds-mono text-xs font-semibold tabular-nums whitespace-nowrap ${
                              variance >= 0 ? 'text-hq-in' : 'text-hq-out'
                            }`}
                          >
                            {variance >= 0 ? '+' : ''}
                            {formatMoney(variance, budgetReport.baseCurrency)}
                          </td>
                          <td className="px-4 py-3">
                            <div className="flex items-center gap-2">
                              <div className="h-2 flex-1 overflow-hidden rounded-full bg-hq-elevated">
                                <div
                                  className={`h-full rounded-full ${barClass}`}
                                  style={{ width: `${Math.min(util, 100)}%` }}
                                />
                              </div>
                              <StatusPill tone={tone}>{util.toFixed(1)}%</StatusPill>
                            </div>
                          </td>
                          {editable && (
                            <td className="px-4 py-3 text-right whitespace-nowrap">
                              <button
                                type="button"
                                onClick={() => {
                                  setBudgetForm({
                                    accountCode: row.accountCode,
                                    currency: budgetReport.baseCurrency,
                                    targetAmount: formatDecimalInput(target, 2),
                                    notes: '',
                                  });
                                  setBudgetModalOpen(true);
                                }}
                                className="rounded border border-hq-borderDefault px-2.5 py-1 text-xs text-hq-textPrimary hover:bg-hq-elevated"
                              >
                                Edit
                              </button>
                            </td>
                          )}
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* TAB 5: OFFICIAL ISO-COMPLIANT FINANCIAL REPORTS */}
      {activeTab === 'reports' && (
        <div className="space-y-4">
          <div className="no-print hq-card p-4 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-1.5">
              {(
                [
                  ['pnl', 'Income Statement (P&L)'],
                  ['balance-sheet', 'Balance Sheet'],
                  ['trial-balance', 'Trial Balance'],
                  ['money-usage', 'Money Usage by COA'],
                ] as const
              ).map(([view, label]) => (
                <button
                  key={view}
                  type="button"
                  onClick={() => setReportView(view)}
                  className={`rounded-full px-3.5 py-1.5 text-xs font-medium transition-colors ${
                    reportView === view
                      ? 'bg-hq-brand text-white'
                      : 'border border-hq-borderDefault text-hq-textSecondary hover:bg-hq-elevated'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="flex flex-wrap items-center gap-2">
              <input
                type="date"
                value={reportDateFrom}
                onChange={(e) => setReportDateFrom(e.target.value)}
                aria-label="Report start date"
                className="hq-input h-9 px-2.5 font-ds-mono text-xs tabular-nums"
              />
              <span className="text-xs text-hq-textMuted">to</span>
              <input
                type="date"
                value={reportDateTo}
                onChange={(e) => setReportDateTo(e.target.value)}
                aria-label="Report end date"
                className="hq-input h-9 px-2.5 font-ds-mono text-xs tabular-nums"
              />
              <button
                type="button"
                onClick={handleExportReportCsv}
                className="hq-btn-secondary inline-flex h-9 items-center gap-1.5 px-3 text-xs"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => window.print()}
                className="hq-btn-primary inline-flex h-9 items-center gap-1.5 px-4 text-xs"
              >
                <Printer className="h-3.5 w-3.5" />
                Print / Save PDF
              </button>
            </div>
          </div>

          {reportsLoading ? (
            <div className="hq-card p-6">
              <TableSkeleton rows={10} cols={4} />
            </div>
          ) : (
            <OfficeReports
              reportType={reportView}
              dateFrom={reportDateFrom}
              dateTo={reportDateTo}
              displayCurrency={displayCurrency}
              incomeStmt={incomeStmt}
              balanceSheet={balanceSheet}
              trialBalance={trialBalance}
              preparedBy={user?.name || user?.email || 'Thea HQ Finance'}
            />
          )}
        </div>
      )}

      {/* Modals */}
      {quickModalMode && (
        <QuickJournalModal
          open={Boolean(quickModalMode)}
          mode={quickModalMode}
          onClose={() => setQuickModalMode(null)}
          accounts={accounts}
          associates={associates}
          onCreated={() => {
            void loadJournals();
            void loadMasterData();
            if (activeTab === 'ledger') void loadLedger();
          }}
        />
      )}

      <GeneralJournalModal
        open={generalModalOpen}
        onClose={() => setGeneralModalOpen(false)}
        accounts={accounts}
        onCreated={() => {
          void loadJournals();
          void loadMasterData();
          if (activeTab === 'ledger') void loadLedger();
        }}
      />

      <ReverseJournalModal
        entry={reversingEntry}
        onClose={() => setReversingEntry(null)}
        onReversed={() => {
          void loadJournals();
          void loadMasterData();
          if (activeTab === 'ledger') void loadLedger();
        }}
      />

      {/* Add/Edit COA Modal */}
      <Modal
        open={coaModalOpen}
        onClose={() => setCoaModalOpen(false)}
        title={editingAccount ? `Edit Account ${editingAccount.code}` : 'Add Chart of Accounts Entry'}
        footer={
          <>
            <button
              type="button"
              onClick={() => setCoaModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="coa-form"
              disabled={coaSaving}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {coaSaving ? 'Saving...' : 'Save Account'}
            </button>
          </>
        }
      >
        <form id="coa-form" onSubmit={handleSaveCoa} className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Account Code (4 digits) *
              </label>
              <input
                type="text"
                required
                disabled={Boolean(editingAccount)}
                pattern="^[1-6]\d{3}$"
                value={coaForm.code}
                onChange={(e) => setCoaForm({ ...coaForm, code: e.target.value })}
                placeholder="6080"
                className="hq-input h-10 w-full px-3 font-ds-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Category *</label>
              <select
                disabled={Boolean(editingAccount)}
                value={coaForm.category}
                onChange={(e) => {
                  const cat = e.target.value as CoaCategory;
                  const grp = COA_GROUPS.find((g) => g.category === cat);
                  setCoaForm({ ...coaForm, category: cat, parentCode: grp?.code || '' });
                }}
                className="hq-input h-10 w-full px-3 text-sm"
              >
                {COA_GROUPS.map((g) => (
                  <option key={g.category} value={g.category}>
                    {g.code} — {g.label}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Account Name *</label>
            <input
              type="text"
              required
              value={coaForm.name}
              onChange={(e) => setCoaForm({ ...coaForm, name: e.target.value })}
              placeholder="AI Compute & API Credits"
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Description</label>
            <textarea
              rows={2}
              value={coaForm.description}
              onChange={(e) => setCoaForm({ ...coaForm, description: e.target.value })}
              className="hq-input w-full px-3 py-2 text-sm"
            />
          </div>
        </form>
      </Modal>

      {/* Add/Edit Budget Modal */}
      <Modal
        open={budgetModalOpen}
        onClose={() => setBudgetModalOpen(false)}
        title={`Set Budget Target (${budgetPeriodKey})`}
        footer={
          <>
            <button
              type="button"
              onClick={() => setBudgetModalOpen(false)}
              className="hq-btn-secondary h-9 px-4 text-xs"
            >
              Cancel
            </button>
            <button
              type="submit"
              form="budget-form"
              disabled={budgetSaving}
              className="hq-btn-primary h-9 px-5 text-xs"
            >
              {budgetSaving ? 'Saving...' : 'Save Budget'}
            </button>
          </>
        }
      >
        <form id="budget-form" onSubmit={handleSaveBudget} className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">COA Account *</label>
            <select
              value={budgetForm.accountCode}
              onChange={(e) => setBudgetForm({ ...budgetForm, accountCode: e.target.value })}
              className="hq-input h-10 w-full px-3 text-xs"
            >
              {accounts
                .filter(
                  (a) =>
                    a.isActive &&
                    ['REVENUE', 'COGS', 'OPEX'].includes(a.category) &&
                    !a.code.endsWith('000')
                )
                .map((a) => (
                  <option key={a.code} value={a.code}>
                    {a.code} — {a.name}
                  </option>
                ))}
            </select>
          </div>

          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
                Target Amount *
              </label>
              <input
                type="number"
                step="0.01"
                min="0"
                required
                value={budgetForm.targetAmount}
                onChange={(e) => setBudgetForm({ ...budgetForm, targetAmount: e.target.value })}
                className="hq-input h-10 w-full px-3 text-right font-ds-mono text-sm tabular-nums"
              />
            </div>
            <div>
              <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Currency *</label>
              <select
                value={budgetForm.currency}
                onChange={(e) =>
                  setBudgetForm({ ...budgetForm, currency: e.target.value as CurrencyCode })
                }
                className="hq-input h-10 w-full px-3 font-ds-mono text-sm"
              >
                <option value="MMK">MMK</option>
                <option value="THB">THB</option>
              </select>
            </div>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Notes</label>
            <input
              type="text"
              value={budgetForm.notes}
              onChange={(e) => setBudgetForm({ ...budgetForm, notes: e.target.value })}
              placeholder="Sprint allocation or expected invoice target"
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>
        </form>
      </Modal>
    </div>
  );
}
