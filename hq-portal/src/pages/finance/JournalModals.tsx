import React, { useEffect, useMemo, useState } from 'react';
import { AlertCircle, AlertTriangle, CheckCircle2, Plus, RefreshCw, Trash2 } from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useCurrency } from '@/context/CurrencyContext';
import { useToast } from '@/context/ToastContext';
import {
  formatDecimalInput,
  formatMoney,
  getTodayIso,
  parseDecimal,
} from '@/lib/format';
import { Modal } from '@/components/ui/Primitives';
import type {
  AssociateDTO,
  CoaAccountDTO,
  CurrencyCode,
  JournalEntryDTO,
  ResolvedFxRateDTO,
} from '@/types/hq';

interface FxResolutionState {
  loading: boolean;
  resolved: ResolvedFxRateDTO | null;
  error: string | null;
}

function useResolvedEntryFx(
  open: boolean,
  entryDate: string,
  currency: CurrencyCode,
  baseCurrency: CurrencyCode
): FxResolutionState {
  const [state, setState] = useState<FxResolutionState>({
    loading: false,
    resolved: null,
    error: null,
  });

  useEffect(() => {
    if (!open || !entryDate || !/^\d{4}-\d{2}-\d{2}$/.test(entryDate)) {
      return;
    }

    if (currency === baseCurrency) {
      setState({
        loading: false,
        resolved: {
          requestedDate: entryDate,
          fromCurrency: currency,
          toCurrency: baseCurrency,
          rate: '1.000000',
          fxRateDate: entryDate,
          isExactDateMatch: true,
        },
        error: null,
      });
      return;
    }

    let cancelled = false;
    setState((prev) => ({ ...prev, loading: true, error: null }));

    const fetchRate = async () => {
      try {
        const res = await apiRequest<ResolvedFxRateDTO>(
          `/api/v1/accounting/fx-rates/resolve?date=${encodeURIComponent(entryDate)}&from=${currency}&to=${baseCurrency}`
        );
        if (!cancelled) {
          setState({ loading: false, resolved: res, error: null });
        }
      } catch (err) {
        if (!cancelled) {
          const message =
            err instanceof ApiError
              ? err.problem.detail || err.message
              : `No ${currency} -> ${baseCurrency} FX rate found on or before ${entryDate}.`;
          setState({ loading: false, resolved: null, error: message });
        }
      }
    };

    void fetchRate();
    return () => {
      cancelled = true;
    };
  }, [open, entryDate, currency, baseCurrency]);

  return state;
}

function EntryFxBanner({
  fxState,
  entryDate,
  currency,
  baseCurrency,
  amountOrig,
}: {
  fxState: FxResolutionState;
  entryDate: string;
  currency: CurrencyCode;
  baseCurrency: CurrencyCode;
  amountOrig: number;
}) {
  if (fxState.loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border border-hq-borderSubtle bg-hq-subtle px-3 py-2.5 font-ds-mono text-xs text-hq-textSecondary">
        <RefreshCw className="h-3.5 w-3.5 animate-spin text-hq-brandSoft shrink-0" />
        <span>Resolving stamped FX rate for {entryDate}...</span>
      </div>
    );
  }

  if (fxState.error || !fxState.resolved) {
    return (
      <div
        role="alert"
        className="flex items-start gap-2 rounded-lg border border-hq-out/40 bg-hq-outBg px-3.5 py-2.5 font-ds-mono text-xs text-hq-out"
      >
        <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
        <div>
          <p className="font-semibold">FX Rate Missing for {entryDate}</p>
          <p className="mt-0.5 font-sans text-xs">
            {fxState.error || `Log a ${currency} to ${baseCurrency} daily exchange rate in Administration -> FX Rates before posting.`}
          </p>
        </div>
      </div>
    );
  }

  const { resolved } = fxState;
  const rateNum = parseDecimal(resolved.rate);
  const equivalentBase = amountOrig * rateNum;

  if (currency === baseCurrency) {
    return (
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-hq-borderSubtle bg-hq-subtle px-3.5 py-2.5 font-ds-mono text-xs tabular-nums">
        <span className="text-hq-textSecondary">
          Base Currency Entry ({baseCurrency}) · Stamped Rate: <strong className="text-hq-textPrimary">1.0000</strong>
        </span>
        {amountOrig > 0 && (
          <span className="text-hq-textPrimary font-semibold">
            Ledger Base: {formatMoney(amountOrig, baseCurrency, { decimals: 2 })}
          </span>
        )}
      </div>
    );
  }

  const isPriorFallback = !resolved.isExactDateMatch;

  return (
    <div
      className={`rounded-lg border px-3.5 py-2.5 font-ds-mono text-xs tabular-nums space-y-1 ${
        isPriorFallback
          ? 'border-hq-warn/40 bg-hq-warnBg text-hq-warn'
          : 'border-hq-in/35 bg-hq-inBg text-hq-in'
      }`}
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <span className="inline-flex items-center gap-1.5 font-semibold">
          {isPriorFallback ? (
            <AlertTriangle className="h-3.5 w-3.5 shrink-0" />
          ) : (
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
          )}
          <span>
            Stamped FX Rate for {entryDate}: 1 {resolved.fromCurrency} = {rateNum.toFixed(2)}{' '}
            {resolved.toCurrency}
          </span>
        </span>
        {isPriorFallback && (
          <span className="rounded-full border border-hq-warn/40 bg-hq-surface/80 px-2 py-0.5 text-[10px] font-semibold">
            Using prior rate from {resolved.fxRateDate}
          </span>
        )}
      </div>
      {amountOrig > 0 && (
        <p className="text-[11px] text-hq-textPrimary">
          Equivalent: <strong>{formatMoney(equivalentBase, baseCurrency, { decimals: 2 })}</strong>{' '}
          (base currency)
        </p>
      )}
    </div>
  );
}

interface QuickModalProps {
  open: boolean;
  mode: 'INCOME' | 'EXPENSE';
  onClose: () => void;
  accounts: CoaAccountDTO[];
  associates: AssociateDTO[];
  onCreated: () => void;
}

export function QuickJournalModal({
  open,
  mode,
  onClose,
  accounts,
  associates,
  onCreated,
}: QuickModalProps) {
  const { baseCurrency } = useCurrency();
  const { pushToast } = useToast();

  const cashAccounts = useMemo(
    () => accounts.filter((a) => a.isActive && a.category === 'ASSET' && a.code.startsWith('10')),
    [accounts]
  );
  const revenueAccounts = useMemo(
    () => accounts.filter((a) => a.isActive && a.category === 'REVENUE' && a.code !== '4000'),
    [accounts]
  );
  const expenseAccounts = useMemo(
    () =>
      accounts.filter(
        (a) =>
          a.isActive &&
          (a.category === 'COGS' || a.category === 'OPEX') &&
          a.code !== '5000' &&
          a.code !== '6000'
      ),
    [accounts]
  );

  const [entryDate, setEntryDate] = useState(getTodayIso());
  const [currency, setCurrency] = useState<CurrencyCode>('MMK');
  const [amount, setAmount] = useState('');
  const [cashAccountCode, setCashAccountCode] = useState('');
  const [categoryAccountCode, setCategoryAccountCode] = useState('');
  const [associateId, setAssociateId] = useState('');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [postImmediately, setPostImmediately] = useState(true);
  const [submitting, setSubmitting] = useState(false);

  const fxState = useResolvedEntryFx(open, entryDate, currency, baseCurrency);

  const resolvedCash = cashAccountCode || cashAccounts[0]?.code || '1020';
  const categoryList = mode === 'INCOME' ? revenueAccounts : expenseAccounts;
  const resolvedCategory =
    categoryAccountCode || categoryList[0]?.code || (mode === 'INCOME' ? '4010' : '5010');

  const numericAmt = parseDecimal(amount);
  const fxBlocked = postImmediately && currency !== baseCurrency && !fxState.resolved;

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    if (numericAmt <= 0) {
      pushToast({ variant: 'error', title: 'Amount must be greater than zero' });
      return;
    }
    if (!description.trim()) {
      pushToast({ variant: 'error', title: 'Description is required' });
      return;
    }

    const amtStr = formatDecimalInput(numericAmt, 2);
    const lines =
      mode === 'INCOME'
        ? [
            {
              accountCode: resolvedCash,
              memo: description.trim(),
              debitOrig: amtStr,
              creditOrig: '0.00',
            },
            {
              accountCode: resolvedCategory,
              memo: description.trim(),
              debitOrig: '0.00',
              creditOrig: amtStr,
            },
          ]
        : [
            {
              accountCode: resolvedCategory,
              memo: description.trim(),
              debitOrig: amtStr,
              creditOrig: '0.00',
            },
            {
              accountCode: resolvedCash,
              memo: description.trim(),
              debitOrig: '0.00',
              creditOrig: amtStr,
            },
          ];

    setSubmitting(true);
    try {
      const created = await apiRequest<JournalEntryDTO>('/api/v1/accounting/journals', {
        method: 'POST',
        idempotent: true,
        body: {
          entryType: mode,
          entryDate,
          currency,
          description: description.trim(),
          reference: reference.trim() || undefined,
          associateId: mode === 'EXPENSE' && associateId ? associateId : undefined,
          lines,
          postImmediately,
        },
      });
      pushToast({
        variant: 'success',
        title: `${mode === 'INCOME' ? 'Income' : 'Expense'} journal ${created.status.toLowerCase()}`,
        description: `${created.entryNumber} · ${formatMoney(numericAmt, currency)}`,
      });
      setAmount('');
      setDescription('');
      setReference('');
      setAssociateId('');
      onCreated();
      onClose();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Journal creation failed',
        description: err instanceof ApiError ? err.message : 'Unable to save journal entry.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={mode === 'INCOME' ? 'Quick Income Journal' : 'Quick Expense Journal'}
      subtitle={
        mode === 'INCOME'
          ? 'Auto-generates balanced Debit Cash/Bank & Credit Revenue double-entry lines'
          : 'Auto-generates balanced Debit Expense/COGS & Credit Cash/Bank double-entry lines'
      }
      maxWidthClass="max-w-xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="hq-btn-secondary h-9 px-4 text-xs">
            Cancel
          </button>
          <button
            type="submit"
            form="quick-journal-form"
            disabled={submitting || fxBlocked}
            className="hq-btn-primary h-9 px-5 text-xs"
          >
            {submitting
              ? 'Recording...'
              : postImmediately
                ? `Post ${mode === 'INCOME' ? 'Income' : 'Expense'}`
                : 'Save Draft'}
          </button>
        </>
      }
    >
      <form id="quick-journal-form" onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Entry Date *</label>
            <input
              type="date"
              required
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="hq-input h-10 w-full px-3 font-ds-mono text-xs tabular-nums"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Currency *</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="hq-input h-10 w-full px-3 font-ds-mono text-sm"
            >
              <option value="MMK">MMK (Myanmar Kyat)</option>
              <option value="THB">THB (Thai Baht)</option>
            </select>
          </div>
        </div>

        <div>
          <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Amount *</label>
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0.01"
              required
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="hq-input h-11 w-full pl-3 pr-16 text-right font-ds-mono text-base tabular-nums"
            />
            <span className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 font-ds-mono text-xs font-semibold text-hq-brandSoft">
              {currency}
            </span>
          </div>
        </div>

        <EntryFxBanner
          fxState={fxState}
          entryDate={entryDate}
          currency={currency}
          baseCurrency={baseCurrency}
          amountOrig={numericAmt}
        />

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              {mode === 'INCOME' ? 'Deposit To (Cash/Bank 10xx)' : 'Paid From (Cash/Bank 10xx)'}
            </label>
            <select
              value={resolvedCash}
              onChange={(e) => setCashAccountCode(e.target.value)}
              className="hq-input h-10 w-full px-3 text-xs"
            >
              {cashAccounts.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              {mode === 'INCOME' ? 'Revenue Account (40xx)' : 'Expense / COGS Account (50xx / 60xx)'}
            </label>
            <select
              value={resolvedCategory}
              onChange={(e) => setCategoryAccountCode(e.target.value)}
              className="hq-input h-10 w-full px-3 text-xs"
            >
              {categoryList.map((a) => (
                <option key={a.code} value={a.code}>
                  {a.code} — {a.name}
                </option>
              ))}
            </select>
          </div>
        </div>

        {mode === 'EXPENSE' && (
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              Contractor / Associate Link (Optional)
            </label>
            <select
              value={associateId}
              onChange={(e) => setAssociateId(e.target.value)}
              className="hq-input h-10 w-full px-3 text-xs"
            >
              <option value="">None (General vendor / overhead)</option>
              {associates.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.employeeId} — {a.name} ({a.associateType})
                </option>
              ))}
            </select>
          </div>
        )}

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              Description / Counterparty *
            </label>
            <input
              type="text"
              required
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              placeholder={mode === 'INCOME' ? 'Client retainer invoice payment' : 'Sprint contractor payout'}
              className="hq-input h-10 w-full px-3 text-sm"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
              Reference / Invoice #
            </label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="INV-2026-042"
              className="hq-input h-10 w-full px-3 font-ds-mono text-xs"
            />
          </div>
        </div>

        <label className="inline-flex items-center gap-2 text-xs text-hq-textPrimary">
          <input
            type="checkbox"
            checked={postImmediately}
            onChange={(e) => setPostImmediately(e.target.checked)}
            className="h-4 w-4 accent-[#5F1F2F]"
          />
          Post immediately to immutable general ledger (stamp FX rate for {entryDate})
        </label>
      </form>
    </Modal>
  );
}

interface DraftLine {
  accountCode: string;
  memo: string;
  debitOrig: string;
  creditOrig: string;
}

export function GeneralJournalModal({
  open,
  onClose,
  accounts,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  accounts: CoaAccountDTO[];
  onCreated: () => void;
}) {
  const { baseCurrency } = useCurrency();
  const { pushToast } = useToast();

  const leafAccounts = useMemo(
    () => accounts.filter((a) => a.isActive && !a.code.endsWith('000')),
    [accounts]
  );

  const [entryDate, setEntryDate] = useState(getTodayIso());
  const [currency, setCurrency] = useState<CurrencyCode>('MMK');
  const [description, setDescription] = useState('');
  const [reference, setReference] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([
    { accountCode: '6010', memo: '', debitOrig: '', creditOrig: '' },
    { accountCode: '1020', memo: '', debitOrig: '', creditOrig: '' },
  ]);
  const [submitting, setSubmitting] = useState(false);

  const fxState = useResolvedEntryFx(open, entryDate, currency, baseCurrency);

  const totals = useMemo(() => {
    const totalDebit = lines.reduce((sum, l) => sum + parseDecimal(l.debitOrig), 0);
    const totalCredit = lines.reduce((sum, l) => sum + parseDecimal(l.creditOrig), 0);
    const diff = totalDebit - totalCredit;
    const validLineCount = lines.filter(
      (l) => l.accountCode && (parseDecimal(l.debitOrig) > 0 || parseDecimal(l.creditOrig) > 0)
    ).length;
    const isBalanced =
      validLineCount >= 2 && totalDebit > 0 && Math.abs(diff) < 0.005;
    return { totalDebit, totalCredit, diff, isBalanced, validLineCount };
  }, [lines]);

  const updateLine = (idx: number, patch: Partial<DraftLine>) => {
    setLines((prev) => prev.map((line, i) => (i === idx ? { ...line, ...patch } : line)));
  };

  const handleCreate = async (postImmediately: boolean) => {
    if (!description.trim()) {
      pushToast({ variant: 'error', title: 'Journal memo / description is required' });
      return;
    }
    if (!totals.isBalanced) {
      pushToast({ variant: 'error', title: 'Debits must equal Credits before saving' });
      return;
    }

    const cleanLines = lines
      .filter((l) => parseDecimal(l.debitOrig) > 0 || parseDecimal(l.creditOrig) > 0)
      .map((l) => ({
        accountCode: l.accountCode,
        memo: l.memo.trim() || undefined,
        debitOrig: formatDecimalInput(parseDecimal(l.debitOrig), 2),
        creditOrig: formatDecimalInput(parseDecimal(l.creditOrig), 2),
      }));

    setSubmitting(true);
    try {
      const created = await apiRequest<JournalEntryDTO>('/api/v1/accounting/journals', {
        method: 'POST',
        idempotent: true,
        body: {
          entryType: 'GENERAL',
          entryDate,
          currency,
          description: description.trim(),
          reference: reference.trim() || undefined,
          lines: cleanLines,
          postImmediately,
        },
      });
      pushToast({
        variant: 'success',
        title: postImmediately ? 'General journal posted' : 'Draft journal saved',
        description: created.entryNumber,
      });
      setDescription('');
      setReference('');
      setLines([
        { accountCode: leafAccounts[0]?.code || '6010', memo: '', debitOrig: '', creditOrig: '' },
        { accountCode: leafAccounts[1]?.code || '1020', memo: '', debitOrig: '', creditOrig: '' },
      ]);
      onCreated();
      onClose();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Unable to submit journal',
        description: err instanceof ApiError ? err.message : 'Check journal lines and try again.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  const fxBlockedForPost = currency !== baseCurrency && !fxState.resolved;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="New General Journal Entry"
      subtitle="Double-entry multi-line journal with real-time parity enforcement and entry-date FX stamping"
      maxWidthClass="max-w-3xl"
      footer={
        <>
          <button type="button" onClick={onClose} className="hq-btn-secondary h-9 px-4 text-xs">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting || !totals.isBalanced}
            onClick={() => void handleCreate(false)}
            className="hq-btn-secondary h-9 px-4 text-xs"
          >
            Save Draft
          </button>
          <button
            type="button"
            disabled={submitting || !totals.isBalanced || fxBlockedForPost}
            aria-disabled={submitting || !totals.isBalanced || fxBlockedForPost}
            onClick={() => void handleCreate(true)}
            className="hq-btn-primary h-9 px-5 text-xs"
          >
            {submitting ? 'Posting...' : 'Post Journal'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Date *</label>
            <input
              type="date"
              value={entryDate}
              onChange={(e) => setEntryDate(e.target.value)}
              className="hq-input h-10 w-full px-3 font-ds-mono text-xs tabular-nums"
            />
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Currency *</label>
            <select
              value={currency}
              onChange={(e) => setCurrency(e.target.value as CurrencyCode)}
              className="hq-input h-10 w-full px-3 font-ds-mono text-sm"
            >
              <option value="MMK">MMK</option>
              <option value="THB">THB</option>
            </select>
          </div>
          <div>
            <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Reference</label>
            <input
              type="text"
              value={reference}
              onChange={(e) => setReference(e.target.value)}
              placeholder="ADJ-2026-01"
              className="hq-input h-10 w-full px-3 font-ds-mono text-xs"
            />
          </div>
        </div>

        <EntryFxBanner
          fxState={fxState}
          entryDate={entryDate}
          currency={currency}
          baseCurrency={baseCurrency}
          amountOrig={totals.totalDebit}
        />

        <div>
          <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
            Journal Description / Memo *
          </label>
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Monthly allocation or inter-bank transfer"
            className="hq-input h-10 w-full px-3 text-sm"
          />
        </div>

        {/* Multi-Line Table */}
        <div className="overflow-x-auto rounded-xl border border-hq-borderSubtle">
          <table className="w-full min-w-[620px] border-collapse text-left">
            <thead>
              <tr className="border-b border-hq-borderSubtle bg-hq-subtle font-ds-mono text-[11px] uppercase text-hq-textMuted">
                <th className="px-3 py-2.5">Account (COA)</th>
                <th className="px-3 py-2.5">Line Memo</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Debit ({currency})</th>
                <th className="px-3 py-2.5 text-right whitespace-nowrap">Credit ({currency})</th>
                <th className="px-2 py-2.5 w-10" />
              </tr>
            </thead>
            <tbody className="divide-y divide-hq-borderSubtle">
              {lines.map((line, idx) => (
                <tr key={idx}>
                  <td className="p-2">
                    <select
                      value={line.accountCode}
                      onChange={(e) => updateLine(idx, { accountCode: e.target.value })}
                      className="hq-input h-9 w-full px-2 text-xs"
                    >
                      {leafAccounts.map((acct) => (
                        <option key={acct.code} value={acct.code}>
                          {acct.code} — {acct.name}
                        </option>
                      ))}
                    </select>
                  </td>
                  <td className="p-2">
                    <input
                      type="text"
                      value={line.memo}
                      onChange={(e) => updateLine(idx, { memo: e.target.value })}
                      placeholder="Line note"
                      className="hq-input h-9 w-full px-2.5 text-xs"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.debitOrig}
                      onChange={(e) =>
                        updateLine(idx, {
                          debitOrig: e.target.value,
                          creditOrig: parseDecimal(e.target.value) > 0 ? '' : line.creditOrig,
                        })
                      }
                      placeholder="0.00"
                      className="hq-input h-9 w-full px-2.5 text-right font-ds-mono text-xs tabular-nums"
                    />
                  </td>
                  <td className="p-2">
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      value={line.creditOrig}
                      onChange={(e) =>
                        updateLine(idx, {
                          creditOrig: e.target.value,
                          debitOrig: parseDecimal(e.target.value) > 0 ? '' : line.debitOrig,
                        })
                      }
                      placeholder="0.00"
                      className="hq-input h-9 w-full px-2.5 text-right font-ds-mono text-xs tabular-nums"
                    />
                  </td>
                  <td className="p-2 text-center">
                    <button
                      type="button"
                      disabled={lines.length <= 2}
                      onClick={() => setLines((prev) => prev.filter((_, i) => i !== idx))}
                      aria-label="Remove line"
                      className="rounded p-1 text-hq-out hover:bg-hq-outBg disabled:opacity-30"
                    >
                      <Trash2 className="h-3.5 w-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <button
          type="button"
          onClick={() =>
            setLines((prev) => [
              ...prev,
              {
                accountCode: leafAccounts[0]?.code || '6010',
                memo: '',
                debitOrig: '',
                creditOrig: '',
              },
            ])
          }
          className="hq-btn-secondary inline-flex h-8 items-center gap-1.5 px-3 text-xs"
        >
          <Plus className="h-3.5 w-3.5" />
          Add Journal Line
        </button>

        {/* Live Balance Meter */}
        <div
          aria-live="polite"
          className={`rounded-xl border p-4 font-ds-mono text-xs tabular-nums ${
            totals.totalDebit === 0 && totals.totalCredit === 0
              ? 'border-hq-borderSubtle bg-hq-subtle text-hq-textSecondary'
              : totals.isBalanced
                ? 'border-hq-in/40 bg-hq-inBg text-hq-in'
                : 'border-hq-out/40 bg-hq-outBg text-hq-out'
          }`}
        >
          <div className="flex flex-wrap items-center justify-between gap-2">
            <span>
              Total Debits: <strong>{formatMoney(totals.totalDebit, currency, { decimals: 2 })}</strong>
            </span>
            <span>
              Total Credits:{' '}
              <strong>{formatMoney(totals.totalCredit, currency, { decimals: 2 })}</strong>
            </span>
          </div>

          <div className="mt-2 flex items-center gap-2">
            {totals.totalDebit === 0 && totals.totalCredit === 0 ? (
              <span>Enter at least two opposing lines to balance this journal entry.</span>
            ) : totals.isBalanced ? (
              <>
                <CheckCircle2 className="h-4 w-4 shrink-0" />
                <span>
                  BALANCED (Diff: 0.00 {currency})
                </span>
              </>
            ) : (
              <>
                <AlertCircle className="h-4 w-4 shrink-0" />
                <span>
                  Out of Balance by {formatMoney(Math.abs(totals.diff), currency, { decimals: 2 })} —
                  Debits must equal Credits before posting.
                </span>
              </>
            )}
          </div>
        </div>
      </div>
    </Modal>
  );
}

export function ReverseJournalModal({
  entry,
  onClose,
  onReversed,
}: {
  entry: JournalEntryDTO | null;
  onClose: () => void;
  onReversed: () => void;
}) {
  const { pushToast } = useToast();
  const [reversalDate, setReversalDate] = useState(getTodayIso());
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleConfirm = async () => {
    if (!entry) return;
    if (!reason.trim()) {
      pushToast({ variant: 'error', title: 'Provide a reversal reason' });
      return;
    }
    setSubmitting(true);
    try {
      await apiRequest(`/api/v1/accounting/journals/${entry.id}/reverse`, {
        method: 'POST',
        idempotent: true,
        body: {
          reversalDate,
          reason: reason.trim(),
          version: entry.version,
        },
      });
      pushToast({
        variant: 'success',
        title: 'Journal reversed',
        description: `Created mirrored counter-entry for ${entry.entryNumber}.`,
      });
      setReason('');
      onReversed();
      onClose();
    } catch (err) {
      pushToast({
        variant: 'error',
        title: 'Reversal failed',
        description: err instanceof ApiError ? err.message : 'Unable to reverse entry.',
      });
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={Boolean(entry)}
      onClose={onClose}
      title="Reverse Posted Journal Entry"
      subtitle={entry ? `${entry.entryNumber} — ${entry.description}` : undefined}
      footer={
        <>
          <button type="button" onClick={onClose} className="hq-btn-secondary h-9 px-4 text-xs">
            Cancel
          </button>
          <button
            type="button"
            disabled={submitting}
            onClick={() => void handleConfirm()}
            className="hq-btn-danger h-9 px-5 text-xs"
          >
            {submitting ? 'Reversing...' : 'Confirm Reversal'}
          </button>
        </>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-hq-textSecondary">
          Posted ledger entries are immutable. Reversing creates an atomic mirrored counter-entry with identical stamped FX rates.
        </p>
        <div>
          <label className="mb-1 block text-xs font-medium text-hq-textSecondary">Reversal Date *</label>
          <input
            type="date"
            value={reversalDate}
            onChange={(e) => setReversalDate(e.target.value)}
            className="hq-input h-10 w-full px-3 font-ds-mono text-xs tabular-nums"
          />
        </div>
        <div>
          <label className="mb-1 block text-xs font-medium text-hq-textSecondary">
            Reversal Reason *
          </label>
          <input
            type="text"
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Duplicate booking or incorrect account allocation"
            className="hq-input h-10 w-full px-3 text-sm"
          />
        </div>
      </div>
    </Modal>
  );
}
