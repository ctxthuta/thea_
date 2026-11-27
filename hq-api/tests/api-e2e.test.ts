import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { existsSync, readdirSync } from 'node:fs';
import { resolve } from 'node:path';
import { createApp } from '../src/app';
import { SEED_CMS_DATA } from '../src/infrastructure/db/seedData';
import { runSeed } from '../src/infrastructure/db/seed';
import { startTestDb, type TestDbHandle } from './testDb';

const app = createApp();

async function req(
  path: string,
  options: { method?: string; body?: unknown; token?: string; headers?: Record<string, string> } = {}
): Promise<Response> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
    ...(options.token ? { Authorization: `Bearer ${options.token}` } : {}),
    ...(options.headers ?? {}),
  };
  return await app.fetch(
    new Request(`http://localhost:4000${path}`, {
      method: options.method ?? 'GET',
      headers,
      body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    })
  );
}

describe('End-to-End Accounting, Associates, CMS, CRM & Seed Flows', () => {
  let dbHandle: TestDbHandle;
  let token = '';

  beforeAll(async () => {
    dbHandle = await startTestDb('thea_hq_test_e2e');

    const loginRes = await req('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
      },
    });
    const loginBody = (await loginRes.json()) as { token: string };
    token = loginBody.token;
  }, 60000);

  afterAll(async () => {
    await dbHandle.stop();
  }, 30000);

  test('Accounting: Daily FX rate, draft->post with idempotency, immutability, reversal, budgets & reports', async () => {
    const fxRes = await req('/api/v1/accounting/fx-rates', {
      method: 'POST',
      token,
      body: {
        date: '2026-11-25',
        fromCurrency: 'THB',
        toCurrency: 'MMK',
        rate: '135.000000',
        source: 'Test Bank Desk',
      },
    });
    expect(fxRes.status).toBe(201);

    // Unbalanced journal entry rejected (422)
    const unbalanced = await req('/api/v1/accounting/journals', {
      method: 'POST',
      token,
      body: {
        entryType: 'EXPENSE',
        entryDate: '2026-11-25',
        currency: 'THB',
        description: 'Unbalanced test',
        lines: [
          { accountCode: '5010', debitOrig: '1000.00', creditOrig: '0.00' },
          { accountCode: '1030', debitOrig: '0.00', creditOrig: '900.00' },
        ],
      },
    });
    expect(unbalanced.status).toBe(422);

    // Create balanced DRAFT in THB
    const draftRes = await req('/api/v1/accounting/journals', {
      method: 'POST',
      token,
      body: {
        entryType: 'EXPENSE',
        entryDate: '2026-11-25',
        currency: 'THB',
        description: 'Contractor sprint payout',
        reference: 'INV-TEST-01',
        lines: [
          { accountCode: '5010', memo: 'Sprint delivery', debitOrig: '20000.00', creditOrig: '0.00' },
          { accountCode: '1030', memo: 'KBank THB', debitOrig: '0.00', creditOrig: '20000.00' },
        ],
      },
    });
    expect(draftRes.status).toBe(201);
    const draft = (await draftRes.json()) as {
      id: string;
      status: string;
      version: number;
      totalDebitBase: string;
    };
    expect(draft.status).toBe('DRAFT');
    expect(draft.totalDebitBase).toBe('2700000.00');

    // Post DRAFT with Idempotency-Key
    const postRes = await req(`/api/v1/accounting/journals/${draft.id}/post`, {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'post-idem-001' },
      body: { version: draft.version },
    });
    expect(postRes.status).toBe(200);
    const posted = (await postRes.json()) as { status: string; version: number; fxRateUsed: string };
    expect(posted.status).toBe('POSTED');
    expect(posted.fxRateUsed).toBe('135.000000');

    // Replay same Idempotency-Key returns cached response
    const replayRes = await req(`/api/v1/accounting/journals/${draft.id}/post`, {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'post-idem-001' },
      body: { version: draft.version },
    });
    expect(replayRes.status).toBe(200);
    expect(replayRes.headers.get('idempotency-replayed')).toBe('true');

    // Editing POSTED entry is rejected with 409
    const editPosted = await req(`/api/v1/accounting/journals/${draft.id}`, {
      method: 'PUT',
      token,
      body: {
        entryType: 'EXPENSE',
        entryDate: '2026-11-25',
        currency: 'THB',
        description: 'Attempt mutate posted',
        lines: [
          { accountCode: '5010', debitOrig: '100.00', creditOrig: '0.00' },
          { accountCode: '1030', debitOrig: '0.00', creditOrig: '100.00' },
        ],
        version: posted.version,
      },
    });
    expect(editPosted.status).toBe(409);

    // Upsert budget and verify Budget vs. Actual variance
    const budgetRes = await req('/api/v1/accounting/budgets', {
      method: 'PUT',
      token,
      body: {
        periodType: 'MONTHLY',
        periodKey: '2026-11',
        accountCode: '5010',
        currency: 'MMK',
        targetAmount: '5000000.00',
        notes: 'Contractor budget',
      },
    });
    expect(budgetRes.status).toBe(200);

    const bvaRes = await req('/api/v1/accounting/budgets?periodType=MONTHLY&periodKey=2026-11', {
      token,
    });
    expect(bvaRes.status).toBe(200);
    const bva = (await bvaRes.json()) as {
      rows: Array<{ accountCode: string; actualBase: string; varianceBase: string }>;
    };
    expect(bva.rows[0]?.accountCode).toBe('5010');
    expect(bva.rows[0]?.actualBase).toBe('2700000.00');
    expect(bva.rows[0]?.varianceBase).toBe('2300000.00');

    // Trial Balance, P&L, Balance Sheet, Cash Flow, Money Usage & Overview
    const tbRes = await req('/api/v1/accounting/reports/trial-balance?asOf=2026-11-25', { token });
    expect(tbRes.status).toBe(200);
    const tb = (await tbRes.json()) as { isBalanced: boolean; totalDebitBase: string };
    expect(tb.isBalanced).toBe(true);
    expect(tb.totalDebitBase).toBe('2700000.00');

    const bsRes = await req('/api/v1/accounting/reports/balance-sheet?asOf=2026-11-25', { token });
    expect(bsRes.status).toBe(200);
    expect(((await bsRes.json()) as { isBalanced: boolean }).isBalanced).toBe(true);

    const pnlRes = await req('/api/v1/accounting/reports/pnl?dateFrom=2026-11-01&dateTo=2026-11-30', {
      token,
    });
    expect(pnlRes.status).toBe(200);
    expect(((await pnlRes.json()) as { cogsTotal: string }).cogsTotal).toBe('2700000.00');

    const overviewThb = await req(
      '/api/v1/overview?displayCurrency=THB&dateFrom=2026-11-01&dateTo=2026-11-30&periodKey=2026-11',
      { token }
    );
    expect(overviewThb.status).toBe(200);
    const ov = (await overviewThb.json()) as { displayCurrency: string; kpis: { totalExpenses: string } };
    expect(ov.displayCurrency).toBe('THB');

    // Reverse the posted journal entry
    const revRes = await req(`/api/v1/accounting/journals/${draft.id}/reverse`, {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'rev-idem-001' },
      body: { reversalDate: '2026-11-25', reason: 'Duplicate invoice', version: posted.version },
    });
    expect(revRes.status).toBe(201);
    const rev = (await revRes.json()) as {
      originalEntry: { status: string; reversedByEntryId: string };
      reversingEntry: { status: string; reversesEntryId: string; totalCreditBase: string };
    };
    expect(rev.originalEntry.status).toBe('REVERSED');
    expect(rev.reversingEntry.status).toBe('POSTED');
    expect(rev.reversingEntry.reversesEntryId).toBe(draft.id);
    expect(rev.reversingEntry.totalCreditBase).toBe('2700000.00');
  });

  test('Associates: Auto-generated badge ID, public card, instant revoke & reinstate', async () => {
    const createRes = await req('/api/v1/associates', {
      method: 'POST',
      token,
      body: {
        slug: 'kyaw-zin-contractor',
        associateType: 'contractor',
        name: 'Kyaw Zin',
        title: 'Senior Backend Contractor',
        department: 'Engineering',
        bio: 'Distributed systems contractor.',
        cardExpirationDate: '2028-12-31',
        contact: { email: 'kyawzin@theasolutions.co', location: 'Bangkok, Thailand' },
        compensation: {
          rateType: 'MONTHLY_RETAINER',
          rateAmount: '65000.00',
          currency: 'THB',
          payoutMethod: 'KBank',
          ndaSigned: true,
          msaSigned: true,
        },
        internalNotes: 'Confidential internal note',
      },
    });
    expect(createRes.status).toBe(201);
    const assoc = (await createRes.json()) as {
      id: string;
      employeeId: string;
      slug: string;
      version: number;
    };
    expect(assoc.employeeId).toMatch(/^THEA-[A-Z0-9]{4}$/);

    // Public profile strips internalNotes
    const pubCard = await req(`/api/v1/public/associates/${assoc.slug}`);
    expect(pubCard.status).toBe(200);
    const pubData = (await pubCard.json()) as Record<string, unknown>;
    expect(pubData.name).toBe('Kyaw Zin');
    expect(pubData.internalNotes).toBeUndefined();

    // Public verification returns verified with no-store header
    const verifyOk = await req(`/api/v1/public/verify/${assoc.employeeId}`);
    expect(verifyOk.status).toBe(200);
    expect(verifyOk.headers.get('cache-control')).toBe('no-store');
    const verifyOkBody = (await verifyOk.json()) as { isVerified: boolean; verificationStatus: string };
    expect(verifyOkBody.isVerified).toBe(true);
    expect(verifyOkBody.verificationStatus).toBe('verified');

    // Instant revoke
    const revokeRes = await req(`/api/v1/associates/${assoc.id}/revoke`, {
      method: 'POST',
      token,
      body: { reason: 'Contract ended', version: assoc.version },
    });
    expect(revokeRes.status).toBe(200);
    const revoked = (await revokeRes.json()) as { version: number };

    const verifyRevoked = await req(`/api/v1/public/verify/${assoc.employeeId}`);
    expect(verifyRevoked.status).toBe(200);
    const vRevBody = (await verifyRevoked.json()) as { isVerified: boolean; verificationStatus: string };
    expect(vRevBody.isVerified).toBe(false);
    expect(vRevBody.verificationStatus).toBe('revoked');

    expect((await req(`/api/v1/public/associates/${assoc.slug}`)).status).toBe(404);

    // Reinstate
    const reinstateRes = await req(`/api/v1/associates/${assoc.id}/reinstate`, {
      method: 'POST',
      token,
      body: { version: revoked.version },
    });
    expect(reinstateRes.status).toBe(200);
    const verifyBack = await req(`/api/v1/public/verify/${assoc.employeeId}`);
    expect(((await verifyBack.json()) as { isVerified: boolean }).isVerified).toBe(true);
  });

  test('CMS: Draft isolation, ACID publish with revision history, public delivery & rollback', async () => {
    const d1 = await req('/api/v1/cms/sections/pricing', {
      method: 'PUT',
      token,
      body: { draftData: SEED_CMS_DATA.pricing },
    });
    expect(d1.status).toBe(200);
    const doc1 = (await d1.json()) as { version: number; status: string };
    expect(doc1.status).toBe('draft');

    expect((await req('/api/v1/public/cms/pricing')).status).toBe(404);

    const pub1 = await req('/api/v1/cms/sections/pricing/publish', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'cms-pub-1' },
      body: { changeSummary: 'Initial launch', version: doc1.version },
    });
    expect(pub1.status).toBe(200);
    const publishedDoc1 = (await pub1.json()) as { publishedVersion: number; version: number };
    expect(publishedDoc1.publishedVersion).toBe(1);

    // Edit draft without publishing -> public still sees v1 headline
    const updatedPricing = { ...SEED_CMS_DATA.pricing, headline: 'Draft v2 headline' };
    const d2 = await req('/api/v1/cms/sections/pricing', {
      method: 'PUT',
      token,
      body: { draftData: updatedPricing, version: publishedDoc1.version },
    });
    expect(d2.status).toBe(200);
    const doc2 = (await d2.json()) as { version: number; hasUnpublishedChanges: boolean };
    expect(doc2.hasUnpublishedChanges).toBe(true);

    const pubStillV1 = await req('/api/v1/public/cms/pricing');
    expect(pubStillV1.status).toBe(200);
    const pubV1Body = (await pubStillV1.json()) as { version: number; data: { headline: string } };
    expect(pubV1Body.version).toBe(1);
    expect(pubV1Body.data.headline).not.toBe('Draft v2 headline');

    const pub2 = await req('/api/v1/cms/sections/pricing/publish', {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'cms-pub-2' },
      body: { changeSummary: 'Updated headline', version: doc2.version },
    });
    expect(pub2.status).toBe(200);
    const publishedDoc2 = (await pub2.json()) as { publishedVersion: number; version: number };
    expect(publishedDoc2.publishedVersion).toBe(2);

    const rb = await req('/api/v1/cms/sections/pricing/rollback', {
      method: 'POST',
      token,
      body: { targetVersion: 1, version: publishedDoc2.version },
    });
    expect(rb.status).toBe(200);
    const rbDoc = (await rb.json()) as { publishedVersion: number; publishedData: { headline: string } };
    expect(rbDoc.publishedVersion).toBe(3);
    expect(rbDoc.publishedData.headline).toBe(String(SEED_CMS_DATA.pricing.headline));
  });

  test('CRM: Public lead ingest with X-HQ-Ingest-Key & ACID conversion to Account/Contact/Deal', async () => {
    // Bad ingest key with Idempotency-Key must fail 401 BEFORE idempotency storage/replay
    const badKey = await req('/api/v1/public/leads/ingest', {
      method: 'POST',
      headers: {
        'X-HQ-Ingest-Key': 'wrong-key',
        'Idempotency-Key': 'lead-ingest-001',
      },
      body: { source: 'WEB_QUOTE', email: 'attacker@bad.example' },
    });
    expect(badKey.status).toBe(401);

    // Legitimate request reusing same Idempotency-Key succeeds cleanly
    const ingestRes = await req('/api/v1/public/leads/ingest', {
      method: 'POST',
      headers: {
        'X-HQ-Ingest-Key': process.env.PUBLIC_INGEST_SECRET!,
        'Idempotency-Key': 'lead-ingest-001',
      },
      body: {
        source: 'WEB_DEMO_REQUEST',
        name: 'Min Thu',
        email: 'minthu@acme-corp.co',
        company: 'Acme Corp',
        payload: { productId: 'thea-finance' },
      },
    });
    expect(ingestRes.status).toBe(201);
    const { leadId } = (await ingestRes.json()) as { leadId: string };

    const convertRes = await req(`/api/v1/crm/leads/${leadId}/convert`, {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'lead-convert-001' },
      body: {
        accountName: 'Acme Corp',
        website: 'https://acme-corp.co',
        dealTitle: 'Thea Finance AI Deployment',
        currency: 'THB',
        estimatedValue: '350000.00',
        version: 1,
      },
    });
    expect(convertRes.status).toBe(201);
    const converted = (await convertRes.json()) as {
      lead: { status: string };
      account: { normalizedDomain: string };
      contact: { email: string };
      deal: { estimatedValue: string; stage: string };
    };
    expect(converted.lead.status).toBe('CONVERTED');
    expect(converted.account.normalizedDomain).toBe('acme-corp.co');
    expect(converted.contact.email).toBe('minthu@acme-corp.co');
    expect(converted.deal.estimatedValue).toBe('350000.00');
    expect(converted.deal.stage).toBe('DISCOVERY');
  });

  test('Idempotent seed removes Dr. Ohnmar Than and populates Myanmar associates, CMS, CRM, Projects & Tickets', async () => {
    // Pre-insert legacy Dr. Ohnmar Than record to verify seed explicitly purges it
    const preLegacy = await req('/api/v1/associates', {
      method: 'POST',
      token,
      body: {
        slug: 'dr-ohnmar-than',
        employeeId: 'THEA-XWUE',
        associateType: 'executive',
        name: 'Legacy Record',
        title: 'Legacy',
        department: 'Finance',
        bio: 'To be removed by seed',
        cardExpirationDate: '2027-12-31',
      },
    });
    expect(preLegacy.status).toBe(201);

    await runSeed();
    await runSeed();

    // Legacy Dr. Ohnmar Than record is completely removed
    expect((await req('/api/v1/public/verify/THEA-XWUE')).status).toBe(404);
    expect((await req('/api/v1/public/associates/dr-ohnmar-than')).status).toBe(404);

    // All 8 CMS sections published
    const cmsBatch = await req('/api/v1/public/cms');
    expect(cmsBatch.status).toBe(200);
    const batchBody = (await cmsBatch.json()) as { sections: Record<string, unknown> };
    expect(Object.keys(batchBody.sections).sort()).toEqual([
      'careers',
      'delivery_pipeline',
      'faqs',
      'hero',
      'pricing',
      'products',
      'services',
      'site_settings',
    ]);

    // Realistic Myanmar associates exist and verify cleanly
    const thiriCard = await req('/api/v1/public/associates/thiri-chan-nyein');
    expect(thiriCard.status).toBe(200);
    expect(((await thiriCard.json()) as { employeeId: string }).employeeId).toBe('THEA-UWIS');

    const chueVerify = await req('/api/v1/public/verify/THEA-CSWE');
    expect(chueVerify.status).toBe(200);
    expect(((await chueVerify.json()) as { name: string }).name).toBe('Chue Yamin Lwin');

    const kzhtVerify = await req('/api/v1/public/verify/THEA-KZHT');
    expect(kzhtVerify.status).toBe(200);
    expect(((await kzhtVerify.json()) as { name: string }).name).toBe('Kyaw Zin Htet');

    // Verify 6 seeded projects and 14 seeded tickets
    const projRes = await req('/api/v1/projects?limit=50', { token });
    expect(projRes.status).toBe(200);
    const projBody = (await projRes.json()) as { items: Array<{ code: string; phases: unknown[] }> };
    expect(projBody.items.length).toBeGreaterThanOrEqual(6);

    const tktRes = await req('/api/v1/tickets?limit=50', { token });
    expect(tktRes.status).toBe(200);
    const tktBody = (await tktRes.json()) as {
      items: Array<{ ticketNumber: string }>;
      summary: { open: number; inProgress: number; waitingClient: number; resolved: number; closed: number };
    };
    expect(tktBody.items.length).toBeGreaterThanOrEqual(14);
    expect(tktBody.summary.open).toBeGreaterThan(0);
    expect(tktBody.summary.waitingClient).toBeGreaterThan(0);

    // Verify delivery_pipeline iconKey values are normalized lowercase
    const dpRes = await req('/api/v1/public/cms/delivery_pipeline');
    expect(dpRes.status).toBe(200);
    const dpBody = (await dpRes.json()) as { data: { phases: Array<{ iconKey: string }> } };
    expect(dpBody.data.phases.map((p) => p.iconKey)).toEqual([
      'compass',
      'layers',
      'terminal',
      'shield',
      'rocket',
      'activity',
    ]);
  });

  test('Rejects javascript:/data: URLs in Associates and CMS payloads', async () => {
    const badAssoc = await req('/api/v1/associates', {
      method: 'POST',
      token,
      body: {
        slug: 'xss-url-test',
        associateType: 'contractor',
        name: 'XSS Test',
        title: 'Tester',
        department: 'QA',
        bio: 'Testing URL guard',
        cardExpirationDate: '2028-12-31',
        profileImage: 'javascript:alert(1)',
      },
    });
    expect(badAssoc.status).toBe(400);

    const badCms = await req('/api/v1/cms/sections/hero', {
      method: 'PUT',
      token,
      body: {
        draftData: {
          ...SEED_CMS_DATA.hero,
          videoPosterUrl: 'javascript:alert(1)',
        },
      },
    });
    expect(badCms.status).toBe(400);
  });

  test('Serves compiled hq-portal SPA and static assets when dist exists', async () => {
    const portalDist = resolve(import.meta.dir, '../..', 'hq-portal', 'dist');
    if (!existsSync(resolve(portalDist, 'index.html'))) {
      return;
    }

    const rootRes = await app.fetch(new Request('http://localhost:4000/'));
    expect(rootRes.status).toBe(200);
    expect(rootRes.headers.get('content-type')).toContain('text/html');
    const html = await rootRes.text();
    expect(html.toLowerCase()).toContain('<!doctype html>');

    const spaFallback = await app.fetch(new Request('http://localhost:4000/accounting/journals'));
    expect(spaFallback.status).toBe(200);
    expect(spaFallback.headers.get('content-type')).toContain('text/html');

    const assetsDir = resolve(portalDist, 'assets');
    if (existsSync(assetsDir)) {
      const files = readdirSync(assetsDir);
      if (files[0]) {
        const assetRes = await app.fetch(new Request(`http://localhost:4000/assets/${files[0]}`));
        expect(assetRes.status).toBe(200);
      }
    }
  });

  test('FX rate resolution by date and General Ledger running balance & reversal reconciliation', async () => {
    // Seed two distinct dates in an unseeded historical month (May 2026) with different THB->MMK rates
    const fxEarly = await req('/api/v1/accounting/fx-rates', {
      method: 'POST',
      token,
      body: {
        date: '2026-05-10',
        fromCurrency: 'THB',
        toCurrency: 'MMK',
        rate: '130.000000',
        source: 'May Desk',
      },
    });
    expect(fxEarly.status).toBe(201);

    const fxMid = await req('/api/v1/accounting/fx-rates', {
      method: 'POST',
      token,
      body: {
        date: '2026-05-20',
        fromCurrency: 'THB',
        toCurrency: 'MMK',
        rate: '140.000000',
        source: 'May Mid Desk',
      },
    });
    expect(fxMid.status).toBe(201);

    // Exact date match
    const resExact = await req('/api/v1/accounting/fx-rates/resolve?date=2026-05-10&from=THB&to=MMK', {
      token,
    });
    expect(resExact.status).toBe(200);
    const exactBody = (await resExact.json()) as {
      rate: string;
      fxRateDate: string;
      isExactDateMatch: boolean;
    };
    expect(exactBody.rate).toBe('130.000000');
    expect(exactBody.fxRateDate).toBe('2026-05-10');
    expect(exactBody.isExactDateMatch).toBe(true);

    // Prior-date fallback (2026-05-15 resolves 2026-05-10 rate)
    const resFallback = await req('/api/v1/accounting/fx-rates/resolve?date=2026-05-15&from=THB&to=MMK', {
      token,
    });
    expect(resFallback.status).toBe(200);
    const fbBody = (await resFallback.json()) as {
      rate: string;
      fxRateDate: string;
      isExactDateMatch: boolean;
    };
    expect(fbBody.rate).toBe('130.000000');
    expect(fbBody.fxRateDate).toBe('2026-05-10');
    expect(fbBody.isExactDateMatch).toBe(false);

    // Same-currency identity
    const resSame = await req('/api/v1/accounting/fx-rates/resolve?date=2026-05-15&from=MMK&to=MMK', {
      token,
    });
    expect(resSame.status).toBe(200);
    const sameBody = (await resSame.json()) as { rate: string; isExactDateMatch: boolean };
    expect(sameBody.rate).toBe('1.000000');
    expect(sameBody.isExactDateMatch).toBe(true);

    // Post entry before period (2026-05-12 @ 130.000000 -> 1,000 THB = 130,000 MMK)
    const openingEntryRes = await req('/api/v1/accounting/journals', {
      method: 'POST',
      token,
      body: {
        entryType: 'INCOME',
        entryDate: '2026-05-12',
        currency: 'THB',
        description: 'May 12 consulting fee',
        lines: [
          { accountCode: '1030', debitOrig: '1000.00', creditOrig: '0.00' },
          { accountCode: '4030', debitOrig: '0.00', creditOrig: '1000.00' },
        ],
        postImmediately: true,
      },
    });
    expect(openingEntryRes.status).toBe(201);
    const openingEntry = (await openingEntryRes.json()) as { fxRateUsed: string; fxRateDate: string };
    expect(openingEntry.fxRateUsed).toBe('130.000000');
    expect(openingEntry.fxRateDate).toBe('2026-05-10');

    // Post entry inside period (2026-05-21 @ 140.000000 -> 500 THB = 70,000 MMK)
    const periodEntryRes = await req('/api/v1/accounting/journals', {
      method: 'POST',
      token,
      body: {
        entryType: 'INCOME',
        entryDate: '2026-05-21',
        currency: 'THB',
        description: 'May 21 advisory fee',
        lines: [
          { accountCode: '1030', debitOrig: '500.00', creditOrig: '0.00' },
          { accountCode: '4030', debitOrig: '0.00', creditOrig: '500.00' },
        ],
        postImmediately: true,
      },
    });
    expect(periodEntryRes.status).toBe(201);
    const periodEntry = (await periodEntryRes.json()) as { id: string; version: number };

    // Reverse the May 21 entry on May 22 to verify chronological reversal reconciliation
    const revPeriod = await req(`/api/v1/accounting/journals/${periodEntry.id}/reverse`, {
      method: 'POST',
      token,
      headers: { 'Idempotency-Key': 'ledger-rev-001' },
      body: { reversalDate: '2026-05-22', reason: 'Credit note issued', version: periodEntry.version },
    });
    expect(revPeriod.status).toBe(201);

    // Query General Ledger summary mode
    const glSummaryRes = await req(
      '/api/v1/accounting/ledger?accountCode=ALL&dateFrom=2026-05-15&dateTo=2026-05-31',
      { token }
    );
    expect(glSummaryRes.status).toBe(200);
    const glSummary = (await glSummaryRes.json()) as {
      mode: string;
      accounts: Array<{ code: string; openingBalanceBase: string; closingBalanceBase: string; entryCount: number }>;
    };
    expect(glSummary.mode).toBe('SUMMARY');
    const acct4030Summary = glSummary.accounts.find((a) => a.code === '4030');
    expect(acct4030Summary?.openingBalanceBase).toBe('130000.00');
    expect(acct4030Summary?.closingBalanceBase).toBe('130000.00');
    expect(acct4030Summary?.entryCount).toBe(2);

    // Query General Ledger detail mode for account 4030
    const glDetailRes = await req(
      '/api/v1/accounting/ledger?accountCode=4030&dateFrom=2026-05-15&dateTo=2026-05-31&displayCurrency=MMK',
      { token }
    );
    expect(glDetailRes.status).toBe(200);
    const glDetail = (await glDetailRes.json()) as {
      mode: string;
      openingBalanceBase: string;
      periodDebitBase: string;
      periodCreditBase: string;
      closingBalanceBase: string;
      entries: Array<{ runningBalanceBase: string; isReversal: boolean; counterAccounts: string[] }>;
    };
    expect(glDetail.mode).toBe('ACCOUNT');
    expect(glDetail.openingBalanceBase).toBe('130000.00');
    expect(glDetail.periodCreditBase).toBe('70000.00');
    expect(glDetail.periodDebitBase).toBe('70000.00');
    expect(glDetail.closingBalanceBase).toBe('130000.00');
    expect(glDetail.entries.length).toBe(2);
    expect(glDetail.entries[0]?.runningBalanceBase).toBe('200000.00');
    expect(glDetail.entries[0]?.isReversal).toBe(false);
    expect(glDetail.entries[1]?.runningBalanceBase).toBe('130000.00');
    expect(glDetail.entries[1]?.isReversal).toBe(true);
    expect(glDetail.entries[0]?.counterAccounts[0]).toContain('1030');
  });

  test('CRM Google Drive sync config validation & CSV import deduplication', async () => {
    const cfgRes = await req('/api/v1/crm/sync/config', { token });
    expect(cfgRes.status).toBe(200);
    const cfg = (await cfgRes.json()) as {
      driveFolderId: string;
      sheets: Array<{ gid: string; source: string }>;
    };
    expect(cfg.driveFolderId).toBe('1hpCrwbDwsZA0auPSB0QFmd1Q8evzBdWL');
    expect(cfg.sheets.map((s) => s.gid)).toEqual(['0', '1776889329', '680829825']);

    // Reject non-Google URL (SSRF protection)
    const badCfg = await req('/api/v1/crm/sync/config', {
      method: 'PUT',
      token,
      body: {
        driveFolderId: '1hpCrwbDwsZA0auPSB0QFmd1Q8evzBdWL',
        driveFolderUrl: 'https://169.254.169.254/latest/meta-data',
        sheets: [],
      },
    });
    expect(badCfg.status).toBe(400);

    // Import Quote Requests CSV (with trailing space in "Budget Range " header and quoted commas)
    const quoteCsv = [
      'Date,Time,Company Name,Contact Name,Email Address,Mobile Phone,Service Type,Project Description,Budget Range ,Timeline',
      '2026-11-24,09:30,"Apex Logistics, Co.",Su Myat,sumyat@apex.co,+959777888,automation,"Invoice OCR, ERP sync","$5k-$10k",1-2months',
      '2026-11-24,11:00,Nova Clinic,Dr. Zaw,zaw@nova.clinic,+959555444,software,Clinic portal,$10k+,2-4months',
    ].join('\n');

    const import1 = await req('/api/v1/crm/import/csv', {
      method: 'POST',
      token,
      body: { csvText: quoteCsv, source: 'WEB_QUOTE', label: 'Quote_Requests.csv' },
    });
    expect(import1.status).toBe(201);
    const imp1Body = (await import1.json()) as {
      rowsRead: number;
      imported: number;
      skippedDuplicates: number;
    };
    expect(imp1Body.rowsRead).toBe(2);
    expect(imp1Body.imported).toBe(2);
    expect(imp1Body.skippedDuplicates).toBe(0);

    // Re-importing the exact same CSV deduplicates 100%
    const import2 = await req('/api/v1/crm/import/csv', {
      method: 'POST',
      token,
      body: { csvText: quoteCsv, source: 'WEB_QUOTE', label: 'Quote_Requests.csv' },
    });
    expect(import2.status).toBe(201);
    const imp2Body = (await import2.json()) as { imported: number; skippedDuplicates: number };
    expect(imp2Body.imported).toBe(0);
    expect(imp2Body.skippedDuplicates).toBe(2);

    // Also test Demo Request CSV format
    const demoCsv = [
      'Requested Date,Requested Time,Name,Business Domain,Business Description,Email,Phone,Scheduled Date,Scheduled Time,Scheduled Product ID,Referrer',
      '2026-11-25,14:00,Ko Ko,Healthcare,Lab automation,koko@medlab.co,+959111222,2026-12-02,15:00,thea-finance,linkedin',
    ].join('\n');

    const demoImport = await req('/api/v1/crm/import/csv', {
      method: 'POST',
      token,
      body: { csvText: demoCsv, source: 'WEB_DEMO_REQUEST', label: 'Requests_for_Demo.csv' },
    });
    expect(demoImport.status).toBe(201);
    expect(((await demoImport.json()) as { imported: number }).imported).toBe(1);
  });

  test('Historical entry-date FX immutability across all reports & FX rate lock guard', async () => {
    // 1. Add historical FX rate on 2026-06-20 (1 THB = 135.000000 MMK)
    const fx20Res = await req('/api/v1/accounting/fx-rates', {
      method: 'POST',
      token,
      body: {
        date: '2026-06-20',
        fromCurrency: 'THB',
        toCurrency: 'MMK',
        rate: '135.000000',
        source: 'Jun 20 Desk',
      },
    });
    expect(fx20Res.status).toBe(201);
    const fx20 = (await fx20Res.json()) as { id: string };

    // Post both a THB journal and an MMK journal on 2026-06-20
    const thbJe = await req('/api/v1/accounting/journals', {
      method: 'POST',
      token,
      body: {
        entryType: 'INCOME',
        entryDate: '2026-06-20',
        currency: 'THB',
        description: 'Jun 20 THB software milestone',
        lines: [
          { accountCode: '1030', debitOrig: '10000.00', creditOrig: '0.00' },
          { accountCode: '4010', debitOrig: '0.00', creditOrig: '10000.00' },
        ],
        postImmediately: true,
      },
    });
    expect(thbJe.status).toBe(201);

    const mmkJe = await req('/api/v1/accounting/journals', {
      method: 'POST',
      token,
      body: {
        entryType: 'EXPENSE',
        entryDate: '2026-06-20',
        currency: 'MMK',
        description: 'Jun 20 MMK office stipend',
        lines: [
          { accountCode: '6050', debitOrig: '270000.00', creditOrig: '0.00' },
          { accountCode: '1020', debitOrig: '0.00', creditOrig: '270000.00' },
        ],
        postImmediately: true,
      },
    });
    expect(mmkJe.status).toBe(201);

    // Set a THB budget for 2026-06 on 4010 so both currencies exercise Budget vs. Actual
    const budgetJun = await req('/api/v1/accounting/budgets', {
      method: 'PUT',
      token,
      body: {
        periodType: 'MONTHLY',
        periodKey: '2026-06',
        accountCode: '4010',
        currency: 'THB',
        targetAmount: '25000.00',
        notes: 'Jun software revenue target',
      },
    });
    expect(budgetJun.status).toBe(200);

    // 2. Snapshot all 5 reports in BOTH MMK and THB
    const snapshotAll = async (curr: 'MMK' | 'THB') => {
      const [tb, pnl, bs, gl, bva] = await Promise.all([
        req(`/api/v1/accounting/reports/trial-balance?asOf=2026-06-20&displayCurrency=${curr}`, { token }).then((r) => r.json()),
        req(`/api/v1/accounting/reports/income-statement?dateFrom=2026-06-01&dateTo=2026-06-20&displayCurrency=${curr}`, { token }).then((r) => r.json()),
        req(`/api/v1/accounting/reports/balance-sheet?asOf=2026-06-20&displayCurrency=${curr}`, { token }).then((r) => r.json()),
        req(`/api/v1/accounting/ledger?accountCode=4010&dateFrom=2026-06-01&dateTo=2026-06-20&displayCurrency=${curr}`, { token }).then((r) => r.json()),
        req(`/api/v1/accounting/reports/budget-vs-actual?periodType=MONTHLY&periodKey=2026-06&displayCurrency=${curr}`, { token }).then((r) => r.json()),
      ]);
      return { tb, pnl, bs, gl, bva } as {
        tb: { isBalanced: boolean; fxTranslationBasis: string };
        pnl: { fxTranslationBasis: string; revenueTotal: string; opexTotal: string };
        bs: { isBalanced: boolean; fxTranslationBasis: string };
        gl: { fxTranslationBasis: string; closingBalanceDisplay: string };
        bva: { fxTranslationBasis: string };
      };
    };

    const beforeMmk = await snapshotAll('MMK');
    const beforeThb = await snapshotAll('THB');

    expect(beforeMmk.tb.isBalanced).toBe(true);
    expect(beforeMmk.bs.isBalanced).toBe(true);
    expect(beforeThb.tb.isBalanced).toBe(true);
    expect(beforeThb.bs.isBalanced).toBe(true);
    expect(beforeMmk.tb.fxTranslationBasis).toBe('HISTORICAL_ENTRY_DATE');
    expect(beforeThb.gl.fxTranslationBasis).toBe('HISTORICAL_ENTRY_DATE');
    expect(beforeThb.bva.fxTranslationBasis).toBe('HISTORICAL_ENTRY_DATE');
    expect(beforeMmk.pnl.revenueTotal).toBe('1350000.00');
    expect(beforeThb.pnl.revenueTotal).toBe('10000.00');
    expect(beforeMmk.pnl.opexTotal).toBe('270000.00');
    expect(beforeThb.gl.closingBalanceDisplay).toBe('10000.00');

    // 3. Insert a drastically different daily FX rate on a future date (2026-06-26 @ 200.00 MMK)
    const fx26Res = await req('/api/v1/accounting/fx-rates', {
      method: 'POST',
      token,
      body: {
        date: '2026-06-26',
        fromCurrency: 'THB',
        toCurrency: 'MMK',
        rate: '200.000000',
        source: 'Jun 26 Desk',
      },
    });
    expect(fx26Res.status).toBe(201);

    // 4. Re-query all 5 reports in BOTH MMK and THB: every historical figure must be 100% identical
    const afterMmk = await snapshotAll('MMK');
    const afterThb = await snapshotAll('THB');

    expect(afterMmk).toEqual(beforeMmk);
    expect(afterThb).toEqual(beforeThb);

    // 5. Editing the locked 2026-06-20 FX rate is rejected with 409 Conflict
    const editLocked = await req(`/api/v1/accounting/fx-rates/${fx20.id}`, {
      method: 'PUT',
      token,
      body: { rate: '150.000000', source: 'Unauthorized retroactive edit' },
    });
    expect(editLocked.status).toBe(409);
    const lockedBody = (await editLocked.json()) as { type: string };
    expect(lockedBody.type).toContain('fx-rate-locked');
  });

  test('Projects, Phases/Milestones, Internal Helpdesk & Client Portal strict tenant/token isolation', async () => {
    // 1. Fetch seeded MediTrust and Shwe Taung accounts
    const accountsRes = await req('/api/v1/crm/accounts?limit=50', { token });
    expect(accountsRes.status).toBe(200);
    const accountsBody = (await accountsRes.json()) as {
      items: Array<{ id: string; portalSlug: string | null; portalAccessCode: string | null; version: number }>;
    };
    const mediTrust = accountsBody.items.find((a) => a.portalSlug === 'meditrust-yangon')!;
    const shweTaung = accountsBody.items.find((a) => a.portalSlug === 'shwetaung-logistics')!;
    expect(mediTrust).toBeDefined();
    expect(shweTaung).toBeDefined();

    // 2. Create a new project with phases/milestones and patch phase progress
    const createProjRes = await req('/api/v1/projects', {
      method: 'POST',
      token,
      body: {
        name: 'MediTrust Mobile Phlebotomy Dispatch',
        accountId: mediTrust.id,
        status: 'ACTIVE',
        summary: 'Home specimen collection dispatch module.',
        currency: 'THB',
        budgetAmount: '95000.00',
        startDate: '2026-11-01',
        targetEndDate: '2027-01-31',
        phases: [
          {
            id: 'phleb-p1',
            name: 'Phase 1: Discovery',
            order: 1,
            status: 'COMPLETED',
            startDate: '2026-11-01',
            targetDate: '2026-11-15',
            progressPct: 100,
            milestones: [
              { title: 'Dispatch SOP Spec', deliveryDate: '2026-11-10', status: 'COMPLETED' },
            ],
          },
          {
            id: 'phleb-p2',
            name: 'Phase 2: Mobile App Build',
            order: 2,
            status: 'IN_PROGRESS',
            startDate: '2026-11-16',
            targetDate: '2026-12-20',
            progressPct: 40,
            milestones: [
              { title: 'Route Assignment Screen', deliveryDate: '2026-12-05', status: 'IN_PROGRESS' },
            ],
          },
        ],
      },
    });
    expect(createProjRes.status).toBe(201);
    const createdProj = (await createProjRes.json()) as {
      id: string;
      code: string;
      overallProgressPct: number;
      version: number;
    };
    expect(createdProj.code).toMatch(/^PRJ-\d{4}-\d{3,}$/);
    expect(createdProj.overallProgressPct).toBe(70);

    const patchPhaseRes = await req(`/api/v1/projects/${createdProj.id}/phases/phleb-p2`, {
      method: 'PATCH',
      token,
      body: { status: 'COMPLETED', progressPct: 100, version: createdProj.version },
    });
    expect(patchPhaseRes.status).toBe(200);
    expect(((await patchPhaseRes.json()) as { overallProgressPct: number }).overallProgressPct).toBe(100);

    // 3. Create internal ticket with BOTH an internal engineering note and a public team reply
    const createTktRes = await req('/api/v1/tickets', {
      method: 'POST',
      token,
      body: {
        accountId: mediTrust.id,
        projectId: createdProj.id,
        phaseId: 'phleb-p2',
        title: 'Phlebotomy GPS pin offset in Bahan township',
        description: 'Pin drifts 200m near Shwedagon East Gate.',
        category: 'BUG',
        priority: 'HIGH',
        status: 'WAITING_CLIENT',
        requesterName: 'Dr. Zaw Min Htut',
        requesterEmail: 'zawminhtut@meditrust-yangon.mm',
      },
    });
    expect(createTktRes.status).toBe(201);
    const internalTkt = (await createTktRes.json()) as { id: string; ticketNumber: string };
    expect(internalTkt.ticketNumber).toMatch(/^TKT-\d{4}-\d{4,}$/);

    const addInternalNote = await req(`/api/v1/tickets/${internalTkt.id}/comments`, {
      method: 'POST',
      token,
      body: {
        message: 'INTERNAL SECRET: Client is on old Android 9 devices; do not mention vendor bug.',
        isInternalNote: true,
      },
    });
    expect(addInternalNote.status).toBe(201);

    const addPublicReply = await req(`/api/v1/tickets/${internalTkt.id}/comments`, {
      method: 'POST',
      token,
      body: {
        message: 'Could you share a screenshot of the GPS accuracy reading from the driver phone?',
        isInternalNote: false,
      },
    });
    expect(addPublicReply.status).toBe(201);

    // 4. Client Portal Login (MediTrust) & Bad Access Code rejection
    const badPortalLogin = await req('/api/v1/client-portal/login', {
      method: 'POST',
      body: { portalSlug: 'meditrust-yangon', accessCode: 'WRONG-CODE' },
    });
    expect(badPortalLogin.status).toBe(401);

    const portalLogin = await req('/api/v1/client-portal/login', {
      method: 'POST',
      body: { portalSlug: 'meditrust-yangon', accessCode: 'MT-2026' },
    });
    expect(portalLogin.status).toBe(200);
    expect(portalLogin.headers.get('set-cookie')).toContain('thea_client_session=');
    const { token: clientToken } = (await portalLogin.json()) as { token: string };

    // 5. Strict JWT Audience / Role Isolation (Client JWT rejected on internal routes; Staff JWT rejected on client routes)
    expect((await req('/api/v1/admin/users', { token: clientToken })).status).toBe(401);
    expect((await req('/api/v1/accounting/coa', { token: clientToken })).status).toBe(401);
    expect((await req('/api/v1/tickets', { token: clientToken })).status).toBe(401);
    expect((await req('/api/v1/client-portal/projects', { token })).status).toBe(401);

    // 6. Client Portal projects list is strictly scoped to MediTrust and redacts budgetAmount
    const clientProjsRes = await req('/api/v1/client-portal/projects', { token: clientToken });
    expect(clientProjsRes.status).toBe(200);
    const clientProjs = (await clientProjsRes.json()) as {
      items: Array<Record<string, unknown>>;
    };
    expect(clientProjs.items.length).toBeGreaterThanOrEqual(3);
    for (const p of clientProjs.items) {
      expect(p.accountName).toBe('MediTrust Diagnostics Yangon');
      expect(p.budgetAmount).toBeUndefined();
    }

    // 7. Client Portal ticket strictly strips isInternalNote: true comments
    const clientTktDetail = await req(`/api/v1/client-portal/tickets/${internalTkt.id}`, {
      token: clientToken,
    });
    expect(clientTktDetail.status).toBe(200);
    const clientTktBody = (await clientTktDetail.json()) as {
      status: string;
      comments: Array<{ message: string; isInternalNote: boolean }>;
    };
    expect(clientTktBody.comments.length).toBe(1);
    expect(clientTktBody.comments[0]?.isInternalNote).toBe(false);
    expect(clientTktBody.comments.some((c) => c.message.includes('INTERNAL SECRET'))).toBe(false);

    // 8. Client reply on WAITING_CLIENT ticket automatically reopens it to IN_PROGRESS
    const clientReply = await req(`/api/v1/client-portal/tickets/${internalTkt.id}/comments`, {
      method: 'POST',
      token: clientToken,
      body: { message: 'Screenshot uploaded — accuracy shows 180m.' },
    });
    expect(clientReply.status).toBe(201);
    const repliedBody = (await clientReply.json()) as {
      status: string;
      comments: Array<{ authorType: string; isInternalNote: boolean }>;
    };
    expect(repliedBody.status).toBe('IN_PROGRESS');
    expect(repliedBody.comments.length).toBe(2);
    expect(repliedBody.comments[1]?.authorType).toBe('CLIENT');

    // 9. Cross-tenant IDOR protection: MediTrust CANNOT read Shwe Taung's tickets or attach Shwe Taung's project
    const shweTicketsRes = await req(`/api/v1/tickets?accountId=${shweTaung.id}`, { token });
    const shweTickets = (await shweTicketsRes.json()) as { items: Array<{ id: string; projectId: string | null }> };
    const shweTicketId = shweTickets.items[0]!.id;
    const shweProjectId = shweTickets.items[0]!.projectId!;

    expect(
      (await req(`/api/v1/client-portal/tickets/${shweTicketId}`, { token: clientToken })).status
    ).toBe(404);

    const idorCreate = await req('/api/v1/client-portal/tickets', {
      method: 'POST',
      token: clientToken,
      body: {
        projectId: shweProjectId,
        title: 'Attempted cross-tenant project link',
        description: 'Should be blocked.',
        category: 'SUPPORT',
        priority: 'LOW',
      },
    });
    expect(idorCreate.status).toBe(404);

    // Legitimate Client Portal ticket submission succeeds
    const validClientSubmit = await req('/api/v1/client-portal/tickets', {
      method: 'POST',
      token: clientToken,
      body: {
        projectId: createdProj.id,
        title: 'Add weekend phlebotomy shift calendar',
        description: 'Need Saturday morning booking slots in Bahan branch.',
        category: 'FEATURE_REQUEST',
        priority: 'MEDIUM',
      },
    });
    expect(validClientSubmit.status).toBe(201);

    // 10. Rotate portal access code via CRM endpoint
    const rotateRes = await req(`/api/v1/crm/accounts/${mediTrust.id}/portal-access`, {
      method: 'POST',
      token,
      body: { rotateAccessCode: true },
    });
    expect(rotateRes.status).toBe(200);
    const rotated = (await rotateRes.json()) as { portalAccessCode: string };
    expect(rotated.portalAccessCode).not.toBe('MT-2026');
  });
});
