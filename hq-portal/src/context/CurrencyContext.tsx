import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest } from '@/lib/apiClient';
import { convertCurrencyAmount, formatMoney, getTodayIso, parseDecimal } from '@/lib/format';
import { useAuth } from '@/context/AuthContext';
import type { CurrencyCode, CursorPage, ExchangeRateDTO, SystemSettingsDTO } from '@/types/hq';

interface CurrencyContextValue {
  displayCurrency: CurrencyCode;
  setDisplayCurrency: (currency: CurrencyCode) => void;
  baseCurrency: CurrencyCode;
  activeRate: ExchangeRateDTO | null;
  thbToMmkRate: number;
  fxHistory: ExchangeRateDTO[];
  fxStatus: 'fresh' | 'stale' | 'missing';
  refreshFx: () => Promise<void>;
  convertToDisplay: (amount: string | number, fromCurrency: CurrencyCode) => number;
  formatInDisplay: (
    amount: string | number,
    fromCurrency: CurrencyCode,
    options?: { compact?: boolean; decimals?: number }
  ) => string;
}

const CurrencyContext = createContext<CurrencyContextValue | null>(null);
const DISPLAY_CURRENCY_KEY = 'thea-hq-display-currency';

function readInitialDisplayCurrency(): CurrencyCode {
  try {
    const saved = localStorage.getItem(DISPLAY_CURRENCY_KEY);
    if (saved === 'MMK' || saved === 'THB') {
      return saved;
    }
  } catch {
    return 'MMK';
  }
  return 'MMK';
}

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  const { user } = useAuth();
  const [displayCurrency, setDisplayCurrencyState] = useState<CurrencyCode>(
    readInitialDisplayCurrency
  );
  const [baseCurrency, setBaseCurrency] = useState<CurrencyCode>('MMK');
  const [fxHistory, setFxHistory] = useState<ExchangeRateDTO[]>([]);

  const setDisplayCurrency = (currency: CurrencyCode) => {
    setDisplayCurrencyState(currency);
    try {
      localStorage.setItem(DISPLAY_CURRENCY_KEY, currency);
    } catch {
      // Ignore storage errors
    }
  };

  const refreshFx = useCallback(async () => {
    if (!user) return;
    try {
      const fxPage = await apiRequest<CursorPage<ExchangeRateDTO>>(
        '/api/v1/accounting/fx-rates?limit=30'
      );
      setFxHistory(fxPage.items || []);
    } catch {
      // Role may not have accounting read permission
    }

    try {
      const settings = await apiRequest<SystemSettingsDTO>('/api/v1/admin/settings');
      if (settings.baseCurrency === 'MMK' || settings.baseCurrency === 'THB') {
        setBaseCurrency(settings.baseCurrency);
      }
    } catch {
      // Non-admin roles do not read /admin/settings
    }
  }, [user]);

  useEffect(() => {
    if (user) {
      void refreshFx();
    } else {
      setFxHistory([]);
    }
  }, [user, refreshFx]);

  const thbToMmkEntry =
    fxHistory.find((r) => r.fromCurrency === 'THB' && r.toCurrency === 'MMK') ||
    fxHistory[0] ||
    null;

  let thbToMmkRate = 135;
  if (thbToMmkEntry) {
    const raw = parseDecimal(thbToMmkEntry.rate);
    if (raw > 0) {
      thbToMmkRate =
        thbToMmkEntry.fromCurrency === 'THB' && thbToMmkEntry.toCurrency === 'MMK'
          ? raw
          : 1 / raw;
    }
  }

  let fxStatus: 'fresh' | 'stale' | 'missing' = 'missing';
  if (thbToMmkEntry) {
    const today = getTodayIso();
    fxStatus = thbToMmkEntry.date >= today ? 'fresh' : 'stale';
  }

  const convertToDisplay = useCallback(
    (amount: string | number, fromCurrency: CurrencyCode): number => {
      return convertCurrencyAmount(amount, fromCurrency, displayCurrency, thbToMmkRate);
    },
    [displayCurrency, thbToMmkRate]
  );

  const formatInDisplay = useCallback(
    (
      amount: string | number,
      fromCurrency: CurrencyCode,
      options?: { compact?: boolean; decimals?: number }
    ): string => {
      const converted = convertCurrencyAmount(amount, fromCurrency, displayCurrency, thbToMmkRate);
      return formatMoney(converted, displayCurrency, options);
    },
    [displayCurrency, thbToMmkRate]
  );

  return (
    <CurrencyContext.Provider
      value={{
        displayCurrency,
        setDisplayCurrency,
        baseCurrency,
        activeRate: thbToMmkEntry,
        thbToMmkRate,
        fxHistory,
        fxStatus,
        refreshFx,
        convertToDisplay,
        formatInDisplay,
      }}
    >
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency(): CurrencyContextValue {
  const ctx = useContext(CurrencyContext);
  if (!ctx) {
    throw new Error('useCurrency must be used within CurrencyProvider');
  }
  return ctx;
}
