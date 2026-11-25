import {
  convertMoneyMinor,
  parseMoneyMinor,
  type CurrencyCode,
} from '../../domain/accounting/money';
import type { JournalEntryDoc } from '../../infrastructure/db/collections';
import { resolveFxRate } from './fxService';

export const FX_TRANSLATION_BASIS = 'HISTORICAL_ENTRY_DATE' as const;

export interface TranslatedJournalLine {
  accountCode: string;
  accountNameSnapshot: string;
  memo: string;
  debitOrig: bigint;
  creditOrig: bigint;
  debitBase: bigint;
  creditBase: bigint;
  debitDisplay: bigint;
  creditDisplay: bigint;
}

/**
 * Translates every line of a posted/reversed journal entry into targetCurrency using
 * the entry's own immutable historical entry-date FX rate (never a report-date rate).
 * Guarantees exact double-entry balance (SUM(debitDisplay) === SUM(creditDisplay)) per entry.
 */
export async function translateJournalLinesToCurrency(
  je: JournalEntryDoc,
  targetCurrency: CurrencyCode,
  rateCache: Map<string, bigint>
): Promise<TranslatedJournalLine[]> {
  if (targetCurrency === je.currency) {
    return je.lines.map((line) => {
      const debitOrig = parseMoneyMinor(line.debitOrig);
      const creditOrig = parseMoneyMinor(line.creditOrig);
      return {
        accountCode: line.accountCode,
        accountNameSnapshot: line.accountNameSnapshot,
        memo: line.memo,
        debitOrig,
        creditOrig,
        debitBase: parseMoneyMinor(line.debitBase),
        creditBase: parseMoneyMinor(line.creditBase),
        debitDisplay: debitOrig,
        creditDisplay: creditOrig,
      };
    });
  }

  if (targetCurrency === je.baseCurrency) {
    return je.lines.map((line) => {
      const debitBase = parseMoneyMinor(line.debitBase);
      const creditBase = parseMoneyMinor(line.creditBase);
      return {
        accountCode: line.accountCode,
        accountNameSnapshot: line.accountNameSnapshot,
        memo: line.memo,
        debitOrig: parseMoneyMinor(line.debitOrig),
        creditOrig: parseMoneyMinor(line.creditOrig),
        debitBase,
        creditBase,
        debitDisplay: debitBase,
        creditDisplay: creditBase,
      };
    });
  }

  // Reversing entries preserve the original entry's fxRateDate so original + reversal net to 0.00 in both currencies
  const lookupDate = je.reversesEntryId && je.fxRateDate ? je.fxRateDate : je.entryDate;
  const cacheKey = `${lookupDate}:${je.baseCurrency}->${targetCurrency}`;

  let rateMicro = rateCache.get(cacheKey);
  if (rateMicro === undefined) {
    const resolved = await resolveFxRate(lookupDate, je.baseCurrency, targetCurrency);
    rateMicro = resolved.rateMicro;
    rateCache.set(cacheKey, rateMicro);
  }

  let totalDebitDisp = 0n;
  let totalCreditDisp = 0n;

  const translated: TranslatedJournalLine[] = je.lines.map((line) => {
    const debitOrig = parseMoneyMinor(line.debitOrig);
    const creditOrig = parseMoneyMinor(line.creditOrig);
    const debitBase = parseMoneyMinor(line.debitBase);
    const creditBase = parseMoneyMinor(line.creditBase);
    const debitDisplay = debitBase > 0n ? convertMoneyMinor(debitBase, rateMicro) : 0n;
    const creditDisplay = creditBase > 0n ? convertMoneyMinor(creditBase, rateMicro) : 0n;

    totalDebitDisp += debitDisplay;
    totalCreditDisp += creditDisplay;

    return {
      accountCode: line.accountCode,
      accountNameSnapshot: line.accountNameSnapshot,
      memo: line.memo,
      debitOrig,
      creditOrig,
      debitBase,
      creditBase,
      debitDisplay,
      creditDisplay,
    };
  });

  // Reconcile any minor-unit rounding remainder on the largest opposing line of this entry
  const diff = totalDebitDisp - totalCreditDisp;
  if (diff !== 0n) {
    if (diff > 0n) {
      let target: TranslatedJournalLine | undefined;
      for (const l of translated) {
        if (l.creditDisplay > 0n && (!target || l.creditDisplay > target.creditDisplay)) {
          target = l;
        }
      }
      if (target) {
        target.creditDisplay += diff;
      }
    } else {
      const adj = -diff;
      let target: TranslatedJournalLine | undefined;
      for (const l of translated) {
        if (l.debitDisplay > 0n && (!target || l.debitDisplay > target.debitDisplay)) {
          target = l;
        }
      }
      if (target) {
        target.debitDisplay += adj;
      }
    }
  }

  return translated;
}
