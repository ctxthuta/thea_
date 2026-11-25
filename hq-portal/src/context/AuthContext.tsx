import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import { apiRequest, setAuthToken, setUnauthorizedHandler } from '@/lib/apiClient';
import type { AuthUser } from '@/types/hq';

interface AuthContextValue {
  user: AuthUser | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<AuthUser>;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshSession = useCallback(async () => {
    try {
      const response = await apiRequest<{ user: AuthUser }>('/api/v1/auth/me', {
        skipUnauthorizedRedirect: true,
      });
      setUser(response.user);
    } catch {
      setUser(null);
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => {
      setUser(null);
      setAuthToken(null);
    });
    void refreshSession();
  }, [refreshSession]);

  const login = useCallback(async (email: string, password: string): Promise<AuthUser> => {
    const response = await apiRequest<{ user: AuthUser; token?: string }>('/api/v1/auth/login', {
      method: 'POST',
      body: { email: email.trim(), password },
      skipUnauthorizedRedirect: true,
    });
    if (response.token) {
      setAuthToken(response.token);
    }
    setUser(response.user);
    return response.user;
  }, []);

  const logout = useCallback(async () => {
    try {
      await apiRequest('/api/v1/auth/logout', {
        method: 'POST',
        skipUnauthorizedRedirect: true,
      });
    } catch {
      // Clear local session state even if network call fails
    } finally {
      setAuthToken(null);
      setUser(null);
    }
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return ctx;
}
