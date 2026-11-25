import type { CurrencyCode } from '@/types/hq';

export function parseDecimal(value: string | number | null | undefined): number {
  if (typeof value === 'number') {
    return Number.isFinite(value) ? value : 0;
  }
  if (!value) {
    return 0;
  }
  const parsed = Number.parseFloat(String(value).replace(/,/g, ''));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function convertCurrencyAmount(
  amount: string | number,
  fromCurrency: CurrencyCode,
  toCurrency: CurrencyCode,
  thbToMmkRate: number
): number {
  const numeric = parseDecimal(amount);
  if (fromCurrency === toCurrency || thbToMmkRate <= 0) {
    return numeric;
  }
  if (fromCurrency === 'THB' && toCurrency === 'MMK') {
    return numeric * thbToMmkRate;
  }
  if (fromCurrency === 'MMK' && toCurrency === 'THB') {
    return numeric / thbToMmkRate;
  }
  return numeric;
}

export function formatMoney(
  amount: string | number,
  currency: CurrencyCode,
  options?: { compact?: boolean; decimals?: number }
): string {
  const numeric = parseDecimal(amount);
  const abs = Math.abs(numeric);
  const sign = numeric < 0 ? '-' : '';

  if (options?.compact && abs >= 1_000_000) {
    const millions = (abs / 1_000_000).toFixed(2);
    return `${sign}${millions}M ${currency}`;
  }

  const decimals = options?.decimals ?? (currency === 'MMK' ? 0 : 2);
  const formatted = new Intl.NumberFormat('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  }).format(abs);

  return `${sign}${formatted} ${currency}`;
}

export function formatDecimalInput(value: number, decimals = 2): string {
  if (!Number.isFinite(value)) {
    return (0).toFixed(decimals);
  }
  return value.toFixed(decimals);
}

export function formatDateShort(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  if (/^\d{4}-\d{2}-\d{2}$/.test(dateStr)) {
    return dateStr;
  }
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toISOString().slice(0, 10);
}

export function formatDateTime(dateStr: string | null | undefined): string {
  if (!dateStr) return '--';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return dateStr;
  return d.toLocaleString('en-GB', {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false,
  });
}

export function getTodayIso(): string {
  return new Date().toISOString().slice(0, 10);
}

export function getCurrentMonthKey(): string {
  return new Date().toISOString().slice(0, 7);
}

export function getMonthBounds(monthKey: string): { dateFrom: string; dateTo: string } {
  const [yearStr, monthStr] = monthKey.split('-');
  const year = Number.parseInt(yearStr, 10) || new Date().getFullYear();
  const month = Number.parseInt(monthStr, 10) || new Date().getMonth() + 1;
  const lastDay = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const paddedMonth = String(month).padStart(2, '0');
  const paddedLast = String(lastDay).padStart(2, '0');
  return {
    dateFrom: `${year}-${paddedMonth}-01`,
    dateTo: `${year}-${paddedMonth}-${paddedLast}`,
  };
}

export function daysUntil(dateStr: string): number {
  const target = new Date(`${dateStr.slice(0, 10)}T00:00:00Z`).getTime();
  const now = new Date();
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  return Math.ceil((target - today) / (1000 * 60 * 60 * 24));
}

export function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}
