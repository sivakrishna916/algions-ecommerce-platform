import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authApi } from '../api/services';
import { tokenStore } from '../api/client';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(!!tokenStore.get()); // only "loading" if there is a token to verify

  useEffect(() => {
    if (!tokenStore.get()) return undefined;
    let alive = true;
    authApi.me().then((r) => alive && setUser(r.user)).catch(() => tokenStore.clear()).finally(() => alive && setLoading(false));
    return () => { alive = false; };
  }, []);

  useEffect(() => {
    const onExpired = () => setUser(null);
    window.addEventListener('auth:expired', onExpired);
    return () => window.removeEventListener('auth:expired', onExpired);
  }, []);

  const login = useCallback(async (email, password) => {
    const r = await authApi.login({ email, password });
    tokenStore.set(r.token); setUser(r.user); return r.user;
  }, []);
  const register = useCallback(async (data) => {
    const r = await authApi.register(data);
    tokenStore.set(r.token); setUser(r.user); return r.user;
  }, []);
  const logout = useCallback(() => { tokenStore.clear(); setUser(null); }, []);
  const refresh = useCallback(async () => { const r = await authApi.me(); setUser(r.user); return r.user; }, []);

  const value = useMemo(() => ({ user, loading, login, register, logout, refresh, isAdmin: user?.role === 'admin', isCustomer: user?.role === 'customer' }), [user, loading, login, register, logout, refresh]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}
export const useAuth = () => useContext(AuthContext);
