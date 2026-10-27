import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import { fetchAsmMe, loginWithPassword, logoutSession, verifyMfa } from './authApi.js';
import {
  clearMemoryAccessToken,
  getMemoryAccessToken,
  setMemoryAccessToken,
} from './tokenBridge.js';
import { HOST_ORIGIN } from './config.js';
import { useIsHostShell } from './ShellContext.jsx';

const AuthContext = createContext(null);

/**
 * Session for ASM module.
 * - Host shell: login is owned by @qvoyant/host; we only probe ASM `/auth/me`
 *   via the shared httpOnly `accessToken` cookie (never show a second login).
 * - Standalone: optional local login against nxradar-auth-server.
 */
export function AuthProvider({ children }) {
  const isHostShell = useIsHostShell();
  const [status, setStatus] = useState('loading'); // loading | authenticated | anonymous
  const [user, setUser] = useState(null);
  const [organizationId, setOrganizationId] = useState(null);
  const [error, setError] = useState(null);

  const bootstrap = useCallback(async (token = null) => {
    setStatus('loading');
    setError(null);
    try {
      const me = await fetchAsmMe(token);
      setUser(me.user || null);
      setOrganizationId(me.user?.orgId || me.auth?.orgId || null);
      setStatus('authenticated');
      return me;
    } catch (err) {
      setUser(null);
      setOrganizationId(null);
      setStatus('anonymous');
      throw err;
    }
  }, []);

  useEffect(() => {
    bootstrap(null).catch(() => {
      /* host: stay anonymous for display; APIs use cookie. standalone: RequireAuth handles UI */
    });
  }, [bootstrap]);

  const applySession = useCallback(
    async (session, fallbackEmail) => {
      setMemoryAccessToken(session.authToken);
      if (session.organizationId) setOrganizationId(session.organizationId);
      try {
        await bootstrap(session.authToken);
      } catch (err) {
        if (session.authToken && session.user) {
          setUser({
            id: session.user._id || session.user.id,
            email: session.user.email || fallbackEmail,
            orgId: session.organizationId,
          });
          setStatus('authenticated');
          return session;
        }
        setError(err.message || 'Session check failed');
        throw err;
      }
      return session;
    },
    [bootstrap],
  );

  const login = useCallback(
    async ({ email, password }) => {
      if (isHostShell) {
        throw new Error('Sign in through the host shell (http://localhost:5173).');
      }
      setError(null);
      const session = await loginWithPassword({ email, password });
      if (session.mfaRequired) return session;
      return applySession(session, email);
    },
    [applySession, isHostShell],
  );

  const completeMfa = useCallback(
    async ({ mfaChallengeToken, method, code, email, password }) => {
      if (isHostShell) {
        throw new Error('Sign in through the host shell (http://localhost:5173).');
      }
      setError(null);
      const session = await verifyMfa({
        mfaChallengeToken,
        method,
        code,
        email,
        password,
      });
      return applySession(session, email);
    },
    [applySession, isHostShell],
  );

  const logout = useCallback(async () => {
    if (isHostShell) {
      // Host owns session chrome — send user to host root (host login / logout).
      window.location.assign(`${HOST_ORIGIN}/`);
      return;
    }
    await logoutSession(getMemoryAccessToken());
    clearMemoryAccessToken();
    setUser(null);
    setOrganizationId(null);
    setStatus('anonymous');
  }, [isHostShell]);

  const value = useMemo(
    () => ({
      status,
      user,
      organizationId,
      error,
      login,
      completeMfa,
      logout,
      refresh: () => bootstrap(getMemoryAccessToken()),
      isAuthenticated: status === 'authenticated',
      isHostShell,
    }),
    [status, user, organizationId, error, login, completeMfa, logout, bootstrap, isHostShell],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
