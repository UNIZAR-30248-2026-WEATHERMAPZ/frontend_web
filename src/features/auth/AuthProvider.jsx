import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

import { getCurrentUser, loginUser, registerUser } from '../../services/api/authApi.js';
import { setUnauthorizedHandler } from '../../services/api/client.js';
import { clearStoredToken, getStoredToken, storeToken } from '../../services/auth/tokenStorage.js';
import { consumeAuthRedirect } from './authRedirect.js';

const SESSION_EXPIRED_MESSAGE = 'Tu sesión ha caducado. Inicia sesión de nuevo.';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [state, setState] = useState({ status: 'checking', user: null, notice: null });
  const redirect = useRef(null);

  const logout = useCallback((notice = null) => {
    clearStoredToken();
    setState({ status: 'anonymous', user: null, notice });
  }, []);

  // Restores the remembered session on start-up, including the token that arrives from the
  // Google login redirect.
  useEffect(() => {
    const controller = new AbortController();
    // A ref keeps the redirect when React runs this effect twice in development.
    redirect.current ??= consumeAuthRedirect();
    if (redirect.current.token) storeToken(redirect.current.token);

    async function restoreSession() {
      const notice = redirect.current.notice ?? null;
      if (!getStoredToken()) {
        setState({ status: 'anonymous', user: null, notice });
        return;
      }
      try {
        const user = await getCurrentUser({ signal: controller.signal });
        setState({ status: 'authenticated', user, notice: null });
      } catch (error) {
        if (controller.signal.aborted) return;
        if (error.status === 401) clearStoredToken();
        setState({ status: 'anonymous', user: null, notice: error.message });
      }
    }

    restoreSession();
    return () => controller.abort();
  }, []);

  useEffect(() => {
    setUnauthorizedHandler(() => logout(SESSION_EXPIRED_MESSAGE));
    return () => setUnauthorizedHandler(null);
  }, [logout]);

  const startSession = useCallback(async (request, input) => {
    const { token, user } = await request(input);
    storeToken(token);
    setState({ status: 'authenticated', user, notice: null });
  }, []);

  const value = useMemo(
    () => ({
      ...state,
      login: (credentials) => startSession(loginUser, credentials),
      register: (data) => startSession(registerUser, data),
      logout: () => logout(),
    }),
    [state, startSession, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside AuthProvider');
  return context;
}
