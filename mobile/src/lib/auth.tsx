import { useQueryClient } from '@tanstack/react-query';
import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { api, refreshAccess, tokens } from './api';
import type { User } from './types';

type Status = 'loading' | 'signedOut' | 'signedIn';

export interface RegisterPayload {
  email: string;
  password: string;
  first_name: string;
  last_name: string;
  phone?: string;
  invite_code?: string;
  gym_name?: string;
}

interface AuthContextValue {
  status: Status;
  user: User | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (payload: RegisterPayload) => Promise<void>;
  signOut: () => Promise<void>;
  reloadUser: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [status, setStatus] = useState<Status>('loading');
  const [user, setUser] = useState<User | null>(null);

  const signOut = useCallback(async () => {
    await tokens.clear();
    queryClient.clear();
    setUser(null);
    setStatus('signedOut');
  }, [queryClient]);

  const reloadUser = useCallback(async () => {
    const me = await api.get<User>('/auth/me');
    setUser(me);
    setStatus('signedIn');
  }, []);

  useEffect(() => {
    tokens.onExpired(() => {
      queryClient.clear();
      setUser(null);
      setStatus('signedOut');
    });
    (async () => {
      // Session persistée : on repart du refresh token stocké dans le Keychain
      if (await refreshAccess()) {
        try {
          await reloadUser();
          return;
        } catch {
          /* token invalide */
        }
      }
      setStatus('signedOut');
    })();
  }, [queryClient, reloadUser]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const data = await api.post<{ access: string; refresh: string }>('/auth/token', { email, password });
      await tokens.set(data.access, data.refresh);
      await reloadUser();
    },
    [reloadUser],
  );

  const register = useCallback(async (payload: RegisterPayload) => {
    const data = await api.post<{ access: string; refresh: string; user: User }>('/auth/register', payload);
    await tokens.set(data.access, data.refresh);
    setUser(data.user);
    setStatus('signedIn');
  }, []);

  const value = useMemo(
    () => ({ status, user, signIn, register, signOut, reloadUser }),
    [status, user, signIn, register, signOut, reloadUser],
  );
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth doit être utilisé dans <AuthProvider>');
  return ctx;
}

/** Utilisateur connecté (garanti non nul dans le groupe (app)). */
export function useUser(): User {
  const { user } = useAuth();
  if (!user) throw new Error('Utilisateur non connecté');
  return user;
}
