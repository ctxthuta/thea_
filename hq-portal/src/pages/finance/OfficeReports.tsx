import { CheckCircle2, AlertCircle, FileSpreadsheet } from 'lucide-react';
import { formatDateTime, parseDecimal } from '@/lib/format';
import { EmptyState } from '@/components/ui/Primitives';
import type {
  BalanceSheetReport,
  CurrencyCode,
  IncomeStatementReport,
  TrialBalanceReport,
} from '@/types/hq';

export type OfficeReportType = 'pnl' | 'balance-sheet' | 'trial-balance' | 'money-usage';

function formatAccountingNumber(amount: number, decimals = 2): string {
  const abs = Math.abs(amount);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(abs);
  return amount < -0.004 ? `(${formatted})` : formatted;
}

interface OfficeReportsProps {
  reportType: OfficeReportType;
  dateFrom: string;
  dateTo: string;
  displayCurrency: CurrencyCode;
  incomeStmt: IncomeStatementReport | null;
  balanceSheet: BalanceSheetReport | null;
  trialBalance: TrialBalanceReport | null;
  preparedBy: string;
}

export default function OfficeReports({
  reportType,
  dateFrom,
  dateTo,
  displayCurrency,
  incomeStmt,
  balanceSheet,
  trialBalance,
  preparedBy,
}: OfficeReportsProps) {
  const generatedTimestamp = formatDateTime(new Date().toISOString());
  const decimals = 2;

  const docMeta: Record<
    OfficeReportType,
    { code: string; title: string; subtitle: string; periodLabel: string }
  > = {
    pnl: {
      code: `FIN-IS-${dateTo.replace(/-/g, '')}`,
      title: 'STATEMENT OF PROFIT OR LOSS',
      subtitle: 'Income Statement — Accrual Basis',
      periodLabel: `${dateFrom} to ${dateTo}`,
    },
    'balance-sheet': {
      code: `FIN-BS-${dateTo.replace(/-/g, '')}`,
      title: 'STATEMENT OF FINANCIAL POSITION',
      subtitle: 'Balance Sheet — As of Reporting Date',
      periodLabel: `As of ${dateTo}`,
    },
    'trial-balance': {
      code: `FIN-TB-${dateTo.replace(/-/g, '')}`,
      title: 'GENERAL LEDGER TRIAL BALANCE',
      subtitle: 'Double-Entry Ledger Parity Verification',
      periodLabel: `As of ${dateTo}`,
    },
    'money-usage': {
      code: `FIN-MU-${dateTo.replace(/-/g, '')}`,
      title: 'STATEMENT OF EXPENDITURE BY COA',
      subtitle: 'Money Usage & Cost Allocation Breakdown',
      periodLabel: `${dateFrom} to ${dateTo}`,
    },
  };

  const meta = docMeta[reportType];

  const isEmpty =
    (reportType === 'pnl' && !incomeStmt) ||
    (reportType === 'balance-sheet' && !balanceSheet) ||
    (reportType === 'trial-balance' && !trialBalance) ||
    (reportType === 'money-usage' && !incomeStmt);

  if (isEmpty) {
    return (
      <div className="hq-card p-6">
        <EmptyState
          icon={<FileSpreadsheet className="h-5 w-5" />}
          title="Statement Data Unavailable"
          description="Post double-entry journals within the selected period to generate this corporate financial statement."
        />
      </div>
    );
  }

  const pnlRevenue = incomeStmt ? parseDecimal(incomeStmt.revenueTotal) : 0;
  const pnlCogs = incomeStmt ? parseDecimal(incomeStmt.cogsTotal) : 0;
  const pnlGross = incomeStmt ? parseDecimal(incomeStmt.grossProfit) : 0;
  const pnlOpex = incomeStmt ? parseDecimal(incomeStmt.opexTotal) : 0;
  const pnlNet = incomeStmt ? parseDecimal(incomeStmt.netIncome) : 0;

  const moneyUsageItems = incomeStmt
    ? [...(incomeStmt.sections.cogs || []), ...(incomeStmt.sections.opex || [])]
        .map((line) => ({
          accountCode: line.accountCode,
          name: line.name,
          category: line.accountCode.startsWith('5') ? 'COGS' : 'OPEX',
          amount: Math.abs(parseDecimal(line.amount)),
        }))
        .sort((a, b) => b.amount - a.amount)
    : [];
  const moneyUsageTotal = moneyUsageItems.reduce((sum, item) => sum + item.amount, 0);

  return (
    <article className="hq-print-sheet rounded-lg border border-stone-300 bg-white text-[#1A1816] shadow-sm p-6 sm:p-10 space-y-8">
      {/* Official Corporate Letterhead */}
      <header className="flex flex-col gap-6 border-b-2 border-[#5F1F2F] pb-6 md:flex-row md:items-start md:justify-between">
        <div className="space-y-2.5">
          <img
            src="/thea_dark_horizontal.png"
            alt="Thea Solutions"
            className="h-9 w-auto object-contain"
          />
          <div>
            <h2 className="font-ds-display text-xl sm:text-2xl font-bold tracking-tight text-[#1A1816]">
              {meta.title}
            </h2>
            <p className="text-xs font-medium text-stone-600">{meta.subtitle}</p>
          </div>
        </div>

        <table className="w-full md:w-auto min-w-[300px] border border-stone-300 text-xs border-collapse">
          <tbody>
            <tr className="border-b border-stone-200">
              <td className="bg-stone-100 px-3 py-1.5 font-medium text-stone-600 whitespace-nowrap">
                Document No.
              </td>
              <td className="px-3 py-1.5 font-ds-mono font-semibold text-[#1A1816] whitespace-nowrap">
                {meta.code}
              </td>
            </tr>
            <tr className="border-b border-stone-200">
              <td className="bg-stone-100 px-3 py-1.5 font-medium text-stone-600 whitespace-nowrap">
                Reporting Entity
              </td>
              <td className="px-3 py-1.5 font-semibold text-[#1A1816]">Thea Solutions</td>
            </tr>
            <tr className="border-b border-stone-200">
              <td className="bg-stone-100 px-3 py-1.5 font-medium text-stone-600 whitespace-nowrap">
                Period / As Of
              </td>
              <td className="px-3 py-1.5 font-ds-mono text-[#1A1816] whitespace-nowrap">
                {meta.periodLabel}
              </td>
            </tr>
            <tr className="border-b border-stone-200">
              <td className="bg-stone-100 px-3 py-1.5 font-medium text-stone-600 whitespace-nowrap">
                Reporting Currency
              </td>
              <td className="px-3 py-1.5 font-ds-mono font-semibold text-[#1A1816] whitespace-nowrap">
                {displayCurrency}
              </td>
            </tr>
            <tr className="border-b border-stone-200">
              <td className="bg-stone-100 px-3 py-1.5 font-medium text-stone-600 whitespace-nowrap">
                FX Reference
              </td>
              <td className="px-3 py-1.5 font-semibold text-[#1A1816] whitespace-nowrap">
                Historical Entry-Date Rates (Immutable)
              </td>
            </tr>
            <tr className="border-b border-stone-200">
              <td className="bg-stone-100 px-3 py-1.5 font-medium text-stone-600 whitespace-nowrap">
                Accounting Standard
              </td>
              <td className="px-3 py-1.5 text-[#1A1816]">Accrual Double-Entry (ISO Ledger)</td>
            </tr>
            <tr>
              <td className="bg-stone-100 px-3 py-1.5 font-medium text-stone-600 whitespace-nowrap">
                Generated
              </td>
              <td className="px-3 py-1.5 font-ds-mono text-[11px] tabular-nums text-stone-700 whitespace-nowrap">
                {generatedTimestamp}
              </td>
            </tr>
          </tbody>
        </table>
      </header>

      {/* INCOME STATEMENT (P&L) */}
      {reportType === 'pnl' && incomeStmt && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[600px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[#1A1816] text-left font-ds-mono text-[11px] uppercase tracking-wider text-stone-600">
                <th className="py-2.5 px-3 w-28">COA Code</th>
                <th className="py-2.5 px-3">Account Description</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  Amount ({displayCurrency})
                </th>
              </tr>
            </thead>
            <tbody>
              <tr className="bg-stone-100 border-y border-stone-300">
                <td colSpan={3} className="py-2 px-3 font-ds-mono text-xs font-bold uppercase tracking-wider text-[#5F1F2F]">
                  4000 · Revenue
                </td>
              </tr>
              {incomeStmt.sections.revenue.length === 0 ? (
                <tr className="border-b border-stone-200">
                  <td colSpan={3} className="py-2.5 px-3 text-xs italic text-stone-500">
                    No revenue posted in this period.
                  </td>
                </tr>
              ) : (
                incomeStmt.sections.revenue.map((line) => (
                  <tr key={line.accountCode} className="border-b border-stone-200">
                    <td className="py-2 px-3 font-ds-mono text-xs text-stone-600 whitespace-nowrap">
                      {line.accountCode}
                    </td>
                    <td className="py-2 px-3 text-[#1A1816]">{line.name}</td>
                    <td className="py-2 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                      {formatAccountingNumber(parseDecimal(line.amount), decimals)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="border-t border-[#1A1816] font-semibold bg-stone-50/70">
                <td colSpan={2} className="py-2.5 px-3 text-xs uppercase tracking-wider">
                  Total Revenue
                </td>
                <td className="py-2.5 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                  {formatAccountingNumber(pnlRevenue, decimals)}
                </td>
              </tr>

              <tr className="bg-stone-100 border-y border-stone-300">
                <td colSpan={3} className="py-2 px-3 font-ds-mono text-xs font-bold uppercase tracking-wider text-[#5F1F2F]">
                  5000 · Less: Cost of Delivery (COGS)
                </td>
              </tr>
              {incomeStmt.sections.cogs.length === 0 ? (
                <tr className="border-b border-stone-200">
                  <td colSpan={3} className="py-2.5 px-3 text-xs italic text-stone-500">
                    No direct delivery costs posted in this period.
                  </td>
                </tr>
              ) : (
                incomeStmt.sections.cogs.map((line) => (
                  <tr key={line.accountCode} className="border-b border-stone-200">
                    <td className="py-2 px-3 font-ds-mono text-xs text-stone-600 whitespace-nowrap">
                      {line.accountCode}
                    </td>
                    <td className="py-2 px-3 text-[#1A1816]">{line.name}</td>
                    <td className="py-2 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                      {formatAccountingNumber(-Math.abs(parseDecimal(line.amount)), decimals)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="border-t border-[#1A1816] font-semibold bg-stone-50/70">
                <td colSpan={2} className="py-2.5 px-3 text-xs uppercase tracking-wider">
                  Total Cost of Delivery (COGS)
                </td>
                <td className="py-2.5 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                  {formatAccountingNumber(-Math.abs(pnlCogs), decimals)}
                </td>
              </tr>

              <tr className="border-y-2 border-stone-400 bg-stone-100/90 font-bold">
                <td colSpan={2} className="py-3 px-3 text-xs uppercase tracking-wider">
                  Gross Profit
                  {pnlRevenue > 0 && (
                    <span className="ml-2 font-ds-mono font-normal text-stone-600">
                      ({((pnlGross / pnlRevenue) * 100).toFixed(2)}% Margin)
                    </span>
                  )}
                </td>
                <td className="py-3 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                  {formatAccountingNumber(pnlGross, decimals)}
                </td>
              </tr>

              <tr className="bg-stone-100 border-y border-stone-300">
                <td colSpan={3} className="py-2 px-3 font-ds-mono text-xs font-bold uppercase tracking-wider text-[#5F1F2F]">
                  6000 · Operating Expenses (OpEx)
                </td>
              </tr>
              {incomeStmt.sections.opex.length === 0 ? (
                <tr className="border-b border-stone-200">
                  <td colSpan={3} className="py-2.5 px-3 text-xs italic text-stone-500">
                    No operating expenses posted in this period.
                  </td>
                </tr>
              ) : (
                incomeStmt.sections.opex.map((line) => (
                  <tr key={line.accountCode} className="border-b border-stone-200">
                    <td className="py-2 px-3 font-ds-mono text-xs text-stone-600 whitespace-nowrap">
                      {line.accountCode}
                    </td>
                    <td className="py-2 px-3 text-[#1A1816]">{line.name}</td>
                    <td className="py-2 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                      {formatAccountingNumber(-Math.abs(parseDecimal(line.amount)), decimals)}
                    </td>
                  </tr>
                ))
              )}
              <tr className="border-t border-[#1A1816] font-semibold bg-stone-50/70">
                <td colSpan={2} className="py-2.5 px-3 text-xs uppercase tracking-wider">
                  Total Operating Expenses
                </td>
                <td className="py-2.5 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                  {formatAccountingNumber(-Math.abs(pnlOpex), decimals)}
                </td>
              </tr>

              <tr className="border-t-2 border-[#1A1816] border-b-4 border-double bg-[#5F1F2F]/[0.06] font-bold">
                <td colSpan={2} className="py-3.5 px-3 text-sm uppercase tracking-wider text-[#1A1816]">
                  Net Operating Income / (Loss)
                  {pnlRevenue > 0 && (
                    <span className="ml-2 font-ds-mono text-xs font-medium text-stone-600">
                      ({((pnlNet / pnlRevenue) * 100).toFixed(2)}%)
                    </span>
                  )}
                </td>
                <td
                  className={`py-3.5 px-3 text-right font-ds-mono text-sm tabular-nums whitespace-nowrap ${
                    pnlNet >= 0 ? 'text-emerald-800' : 'text-rose-700'
                  }`}
                >
                  {formatAccountingNumber(pnlNet, decimals)} {displayCurrency}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}

      {/* BALANCE SHEET */}
      {reportType === 'balance-sheet' && balanceSheet && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-ds-mono text-[11px] font-semibold uppercase tracking-wider ${
                balanceSheet.isBalanced
                  ? 'border-emerald-700/30 bg-emerald-50 text-emerald-800'
                  : 'border-rose-700/30 bg-rose-50 text-rose-800'
              }`}
            >
              {balanceSheet.isBalanced ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              <span>
                {balanceSheet.isBalanced ? 'Balanced / Reconciled (A = L + E)' : 'Imbalance Detected'}
              </span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[600px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[#1A1816] text-left font-ds-mono text-[11px] uppercase tracking-wider text-stone-600">
                  <th className="py-2.5 px-3 w-28">COA Code</th>
                  <th className="py-2.5 px-3">Account Description</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    Balance ({displayCurrency})
                  </th>
                </tr>
              </thead>
              <tbody>
                <tr className="bg-stone-100 border-y border-stone-300">
                  <td colSpan={3} className="py-2 px-3 font-ds-mono text-xs font-bold uppercase tracking-wider text-[#5F1F2F]">
                    1000 · Assets
                  </td>
                </tr>
                {(balanceSheet.sections.assets || []).map((line) => (
                  <tr key={line.accountCode} className="border-b border-stone-200">
                    <td className="py-2 px-3 font-ds-mono text-xs text-stone-600">{line.accountCode}</td>
                    <td className="py-2 px-3">{line.name}</td>
                    <td className="py-2 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                      {formatAccountingNumber(parseDecimal(line.amount), decimals)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t-2 border-[#1A1816] border-b-4 border-double bg-stone-50 font-bold">
                  <td colSpan={2} className="py-3 px-3 text-xs uppercase tracking-wider">
                    Total Assets
                  </td>
                  <td className="py-3 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                    {formatAccountingNumber(parseDecimal(balanceSheet.assetsTotal), decimals)}{' '}
                    {displayCurrency}
                  </td>
                </tr>

                <tr className="bg-stone-100 border-y border-stone-300">
                  <td colSpan={3} className="py-2 px-3 font-ds-mono text-xs font-bold uppercase tracking-wider text-[#5F1F2F]">
                    2000 · Liabilities
                  </td>
                </tr>
                {(balanceSheet.sections.liabilities || []).map((line) => (
                  <tr key={line.accountCode} className="border-b border-stone-200">
                    <td className="py-2 px-3 font-ds-mono text-xs text-stone-600">{line.accountCode}</td>
                    <td className="py-2 px-3">{line.name}</td>
                    <td className="py-2 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                      {formatAccountingNumber(parseDecimal(line.amount), decimals)}
                    </td>
                  </tr>
                ))}
                <tr className="border-t border-[#1A1816] font-semibold bg-stone-50/70">
                  <td colSpan={2} className="py-2.5 px-3 text-xs uppercase tracking-wider">
                    Total Liabilities
                  </td>
                  <td className="py-2.5 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                    {formatAccountingNumber(parseDecimal(balanceSheet.liabilitiesTotal), decimals)}
                  </td>
                </tr>

                <tr className="bg-stone-100 border-y border-stone-300">
                  <td colSpan={3} className="py-2 px-3 font-ds-mono text-xs font-bold uppercase tracking-wider text-[#5F1F2F]">
                    3000 · Equity &amp; Retained Earnings
                  </td>
                </tr>
                {(balanceSheet.sections.equity || []).map((line) => (
                  <tr key={line.accountCode} className="border-b border-stone-200">
                    <td className="py-2 px-3 font-ds-mono text-xs text-stone-600">{line.accountCode}</td>
                    <td className="py-2 px-3">{line.name}</td>
                    <td className="py-2 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                      {formatAccountingNumber(parseDecimal(line.amount), decimals)}
                    </td>
                  </tr>
                ))}
                <tr className="border-b border-stone-200">
                  <td className="py-2 px-3 font-ds-mono text-xs text-stone-600">3999</td>
                  <td className="py-2 px-3 italic">Current Period Earnings</td>
                  <td className="py-2 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                    {formatAccountingNumber(parseDecimal(balanceSheet.currentEarnings), decimals)}
                  </td>
                </tr>
                <tr className="border-t-2 border-[#1A1816] border-b-4 border-double bg-[#5F1F2F]/[0.06] font-bold">
                  <td colSpan={2} className="py-3.5 px-3 text-xs uppercase tracking-wider">
                    Total Liabilities &amp; Equity
                  </td>
                  <td className="py-3.5 px-3 text-right font-ds-mono text-sm tabular-nums whitespace-nowrap">
                    {formatAccountingNumber(
                      parseDecimal(balanceSheet.liabilitiesTotal) +
                        parseDecimal(balanceSheet.equityTotal) +
                        parseDecimal(balanceSheet.currentEarnings),
                      decimals
                    )}{' '}
                    {displayCurrency}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TRIAL BALANCE */}
      {reportType === 'trial-balance' && trialBalance && (
        <div className="space-y-4">
          <div className="flex items-center justify-end">
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-ds-mono text-[11px] font-semibold uppercase tracking-wider ${
                trialBalance.isBalanced
                  ? 'border-emerald-700/30 bg-emerald-50 text-emerald-800'
                  : 'border-rose-700/30 bg-rose-50 text-rose-800'
              }`}
            >
              {trialBalance.isBalanced ? (
                <CheckCircle2 className="h-3.5 w-3.5" />
              ) : (
                <AlertCircle className="h-3.5 w-3.5" />
              )}
              <span>
                {trialBalance.isBalanced ? 'Balanced / Reconciled' : 'Ledger Imbalance Detected'}
              </span>
            </span>
          </div>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[660px] border-collapse text-sm">
              <thead>
                <tr className="border-b-2 border-[#1A1816] text-left font-ds-mono text-[11px] uppercase tracking-wider text-stone-600 bg-stone-100">
                  <th className="py-2.5 px-3 w-24">Code</th>
                  <th className="py-2.5 px-3">Account</th>
                  <th className="py-2.5 px-3">Class</th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    Debit ({displayCurrency})
                  </th>
                  <th className="py-2.5 px-3 text-right whitespace-nowrap">
                    Credit ({displayCurrency})
                  </th>
                </tr>
              </thead>
              <tbody>
                {trialBalance.rows.map((row) => (
                  <tr key={row.accountCode} className="border-b border-stone-200">
                    <td className="py-2 px-3 font-ds-mono text-xs text-stone-600 whitespace-nowrap">
                      {row.accountCode}
                    </td>
                    <td className="py-2 px-3 text-[#1A1816]">{row.name}</td>
                    <td className="py-2 px-3 font-ds-mono text-[11px] text-stone-500">
                      {row.category}
                    </td>
                    <td className="py-2 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                      {formatAccountingNumber(parseDecimal(row.debitBase), decimals)}
                    </td>
                    <td className="py-2 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                      {formatAccountingNumber(parseDecimal(row.creditBase), decimals)}
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-[#1A1816] border-b-4 border-double bg-[#5F1F2F]/[0.06] font-bold">
                  <td colSpan={3} className="py-3.5 px-3 text-xs uppercase tracking-wider">
                    Trial Balance Totals ({trialBalance.rows.length} active accounts)
                  </td>
                  <td className="py-3.5 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                    {formatAccountingNumber(parseDecimal(trialBalance.totalDebitBase), decimals)}
                  </td>
                  <td className="py-3.5 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                    {formatAccountingNumber(parseDecimal(trialBalance.totalCreditBase), decimals)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* MONEY USAGE BY COA */}
      {reportType === 'money-usage' && incomeStmt && (
        <div className="overflow-x-auto">
          <table className="w-full min-w-[640px] border-collapse text-sm">
            <thead>
              <tr className="border-b-2 border-[#1A1816] text-left font-ds-mono text-[11px] uppercase tracking-wider text-stone-600 bg-stone-100">
                <th className="py-2.5 px-3 w-24">Code</th>
                <th className="py-2.5 px-3">Expenditure Account</th>
                <th className="py-2.5 px-3">Class</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">Share (%)</th>
                <th className="py-2.5 px-3 text-right whitespace-nowrap">
                  Spend ({displayCurrency})
                </th>
              </tr>
            </thead>
            <tbody>
              {moneyUsageItems.length === 0 ? (
                <tr className="border-b border-stone-200">
                  <td colSpan={5} className="py-4 px-3 text-center text-xs text-stone-500">
                    No expenditure recorded in this period.
                  </td>
                </tr>
              ) : (
                moneyUsageItems.map((item) => {
                  const pct = moneyUsageTotal > 0 ? (item.amount / moneyUsageTotal) * 100 : 0;
                  return (
                    <tr key={item.accountCode} className="border-b border-stone-200">
                      <td className="py-2.5 px-3 font-ds-mono text-xs text-stone-600 whitespace-nowrap">
                        {item.accountCode}
                      </td>
                      <td className="py-2.5 px-3 text-[#1A1816]">{item.name}</td>
                      <td className="py-2.5 px-3 font-ds-mono text-[11px] text-stone-500">
                        {item.category}
                      </td>
                      <td className="py-2.5 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                        {pct.toFixed(1)}%
                      </td>
                      <td className="py-2.5 px-3 text-right font-ds-mono text-xs tabular-nums whitespace-nowrap">
                        {formatAccountingNumber(item.amount, decimals)}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-[#1A1816] border-b-4 border-double bg-[#5F1F2F]/[0.06] font-bold">
                <td colSpan={3} className="py-3.5 px-3 text-xs uppercase tracking-wider">
                  Total Period Expenditure (COGS + OpEx)
                </td>
                <td className="py-3.5 px-3 text-right font-ds-mono text-xs tabular-nums">100.0%</td>
                <td className="py-3.5 px-3 text-right font-ds-mono text-sm tabular-nums whitespace-nowrap">
                  {formatAccountingNumber(moneyUsageTotal, decimals)} {displayCurrency}
                </td>
              </tr>
            </tfoot>
          </table>
        </div>
      )}

      {/* Formal Corporate Approval Signature Footer */}
      <footer className="grid grid-cols-1 gap-8 border-t border-stone-300 pt-8 sm:grid-cols-3 text-xs">
        <div className="space-y-8">
          <p className="font-ds-mono text-[10px] uppercase tracking-wider text-stone-500">
            Prepared By
          </p>
          <div className="border-t border-stone-400 pt-1.5">
            <p className="font-semibold text-[#1A1816]">{preparedBy}</p>
            <p className="text-[11px] text-stone-500">Thea HQ Accounting Desk</p>
          </div>
        </div>
        <div className="space-y-8">
          <p className="font-ds-mono text-[10px] uppercase tracking-wider text-stone-500">
            Reviewed &amp; Verified By
          </p>
          <div className="border-t border-stone-400 pt-1.5">
            <p className="font-semibold text-[#1A1816]">Finance Controller</p>
            <p className="text-[11px] text-stone-500">Date &amp; Signature</p>
          </div>
        </div>
        <div className="space-y-8">
          <p className="font-ds-mono text-[10px] uppercase tracking-wider text-stone-500">
            Approved By
          </p>
          <div className="border-t border-stone-400 pt-1.5">
            <p className="font-semibold text-[#1A1816]">Managing Director</p>
            <p className="text-[11px] text-stone-500">Thea Solutions</p>
          </div>
        </div>
      </footer>
    </article>
  );
}
