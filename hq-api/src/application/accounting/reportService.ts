import {
  convertMoneyMinor,
  formatFxMicro,
  formatMoneyMinor,
  parseFxMicro,
  parseMoneyMinor,
  type CurrencyCode,
} from '../../domain/accounting/money';
import { AppError } from '../../domain/errors';
import { Collections, type CoaAccountDoc, type CoaCategory } from '../../infrastructure/db/collections';
import { getSystemBaseCurrency, resolveFxRate } from './fxService';
import {
  FX_TRANSLATION_BASIS,
  translateJournalLinesToCurrency,
} from './fxTranslation';
import { getBudgetVsActualReport } from './budgetService';

const CASH_ACCOUNT_CODES = new Set(['1010', '1020', '1030']);

async function aggregateAccountBalances(filter: {
  dateFrom?: string;
  dateTo?: string;
  displayCurrency: CurrencyCode;
}): Promise<{
  coaMap: Map<string, CoaAccountDoc>;
  debits: Map<string, bigint>;
  credits: Map<string, bigint>;
}> {
  const dateCond: Record<string, string> = {};
  if (filter.dateFrom) dateCond.$gte = filter.dateFrom;
  if (filter.dateTo) dateCond.$lte = filter.dateTo;

  const jeQuery: Record<string, unknown> = {
    status: { $in: ['POSTED', 'REVERSED'] },
  };
  if (Object.keys(dateCond).length > 0) {
    jeQuery.entryDate = dateCond;
  }

  const [coaList, entries] = await Promise.all([
    Collections.coaAccounts().find({}).sort({ code: 1 }).toArray(),
    Collections.journalEntries().find(jeQuery).toArray(),
  ]);

  const coaMap = new Map(coaList.map((a) => [a.code, a]));
  const debits = new Map<string, bigint>();
  const credits = new Map<string, bigint>();
  const rateCache = new Map<string, bigint>();

  for (const je of entries) {
    const lines = await translateJournalLinesToCurrency(je, filter.displayCurrency, rateCache);
    for (const line of lines) {
      debits.set(line.accountCode, (debits.get(line.accountCode) ?? 0n) + line.debitDisplay);
      credits.set(line.accountCode, (credits.get(line.accountCode) ?? 0n) + line.creditDisplay);
    }
  }

  return { coaMap, debits, credits };
}

export async function getTrialBalance(asOf: string, displayCurrency?: CurrencyCode) {
  const reportingBaseCurrency = await getSystemBaseCurrency();
  const effectiveCurrency = displayCurrency ?? reportingBaseCurrency;
  const { coaMap, debits, credits } = await aggregateAccountBalances({
    dateTo: asOf,
    displayCurrency: effectiveCurrency,
  });

  const rows: Array<{
    accountCode: string;
    name: string;
    category: CoaCategory;
    debitBase: string;
    creditBase: string;
    netBalanceBase: string;
  }> = [];

  let totalDebit = 0n;
  let totalCredit = 0n;

  for (const [code, acct] of coaMap.entries()) {
    const dispDebit = debits.get(code) ?? 0n;
    const dispCredit = credits.get(code) ?? 0n;
    if (dispDebit === 0n && dispCredit === 0n) continue;

    const net = acct.normalBalance === 'DEBIT' ? dispDebit - dispCredit : dispCredit - dispDebit;
    totalDebit += dispDebit;
    totalCredit += dispCredit;

    rows.push({
      accountCode: code,
      name: acct.name,
      category: acct.category,
      debitBase: formatMoneyMinor(dispDebit),
      creditBase: formatMoneyMinor(dispCredit),
      netBalanceBase: formatMoneyMinor(net),
    });
  }

  return {
    asOf,
    baseCurrency: effectiveCurrency,
    displayCurrency: effectiveCurrency,
    reportingBaseCurrency,
    fxTranslationBasis: FX_TRANSLATION_BASIS,
    rows,
    totalDebitBase: formatMoneyMinor(totalDebit),
    totalCreditBase: formatMoneyMinor(totalCredit),
    isBalanced: totalDebit === totalCredit,
  };
}

export async function getIncomeStatement(
  dateFrom: string,
  dateTo: string,
  displayCurrency?: CurrencyCode
) {
  const reportingBaseCurrency = await getSystemBaseCurrency();
  const effectiveCurrency = displayCurrency ?? reportingBaseCurrency;
  const { coaMap, debits, credits } = await aggregateAccountBalances({
    dateFrom,
    dateTo,
    displayCurrency: effectiveCurrency,
  });

  const revenue: Array<{ accountCode: string; name: string; amount: string }> = [];
  const cogs: Array<{ accountCode: string; name: string; amount: string }> = [];
  const opex: Array<{ accountCode: string; name: string; amount: string }> = [];

  let revenueTotal = 0n;
  let cogsTotal = 0n;
  let opexTotal = 0n;

  for (const [code, acct] of coaMap.entries()) {
    const d = debits.get(code) ?? 0n;
    const c = credits.get(code) ?? 0n;
    if (d === 0n && c === 0n) continue;

    if (acct.category === 'REVENUE') {
      const val = c - d;
      revenueTotal += val;
      revenue.push({ accountCode: code, name: acct.name, amount: formatMoneyMinor(val) });
    } else if (acct.category === 'COGS') {
      const val = d - c;
      cogsTotal += val;
      cogs.push({ accountCode: code, name: acct.name, amount: formatMoneyMinor(val) });
    } else if (acct.category === 'OPEX') {
      const val = d - c;
      opexTotal += val;
      opex.push({ accountCode: code, name: acct.name, amount: formatMoneyMinor(val) });
    }
  }

  const grossProfit = revenueTotal - cogsTotal;
  const netIncome = grossProfit - opexTotal;

  return {
    dateFrom,
    dateTo,
    baseCurrency: effectiveCurrency,
    displayCurrency: effectiveCurrency,
    reportingBaseCurrency,
    fxTranslationBasis: FX_TRANSLATION_BASIS,
    revenueTotal: formatMoneyMinor(revenueTotal),
    cogsTotal: formatMoneyMinor(cogsTotal),
    grossProfit: formatMoneyMinor(grossProfit),
    opexTotal: formatMoneyMinor(opexTotal),
    netIncome: formatMoneyMinor(netIncome),
    sections: { revenue, cogs, opex },
  };
}

export async function getBalanceSheet(asOf: string, displayCurrency?: CurrencyCode) {
  const reportingBaseCurrency = await getSystemBaseCurrency();
  const effectiveCurrency = displayCurrency ?? reportingBaseCurrency;
  const { coaMap, debits, credits } = await aggregateAccountBalances({
    dateTo: asOf,
    displayCurrency: effectiveCurrency,
  });

  const assets: Array<{ accountCode: string; name: string; amount: string }> = [];
  const liabilities: Array<{ accountCode: string; name: string; amount: string }> = [];
  const equity: Array<{ accountCode: string; name: string; amount: string }> = [];

  let assetsTotal = 0n;
  let liabilitiesTotal = 0n;
  let equityTotal = 0n;
  let currentEarnings = 0n;

  for (const [code, acct] of coaMap.entries()) {
    const d = debits.get(code) ?? 0n;
    const c = credits.get(code) ?? 0n;
    if (d === 0n && c === 0n) continue;

    if (acct.category === 'ASSET') {
      const val = d - c;
      assetsTotal += val;
      assets.push({ accountCode: code, name: acct.name, amount: formatMoneyMinor(val) });
    } else if (acct.category === 'LIABILITY') {
      const val = c - d;
      liabilitiesTotal += val;
      liabilities.push({ accountCode: code, name: acct.name, amount: formatMoneyMinor(val) });
    } else if (acct.category === 'EQUITY') {
      const val = c - d;
      equityTotal += val;
      equity.push({ accountCode: code, name: acct.name, amount: formatMoneyMinor(val) });
    } else if (acct.category === 'REVENUE') {
      currentEarnings += c - d;
    } else if (acct.category === 'COGS' || acct.category === 'OPEX') {
      currentEarnings -= d - c;
    }
  }

  const totalLiabilitiesAndEquity = liabilitiesTotal + equityTotal + currentEarnings;

  return {
    asOf,
    baseCurrency: effectiveCurrency,
    displayCurrency: effectiveCurrency,
    reportingBaseCurrency,
    fxTranslationBasis: FX_TRANSLATION_BASIS,
    assetsTotal: formatMoneyMinor(assetsTotal),
    liabilitiesTotal: formatMoneyMinor(liabilitiesTotal),
    equityTotal: formatMoneyMinor(equityTotal),
    currentEarnings: formatMoneyMinor(currentEarnings),
    isBalanced: assetsTotal === totalLiabilitiesAndEquity,
    sections: { assets, liabilities, equity },
  };
}

export async function getCashFlowReport(
  dateFrom: string,
  dateTo: string,
  displayCurrency?: CurrencyCode
) {
  const reportingBaseCurrency = await getSystemBaseCurrency();
  const effectiveCurrency = displayCurrency ?? reportingBaseCurrency;

  const entries = await Collections.journalEntries()
    .find({
      status: { $in: ['POSTED', 'REVERSED'] },
      entryDate: { $gte: dateFrom, $lte: dateTo },
    })
    .sort({ entryDate: 1 })
    .toArray();

  let cashIn = 0n;
  let cashOut = 0n;
  const byMonth = new Map<string, { inflow: bigint; outflow: bigint }>();
  const rateCache = new Map<string, bigint>();

  for (const je of entries) {
    const month = je.entryDate.slice(0, 7);
    const bucket = byMonth.get(month) ?? { inflow: 0n, outflow: 0n };
    const lines = await translateJournalLinesToCurrency(je, effectiveCurrency, rateCache);

    for (const line of lines) {
      if (!CASH_ACCOUNT_CODES.has(line.accountCode)) continue;
      cashIn += line.debitDisplay;
      cashOut += line.creditDisplay;
      bucket.inflow += line.debitDisplay;
      bucket.outflow += line.creditDisplay;
    }
    byMonth.set(month, bucket);
  }

  const series = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, v]) => ({
      month,
      inflow: formatMoneyMinor(v.inflow),
      outflow: formatMoneyMinor(v.outflow),
      net: formatMoneyMinor(v.inflow - v.outflow),
    }));

  return {
    dateFrom,
    dateTo,
    baseCurrency: effectiveCurrency,
    displayCurrency: effectiveCurrency,
    reportingBaseCurrency,
    fxTranslationBasis: FX_TRANSLATION_BASIS,
    cashInflow: formatMoneyMinor(cashIn),
    cashOutflow: formatMoneyMinor(cashOut),
    netCashFlow: formatMoneyMinor(cashIn - cashOut),
    series,
  };
}

export async function getMoneyUsageReport(
  dateFrom: string,
  dateTo: string,
  displayCurrency?: CurrencyCode
) {
  const pnl = await getIncomeStatement(dateFrom, dateTo, displayCurrency);
  const combined = [
    ...pnl.sections.cogs.map((item) => ({ ...item, category: 'COGS' as const })),
    ...pnl.sections.opex.map((item) => ({ ...item, category: 'OPEX' as const })),
  ];

  let totalSpend = 0n;
  const parsed = combined.map((item) => {
    const minor = parseMoneyMinor(item.amount);
    if (minor > 0n) totalSpend += minor;
    return { ...item, minor };
  });

  const breakdown = parsed
    .filter((i) => i.minor > 0n)
    .sort((a, b) => (b.minor > a.minor ? 1 : b.minor < a.minor ? -1 : 0))
    .map((item) => ({
      accountCode: item.accountCode,
      name: item.name,
      category: item.category,
      amount: item.amount,
      sharePct: totalSpend === 0n ? 0 : Number((item.minor * 10000n) / totalSpend) / 100,
    }));

  return {
    dateFrom,
    dateTo,
    baseCurrency: pnl.baseCurrency,
    displayCurrency: pnl.displayCurrency,
    reportingBaseCurrency: pnl.reportingBaseCurrency,
    fxTranslationBasis: FX_TRANSLATION_BASIS,
    totalSpend: formatMoneyMinor(totalSpend),
    breakdown,
  };
}

export async function getFinancialSummary(
  dateFrom: string,
  dateTo: string,
  displayCurrency?: CurrencyCode
) {
  const [pnl, balanceSheet, cashFlow, moneyUsage] = await Promise.all([
    getIncomeStatement(dateFrom, dateTo, displayCurrency),
    getBalanceSheet(dateTo, displayCurrency),
    getCashFlowReport(dateFrom, dateTo, displayCurrency),
    getMoneyUsageReport(dateFrom, dateTo, displayCurrency),
  ]);

  const cashAccounts = balanceSheet.sections.assets.filter((a) =>
    CASH_ACCOUNT_CODES.has(a.accountCode)
  );
  let cashBalanceMinor = 0n;
  for (const c of cashAccounts) {
    cashBalanceMinor += parseMoneyMinor(c.amount);
  }

  return {
    dateFrom,
    dateTo,
    displayCurrency: pnl.displayCurrency,
    baseCurrency: pnl.reportingBaseCurrency,
    fxTranslationBasis: FX_TRANSLATION_BASIS,
    cashBalance: formatMoneyMinor(cashBalanceMinor),
    totalIncome: pnl.revenueTotal,
    totalExpenses: formatMoneyMinor(
      parseMoneyMinor(pnl.cogsTotal) + parseMoneyMinor(pnl.opexTotal)
    ),
    cogsTotal: pnl.cogsTotal,
    opexTotal: pnl.opexTotal,
    grossProfit: pnl.grossProfit,
    netIncome: pnl.netIncome,
    cashFlow: {
      inflow: cashFlow.cashInflow,
      outflow: cashFlow.cashOutflow,
      net: cashFlow.netCashFlow,
      series: cashFlow.series,
    },
    moneyUsages: moneyUsage.breakdown,
  };
}

export async function getExecutiveOverview(params: {
  displayCurrency?: CurrencyCode;
  dateFrom?: string;
  dateTo?: string;
  periodKey?: string;
  canReadAccounting?: boolean;
  canReadCrm?: boolean;
}) {
  const now = new Date();
  const todayIso = now.toISOString().slice(0, 10);
  const yearStart = `${todayIso.slice(0, 4)}-01-01`;
  const dateFrom = params.dateFrom ?? yearStart;
  const dateTo = params.dateTo ?? todayIso;
  const periodKey = params.periodKey ?? todayIso.slice(0, 7);
  const canReadAccounting = params.canReadAccounting ?? true;
  const canReadCrm = params.canReadCrm ?? true;

  const sixtyDaysAhead = new Date(now.getTime() + 60 * 24 * 60 * 60 * 1000)
    .toISOString()
    .slice(0, 10);

  const baseCurrency = await getSystemBaseCurrency();
  const displayCurrency = params.displayCurrency ?? baseCurrency;

  const [
    summary,
    budgetReport,
    activeAssociatesCount,
    expiringAssociates,
    openLeadsCount,
    recentLeads,
    openDeals,
    unpublishedCmsCount,
  ] = await Promise.all([
    canReadAccounting
      ? getFinancialSummary(dateFrom, dateTo, params.displayCurrency)
      : Promise.resolve(null),
    canReadAccounting
      ? getBudgetVsActualReport({
          periodType: 'MONTHLY',
          periodKey,
          displayCurrency: params.displayCurrency,
        })
      : Promise.resolve(null),
    Collections.associates().countDocuments({ status: 'ACTIVE' }),
    Collections.associates()
      .find({
        status: 'ACTIVE',
        cardExpirationDate: { $lte: sixtyDaysAhead },
      })
      .sort({ cardExpirationDate: 1 })
      .limit(10)
      .toArray(),
    canReadCrm
      ? Collections.crmLeads().countDocuments({ status: { $in: ['NEW', 'CONTACTED', 'QUALIFIED'] } })
      : Promise.resolve(0),
    canReadCrm
      ? Collections.crmLeads().find({}).sort({ createdAt: -1, _id: -1 }).limit(5).toArray()
      : Promise.resolve([]),
    canReadCrm
      ? Collections.crmDeals()
          .find({ stage: { $nin: ['WON', 'LOST'] } })
          .toArray()
      : Promise.resolve([]),
    Collections.cmsDocuments().countDocuments({
      $or: [{ status: 'draft' }, { hasUnpublishedChanges: true }],
    }),
  ]);

  const effectiveDisplayCurrency = summary?.displayCurrency ?? displayCurrency;

  let pipelineMinor = 0n;
  if (canReadCrm) {
    for (const deal of openDeals) {
      const val = parseMoneyMinor(deal.estimatedValue);
      if (deal.currency === effectiveDisplayCurrency) {
        pipelineMinor += val;
      } else {
        try {
          const dealDate = deal.createdAt.toISOString().slice(0, 10);
          const fx = await resolveFxRate(dealDate, deal.currency, effectiveDisplayCurrency);
          pipelineMinor += convertMoneyMinor(val, fx.rateMicro);
        } catch {
          pipelineMinor += val;
        }
      }
    }
  }

  return {
    displayCurrency: effectiveDisplayCurrency,
    baseCurrency: summary?.baseCurrency ?? baseCurrency,
    fxTranslationBasis: FX_TRANSLATION_BASIS,
    dateFrom,
    dateTo,
    periodKey,
    kpis: {
      ...(canReadAccounting && summary
        ? {
            cashBalance: summary.cashBalance,
            totalIncome: summary.totalIncome,
            totalExpenses: summary.totalExpenses,
            grossProfit: summary.grossProfit,
            netIncome: summary.netIncome,
          }
        : {}),
      activeAssociatesCount,
      ...(canReadCrm
        ? {
            openLeadsCount,
            openDealsCount: openDeals.length,
            openDealsPipelineValue: formatMoneyMinor(pipelineMinor),
          }
        : {}),
      unpublishedCmsCount,
    },
    moneyInVsOut: canReadAccounting && summary ? summary.cashFlow.series : [],
    moneyUsages: canReadAccounting && summary ? summary.moneyUsages : [],
    budgetVsActual: canReadAccounting && budgetReport ? budgetReport.rows : [],
    expiringAssociateCards: expiringAssociates.map((a) => ({
      id: a._id.toHexString(),
      employeeId: a.employeeId,
      slug: a.slug,
      name: a.name,
      title: a.title,
      department: a.department,
      cardExpirationDate: a.cardExpirationDate,
      isExpired: todayIso > a.cardExpirationDate,
    })),
    recentLeads: canReadCrm
      ? recentLeads.map((l) => ({
          id: l._id.toHexString(),
          source: l.source,
          status: l.status,
          name: l.name,
          email: l.email,
          company: l.company,
          createdAt: l.createdAt.toISOString(),
        }))
      : [],
  };
}

export async function getGeneralLedger(params: {
  accountCode?: string;
  dateFrom?: string;
  dateTo?: string;
  displayCurrency?: CurrencyCode;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const dateFrom = params.dateFrom || null;
  const dateTo = params.dateTo || todayIso;

  const baseCurrency = await getSystemBaseCurrency();
  const displayCurrency = params.displayCurrency ?? baseCurrency;
  const rateCache = new Map<string, bigint>();

  const requestedAccount = params.accountCode?.trim();
  const isSummaryMode = !requestedAccount || requestedAccount.toUpperCase() === 'ALL';

  if (isSummaryMode) {
    const [coaList, entries] = await Promise.all([
      Collections.coaAccounts().find({ isActive: true }).sort({ code: 1 }).toArray(),
      Collections.journalEntries()
        .find({
          status: { $in: ['POSTED', 'REVERSED'] },
          entryDate: { $lte: dateTo },
        })
        .sort({ entryDate: 1, entryNumber: 1, _id: 1 })
        .toArray(),
    ]);

    const openingDebitBase = new Map<string, bigint>();
    const openingCreditBase = new Map<string, bigint>();
    const periodDebitBase = new Map<string, bigint>();
    const periodCreditBase = new Map<string, bigint>();

    const openingDebitDisp = new Map<string, bigint>();
    const openingCreditDisp = new Map<string, bigint>();
    const periodDebitDisp = new Map<string, bigint>();
    const periodCreditDisp = new Map<string, bigint>();

    const entryCounts = new Map<string, number>();

    for (const je of entries) {
      const isBeforePeriod = dateFrom !== null && je.entryDate < dateFrom;
      const seenAccountsInEntry = new Set<string>();
      const translated = await translateJournalLinesToCurrency(je, displayCurrency, rateCache);

      for (const line of translated) {
        if (isBeforePeriod) {
          openingDebitBase.set(
            line.accountCode,
            (openingDebitBase.get(line.accountCode) ?? 0n) + line.debitBase
          );
          openingCreditBase.set(
            line.accountCode,
            (openingCreditBase.get(line.accountCode) ?? 0n) + line.creditBase
          );
          openingDebitDisp.set(
            line.accountCode,
            (openingDebitDisp.get(line.accountCode) ?? 0n) + line.debitDisplay
          );
          openingCreditDisp.set(
            line.accountCode,
            (openingCreditDisp.get(line.accountCode) ?? 0n) + line.creditDisplay
          );
        } else {
          periodDebitBase.set(
            line.accountCode,
            (periodDebitBase.get(line.accountCode) ?? 0n) + line.debitBase
          );
          periodCreditBase.set(
            line.accountCode,
            (periodCreditBase.get(line.accountCode) ?? 0n) + line.creditBase
          );
          periodDebitDisp.set(
            line.accountCode,
            (periodDebitDisp.get(line.accountCode) ?? 0n) + line.debitDisplay
          );
          periodCreditDisp.set(
            line.accountCode,
            (periodCreditDisp.get(line.accountCode) ?? 0n) + line.creditDisplay
          );
          seenAccountsInEntry.add(line.accountCode);
        }
      }

      for (const code of seenAccountsInEntry) {
        entryCounts.set(code, (entryCounts.get(code) ?? 0) + 1);
      }
    }

    const accounts = coaList.map((acct) => {
      const isDebitNormal = acct.normalBalance === 'DEBIT';

      const opDebB = openingDebitBase.get(acct.code) ?? 0n;
      const opCredB = openingCreditBase.get(acct.code) ?? 0n;
      const perDebB = periodDebitBase.get(acct.code) ?? 0n;
      const perCredB = periodCreditBase.get(acct.code) ?? 0n;
      const openingBaseMinor = isDebitNormal ? opDebB - opCredB : opCredB - opDebB;
      const closingBaseMinor = isDebitNormal
        ? openingBaseMinor + (perDebB - perCredB)
        : openingBaseMinor + (perCredB - perDebB);

      const opDebD = openingDebitDisp.get(acct.code) ?? 0n;
      const opCredD = openingCreditDisp.get(acct.code) ?? 0n;
      const perDebD = periodDebitDisp.get(acct.code) ?? 0n;
      const perCredD = periodCreditDisp.get(acct.code) ?? 0n;
      const openingDispMinor = isDebitNormal ? opDebD - opCredD : opCredD - opDebD;
      const closingDispMinor = isDebitNormal
        ? openingDispMinor + (perDebD - perCredD)
        : openingDispMinor + (perCredD - perDebD);

      return {
        code: acct.code,
        name: acct.name,
        category: acct.category,
        normalBalance: acct.normalBalance,
        openingBalance: formatMoneyMinor(openingDispMinor),
        periodDebit: formatMoneyMinor(perDebD),
        periodCredit: formatMoneyMinor(perCredD),
        closingBalance: formatMoneyMinor(closingDispMinor),
        openingBalanceBase: formatMoneyMinor(openingBaseMinor),
        periodDebitBase: formatMoneyMinor(perDebB),
        periodCreditBase: formatMoneyMinor(perCredB),
        closingBalanceBase: formatMoneyMinor(closingBaseMinor),
        entryCount: entryCounts.get(acct.code) ?? 0,
      };
    });

    return {
      mode: 'SUMMARY' as const,
      baseCurrency,
      displayCurrency,
      fxTranslationBasis: FX_TRANSLATION_BASIS,
      dateFrom,
      dateTo,
      accounts,
    };
  }

  // Single Account Chronological General Ledger
  const account = await Collections.coaAccounts().findOne({ code: requestedAccount });
  if (!account) {
    throw AppError.notFound(`COA account ${requestedAccount} not found.`);
  }

  const entries = await Collections.journalEntries()
    .find({
      status: { $in: ['POSTED', 'REVERSED'] },
      'lines.accountCode': requestedAccount,
      entryDate: { $lte: dateTo },
    })
    .sort({ entryDate: 1, entryNumber: 1, _id: 1 })
    .toArray();

  const isDebitNormal = account.normalBalance === 'DEBIT';
  let openingBaseMinor = 0n;
  let openingDisplayMinor = 0n;
  let periodDebitBaseMinor = 0n;
  let periodCreditBaseMinor = 0n;
  let periodDebitDisplayMinor = 0n;
  let periodCreditDisplayMinor = 0n;

  for (const je of entries) {
    if (dateFrom !== null && je.entryDate < dateFrom) {
      const translated = await translateJournalLinesToCurrency(je, displayCurrency, rateCache);
      for (const line of translated) {
        if (line.accountCode !== requestedAccount) continue;
        openingBaseMinor += isDebitNormal
          ? line.debitBase - line.creditBase
          : line.creditBase - line.debitBase;
        openingDisplayMinor += isDebitNormal
          ? line.debitDisplay - line.creditDisplay
          : line.creditDisplay - line.debitDisplay;
      }
    }
  }

  let runningBaseMinor = openingBaseMinor;
  let runningDisplayMinor = openingDisplayMinor;

  const ledgerRows: Array<{
    entryId: string;
    entryNumber: string;
    entryType: string;
    entryDate: string;
    status: string;
    description: string;
    reference: string;
    memo: string;
    counterAccounts: string[];
    currency: CurrencyCode;
    fxRateUsed: string;
    fxRateDate: string;
    debitOrig: string;
    creditOrig: string;
    debitBase: string;
    creditBase: string;
    debitDisplay: string;
    creditDisplay: string;
    runningBalanceBase: string;
    runningBalanceDisplay: string;
    isReversal: boolean;
  }> = [];

  for (const je of entries) {
    if (dateFrom !== null && je.entryDate < dateFrom) continue;

    const translated = await translateJournalLinesToCurrency(je, displayCurrency, rateCache);
    const counterAccounts = [
      ...new Set(
        je.lines
          .filter((l) => l.accountCode !== requestedAccount)
          .map((l) => `${l.accountCode} ${l.accountNameSnapshot}`.trim())
      ),
    ];

    const fxRateUsedStr = formatFxMicro(parseFxMicro(je.fxRateUsed));

    for (const line of translated) {
      if (line.accountCode !== requestedAccount) continue;

      periodDebitBaseMinor += line.debitBase;
      periodCreditBaseMinor += line.creditBase;
      periodDebitDisplayMinor += line.debitDisplay;
      periodCreditDisplayMinor += line.creditDisplay;

      runningBaseMinor += isDebitNormal
        ? line.debitBase - line.creditBase
        : line.creditBase - line.debitBase;
      runningDisplayMinor += isDebitNormal
        ? line.debitDisplay - line.creditDisplay
        : line.creditDisplay - line.debitDisplay;

      ledgerRows.push({
        entryId: je._id.toHexString(),
        entryNumber: je.entryNumber,
        entryType: je.entryType,
        entryDate: je.entryDate,
        status: je.status,
        description: je.description,
        reference: je.reference,
        memo: line.memo,
        counterAccounts,
        currency: je.currency,
        fxRateUsed: fxRateUsedStr,
        fxRateDate: je.fxRateDate,
        debitOrig: formatMoneyMinor(line.debitOrig),
        creditOrig: formatMoneyMinor(line.creditOrig),
        debitBase: formatMoneyMinor(line.debitBase),
        creditBase: formatMoneyMinor(line.creditBase),
        debitDisplay: formatMoneyMinor(line.debitDisplay),
        creditDisplay: formatMoneyMinor(line.creditDisplay),
        runningBalanceBase: formatMoneyMinor(runningBaseMinor),
        runningBalanceDisplay: formatMoneyMinor(runningDisplayMinor),
        isReversal: je.reversesEntryId !== null,
      });
    }
  }

  return {
    mode: 'ACCOUNT' as const,
    account: {
      code: account.code,
      name: account.name,
      category: account.category,
      normalBalance: account.normalBalance,
    },
    baseCurrency,
    displayCurrency,
    fxTranslationBasis: FX_TRANSLATION_BASIS,
    dateFrom,
    dateTo,
    openingBalanceBase: formatMoneyMinor(openingBaseMinor),
    openingBalanceDisplay: formatMoneyMinor(openingDisplayMinor),
    periodDebitBase: formatMoneyMinor(periodDebitBaseMinor),
    periodCreditBase: formatMoneyMinor(periodCreditBaseMinor),
    periodDebitDisplay: formatMoneyMinor(periodDebitDisplayMinor),
    periodCreditDisplay: formatMoneyMinor(periodCreditDisplayMinor),
    closingBalanceBase: formatMoneyMinor(runningBaseMinor),
    closingBalanceDisplay: formatMoneyMinor(runningDisplayMinor),
    entries: ledgerRows,
  };
}
