import React, { createContext, useCallback, useContext, useState } from 'react';
import { CheckCircle2, AlertCircle, Info, X } from 'lucide-react';

export type ToastVariant = 'success' | 'error' | 'info';

interface ToastItem {
  id: string;
  title: string;
  description?: string;
  variant: ToastVariant;
}

interface ToastContextValue {
  pushToast: (toast: Omit<ToastItem, 'id'>) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);

  const dismiss = useCallback((id: string) => {
    setToasts((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const pushToast = useCallback(
    (toast: Omit<ToastItem, 'id'>) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
      setToasts((prev) => [...prev.slice(-3), { ...toast, id }]);
      window.setTimeout(() => {
        dismiss(id);
      }, 4500);
    },
    [dismiss]
  );

  return (
    <ToastContext.Provider value={{ pushToast }}>
      {children}
      <div
        aria-live="polite"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[60] flex w-[calc(100vw-2rem)] max-w-sm flex-col gap-2.5 pointer-events-none"
      >
        {toasts.map((item) => {
          const borderColor =
            item.variant === 'success'
              ? 'border-hq-in/50'
              : item.variant === 'error'
                ? 'border-hq-out/60'
                : 'border-hq-brand/60';
          const icon =
            item.variant === 'success' ? (
              <CheckCircle2 className="h-4 w-4 text-hq-in shrink-0 mt-0.5" />
            ) : item.variant === 'error' ? (
              <AlertCircle className="h-4 w-4 text-hq-out shrink-0 mt-0.5" />
            ) : (
              <Info className="h-4 w-4 text-hq-brandVibrant shrink-0 mt-0.5" />
            );

          return (
            <div
              key={item.id}
              role={item.variant === 'error' ? 'alert' : 'status'}
              className={`pointer-events-auto hq-card border ${borderColor} px-4 py-3 flex items-start gap-3`}
            >
              {icon}
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-hq-textPrimary">{item.title}</p>
                {item.description && (
                  <p className="mt-0.5 text-xs text-hq-textSecondary">{item.description}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => dismiss(item.id)}
                aria-label="Dismiss notification"
                className="text-hq-textMuted hover:text-hq-textPrimary p-1 rounded"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext);
  if (!ctx) {
    throw new Error('useToast must be used within ToastProvider');
  }
  return ctx;
}
