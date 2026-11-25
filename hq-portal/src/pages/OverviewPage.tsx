import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Briefcase,
  CreditCard,
  Plus,
  TrendingUp,
  Wallet,
} from 'lucide-react';
import { apiRequest, ApiError } from '@/lib/apiClient';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { canAccessModule, canEditFinance } from '@/lib/rbac';
import {
  daysUntil,
  formatMoney,
  getCurrentMonthKey,
  getMonthBounds,
  parseDecimal,
} from '@/lib/format';
import { EmptyState, ErrorBanner, StatusPill } from '@/components/ui/Primitives';
import type { CashFlowReport, ExecutiveOverviewDTO } from '@/types/hq';

interface MonthlySeriesPoint {
  monthKey: string;
  label: string;
  moneyIn: number;
  moneyOut: number;
}

function getLastNMonths(anchorMonth: string, count: number): string[] {
  const [yStr, mStr] = anchorMonth.split('-');
  const year = Number.parseInt(yStr, 10) || new Date().getFullYear();
  const month = Number.parseInt(mStr, 10) || new Date().getMonth() + 1;
  const result: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(Date.UTC(year, month - 1 - i, 1));
    result.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, '0')}`);
  }
  return result;
}

function monthShortLabel(monthKey: string): string {
  const [y, m] = monthKey.split('-');
  const d = new Date(Date.UTC(Number(y), Number(m) - 1, 1));
  return d.toLocaleDateString('en-US', { month: 'short', timeZone: 'UTC' });
}

export default function OverviewPage() {
  const { user } = useAuth();
  const { displayCurrency } = useCurrency();

  const canSeeFinance = canAccessModule(user, 'finance');
  const canSeeCrm = canAccessModule(user, 'crm');

  const [periodMonth, setPeriodMonth] = useState(getCurrentMonthKey());
  const [chartSpan, setChartSpan] = useState<6 | 12>(6);
  const [actionTab, setActionTab] = useState<'cards' | 'leads'>('cards');
  const [hoveredMonth, setHoveredMonth] = useState<string | null>(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [overview, setOverview] = useState<ExecutiveOverviewDTO | null>(null);
  const [cashFlowSeries, setCashFlowSeries] = useState<CashFlowReport['series']>([]);

  const loadDashboard = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { dateFrom, dateTo } = getMonthBounds(periodMonth);
    const chartMonths = getLastNMonths(periodMonth, 12);
    const seriesStart = `${chartMonths[0]}-01`;

    try {
      const overviewParams = new URLSearchParams({
        displayCurrency,
        dateFrom,
        dateTo,
        periodKey: periodMonth,
      });

      const [overviewRes, cashFlowRes] = await Promise.all([
        apiRequest<ExecutiveOverviewDTO>(`/api/v1/overview?${overviewParams.toString()}`),
        canSeeFinance
          ? apiRequest<CashFlowReport>(
              `/api/v1/accounting/reports/cash-flow?dateFrom=${seriesStart}&dateTo=${dateTo}&displayCurrency=${displayCurrency}`
            ).catch(() => null)
          : Promise.resolve(null),
      ]);

      setOverview(overviewRes);
      setCashFlowSeries(cashFlowRes?.series || overviewRes.moneyInVsOut || []);
    } catch (err) {
      setError(err instanceof ApiError ? err.message : 'Unable to load executive telemetry.');
    } finally {
      setLoading(false);
    }
  }, [periodMonth, displayCurrency, canSeeFinance]);

  useEffect(() => {
    void loadDashboard();
  }, [loadDashboard]);

  const effectiveCurrency = overview?.displayCurrency || displayCurrency;
  const hasFinanceKpis =
    canSeeFinance && overview?.kpis?.cashBalance !== undefined;

  const cashPosition = parseDecimal(overview?.kpis?.cashBalance);
  const mtdMoneyIn = parseDecimal(overview?.kpis?.totalIncome);
  const mtdMoneyOut = parseDecimal(overview?.kpis?.totalExpenses);
  const netIncome = parseDecimal(overview?.kpis?.netIncome);
  const netMarginPct = mtdMoneyIn > 0 ? (netIncome / mtdMoneyIn) * 100 : 0;

  const monthlySeries: MonthlySeriesPoint[] = useMemo(() => {
    const months = getLastNMonths(periodMonth, chartSpan);
    const byMonth = new Map<string, { moneyIn: number; moneyOut: number }>();
    for (const point of cashFlowSeries) {
      byMonth.set(point.month, {
        moneyIn: parseDecimal(point.inflow),
        moneyOut: parseDecimal(point.outflow),
      });
    }

    return months.map((m) => {
      const bucket = byMonth.get(m) || { moneyIn: 0, moneyOut: 0 };
      return {
        monthKey: m,
        label: monthShortLabel(m),
        moneyIn: bucket.moneyIn,
        moneyOut: bucket.moneyOut,
      };
    });
  }, [cashFlowSeries, periodMonth, chartSpan]);

  const maxChartVal = useMemo(() => {
    const maxVal = monthlySeries.reduce(
      (acc, point) => Math.max(acc, point.moneyIn, point.moneyOut),
      0
    );
    return maxVal > 0 ? maxVal : 1;
  }, [monthlySeries]);

  const moneyUsages = useMemo(() => {
    return (overview?.moneyUsages || []).slice(0, 6);
  }, [overview]);

  const budgetRows = useMemo(() => {
    return (overview?.budgetVsActual || []).slice(0, 6);
  }, [overview]);

  const expiringAssociates = overview?.expiringAssociateCards || [];
  const recentLeads = overview?.recentLeads || [];

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-ds-display text-[28px] font-semibold leading-tight tracking-[-0.02em] text-hq-textPrimary">
            Overview Dashboard
          </h1>
          <p className="mt-1 text-sm text-hq-textSecondary">
            Financial telemetry displayed in{' '}
            <span className="font-ds-mono font-semibold text-hq-textPrimary">
              {effectiveCurrency}
            </span>{' '}
            <span className="font-ds-mono text-xs text-hq-textMuted">
              (Translated at historical entry-date FX rates)
            </span>
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="sr-only" htmlFor="overview-period">
            Reporting Month
          </label>
          <input
            id="overview-period"
            type="month"
            value={periodMonth}
            onChange={(e) => setPeriodMonth(e.target.value)}
            className="hq-input h-10 px-3 font-ds-mono text-xs tabular-nums"
          />
          {canEditFinance(user) && (
            <Link
              to="/finance?tab=journals&action=income"
              className="hq-btn-primary inline-flex h-10 items-center gap-1.5 px-4 text-xs"
            >
              <Plus className="h-4 w-4" />
              <span>Record Entry</span>
            </Link>
          )}
        </div>
      </div>

      {error && <ErrorBanner message={error} onRetry={loadDashboard} />}

      {/* 4-KPI Strip */}
      <section aria-label="Key Financial Metrics" className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <article className="hq-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-ds-mono text-[11px] font-medium uppercase tracking-[0.06em] text-hq-textSecondary">
              Cash Position
            </span>
            <Wallet className="h-4 w-4 text-hq-brandSoft" />
          </div>
          {loading ? (
            <div className="hq-skeleton mt-3 h-8 w-44" />
          ) : hasFinanceKpis ? (
            <>
              <p className="mt-3 font-ds-mono text-2xl font-semibold tabular-nums tracking-[-0.02em] text-hq-textPrimary truncate">
                {formatMoney(cashPosition, effectiveCurrency)}
              </p>
              <p className="mt-1.5 text-xs text-hq-textMuted">
                Liquid Cash &amp; Bank accounts (10xx)
              </p>
            </>
          ) : (
            <p className="mt-3 font-ds-mono text-xl text-hq-textMuted">Restricted</p>
          )}
        </article>

        <article className="hq-card overflow-hidden flex flex-col justify-between">
          <div className="h-[2px] w-full bg-hq-in" />
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-ds-mono text-[11px] font-medium uppercase tracking-[0.06em] text-hq-textSecondary">
                MTD Money In
              </span>
              <ArrowDownLeft className="h-4 w-4 text-hq-in" />
            </div>
            {loading ? (
              <div className="hq-skeleton mt-3 h-8 w-44" />
            ) : hasFinanceKpis ? (
              <>
                <p className="mt-3 font-ds-mono text-2xl font-semibold tabular-nums tracking-[-0.02em] text-hq-in truncate">
                  {formatMoney(mtdMoneyIn, effectiveCurrency)}
                </p>
                <p className="mt-1.5 font-ds-mono text-xs text-hq-textMuted">
                  Period {periodMonth} recognized revenue
                </p>
              </>
            ) : (
              <p className="mt-3 font-ds-mono text-xl text-hq-textMuted">Restricted</p>
            )}
          </div>
        </article>

        <article className="hq-card overflow-hidden flex flex-col justify-between">
          <div className="h-[2px] w-full bg-hq-out" />
          <div className="p-5 flex-1 flex flex-col justify-between">
            <div className="flex items-center justify-between">
              <span className="font-ds-mono text-[11px] font-medium uppercase tracking-[0.06em] text-hq-textSecondary">
                MTD Money Out
              </span>
              <ArrowUpRight className="h-4 w-4 text-hq-out" />
            </div>
            {loading ? (
              <div className="hq-skeleton mt-3 h-8 w-44" />
            ) : hasFinanceKpis ? (
              <>
                <p className="mt-3 font-ds-mono text-2xl font-semibold tabular-nums tracking-[-0.02em] text-hq-out truncate">
                  {formatMoney(mtdMoneyOut, effectiveCurrency)}
                </p>
                <p className="mt-1.5 font-ds-mono text-xs text-hq-textMuted">
                  COGS &amp; Operating Expenses ({periodMonth})
                </p>
              </>
            ) : (
              <p className="mt-3 font-ds-mono text-xl text-hq-textMuted">Restricted</p>
            )}
          </div>
        </article>

        <article className="hq-card p-5 flex flex-col justify-between">
          <div className="flex items-center justify-between">
            <span className="font-ds-mono text-[11px] font-medium uppercase tracking-[0.06em] text-hq-textSecondary">
              Net Margin (MTD)
            </span>
            <TrendingUp className="h-4 w-4 text-hq-brandVibrant" />
          </div>
          {loading ? (
            <div className="hq-skeleton mt-3 h-8 w-32" />
          ) : hasFinanceKpis ? (
            <>
              <p
                className={`mt-3 font-ds-mono text-2xl font-semibold tabular-nums tracking-[-0.02em] ${
                  netIncome >= 0 ? 'text-hq-in' : 'text-hq-out'
                }`}
              >
                {netMarginPct.toFixed(2)}%
              </p>
              <p className="mt-1.5 font-ds-mono text-xs tabular-nums text-hq-textSecondary">
                Net: {formatMoney(netIncome, effectiveCurrency)}
              </p>
            </>
          ) : (
            <p className="mt-3 font-ds-mono text-xl text-hq-textMuted">Restricted</p>
          )}
        </article>
      </section>

      {/* Middle Row: Money In vs Out Chart + Money Usages */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="hq-card p-5 xl:col-span-8 flex flex-col justify-between">
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="font-ds-display text-base font-semibold text-hq-textPrimary">
                Money In vs. Money Out
              </h2>
              <p className="text-xs text-hq-textSecondary">
                Historical cash inflows and outflows in {effectiveCurrency}
              </p>
            </div>
            <div className="inline-flex rounded-full border border-hq-borderDefault bg-hq-subtle p-0.5">
              {([6, 12] as const).map((span) => (
                <button
                  key={span}
                  type="button"
                  onClick={() => setChartSpan(span)}
                  className={`rounded-full px-3 py-1 font-ds-mono text-[11px] font-medium transition-colors ${
                    chartSpan === span
                      ? 'bg-hq-brand text-white'
                      : 'text-hq-textSecondary hover:text-hq-textPrimary'
                  }`}
                >
                  {span}M
                </button>
              ))}
            </div>
          </div>

          {!canSeeFinance ? (
            <EmptyState
              icon={<Wallet className="h-5 w-5" />}
              title="Finance Telemetry Restricted"
              description="Your assigned role does not include ledger read access."
            />
          ) : (
            <div>
              <div className="relative flex h-56 items-end gap-2 sm:gap-4 border-b border-hq-borderSubtle pb-3 pt-6">
                {monthlySeries.map((point) => {
                  const inHeightPct = Math.max(
                    (point.moneyIn / maxChartVal) * 100,
                    point.moneyIn > 0 ? 4 : 1
                  );
                  const outHeightPct = Math.max(
                    (point.moneyOut / maxChartVal) * 100,
                    point.moneyOut > 0 ? 4 : 1
                  );
                  const isHovered = hoveredMonth === point.monthKey;

                  return (
                    <div
                      key={point.monthKey}
                      onMouseEnter={() => setHoveredMonth(point.monthKey)}
                      onMouseLeave={() => setHoveredMonth(null)}
                      onFocus={() => setHoveredMonth(point.monthKey)}
                      onBlur={() => setHoveredMonth(null)}
                      tabIndex={0}
                      className="relative flex flex-1 flex-col items-center justify-end h-full group cursor-pointer focus:outline-none"
                    >
                      {isHovered && (
                        <div className="pointer-events-none absolute -top-2 left-1/2 z-10 -translate-x-1/2 -translate-y-full whitespace-nowrap rounded-lg border border-hq-borderDefault bg-hq-surface px-3 py-2 font-ds-mono text-[11px] tabular-nums shadow-lg">
                          <p className="font-semibold text-hq-textPrimary mb-1">{point.monthKey}</p>
                          <p className="text-hq-in">
                            In: {formatMoney(point.moneyIn, effectiveCurrency, { compact: true })}
                          </p>
                          <p className="text-hq-out">
                            Out: {formatMoney(point.moneyOut, effectiveCurrency, { compact: true })}
                          </p>
                        </div>
                      )}
                      <div className="flex w-full max-w-[44px] items-end justify-center gap-1 h-44">
                        <div
                          className="w-1/2 rounded-t bg-hq-in/85 group-hover:bg-hq-in transition-all"
                          style={{ height: `${inHeightPct}%` }}
                          aria-label={`${point.label} Money In`}
                        />
                        <div
                          className="w-1/2 rounded-t bg-hq-out/85 group-hover:bg-hq-out transition-all"
                          style={{ height: `${outHeightPct}%` }}
                          aria-label={`${point.label} Money Out`}
                        />
                      </div>
                      <span className="mt-2 font-ds-mono text-[10px] uppercase text-hq-textMuted">
                        {point.label}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 font-ds-mono text-[11px] text-hq-textSecondary">
                <div className="flex items-center gap-4">
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-hq-in" />
                    Money In
                  </span>
                  <span className="inline-flex items-center gap-1.5">
                    <span className="h-2.5 w-2.5 rounded-sm bg-hq-out" />
                    Money Out
                  </span>
                </div>
                <span className="text-hq-textMuted">Hover or focus any month for details</span>
              </div>
            </div>
          )}
        </div>

        {/* Money Usages by COA Category */}
        <div className="hq-card p-5 xl:col-span-4 flex flex-col">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="font-ds-display text-base font-semibold text-hq-textPrimary">
                Money Usages by COA
              </h2>
              <p className="text-xs text-hq-textSecondary">COGS &amp; OpEx distribution ({periodMonth})</p>
            </div>
            {canSeeFinance && (
              <Link
                to="/finance?tab=reports"
                className="font-ds-mono text-[11px] text-hq-brandSoft hover:underline"
              >
                Full Report
              </Link>
            )}
          </div>

          {!canSeeFinance ? (
            <EmptyState
              icon={<CreditCard className="h-5 w-5" />}
              title="Restricted"
              description="Requires Finance or Viewer role."
            />
          ) : moneyUsages.length === 0 ? (
            <EmptyState
              icon={<CreditCard className="h-5 w-5" />}
              title="No Outflows Recorded"
              description={`No posted COGS or OpEx entries found for ${periodMonth}.`}
            />
          ) : (
            <ul className="space-y-4 flex-1">
              {moneyUsages.map((item) => (
                <li key={item.accountCode}>
                  <div className="flex items-baseline justify-between gap-2 text-xs">
                    <span className="truncate font-medium text-hq-textPrimary">
                      <span className="font-ds-mono text-hq-brandSoft mr-1.5">
                        {item.accountCode}
                      </span>
                      {item.name}
                    </span>
                    <span className="font-ds-mono tabular-nums text-hq-textSecondary shrink-0">
                      {item.sharePct.toFixed(1)}% ·{' '}
                      {formatMoney(item.amount, effectiveCurrency, { compact: true })}
                    </span>
                  </div>
                  <div className="mt-1.5 h-2 w-full overflow-hidden rounded-full bg-hq-elevated">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-hq-brand to-hq-brandVibrant"
                      style={{ width: `${Math.min(item.sharePct, 100)}%` }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>

      {/* Bottom Row: Budget vs Actual + Action Queue */}
      <section className="grid grid-cols-1 gap-5 xl:grid-cols-12">
        <div className="hq-card p-5 xl:col-span-7">
          <div className="flex items-center justify-between gap-3 mb-4">
            <div>
              <h2 className="font-ds-display text-base font-semibold text-hq-textPrimary">
                Budget vs. Actual Utilization
              </h2>
              <p className="text-xs text-hq-textSecondary">
                Period {periodMonth} — Emerald &lt;80%, Amber 80-100%, Rose &gt;100%
              </p>
            </div>
            {canSeeFinance && (
              <Link
                to="/finance?tab=budgets"
                className="inline-flex items-center gap-1 font-ds-mono text-xs text-hq-brandSoft hover:underline"
              >
                <span>Manage Budgets</span>
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
            )}
          </div>

          {!canSeeFinance ? (
            <EmptyState
              icon={<AlertTriangle className="h-5 w-5" />}
              title="Budget Data Restricted"
              description="Budget targets are visible to Finance, Admin, and Viewer roles."
            />
          ) : budgetRows.length === 0 ? (
            <EmptyState
              icon={<TrendingUp className="h-5 w-5" />}
              title="No Budgets Configured"
              description={`Set monthly COA budget targets for ${periodMonth} to monitor spend utilization.`}
              action={
                canEditFinance(user) ? (
                  <Link
                    to="/finance?tab=budgets"
                    className="hq-btn-secondary inline-flex items-center gap-1.5 px-4 py-2 text-xs"
                  >
                    Configure Budgets
                  </Link>
                ) : undefined
              }
            />
          ) : (
            <div className="space-y-4">
              {budgetRows.map((row) => {
                const target = parseDecimal(row.targetBase);
                const actual = parseDecimal(row.actualBase);
                const utilization = target > 0 ? (actual / target) * 100 : actual > 0 ? 100 : 0;
                const tone: 'in' | 'warn' | 'out' =
                  utilization > 100 ? 'out' : utilization >= 80 ? 'warn' : 'in';
                const barClass =
                  tone === 'out'
                    ? 'bg-hq-out'
                    : tone === 'warn'
                      ? 'bg-hq-warn'
                      : 'bg-hq-in';

                return (
                  <div key={row.accountCode} className="space-y-1.5">
                    <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                      <div className="min-w-0">
                        <span className="font-ds-mono text-hq-brandSoft mr-2">{row.accountCode}</span>
                        <span className="font-medium text-hq-textPrimary">{row.accountName}</span>
                      </div>
                      <div className="flex items-center gap-2 font-ds-mono tabular-nums">
                        <span className="text-hq-textSecondary">
                          {formatMoney(actual, effectiveCurrency, { compact: true })} /{' '}
                          {formatMoney(target, effectiveCurrency, { compact: true })}
                        </span>
                        <StatusPill tone={tone}>
                          {utilization > 100
                            ? `+${(utilization - 100).toFixed(1)}% OVER`
                            : `${utilization.toFixed(1)}%`}
                        </StatusPill>
                      </div>
                    </div>
                    <div className="h-2 w-full overflow-hidden rounded-full bg-hq-elevated">
                      <div
                        className={`h-full rounded-full transition-all ${barClass}`}
                        style={{ width: `${Math.min(utilization, 100)}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Action Queue */}
        <div className="hq-card p-5 xl:col-span-5 flex flex-col">
          <div className="flex items-center justify-between gap-2 mb-4">
            <h2 className="font-ds-display text-base font-semibold text-hq-textPrimary">
              Action Queue
            </h2>
            <div role="tablist" className="inline-flex rounded-full border border-hq-borderDefault bg-hq-subtle p-0.5">
              <button
                type="button"
                role="tab"
                aria-selected={actionTab === 'cards'}
                onClick={() => setActionTab('cards')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  actionTab === 'cards'
                    ? 'bg-hq-brand text-white'
                    : 'text-hq-textSecondary hover:text-hq-textPrimary'
                }`}
              >
                Expiring Cards ({expiringAssociates.length})
              </button>
              <button
                type="button"
                role="tab"
                aria-selected={actionTab === 'leads'}
                onClick={() => setActionTab('leads')}
                className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                  actionTab === 'leads'
                    ? 'bg-hq-brand text-white'
                    : 'text-hq-textSecondary hover:text-hq-textPrimary'
                }`}
              >
                Website Leads ({recentLeads.length})
              </button>
            </div>
          </div>

          {actionTab === 'cards' ? (
            expiringAssociates.length === 0 ? (
              <EmptyState
                icon={<CreditCard className="h-5 w-5" />}
                title="All Associate Credentials Healthy"
                description="No associate cards are expiring within the next 60 days."
              />
            ) : (
              <ul className="divide-y divide-hq-borderSubtle">
                {expiringAssociates.map((card) => {
                  const daysLeft = daysUntil(card.cardExpirationDate);
                  const isExpired = card.isExpired || daysLeft < 0;
                  return (
                    <li key={card.id} className="flex items-center justify-between gap-3 py-3">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-ds-mono text-xs font-semibold text-hq-brandSoft tabular-nums">
                            {card.employeeId}
                          </span>
                          <span className="truncate text-sm font-medium text-hq-textPrimary">
                            {card.name}
                          </span>
                        </div>
                        <p className="text-xs text-hq-textSecondary">
                          {card.title} · Expires {card.cardExpirationDate}
                        </p>
                      </div>
                      <div className="flex items-center gap-2 shrink-0">
                        <StatusPill tone={isExpired ? 'out' : 'warn'}>
                          {isExpired ? 'Expired' : `${daysLeft}d left`}
                        </StatusPill>
                        <Link
                          to={`/associates?edit=${encodeURIComponent(card.employeeId)}`}
                          className="rounded-md border border-hq-borderDefault px-2.5 py-1 text-xs font-medium text-hq-textPrimary hover:bg-hq-elevated"
                        >
                          Review
                        </Link>
                      </div>
                    </li>
                  );
                })}
              </ul>
            )
          ) : !canSeeCrm ? (
            <EmptyState
              icon={<Briefcase className="h-5 w-5" />}
              title="CRM Access Restricted"
              description="Inbound leads require CRM Manager, Admin, or Viewer role."
            />
          ) : recentLeads.length === 0 ? (
            <EmptyState
              icon={<Briefcase className="h-5 w-5" />}
              title="No Inbound Leads Yet"
              description="Leads submitted on theasolutions.co will appear here automatically."
            />
          ) : (
            <ul className="divide-y divide-hq-borderSubtle">
              {recentLeads.map((lead) => (
                <li key={lead.id} className="flex items-center justify-between gap-3 py-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium text-hq-textPrimary">
                      {lead.name || lead.email}
                      {lead.company ? ` (${lead.company})` : ''}
                    </p>
                    <p className="font-ds-mono text-[11px] text-hq-textMuted">
                      {lead.source.replace('WEB_', '')} · {lead.createdAt.slice(0, 10)}
                    </p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <StatusPill
                      tone={
                        lead.status === 'NEW'
                          ? 'brand'
                          : lead.status === 'CONVERTED'
                            ? 'in'
                            : 'neutral'
                      }
                    >
                      {lead.status}
                    </StatusPill>
                    <Link
                      to="/crm?tab=leads"
                      className="rounded-md border border-hq-borderDefault px-2.5 py-1 text-xs font-medium text-hq-textPrimary hover:bg-hq-elevated"
                    >
                      Open
                    </Link>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </section>
    </div>
  );
}
