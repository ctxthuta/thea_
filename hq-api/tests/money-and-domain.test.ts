import { describe, expect, test } from 'bun:test';
import {
  convertMoneyMinor,
  divideRoundHalfEven,
  formatFxMicro,
  formatMoneyMinor,
  invertFxMicro,
  parseFxMicro,
  parseMoneyMinor,
  validateAndComputeJournalLines,
} from '../src/domain/accounting/money';
import {
  assertValidPublicSlug,
  computeVerificationStatus,
  EMPLOYEE_ID_REGEX,
  generateAssociateBadgeId,
} from '../src/domain/associates/associateDomain';
import { hasPermission } from '../src/domain/auth/rbac';
import { constantTimeEqual } from '../src/infrastructure/security/password';
import { mapCsvRowToLead, parseRfc4180Csv } from '../src/application/crm/sheetSyncService';

describe('Money & FX BigInt Precision Math', () => {
  test('divideRoundHalfEven applies banker rounding accurately', () => {
    expect(divideRoundHalfEven(5n, 2n)).toBe(2n);
    expect(divideRoundHalfEven(7n, 2n)).toBe(4n);
    expect(divideRoundHalfEven(9n, 2n)).toBe(4n);
    expect(divideRoundHalfEven(11n, 2n)).toBe(6n);
    expect(divideRoundHalfEven(-5n, 2n)).toBe(-2n);
    expect(divideRoundHalfEven(-7n, 2n)).toBe(-4n);
  });

  test('parses and formats MMK/THB minor units without floating-point drift', () => {
    const a = parseMoneyMinor('999999999999.99');
    const b = parseMoneyMinor('0.01');
    expect(formatMoneyMinor(a + b)).toBe('1000000000000.00');
    expect(formatMoneyMinor(parseMoneyMinor('2500000'))).toBe('2500000.00');
  });

  test('computes FX conversion and inverse rate at 6 decimal micro precision', () => {
    const thbToMmk = parseFxMicro('135.000000');
    const amountThb = parseMoneyMinor('20000.00');
    const amountMmk = convertMoneyMinor(amountThb, thbToMmk);
    expect(formatMoneyMinor(amountMmk)).toBe('2700000.00');

    const mmkToThb = invertFxMicro(thbToMmk);
    expect(formatFxMicro(mmkToThb)).toBe('0.007407');
  });

  test('validates double-entry balance and rejects unbalanced or dual-sided lines', () => {
    const accounts = new Map([
      ['5010', 'Engineering Contractor Payouts'],
      ['1030', 'Bank Account (THB)'],
      ['6010', 'SaaS & Developer Tooling'],
    ]);

    const fxRate = parseFxMicro('135.333333');
    const result = validateAndComputeJournalLines(
      [
        { accountCode: '5010', debitOrig: '100.01', creditOrig: '0.00', memo: 'Sprint A' },
        { accountCode: '6010', debitOrig: '100.01', creditOrig: '0.00', memo: 'Tooling' },
        { accountCode: '1030', debitOrig: '0.00', creditOrig: '200.02', memo: 'Wire' },
      ],
      accounts,
      fxRate
    );

    expect(result.totalDebitOrigMinor).toBe(result.totalCreditOrigMinor);
    expect(result.totalDebitBaseMinor).toBe(result.totalCreditBaseMinor);
    expect(result.totalDebitOrigMinor).toBe(20002n);

    // Unbalanced rejected
    expect(() =>
      validateAndComputeJournalLines(
        [
          { accountCode: '5010', debitOrig: '100.00', creditOrig: '0.00' },
          { accountCode: '1030', debitOrig: '0.00', creditOrig: '99.99' },
        ],
        accounts,
        fxRate
      )
    ).toThrow(/unbalanced/i);

    // Dual-sided line rejected
    expect(() =>
      validateAndComputeJournalLines(
        [
          { accountCode: '5010', debitOrig: '100.00', creditOrig: '100.00' },
          { accountCode: '1030', debitOrig: '0.00', creditOrig: '100.00' },
        ],
        accounts,
        fxRate
      )
    ).toThrow(/strictly one non-zero side/i);
  });
});

describe('Associates, RBAC & Constant-Time Security Domain', () => {
  test('generates valid THEA-XXXX badge IDs and blocks reserved slugs', () => {
    for (let i = 0; i < 20; i++) {
      expect(EMPLOYEE_ID_REGEX.test(generateAssociateBadgeId())).toBe(true);
    }
    expect(() => assertValidPublicSlug('pricing')).toThrow(/reserved/i);
    expect(() => assertValidPublicSlug('verify')).toThrow(/reserved/i);
    expect(() => assertValidPublicSlug('thiri-chan-nyein')).not.toThrow();
  });

  test('computes associate verification states accurately', () => {
    const now = new Date('2026-11-25T12:00:00Z');
    expect(
      computeVerificationStatus(
        { status: 'ACTIVE', revokedAt: null, cardExpirationDate: '2027-12-31' },
        now
      )
    ).toEqual({ isVerified: true, verificationStatus: 'verified' });

    expect(
      computeVerificationStatus(
        { status: 'ACTIVE', revokedAt: null, cardExpirationDate: '2026-01-01' },
        now
      )
    ).toEqual({ isVerified: false, verificationStatus: 'expired' });

    expect(
      computeVerificationStatus(
        { status: 'REVOKED', revokedAt: now, cardExpirationDate: '2027-12-31' },
        now
      )
    ).toEqual({ isVerified: false, verificationStatus: 'revoked' });
  });

  test('enforces RBAC permission matrix with Static Super Admin wildcard bypass', () => {
    expect(hasPermission('SUPER_ADMIN', true, 'admin:users')).toBe(true);
    expect(hasPermission('SUPER_ADMIN', true, 'accounting:write')).toBe(true);
    expect(hasPermission('FINANCE', false, 'accounting:write')).toBe(true);
    expect(hasPermission('FINANCE', false, 'cms:write')).toBe(false);
    expect(hasPermission('CMS_EDITOR', false, 'cms:write')).toBe(true);
    expect(hasPermission('CMS_EDITOR', false, 'accounting:read')).toBe(false);
    expect(hasPermission('VIEWER', false, 'accounting:read')).toBe(true);
    expect(hasPermission('VIEWER', false, 'accounting:write')).toBe(false);
  });

  test('constantTimeEqual compares arbitrary length strings accurately', () => {
    expect(constantTimeEqual('synthetic-test-secret-01', 'synthetic-test-secret-01')).toBe(true);
    expect(constantTimeEqual('synthetic-test-secret-01', 'short')).toBe(false);
  });

  test('RFC-4180 CSV parser handles quoted commas, escaped quotes, CRLF and trimmed headers', () => {
    const csv =
      '\uFEFFDate,Time,Company Name,Contact Name,Email Address,Mobile Phone,Service Type,Project Description,Budget Range ,Timeline\r\n' +
      '2026-11-20,10:15,"Acme, ""Global"" Ltd.",Aung Min,aung@acme.co,+959123456,ai,"Need RAG, agents, and ERP sync","$10,000+",2-4months\r\n';
    const parsed = parseRfc4180Csv(csv);
    expect(parsed.headers).toContain('Budget Range');
    expect(parsed.rows.length).toBe(1);
    const mapped = mapCsvRowToLead(parsed.rows[0]!, 'WEB_QUOTE', 'Quote Requests');
    expect(mapped).not.toBeNull();
    expect(mapped?.company).toBe('Acme, "Global" Ltd.');
    expect(mapped?.name).toBe('Aung Min');
    expect(mapped?.email).toBe('aung@acme.co');
    expect(mapped?.payload.budgetRange).toBe('$10,000+');
    expect(mapped?.payload.projectDescription).toBe('Need RAG, agents, and ERP sync');
  });
});
