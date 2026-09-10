/**
 * Session state.
 *
 * The source of truth is the httpOnly cookie, which JavaScript cannot read, so
 * "am I signed in?" is answered by asking the server once at boot. Nothing
 * about the user is kept in localStorage — the legacy app stored
 * `isLoggedIn=true` in sessionStorage, which any script could forge.
 */
import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { auth, type MeResponse } from './api';

interface AuthState {
  user: MeResponse | null;
  loading: boolean;
  refresh: () => Promise<void>;
  signOut: () => Promise<void>;
}

const Ctx = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<MeResponse | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = async () => {
    try {
      const { user: me } = await auth.me();
      setUser(me);
    } catch {
      // A 401 here is the normal signed-out case, not an error worth surfacing.
      setUser(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refresh();
  }, []);

  const signOut = async () => {
    await auth.logout().catch(() => undefined);
    setUser(null);
  };

  return <Ctx.Provider value={{ user, loading, refresh, signOut }}>{children}</Ctx.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
