import React from 'react';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { AuthProvider, useAuth } from '@/context/AuthContext';
import { CurrencyProvider } from '@/context/CurrencyContext';
import { ThemeProvider } from '@/context/ThemeContext';
import { ToastProvider } from '@/context/ToastContext';
import { canAccessModule, type PortalModule } from '@/lib/rbac';
import AppShell from '@/components/shell/AppShell';
import LoginPage from '@/pages/LoginPage';
import OverviewPage from '@/pages/OverviewPage';
import CmsPage from '@/pages/cms/CmsPage';
import AssociatesPage from '@/pages/AssociatesPage';
import FinancePage from '@/pages/finance/FinancePage';
import CrmPage from '@/pages/CrmPage';
import AdminPage from '@/pages/AdminPage';

function RequireAuth({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-hq-canvas">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-hq-brandVibrant border-t-transparent" />
          <span className="font-ds-mono text-xs uppercase tracking-wider text-hq-textMuted">
            Verifying session...
          </span>
        </div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname + location.search }} replace />;
  }

  return <>{children}</>;
}

function RequireModule({
  module,
  children,
}: {
  module: PortalModule;
  children: React.ReactNode;
}) {
  const { user } = useAuth();
  if (!canAccessModule(user, module)) {
    return <Navigate to="/" replace />;
  }
  return <>{children}</>;
}

export default function App() {
  return (
    <ThemeProvider>
      <ToastProvider>
        <AuthProvider>
          <CurrencyProvider>
            <BrowserRouter>
              <Routes>
                <Route path="/login" element={<LoginPage />} />
                <Route
                  element={
                    <RequireAuth>
                      <AppShell />
                    </RequireAuth>
                  }
                >
                  <Route index element={<OverviewPage />} />
                  <Route
                    path="cms"
                    element={
                      <RequireModule module="cms">
                        <CmsPage />
                      </RequireModule>
                    }
                  />
                  <Route
                    path="associates"
                    element={
                      <RequireModule module="associates">
                        <AssociatesPage />
                      </RequireModule>
                    }
                  />
                  <Route
                    path="finance"
                    element={
                      <RequireModule module="finance">
                        <FinancePage />
                      </RequireModule>
                    }
                  />
                  <Route
                    path="crm"
                    element={
                      <RequireModule module="crm">
                        <CrmPage />
                      </RequireModule>
                    }
                  />
                  <Route
                    path="admin"
                    element={
                      <RequireModule module="admin">
                        <AdminPage />
                      </RequireModule>
                    }
                  />
                </Route>
                <Route path="*" element={<Navigate to="/" replace />} />
              </Routes>
            </BrowserRouter>
          </CurrencyProvider>
        </AuthProvider>
      </ToastProvider>
    </ThemeProvider>
  );
}
