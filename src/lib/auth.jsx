import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { api, getSession, onSessionExpired, saveSession } from './api';

const AuthCtx = createContext(null);

// The API has no "who am I" endpoint, so admin status is read from the token's role claim
// when present and otherwise probed with the ADMIN-only GET /api/users.
function claimsSayAdmin(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));
    return Object.entries(payload).some(
      ([key, value]) =>
        /role|authorit|scope|group/i.test(key) && JSON.stringify(value).toUpperCase().includes('ADMIN'),
    );
  } catch {
    return false;
  }
}

async function detectAdmin(token) {
  if (claimsSayAdmin(token)) return true;
  try {
    await api.users();
    return true;
  } catch {
    return false;
  }
}

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'loading', user: null });

  const hydrate = useCallback(async (userId) => {
    const user = await api.user(userId);
    const isAdmin = await detectAdmin(getSession().accessToken);
    setState({ status: 'authed', user: { ...user, isAdmin } });
  }, []);

  useEffect(() => {
    onSessionExpired(() => setState({ status: 'anon', user: null }));
    const session = getSession();
    if (!session) {
      setState({ status: 'anon', user: null });
      return;
    }
    hydrate(session.userId).catch(() => {
      saveSession(null);
      setState({ status: 'anon', user: null });
    });
  }, [hydrate]);

  const login = useCallback(
    async (email, password) => {
      const res = await api.login(email, password);
      saveSession({
        userId: res.userId,
        email: res.email,
        accessToken: res.accessToken,
        refreshToken: res.refreshToken,
      });
      try {
        await hydrate(res.userId);
      } catch (err) {
        saveSession(null);
        throw err;
      }
    },
    [hydrate],
  );

  const register = useCallback(
    async (payload) => {
      await api.register(payload);
      await login(payload.email, payload.password);
    },
    [login],
  );

  const logout = useCallback(async () => {
    const session = getSession();
    saveSession(null);
    setState({ status: 'anon', user: null });
    if (session?.refreshToken) await api.logout(session.refreshToken);
  }, []);

  const value = useMemo(() => ({ ...state, login, register, logout }), [state, login, register, logout]);
  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export const useAuth = () => useContext(AuthCtx);
