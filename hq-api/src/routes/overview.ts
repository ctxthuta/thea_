import { Hono } from 'hono';
import { SUPPORTED_CURRENCIES, type CurrencyCode } from '../domain/accounting/money';
import { hasPermission } from '../domain/auth/rbac';
import { getExecutiveOverview } from '../application/accounting/reportService';
import { requireAuth } from '../middleware/auth';
import type { AppEnv } from '../middleware/context';

export function createOverviewRoutes(): Hono<AppEnv> {
  const app = new Hono<AppEnv>();

  app.use('*', requireAuth());

  app.get('/', async (c) => {
    const user = c.get('authUser')!;
    const rawCurrency = c.req.query('displayCurrency')?.toUpperCase();
    const displayCurrency = (SUPPORTED_CURRENCIES as readonly string[]).includes(rawCurrency ?? '')
      ? (rawCurrency as CurrencyCode)
      : undefined;

    const canReadAccounting = hasPermission(user.role, user.isStaticSuperAdmin, 'accounting:read');
    const canReadCrm = hasPermission(user.role, user.isStaticSuperAdmin, 'crm:read');

    const overview = await getExecutiveOverview({
      displayCurrency,
      dateFrom: c.req.query('dateFrom') || undefined,
      dateTo: c.req.query('dateTo') || undefined,
      periodKey: c.req.query('periodKey') || undefined,
      canReadAccounting,
      canReadCrm,
    });

    return c.json(overview);
  });

  return app;
}
