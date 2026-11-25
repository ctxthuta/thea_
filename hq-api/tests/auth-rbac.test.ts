import { afterAll, beforeAll, describe, expect, test } from 'bun:test';
import { createApp } from '../src/app';
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

describe('Auth, Static Super Admin & RBAC Integration', () => {
  let dbHandle: TestDbHandle;
  let superAdminToken = '';

  beforeAll(async () => {
    dbHandle = await startTestDb('thea_hq_test_auth');
  }, 60000);

  afterAll(async () => {
    await dbHandle.stop();
  }, 30000);

  test('Health endpoint reports connected DB', async () => {
    const res = await req('/api/v1/health');
    expect(res.status).toBe(200);
    const body = (await res.json()) as { status: string; db: string };
    expect(body.status).toBe('ok');
    expect(body.db).toBe('connected');
  });

  test('Static Super Admin signs in via constant-time env check and receives wildcard permissions', async () => {
    const badRes = await req('/api/v1/auth/login', {
      method: 'POST',
      body: { email: process.env.SUPER_ADMIN_EMAIL, password: 'WrongPassword123!' },
    });
    expect(badRes.status).toBe(401);
    expect(badRes.headers.get('content-type')).toContain('application/problem+json');

    const res = await req('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: process.env.SUPER_ADMIN_EMAIL,
        password: process.env.SUPER_ADMIN_PASSWORD,
      },
    });
    expect(res.status).toBe(200);
    expect(res.headers.get('set-cookie')).toContain('thea_hq_session=');

    const data = (await res.json()) as {
      token: string;
      user: { role: string; isStaticSuperAdmin: boolean; permissions: string[] };
    };
    expect(data.user.role).toBe('SUPER_ADMIN');
    expect(data.user.isStaticSuperAdmin).toBe(true);
    expect(data.user.permissions).toContain('*');
    superAdminToken = data.token;

    const meRes = await req('/api/v1/auth/me', { token: superAdminToken });
    expect(meRes.status).toBe(200);
    const meData = (await meRes.json()) as { user: { role: string; isStaticSuperAdmin: boolean } };
    expect(meData.user.role).toBe('SUPER_ADMIN');
    expect(meData.user.isStaticSuperAdmin).toBe(true);
  });

  test('Argon2id DB users enforce RBAC matrix and disabled user lockout', async () => {
    const createRes = await req('/api/v1/admin/users', {
      method: 'POST',
      token: superAdminToken,
      body: {
        email: 'finance.test@theasolutions.co',
        name: 'Finance Officer',
        password: 'FinanceStrongPassword#2026',
        role: 'FINANCE',
      },
    });
    expect(createRes.status).toBe(201);
    const createdUser = (await createRes.json()) as { id: string; version: number };

    const loginRes = await req('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'finance.test@theasolutions.co',
        password: 'FinanceStrongPassword#2026',
      },
    });
    expect(loginRes.status).toBe(200);
    const { token: financeToken } = (await loginRes.json()) as { token: string };

    // FINANCE can read accounting COA
    const coaRes = await req('/api/v1/accounting/coa', { token: financeToken });
    expect(coaRes.status).toBe(200);

    // FINANCE cannot access CMS or Admin Users
    expect((await req('/api/v1/cms/sections', { token: financeToken })).status).toBe(403);
    expect((await req('/api/v1/admin/users', { token: financeToken })).status).toBe(403);

    // Disable FINANCE user as Super Admin
    const disableRes = await req(`/api/v1/admin/users/${createdUser.id}`, {
      method: 'PATCH',
      token: superAdminToken,
      body: { status: 'DISABLED', version: createdUser.version },
    });
    expect(disableRes.status).toBe(200);

    // Existing JWT is immediately rejected (403)
    expect((await req('/api/v1/accounting/coa', { token: financeToken })).status).toBe(403);

    // Wrong password on disabled user returns 401 (prevents disabled-account enumeration)
    const disabledWrongPw = await req('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'finance.test@theasolutions.co',
        password: 'WrongPassword#2026',
      },
    });
    expect(disabledWrongPw.status).toBe(401);

    // Correct password on disabled user returns 403
    const reLogin = await req('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'finance.test@theasolutions.co',
        password: 'FinanceStrongPassword#2026',
      },
    });
    expect(reLogin.status).toBe(403);

    // Non-existent email returns 401 and invalid x-request-id is sanitized
    const missingUser = await req('/api/v1/auth/login', {
      method: 'POST',
      headers: { 'x-request-id': 'bad<script>header value!' },
      body: {
        email: 'nobody.here@theasolutions.co',
        password: 'SomePassword#2026',
      },
    });
    expect(missingUser.status).toBe(401);
    const echoedReqId = missingUser.headers.get('x-request-id') ?? '';
    expect(echoedReqId).toMatch(/^[A-Za-z0-9._-]{1,64}$/);
    expect(echoedReqId).not.toContain('<script>');

    // Logout clears cookie
    const logoutRes = await req('/api/v1/auth/logout', { method: 'POST', token: superAdminToken });
    expect(logoutRes.status).toBe(200);
    expect(logoutRes.headers.get('set-cookie')).toContain('Max-Age=0');
  });

  test('RBAC scopes /overview and /associates sensitive fields for CMS_EDITOR', async () => {
    const createCmsUser = await req('/api/v1/admin/users', {
      method: 'POST',
      token: superAdminToken,
      body: {
        email: 'cms.editor@theasolutions.co',
        name: 'CMS Editor',
        password: 'CmsStrongPassword#2026',
        role: 'CMS_EDITOR',
      },
    });
    expect(createCmsUser.status).toBe(201);

    const cmsLogin = await req('/api/v1/auth/login', {
      method: 'POST',
      body: {
        email: 'cms.editor@theasolutions.co',
        password: 'CmsStrongPassword#2026',
      },
    });
    expect(cmsLogin.status).toBe(200);
    const { token: cmsToken } = (await cmsLogin.json()) as { token: string };

    // Create associate with compensation & internal notes as Super Admin
    const assocRes = await req('/api/v1/associates', {
      method: 'POST',
      token: superAdminToken,
      body: {
        slug: 'rbac-scoped-contractor',
        associateType: 'contractor',
        name: 'Scoped Contractor',
        title: 'Engineer',
        department: 'Engineering',
        bio: 'Scoped bio',
        cardExpirationDate: '2028-12-31',
        compensation: {
          rateType: 'MONTHLY_RETAINER',
          rateAmount: '50000.00',
          currency: 'THB',
          payoutMethod: 'KBank',
          ndaSigned: true,
          msaSigned: true,
        },
        internalNotes: 'Top secret rate note',
      },
    });
    expect(assocRes.status).toBe(201);
    const assoc = (await assocRes.json()) as { id: string; compensation?: unknown; internalNotes?: string };
    expect(assoc.compensation).toBeDefined();
    expect(assoc.internalNotes).toBe('Top secret rate note');

    // CMS_EDITOR cannot see compensation or internalNotes on list or detail
    const cmsListRes = await req('/api/v1/associates', { token: cmsToken });
    expect(cmsListRes.status).toBe(200);
    const cmsList = (await cmsListRes.json()) as {
      items: Array<{ id: string; compensation?: unknown; internalNotes?: string }>;
    };
    const found = cmsList.items.find((i) => i.id === assoc.id);
    expect(found).toBeDefined();
    expect(found?.compensation).toBeUndefined();
    expect(found?.internalNotes).toBeUndefined();

    const cmsDetailRes = await req(`/api/v1/associates/${assoc.id}`, { token: cmsToken });
    expect(cmsDetailRes.status).toBe(200);
    const cmsDetail = (await cmsDetailRes.json()) as { compensation?: unknown; internalNotes?: string };
    expect(cmsDetail.compensation).toBeUndefined();
    expect(cmsDetail.internalNotes).toBeUndefined();

    // CMS_EDITOR calling /overview receives redacted financial and CRM fields
    const cmsOverviewRes = await req('/api/v1/overview', { token: cmsToken });
    expect(cmsOverviewRes.status).toBe(200);
    const cmsOverview = (await cmsOverviewRes.json()) as {
      kpis: Record<string, unknown>;
      moneyInVsOut: unknown[];
      moneyUsages: unknown[];
      budgetVsActual: unknown[];
      recentLeads: unknown[];
    };
    expect(cmsOverview.kpis.cashBalance).toBeUndefined();
    expect(cmsOverview.kpis.totalIncome).toBeUndefined();
    expect(cmsOverview.kpis.totalExpenses).toBeUndefined();
    expect(cmsOverview.kpis.openDealsPipelineValue).toBeUndefined();
    expect(cmsOverview.kpis.openLeadsCount).toBeUndefined();
    expect(cmsOverview.moneyInVsOut).toEqual([]);
    expect(cmsOverview.moneyUsages).toEqual([]);
    expect(cmsOverview.budgetVsActual).toEqual([]);
    expect(cmsOverview.recentLeads).toEqual([]);
  });
});
