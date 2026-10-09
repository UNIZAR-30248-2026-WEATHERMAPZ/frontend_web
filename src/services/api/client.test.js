import { apiRequest, setUnauthorizedHandler } from './client.js';

describe('apiRequest', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  it('uses the configured base and forwards cancellation and merged headers', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });
    const { signal } = new AbortController();
    await expect(
      apiRequest('/geocoding/autocomplete', { signal, headers: { Accept: 'application/json' } })
    ).resolves.toEqual({ results: [] });
    expect(global.fetch).toHaveBeenCalledWith('/api/geocoding/autocomplete', {
      signal,
      headers: { Accept: 'application/json', 'Content-Type': 'application/json' },
    });
  });
  it.each([
    [429, 'ocupada'],
    [503, 'no está configurada'],
    [504, 'tardado demasiado'],
    [502, 'no está disponible'],
  ])('provides a safe message for status %s', async (status, message) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
    await expect(apiRequest('/geocoding/autocomplete')).rejects.toThrow(message);
  });
  it('supports endpoint-specific errors without forwarding client options to fetch', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 504 });
    await expect(
      apiRequest('/routes/fastest', {
        method: 'POST',
        errorMessages: { 504: 'Tiempo de ruta agotado.' },
        fallbackErrorMessage: 'Ruta no disponible.',
      })
    ).rejects.toThrow('Tiempo de ruta agotado.');
    expect(global.fetch).toHaveBeenCalledWith('/api/routes/fastest', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    });
  });

  describe('authentication', () => {
    afterEach(() => {
      window.localStorage.clear();
      setUnauthorizedHandler(null);
    });

    it('sends the stored session token', async () => {
      window.localStorage.setItem('weathermapz.authToken', 'session-token');
      global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => ({}) });

      await apiRequest('/auth/me');

      expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', {
        headers: { 'Content-Type': 'application/json', Authorization: 'Bearer session-token' },
      });
    });

    it('exposes the status and the field errors returned by the backend', async () => {
      global.fetch = jest.fn().mockResolvedValue({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'x', fields: { email: 'Correo no válido.' } } }),
      });

      await expect(
        apiRequest('/auth/register', { errorMessages: { 400: 'Revisa los datos.' } })
      ).rejects.toMatchObject({
        message: 'Revisa los datos.',
        status: 400,
        fields: { email: 'Correo no válido.' },
      });
    });

    it('notifies an expired session only when a token was sent', async () => {
      const onUnauthorized = jest.fn();
      setUnauthorizedHandler(onUnauthorized);
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 401 });

      await expect(apiRequest('/auth/login')).rejects.toMatchObject({ status: 401 });
      expect(onUnauthorized).not.toHaveBeenCalled();

      window.localStorage.setItem('weathermapz.authToken', 'expired-token');
      await expect(apiRequest('/routes/fastest')).rejects.toMatchObject({ status: 401 });
      expect(onUnauthorized).toHaveBeenCalledTimes(1);
    });
  });
});
