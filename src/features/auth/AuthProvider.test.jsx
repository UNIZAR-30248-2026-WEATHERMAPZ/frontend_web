import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { getCurrentUser, loginUser, registerUser } from '../../services/api/authApi.js';
import { apiRequest } from '../../services/api/client.js';
import { AuthProvider, useAuth } from './AuthProvider.jsx';

jest.mock('../../services/api/authApi.js', () => ({
  getCurrentUser: jest.fn(),
  loginUser: jest.fn(),
  registerUser: jest.fn(),
}));

const user = { id: 7, name: 'Ana López', email: 'ana@correo.es' };

function Probe() {
  const auth = useAuth();
  return (
    <div>
      <span data-testid="status">{auth.status}</span>
      <span data-testid="user">{auth.user?.name ?? 'none'}</span>
      <span data-testid="notice">{auth.notice ?? 'none'}</span>
      <button type="button" onClick={() => auth.login({ email: 'a', password: 'b' })}>
        login
      </button>
      <button type="button" onClick={() => auth.register({ name: 'n' })}>
        register
      </button>
      <button type="button" onClick={auth.logout}>
        logout
      </button>
    </div>
  );
}

function renderProvider() {
  return render(
    <AuthProvider>
      <Probe />
    </AuthProvider>
  );
}

describe('AuthProvider', () => {
  const originalFetch = global.fetch;

  beforeEach(() => {
    jest.resetAllMocks();
    window.localStorage.clear();
    window.history.replaceState(null, '', '/');
  });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('starts anonymous without a stored token', async () => {
    renderProvider();

    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(getCurrentUser).not.toHaveBeenCalled();
  });

  it('restores a remembered session', async () => {
    window.localStorage.setItem('weathermapz.authToken', 'jwt');
    getCurrentUser.mockResolvedValue(user);

    renderProvider();

    expect(screen.getByTestId('status')).toHaveTextContent('checking');
    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(screen.getByTestId('user')).toHaveTextContent('Ana López');
  });

  it('forgets an expired token', async () => {
    window.localStorage.setItem('weathermapz.authToken', 'old');
    getCurrentUser.mockRejectedValue(
      Object.assign(new Error('Tu sesión ha caducado. Inicia sesión de nuevo.'), { status: 401 })
    );

    renderProvider();

    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(screen.getByTestId('notice')).toHaveTextContent('Tu sesión ha caducado');
    expect(window.localStorage.getItem('weathermapz.authToken')).toBeNull();
  });

  it('keeps the token when the session cannot be checked for other reasons', async () => {
    window.localStorage.setItem('weathermapz.authToken', 'jwt');
    getCurrentUser.mockRejectedValue(
      Object.assign(new Error('No se ha podido comprobar tu sesión.'), { status: 502 })
    );

    renderProvider();

    expect(await screen.findByText('anonymous')).toBeInTheDocument();
    expect(window.localStorage.getItem('weathermapz.authToken')).toBe('jwt');
  });

  it('stores the token that comes back from Google', async () => {
    window.history.replaceState(null, '', '/#authToken=google-jwt');
    getCurrentUser.mockResolvedValue(user);

    renderProvider();

    expect(await screen.findByText('authenticated')).toBeInTheDocument();
    expect(window.localStorage.getItem('weathermapz.authToken')).toBe('google-jwt');
    expect(window.location.hash).toBe('');
  });

  it('shows the Google error notice', async () => {
    window.history.replaceState(null, '', '/#authError=google');

    renderProvider();

    expect(
      await screen.findByText(/No se ha podido iniciar sesión con Google/)
    ).toBeInTheDocument();
  });

  it('logs in, registers and logs out', async () => {
    loginUser.mockResolvedValue({ token: 'jwt-login', user });
    registerUser.mockResolvedValue({ token: 'jwt-register', user });
    renderProvider();
    await screen.findByText('anonymous');

    await userEvent.click(screen.getByRole('button', { name: 'login' }));
    expect(screen.getByTestId('status')).toHaveTextContent('authenticated');
    expect(window.localStorage.getItem('weathermapz.authToken')).toBe('jwt-login');

    await userEvent.click(screen.getByRole('button', { name: 'logout' }));
    expect(screen.getByTestId('status')).toHaveTextContent('anonymous');
    expect(window.localStorage.getItem('weathermapz.authToken')).toBeNull();

    await userEvent.click(screen.getByRole('button', { name: 'register' }));
    expect(window.localStorage.getItem('weathermapz.authToken')).toBe('jwt-register');
  });

  it('logs out when any request reports an expired session', async () => {
    window.localStorage.setItem('weathermapz.authToken', 'jwt');
    getCurrentUser.mockResolvedValue(user);
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });
    renderProvider();
    await screen.findByText('authenticated');

    await act(async () => {
      await apiRequest('/routes/fastest').catch(() => {});
    });

    await waitFor(() => expect(screen.getByTestId('status')).toHaveTextContent('anonymous'));
    expect(screen.getByTestId('notice')).toHaveTextContent('Tu sesión ha caducado');
  });

  it('requires the provider', () => {
    jest.spyOn(window.console, 'error').mockImplementation(() => {});
    expect(() => render(<Probe />)).toThrow('useAuth must be used inside AuthProvider');
  });
});
