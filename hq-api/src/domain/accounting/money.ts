import { Decimal128 } from 'mongodb';
import { AppError } from '../errors';

export const SUPPORTED_CURRENCIES = ['MMK', 'THB'] as const;
export type CurrencyCode = (typeof SUPPORTED_CURRENCIES)[number];

export const MONEY_SCALE = 2;
export const MONEY_FACTOR = 100n;
export const FX_SCALE = 6;
export const FX_FACTOR = 1_000_000n;

export const DECIMAL_AMOUNT_REGEX = /^-?\d+(?:\.\d{1,2})?$/;
export const NON_NEGATIVE_AMOUNT_REGEX = /^\d+(?:\.\d{1,2})?$/;
export const POSITIVE_FX_RATE_REGEX = /^\d+(?:\.\d{1,6})?$/;

/**
 * Half-even (banker's) rounding for exact bigint integer division.
 */
export function divideRoundHalfEven(numerator: bigint, denominator: bigint): bigint {
  if (denominator === 0n) {
    throw AppError.unprocessable('Division by zero in monetary conversion.', 'division-by-zero');
  }

  const negative = (numerator < 0n) !== (denominator < 0n);
  const absNum = numerator < 0n ? -numerator : numerator;
  const absDen = denominator < 0n ? -denominator : denominator;

  let quotient = absNum / absDen;
  const remainder = absNum % absDen;
  const twiceRemainder = remainder * 2n;

  if (twiceRemainder > absDen || (twiceRemainder === absDen && (quotient & 1n) === 1n)) {
    quotient += 1n;
  }

  return negative ? -quotient : quotient;
}

export function parseScaledBigInt(raw: string, scale: number, fieldName = 'amount'): bigint {
  const trimmed = raw.trim();
  const pattern = new RegExp(`^(-?)(\\d+)(?:\\.(\\d{1,${scale}}))?$`);
  const match = pattern.exec(trimmed);
  if (!match) {
    throw AppError.badRequest(`Invalid fixed-scale decimal for ${fieldName}: "${raw}".`, [
      { field: fieldName, message: `Must be a decimal with at most ${scale} decimal places.` },
    ]);
  }

  const sign = match[1] === '-' ? -1n : 1n;
  const intPart = match[2] ?? '0';
  const fracPart = (match[3] ?? '').padEnd(scale, '0');
  const combined = BigInt(intPart + fracPart);
  return sign * combined;
}

export function formatScaledBigInt(value: bigint, scale: number): string {
  const negative = value < 0n;
  const abs = negative ? -value : value;
  const factor = 10n ** BigInt(scale);
  const intPart = abs / factor;
  const fracPart = (abs % factor).toString().padStart(scale, '0');
  return `${negative ? '-' : ''}${intPart.toString()}.${fracPart}`;
}

export function parseMoneyMinor(raw: string | Decimal128, fieldName = 'amount'): bigint {
  const str = raw instanceof Decimal128 ? raw.toString() : raw;
  return parseScaledBigInt(str, MONEY_SCALE, fieldName);
}

export function formatMoneyMinor(minor: bigint): string {
  return formatScaledBigInt(minor, MONEY_SCALE);
}

export function moneyMinorToDecimal128(minor: bigint): Decimal128 {
  return Decimal128.fromString(formatMoneyMinor(minor));
}

export function parseFxMicro(raw: string | Decimal128, fieldName = 'rate'): bigint {
  const str = raw instanceof Decimal128 ? raw.toString() : raw;
  const parsed = parseScaledBigInt(str, FX_SCALE, fieldName);
  if (parsed <= 0n) {
    throw AppError.badRequest(`FX rate must be greater than zero.`, [
      { field: fieldName, message: 'Rate must be strictly positive.' },
    ]);
  }
  return parsed;
}

export function formatFxMicro(micro: bigint): string {
  return formatScaledBigInt(micro, FX_SCALE);
}

export function fxMicroToDecimal128(micro: bigint): Decimal128 {
  return Decimal128.fromString(formatFxMicro(micro));
}

/**
 * Computes inverse rate (1 / rate) at 10^6 micro-unit precision with half-even rounding.
 */
export function invertFxMicro(rateMicro: bigint): bigint {
  if (rateMicro <= 0n) {
    throw AppError.unprocessable('Cannot invert non-positive FX rate.', 'invalid-fx-rate');
  }
  const inverted = divideRoundHalfEven(FX_FACTOR * FX_FACTOR, rateMicro);
  if (inverted <= 0n) {
    throw AppError.unprocessable('Inverted FX rate underflowed micro precision.', 'fx-underflow');
  }
  return inverted;
}

/**
 * Converts a minor-unit amount using a micro-unit FX rate (amount * rate / 10^6).
 */
export function convertMoneyMinor(amountMinor: bigint, fxRateMicro: bigint): bigint {
  if (fxRateMicro === FX_FACTOR) return amountMinor;
  return divideRoundHalfEven(amountMinor * fxRateMicro, FX_FACTOR);
}

export interface RawJournalLineInput {
  accountCode: string;
  memo?: string;
  debitOrig: string;
  creditOrig: string;
}

export interface ValidatedJournalLine {
  lineNo: number;
  accountCode: string;
  accountNameSnapshot: string;
  memo: string;
  debitOrigMinor: bigint;
  creditOrigMinor: bigint;
  debitBaseMinor: bigint;
  creditBaseMinor: bigint;
}

export interface BalancedJournalComputation {
  lines: ValidatedJournalLine[];
  totalDebitOrigMinor: bigint;
  totalCreditOrigMinor: bigint;
  totalDebitBaseMinor: bigint;
  totalCreditBaseMinor: bigint;
}

/**
 * Validates double-entry balance in original currency and converts each line to base currency,
 * reconciling any sub-minor-unit rounding drift across multi-line FX conversions.
 */
export function validateAndComputeJournalLines(
  rawLines: RawJournalLineInput[],
  accountNames: Map<string, string>,
  fxRateMicro: bigint
): BalancedJournalComputation {
  if (rawLines.length < 2) {
    throw AppError.unprocessable(
      'Journal entry must contain at least 2 lines.',
      'invalid-journal-lines',
      'Invalid Journal Entry'
    );
  }

  let totalDebitOrig = 0n;
  let totalCreditOrig = 0n;
  let totalDebitBase = 0n;
  let totalCreditBase = 0n;

  const lines: ValidatedJournalLine[] = rawLines.map((raw, idx) => {
    const accountName = accountNames.get(raw.accountCode);
    if (!accountName) {
      throw AppError.unprocessable(
        `Account code ${raw.accountCode} does not exist or is inactive.`,
        'invalid-account-code',
        'Invalid Account Code',
        [{ field: `lines.${idx}.accountCode`, message: `Unknown or inactive account: ${raw.accountCode}` }]
      );
    }

    const debitOrigMinor = parseMoneyMinor(raw.debitOrig, `lines.${idx}.debitOrig`);
    const creditOrigMinor = parseMoneyMinor(raw.creditOrig, `lines.${idx}.creditOrig`);

    if (debitOrigMinor < 0n || creditOrigMinor < 0n) {
      throw AppError.unprocessable(
        'Debit and credit line amounts cannot be negative.',
        'negative-line-amount',
        'Invalid Line Amount',
        [{ field: `lines.${idx}`, message: 'Amounts must be >= 0.00.' }]
      );
    }

    const hasDebit = debitOrigMinor > 0n;
    const hasCredit = creditOrigMinor > 0n;
    if ((hasDebit && hasCredit) || (!hasDebit && !hasCredit)) {
      throw AppError.unprocessable(
        `Line ${idx + 1} must have strictly one non-zero side (either debitOrig or creditOrig).`,
        'invalid-line-side',
        'Invalid Journal Line',
        [{ field: `lines.${idx}`, message: 'Provide a positive value on debitOrig OR creditOrig, not both.' }]
      );
    }

    const debitBaseMinor = hasDebit ? convertMoneyMinor(debitOrigMinor, fxRateMicro) : 0n;
    const creditBaseMinor = hasCredit ? convertMoneyMinor(creditOrigMinor, fxRateMicro) : 0n;

    totalDebitOrig += debitOrigMinor;
    totalCreditOrig += creditOrigMinor;
    totalDebitBase += debitBaseMinor;
    totalCreditBase += creditBaseMinor;

    return {
      lineNo: idx + 1,
      accountCode: raw.accountCode,
      accountNameSnapshot: accountName,
      memo: (raw.memo ?? '').trim(),
      debitOrigMinor,
      creditOrigMinor,
      debitBaseMinor,
      creditBaseMinor,
    };
  });

  if (totalDebitOrig <= 0n || totalDebitOrig !== totalCreditOrig) {
    throw AppError.unprocessable(
      `Journal entry is unbalanced in original currency: debits (${formatMoneyMinor(totalDebitOrig)}) != credits (${formatMoneyMinor(totalCreditOrig)}).`,
      'unbalanced-journal-entry',
      'Unbalanced Journal Entry'
    );
  }

  // Reconcile line-by-line FX rounding drift when minor-unit drift <= lines.length
  const baseDiff = totalDebitBase - totalCreditBase;
  if (baseDiff !== 0n) {
    const absDiff = baseDiff < 0n ? -baseDiff : baseDiff;
    if (absDiff > BigInt(lines.length)) {
      throw AppError.unprocessable(
        `Base currency rounding drift (${formatMoneyMinor(absDiff)}) exceeds tolerance.`,
        'fx-rounding-drift-exceeded',
        'Base Currency Imbalance'
      );
    }

    if (baseDiff > 0n) {
      let target: ValidatedJournalLine | undefined;
      for (const line of lines) {
        if (line.creditBaseMinor > 0n && (!target || line.creditBaseMinor > target.creditBaseMinor)) {
          target = line;
        }
      }
      if (target) {
        target.creditBaseMinor += baseDiff;
        totalCreditBase += baseDiff;
      }
    } else {
      const adjustment = -baseDiff;
      let target: ValidatedJournalLine | undefined;
      for (const line of lines) {
        if (line.debitBaseMinor > 0n && (!target || line.debitBaseMinor > target.debitBaseMinor)) {
          target = line;
        }
      }
      if (target) {
        target.debitBaseMinor += adjustment;
        totalDebitBase += adjustment;
      }
    }
  }

  if (totalDebitBase <= 0n || totalDebitBase !== totalCreditBase) {
    throw AppError.unprocessable(
      'Journal entry failed base currency balance assertion.',
      'unbalanced-base-entry',
      'Base Currency Imbalance'
    );
  }

  return {
    lines,
    totalDebitOrigMinor: totalDebitOrig,
    totalCreditOrigMinor: totalCreditOrig,
    totalDebitBaseMinor: totalDebitBase,
    totalCreditBaseMinor: totalCreditBase,
  };
}
