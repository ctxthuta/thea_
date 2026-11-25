import React, { useState } from 'react';
import { Navigate, useLocation, useNavigate } from 'react-router-dom';
import { AlertCircle, Eye, EyeOff, Lock, Moon, Sun } from 'lucide-react';
import { useAuth } from '@/context/AuthContext';
import { useTheme } from '@/context/ThemeContext';
import { ApiError } from '@/lib/apiClient';

export default function LoginPage() {
  const { user, loading, login } = useAuth();
  const { theme, toggleTheme } = useTheme();
  const navigate = useNavigate();
  const location = useLocation();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const redirectTo =
    (location.state as { from?: string } | null)?.from &&
    (location.state as { from?: string }).from !== '/login'
      ? (location.state as { from?: string }).from!
      : '/';

  if (!loading && user) {
    return <Navigate to={redirectTo} replace />;
  }

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setErrorMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !trimmedEmail.includes('@')) {
      setErrorMessage('Enter a valid work email address.');
      return;
    }
    if (!password) {
      setErrorMessage('Enter your account password.');
      return;
    }

    setIsSubmitting(true);
    try {
      await login(trimmedEmail, password);
      navigate(redirectTo, { replace: true });
    } catch (err) {
      if (err instanceof ApiError) {
        setErrorMessage(err.problem.detail || err.problem.title || 'Invalid email or password.');
      } else {
        setErrorMessage('Unable to reach Thea HQ authentication service. Try again.');
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const brandLogoSrc =
    theme === 'dark' ? '/dark_tranStacked_logo.png' : '/light_tranStacked_logo.png';

  return (
    <div className="relative flex min-h-[100dvh] flex-col justify-between bg-hq-canvas px-4 py-6 text-hq-textPrimary">
      <div aria-hidden="true" className="pointer-events-none fixed inset-0 overflow-hidden">
        <div
          className="absolute left-1/2 top-1/3 h-[420px] w-[560px] -translate-x-1/2 -translate-y-1/2 rounded-full blur-[150px]"
          style={{
            background:
              theme === 'dark' ? 'rgba(95, 31, 47, 0.24)' : 'rgba(95, 31, 47, 0.08)',
          }}
        />
      </div>

      <header className="relative z-10 mx-auto flex w-full max-w-5xl items-center justify-between">
        <div className="flex items-center gap-2.5">
          <img
            src={brandLogoSrc}
            alt="Thea Solutions"
            className="h-11 w-auto object-contain"
          />
          <span className="rounded border border-hq-borderDefault bg-hq-surface px-2 py-0.5 font-ds-mono text-[10px] font-semibold uppercase tracking-[0.14em] text-hq-textMuted">
            HQ
          </span>
        </div>

        <button
          type="button"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'}
          className="inline-flex h-10 items-center gap-2 rounded-full border border-hq-borderDefault bg-hq-surface px-3.5 text-xs font-medium text-hq-textSecondary hover:bg-hq-elevated hover:text-hq-textPrimary transition-colors"
        >
          {theme === 'dark' ? <Sun className="h-3.5 w-3.5" /> : <Moon className="h-3.5 w-3.5" />}
          <span>{theme === 'dark' ? 'Light' : 'Dark'}</span>
        </button>
      </header>

      <main className="relative z-10 mx-auto my-8 w-full max-w-[420px]">
        <div className="hq-card overflow-hidden border-hq-brand/40">
          <div className="h-1 w-full bg-gradient-to-r from-hq-brand via-hq-brandVibrant to-hq-brand" />
          <div className="p-6 sm:p-8">
            <div className="flex flex-col items-center text-center">
              <h1 className="sr-only">Thea Solutions Internal Operating Portal</h1>
              <img
                src={brandLogoSrc}
                alt="Thea Solutions"
                className="h-28 sm:h-32 w-auto object-contain"
              />
              <p className="mt-3 font-ds-mono text-[11px] uppercase tracking-[0.14em] text-hq-brandSoft">
                Internal Operating Portal
              </p>
            </div>

            <div className="my-6 border-t border-hq-borderSubtle" />

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div>
                <label
                  htmlFor="hq-login-email"
                  className="mb-1.5 block text-xs font-medium text-hq-textSecondary"
                >
                  Work Email
                </label>
                <input
                  id="hq-login-email"
                  name="email"
                  type="email"
                  autoComplete="username"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@theasolutions.co"
                  aria-invalid={errorMessage !== null}
                  className="hq-input h-12 sm:h-10 w-full px-3.5 text-base sm:text-sm"
                />
              </div>

              <div>
                <label
                  htmlFor="hq-login-password"
                  className="mb-1.5 block text-xs font-medium text-hq-textSecondary"
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="hq-login-password"
                    name="password"
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    aria-invalid={errorMessage !== null}
                    className="hq-input h-12 sm:h-10 w-full pl-3.5 pr-11 text-base sm:text-sm"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((prev) => !prev)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    aria-pressed={showPassword}
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded-md p-2 text-hq-textMuted hover:text-hq-textPrimary"
                  >
                    {showPassword ? (
                      <EyeOff className="h-4 w-4" />
                    ) : (
                      <Eye className="h-4 w-4" />
                    )}
                  </button>
                </div>
              </div>

              <div className="min-h-[24px]">
                {errorMessage && (
                  <div
                    role="alert"
                    className="flex items-start gap-2 rounded-lg border border-hq-out/40 bg-hq-outBg px-3 py-2.5 text-xs text-hq-out"
                  >
                    <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
                    <span>{errorMessage}</span>
                  </div>
                )}
              </div>

              <button
                type="submit"
                disabled={isSubmitting}
                aria-busy={isSubmitting}
                className="hq-btn-primary flex h-12 sm:h-11 w-full items-center justify-center gap-2 px-5 text-sm"
              >
                <Lock className="h-4 w-4" />
                <span>{isSubmitting ? 'Signing In...' : 'Sign In'}</span>
              </button>
            </form>

            <p className="mt-6 text-center text-xs text-hq-textMuted leading-relaxed">
              Authorized personnel only. Contact your Super Admin to request or modify access.
            </p>
          </div>
        </div>
      </main>

      <footer className="relative z-10 mx-auto flex w-full max-w-5xl flex-wrap items-center justify-center gap-x-4 gap-y-1 font-ds-mono text-[11px] uppercase tracking-wider text-hq-textMuted">
        <span>HQ.THEASOLUTIONS.CO</span>
        <span aria-hidden="true">|</span>
        <span>PROTECTED ACCESS</span>
      </footer>
    </div>
  );
}
