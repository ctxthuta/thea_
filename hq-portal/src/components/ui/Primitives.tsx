import React from 'react';
import { AlertCircle, RefreshCw } from 'lucide-react';
import ModalShell from '@/components/ui/ModalShell';

export type PillTone = 'neutral' | 'brand' | 'in' | 'warn' | 'out';

export function StatusPill({
  tone = 'neutral',
  children,
  className = '',
}: {
  tone?: PillTone;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClass: Record<PillTone, string> = {
    neutral: 'bg-hq-elevated text-hq-textSecondary border-hq-borderDefault',
    brand: 'bg-hq-brand/15 text-hq-brandSoft border-hq-brand/40',
    in: 'bg-hq-inBg text-hq-in border-hq-in/30',
    warn: 'bg-hq-warnBg text-hq-warn border-hq-warn/30',
    out: 'bg-hq-outBg text-hq-out border-hq-out/30',
  };

  return (
    <span
      className={`inline-flex items-center gap-1 rounded-full border px-2.5 py-0.5 font-ds-mono text-[11px] font-medium uppercase tracking-wider whitespace-nowrap ${toneClass[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function Modal({
  open,
  onClose,
  title,
  subtitle,
  maxWidthClass = 'max-w-lg',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  maxWidthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      variant="dialog"
      maxWidthClass={maxWidthClass}
      footer={footer}
    >
      {children}
    </ModalShell>
  );
}

export function SlideOver({
  open,
  onClose,
  title,
  subtitle,
  widthClass = 'max-w-[600px]',
  children,
  footer,
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  widthClass?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
}) {
  return (
    <ModalShell
      open={open}
      onClose={onClose}
      title={title}
      subtitle={subtitle}
      variant="drawer"
      maxWidthClass={widthClass}
      footer={footer}
    >
      {children}
    </ModalShell>
  );
}

export function ErrorBanner({
  message,
  onRetry,
}: {
  message: string;
  onRetry?: () => void;
}) {
  return (
    <div
      role="alert"
      className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-hq-out/40 bg-hq-outBg px-4 py-3 text-sm text-hq-out"
    >
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle className="h-4 w-4 shrink-0" />
        <span className="truncate">{message}</span>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="inline-flex items-center gap-1.5 rounded-full border border-hq-out/50 px-3 py-1 text-xs font-medium hover:bg-hq-out hover:text-white transition-colors"
        >
          <RefreshCw className="h-3.5 w-3.5" />
          Retry
        </button>
      )}
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  description,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  action?: React.ReactNode;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl border border-dashed border-hq-borderDefault bg-hq-subtle/50 px-6 py-12 text-center">
      <div className="mb-3 flex h-11 w-11 items-center justify-center rounded-xl bg-hq-elevated text-hq-textSecondary">
        {icon}
      </div>
      <h3 className="font-ds-display text-base font-semibold text-hq-textPrimary">{title}</h3>
      <p className="mt-1 max-w-md text-xs text-hq-textSecondary">{description}</p>
      {action && <div className="mt-4">{action}</div>}
    </div>
  );
}

export function TableSkeleton({ rows = 6, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2.5 p-4" aria-busy="true" aria-label="Loading records">
      {Array.from({ length: rows }).map((_, rowIdx) => (
        <div
          key={rowIdx}
          className="grid gap-3"
          style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
        >
          {Array.from({ length: cols }).map((__, colIdx) => (
            <div key={colIdx} className="hq-skeleton h-7 w-full" />
          ))}
        </div>
      ))}
    </div>
  );
}
