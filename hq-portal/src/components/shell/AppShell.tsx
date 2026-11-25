import React, { useState } from 'react';
import { Link, NavLink, Outlet, useLocation, useNavigate } from 'react-router-dom';
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  Crown,
  FileCode2,
  Landmark,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  ShieldCheck,
  Sun,
  Users,
  X,
} from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useCurrency } from '@/context/CurrencyContext';
import { useTheme } from '@/context/ThemeContext';
import { canAccessModule, canEditFinance, type PortalModule } from '@/lib/rbac';
import type { CurrencyCode } from '@/types/hq';

interface NavEntry {
  to: string;
  label: string;
  group: 'Workspace' | 'Operations' | 'Governance';
  module: PortalModule;
  icon: React.ComponentType<{ className?: string }>;
}

const NAV_ENTRIES: NavEntry[] = [
  { to: '/', label: 'Overview', group: 'Workspace', module: 'overview', icon: LayoutDashboard },
  { to: '/cms', label: 'Website CMS', group: 'Workspace', module: 'cms', icon: FileCode2 },
  { to: '/associates', label: 'Associates', group: 'Workspace', module: 'associates', icon: Users },
  { to: '/finance', label: 'Finance Suite', group: 'Operations', module: 'finance', icon: Landmark },
  { to: '/crm', label: 'CRM & Leads', group: 'Operations', module: 'crm', icon: Briefcase },
  { to: '/admin', label: 'Administration', group: 'Governance', module: 'admin', icon: ShieldCheck },
];

const ROUTE_LABELS: Record<string, string> = {
  '/': 'Overview Dashboard',
  '/cms': 'Dynamic Website CMS',
  '/associates': 'Associates & Digital Identity',
  '/finance': 'Finance Suite',
  '/crm': 'CRM & Revenue Pipeline',
  '/admin': 'Administration',
};

export default function AppShell() {
  const { user, logout } = useAuth();
  const { displayCurrency, setDisplayCurrency, activeRate, thbToMmkRate, fxStatus, fxHistory } =
    useCurrency();
  const { theme, toggleTheme } = useTheme();
  const location = useLocation();
  const navigate = useNavigate();

  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [fxPopoverOpen, setFxPopoverOpen] = useState(false);

  const visibleEntries = NAV_ENTRIES.filter((entry) => canAccessModule(user, entry.module));
  const groups: Array<'Workspace' | 'Operations' | 'Governance'> = [
    'Workspace',
    'Operations',
    'Governance',
  ];

  const handleSignOut = async () => {
    await logout();
    navigate('/login', { replace: true });
  };

  const initials = (user?.name || user?.email || 'HQ')
    .split(/\s+/)
    .map((part) => part[0])
    .join('')
    .toUpperCase()
    .slice(0, 2);

  const fxDotClass =
    fxStatus === 'fresh'
      ? 'bg-hq-in'
      : fxStatus === 'stale'
        ? 'bg-hq-warn'
        : 'bg-hq-out';

  const currentBreadcrumb = ROUTE_LABELS[location.pathname] || 'Thea HQ';
  const brandLogoSrc =
    theme === 'dark' ? '/dark_tranStacked_logo.png' : '/light_tranStacked_logo.png';

  const renderSidebarLinks = (isMobile = false) => (
    <nav aria-label="Primary navigation" className="flex-1 overflow-y-auto px-2.5 py-4 space-y-5">
      {groups.map((group) => {
        const items = visibleEntries.filter((entry) => entry.group === group);
        if (items.length === 0) return null;

        return (
          <div key={group}>
            {(!collapsed || isMobile) && (
              <p className="mb-1.5 px-3 font-ds-mono text-[10px] font-medium uppercase tracking-[0.1em] text-hq-textMuted">
                {group}
              </p>
            )}
            <ul className="space-y-1">
              {items.map((item) => {
                const Icon = item.icon;
                return (
                  <li key={item.to}>
                    <NavLink
                      to={item.to}
                      end={item.to === '/'}
                      onClick={() => setMobileOpen(false)}
                      title={collapsed && !isMobile ? item.label : undefined}
                      className={({ isActive }) =>
                        `group relative flex items-center gap-3 rounded-lg px-3 ${
                          isMobile ? 'h-12' : 'h-10'
                        } text-sm transition-colors ${
                          isActive
                            ? 'bg-hq-elevated font-medium text-hq-textPrimary'
                            : 'text-hq-textSecondary hover:bg-hq-elevated/70 hover:text-hq-textPrimary'
                        }`
                      }
                    >
                      {({ isActive }) => (
                        <>
                          {isActive && (
                            <span
                              aria-hidden="true"
                              className="absolute left-0 top-1.5 bottom-1.5 w-[3px] rounded-r bg-hq-brandVibrant"
                            />
                          )}
                          <Icon className="h-4 w-4 shrink-0" />
                          {(!collapsed || isMobile) && (
                            <span className="truncate">{item.label}</span>
                          )}
                        </>
                      )}
                    </NavLink>
                  </li>
                );
              })}
            </ul>
          </div>
        );
      })}
    </nav>
  );

  const renderUserCard = (isMobile = false) => (
    <div className="shrink-0 border-t border-hq-borderSubtle p-3 bg-hq-surface">
      <div className={`flex items-center gap-2.5 ${collapsed && !isMobile ? 'justify-center' : ''}`}>
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-hq-brand text-xs font-semibold text-white">
          {initials}
        </div>
        {(!collapsed || isMobile) && (
          <div className="min-w-0 flex-1">
            <p className="truncate text-xs font-semibold text-hq-textPrimary">
              {user?.name || user?.email}
            </p>
            <div className="mt-0.5 flex items-center gap-1">
              {user?.isStaticSuperAdmin ? (
                <span className="inline-flex items-center gap-1 rounded-full border border-hq-brandVibrant/45 bg-hq-brand/15 px-2 py-0.5 font-ds-mono text-[10px] font-semibold uppercase tracking-wider text-hq-brandSoft">
                  <Crown className="h-2.5 w-2.5" />
                  SUPER ADMIN
                </span>
              ) : (
                <span className="font-ds-mono text-[10px] uppercase tracking-wider text-hq-textMuted">
                  {user?.role}
                </span>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );

  return (
    <div className="flex min-h-screen w-full max-w-[100vw] items-stretch bg-hq-canvas text-hq-textPrimary">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:left-4 focus:top-4 focus:z-[60] focus:rounded-full focus:bg-hq-brand focus:px-4 focus:py-2 focus:text-xs focus:font-semibold focus:text-white"
      >
        Skip to main content
      </a>

      {/* Fixed Full-Height Desktop Sidebar */}
      <aside
        className={`no-print hidden md:flex fixed inset-y-0 left-0 h-screen flex-col border-r border-hq-borderSubtle bg-hq-surface transition-[width] duration-200 z-30 ${
          collapsed ? 'w-[72px]' : 'w-[248px]'
        }`}
      >
        <button
          type="button"
          onClick={() => setCollapsed((prev) => !prev)}
          aria-label={collapsed ? 'Expand navigation sidebar' : 'Collapse navigation sidebar'}
          title={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
          className="absolute -right-3 top-5 z-40 flex h-6 w-6 items-center justify-center rounded-full border border-hq-borderDefault bg-hq-surface text-hq-textSecondary shadow-sm transition-colors hover:bg-hq-elevated hover:text-hq-textPrimary"
        >
          {collapsed ? (
            <ChevronRight className="h-3.5 w-3.5" />
          ) : (
            <ChevronLeft className="h-3.5 w-3.5" />
          )}
        </button>

        <div
          className={`flex h-16 shrink-0 items-center border-b border-hq-borderSubtle ${
            collapsed ? 'justify-center px-2' : 'justify-start px-4'
          }`}
        >
          <Link to="/" className="flex items-center gap-2.5 min-w-0">
            {collapsed ? (
              <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[#1A1816] p-1.5">
                <img
                  src="/thea_icon_transparent.png"
                  alt="Thea HQ"
                  className="h-full w-full object-contain"
                />
              </div>
            ) : (
              <div className="flex items-center gap-2.5 min-w-0">
                <img
                  src={brandLogoSrc}
                  alt="Thea Solutions"
                  className="h-11 w-auto object-contain shrink-0"
                />
                <span className="rounded border border-hq-borderDefault bg-hq-subtle px-1.5 py-0.5 font-ds-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-hq-textMuted shrink-0">
                  HQ
                </span>
              </div>
            )}
          </Link>
        </div>

        {renderSidebarLinks(false)}
        {renderUserCard(false)}
      </aside>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div
          className="no-print fixed inset-0 z-40 flex md:hidden"
          role="dialog"
          aria-modal="true"
          aria-label="Navigation menu"
        >
          <div
            className="fixed inset-0 bg-black/60 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
            aria-hidden="true"
          />
          <aside className="relative z-10 flex h-full w-[280px] flex-col border-r border-hq-borderSubtle bg-hq-surface">
            <div className="flex h-16 shrink-0 items-center justify-between border-b border-hq-borderSubtle px-4">
              <div className="flex items-center gap-2.5">
                <img
                  src={brandLogoSrc}
                  alt="Thea Solutions"
                  className="h-11 w-auto object-contain"
                />
                <span className="rounded border border-hq-borderDefault bg-hq-subtle px-1.5 py-0.5 font-ds-mono text-[9px] font-semibold uppercase tracking-[0.12em] text-hq-textMuted">
                  HQ
                </span>
              </div>
              <button
                type="button"
                onClick={() => setMobileOpen(false)}
                aria-label="Close navigation menu"
                className="flex h-10 w-10 items-center justify-center rounded-md text-hq-textSecondary hover:bg-hq-elevated"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            {renderSidebarLinks(true)}
            {renderUserCard(true)}
          </aside>
        </div>
      )}

      {/* Main Column */}
      <div
        className={`flex min-w-0 flex-1 flex-col min-h-screen transition-[padding-left] duration-200 print:pl-0 ${
          collapsed ? 'md:pl-[72px]' : 'md:pl-[248px]'
        }`}
      >
        <header className="no-print sticky top-0 z-20 border-b border-hq-borderSubtle bg-hq-surface/95 backdrop-blur-md">
          <div className="flex h-16 items-center justify-between gap-3 px-4 lg:px-6">
            <div className="flex items-center gap-3 min-w-0">
              <button
                type="button"
                onClick={() => setMobileOpen(true)}
                aria-label="Open navigation menu"
                className="flex h-10 w-10 items-center justify-center rounded-lg border border-hq-borderDefault text-hq-textPrimary md:hidden"
              >
                <Menu className="h-5 w-5" />
              </button>
              <div className="min-w-0">
                <p className="font-ds-mono text-[10px] uppercase tracking-[0.1em] text-hq-textMuted">
                  Thea HQ
                </p>
                <p className="truncate font-ds-display text-sm font-semibold text-hq-textPrimary">
                  {currentBreadcrumb}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2 sm:gap-2.5">
              {/* Global Display Currency Switch */}
              <div
                role="radiogroup"
                aria-label="Display Currency"
                className="inline-flex items-center rounded-full border border-hq-borderDefault bg-hq-subtle p-0.5"
              >
                {(['MMK', 'THB'] as CurrencyCode[]).map((code) => {
                  const active = displayCurrency === code;
                  return (
                    <button
                      key={code}
                      type="button"
                      role="radio"
                      aria-checked={active}
                      onClick={() => setDisplayCurrency(code)}
                      className={`rounded-full px-2.5 py-1 font-ds-mono text-[11px] font-semibold transition-colors ${
                        active
                          ? 'bg-hq-brand text-white'
                          : 'text-hq-textSecondary hover:text-hq-textPrimary'
                      }`}
                    >
                      {code}
                    </button>
                  );
                })}
              </div>

              {/* Live Daily FX Rate Pill */}
              <div className="relative hidden sm:block">
                <button
                  type="button"
                  onClick={() => {
                    if (canEditFinance(user)) {
                      navigate('/admin?tab=fx');
                    } else {
                      setFxPopoverOpen((prev) => !prev);
                    }
                  }}
                  title="Daily THB to MMK exchange rate"
                  className="inline-flex h-9 items-center gap-2 rounded-full border border-hq-borderDefault bg-hq-subtle px-3 font-ds-mono text-xs tabular-nums text-hq-textPrimary hover:border-hq-brand transition-colors"
                >
                  <span className={`h-2 w-2 rounded-full ${fxDotClass}`} />
                  <span>1 THB = {thbToMmkRate.toFixed(2)} MMK</span>
                </button>

                {fxPopoverOpen && (
                  <div className="absolute right-0 top-11 z-30 w-72 hq-card p-3.5 border-hq-borderDefault shadow-xl">
                    <div className="flex items-center justify-between mb-2">
                      <span className="font-ds-mono text-[11px] uppercase tracking-wider text-hq-textSecondary">
                        Recent FX History
                      </span>
                      <button
                        type="button"
                        onClick={() => setFxPopoverOpen(false)}
                        className="text-hq-textMuted hover:text-hq-textPrimary"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    </div>
                    {fxHistory.length === 0 ? (
                      <p className="text-xs text-hq-textMuted">No recorded FX rates available.</p>
                    ) : (
                      <ul className="space-y-1.5 font-ds-mono text-xs tabular-nums">
                        {fxHistory.slice(0, 5).map((entry) => (
                          <li key={entry.id} className="flex items-center justify-between">
                            <span className="text-hq-textSecondary">{entry.date}</span>
                            <span className="text-hq-textPrimary">
                              1 {entry.fromCurrency} = {Number(entry.rate).toFixed(2)}{' '}
                              {entry.toCurrency}
                            </span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>
                )}
              </div>

              {/* Theme Toggle */}
              <button
                type="button"
                onClick={toggleTheme}
                aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
                className="flex h-9 w-9 items-center justify-center rounded-full border border-hq-borderDefault bg-hq-subtle text-hq-textSecondary hover:bg-hq-elevated hover:text-hq-textPrimary transition-colors"
              >
                {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
              </button>

              {/* Current User Badge on Desktop Topbar */}
              <div className="hidden lg:flex items-center gap-2 rounded-full border border-hq-borderSubtle bg-hq-subtle px-3 py-1.5">
                <span className="text-xs font-medium text-hq-textPrimary max-w-[140px] truncate">
                  {user?.name || user?.email}
                </span>
                {user?.isStaticSuperAdmin ? (
                  <span className="inline-flex items-center gap-1 rounded-full bg-hq-brand px-2 py-0.5 font-ds-mono text-[10px] font-semibold uppercase tracking-wider text-white">
                    <Crown className="h-2.5 w-2.5" />
                    SUPER ADMIN
                  </span>
                ) : (
                  <span className="rounded-full bg-hq-elevated px-2 py-0.5 font-ds-mono text-[10px] uppercase text-hq-textSecondary">
                    {user?.role}
                  </span>
                )}
              </div>

              {/* Sign Out */}
              <button
                type="button"
                onClick={handleSignOut}
                aria-label="Sign out of Thea HQ"
                className="inline-flex h-9 items-center gap-1.5 rounded-full border border-hq-borderDefault px-3 text-xs font-medium text-hq-textSecondary hover:border-hq-out/60 hover:text-hq-out transition-colors"
              >
                <LogOut className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Sign Out</span>
              </button>
            </div>
          </div>

          {/* Mobile FX Sub-Strip */}
          <div className="flex items-center justify-between border-t border-hq-borderSubtle bg-hq-subtle px-4 py-1.5 font-ds-mono text-[11px] tabular-nums sm:hidden">
            <span className="flex items-center gap-1.5 text-hq-textSecondary">
              <span className={`h-2 w-2 rounded-full ${fxDotClass}`} />
              <span>FX: 1 THB = {thbToMmkRate.toFixed(2)} MMK</span>
            </span>
            <span className="text-hq-textMuted">{activeRate ? activeRate.date : 'Fallback'}</span>
          </div>
        </header>

        <main
          id="main-content"
          tabIndex={-1}
          className="mx-auto w-full max-w-[1600px] flex-1 px-4 py-6 sm:px-6 lg:px-8 focus:outline-none"
        >
          <Outlet />
        </main>
      </div>
    </div>
  );
}
