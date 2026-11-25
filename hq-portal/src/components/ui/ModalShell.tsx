import React, { useEffect, useState } from 'react';
import { createPortal } from 'react-dom';
import { Maximize2, Minimize2, X } from 'lucide-react';

export interface ModalShellProps {
  open: boolean;
  onClose: () => void;
  title: string;
  subtitle?: string;
  variant?: 'dialog' | 'drawer';
  maxWidthClass?: string;
  defaultExpanded?: boolean;
  children: React.ReactNode;
  footer?: React.ReactNode;
}

export default function ModalShell({
  open,
  onClose,
  title,
  subtitle,
  variant = 'dialog',
  maxWidthClass,
  defaultExpanded = false,
  children,
  footer,
}: ModalShellProps) {
  const [expanded, setExpanded] = useState(defaultExpanded);

  useEffect(() => {
    if (!open) {
      setExpanded(defaultExpanded);
      return;
    }

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };
    window.addEventListener('keydown', onKeyDown);

    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open, onClose, defaultExpanded]);

  if (!open || typeof document === 'undefined') {
    return null;
  }

  const isDrawer = variant === 'drawer';

  const containerLayoutClass = expanded
    ? 'items-center justify-center p-3 sm:p-5'
    : isDrawer
      ? 'justify-end p-0'
      : 'items-center justify-center p-4';

  const panelSizeClass = expanded
    ? 'w-[94vw] max-w-6xl h-[92vh] rounded-xl border border-hq-brand/45'
    : isDrawer
      ? `h-full w-full ${maxWidthClass || 'max-w-[600px]'} border-l border-hq-brand/45`
      : `w-full ${maxWidthClass || 'max-w-lg'} max-h-[90vh] rounded-xl border border-hq-brand/45`;

  return createPortal(
    <div
      className={`fixed inset-0 z-[100] flex bg-black/50 backdrop-blur-sm ${containerLayoutClass}`}
      role="dialog"
      aria-modal="true"
      aria-label={title}
    >
      <div className="fixed inset-0" onClick={onClose} aria-hidden="true" />
      <div
        className={`relative z-10 flex flex-col bg-hq-surface text-hq-textPrimary shadow-2xl overflow-hidden transition-[width,max-width,height] duration-200 ${panelSizeClass}`}
      >
        <div className="flex items-start justify-between gap-4 border-b border-hq-borderSubtle bg-hq-surface px-6 py-4 shrink-0">
          <div className="min-w-0">
            <h2 className="font-ds-display text-lg font-semibold text-hq-textPrimary truncate">
              {title}
            </h2>
            {subtitle && (
              <p className="mt-0.5 font-ds-mono text-xs text-hq-textSecondary truncate">
                {subtitle}
              </p>
            )}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={() => setExpanded((prev) => !prev)}
              aria-label={expanded ? 'Restore standard size' : 'Expand to full workspace width'}
              title={expanded ? 'Collapse' : 'Expand'}
              className="rounded-md p-1.5 text-hq-textSecondary hover:bg-hq-elevated hover:text-hq-textPrimary transition-colors"
            >
              {expanded ? (
                <Minimize2 className="h-4 w-4" />
              ) : (
                <Maximize2 className="h-4 w-4" />
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              aria-label="Close"
              title="Close"
              className="rounded-md p-1.5 text-hq-textSecondary hover:bg-hq-elevated hover:text-hq-textPrimary transition-colors"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5">{children}</div>

        {footer && (
          <div className="flex flex-wrap items-center justify-end gap-2.5 border-t border-hq-borderSubtle bg-hq-subtle px-6 py-3.5 shrink-0">
            {footer}
          </div>
        )}
      </div>
    </div>,
    document.body
  );
}
