import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { authApi, type User } from '@/lib/api';
import { clearCookies } from '@/lib/cookie-jar';

interface AuthContextValue {
  user: User | null;
  isLoading: boolean;
  login: (mobile: string, password: string) => Promise<void>;
  register: (body: {
    firstName: string;
    lastName: string;
    mobile: string;
    pan: string;
    address?: string;
    password: string;
  }) => Promise<void>;
  logout: () => Promise<void>;
  refresh: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  const refresh = useCallback(async () => {
    try {
      const { user: me } = await authApi.me();
      setUser(me);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    (async () => {
      await refresh();
      setIsLoading(false);
    })();
  }, [refresh]);

  const login = useCallback(async (mobile: string, password: string) => {
    const { user: u } = await authApi.login({ mobile, password });
    setUser(u);
  }, []);

  const register = useCallback(
    async (body: {
      firstName: string;
      lastName: string;
      mobile: string;
      pan: string;
      address?: string;
      password: string;
    }) => {
      const { user: u } = await authApi.register(body);
      setUser(u);
    },
    [],
  );

  const logout = useCallback(async () => {
    try {
      await authApi.logout();
    } finally {
      // Safety net on native: drop the persisted session cookie too.
      await clearCookies().catch(() => {});
      setUser(null);
    }
  }, []);

  const value = useMemo(
    () => ({ user, isLoading, login, register, logout, refresh }),
    [user, isLoading, login, register, logout, refresh],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
