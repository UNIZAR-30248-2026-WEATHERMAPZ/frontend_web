import { getCurrentUser, GOOGLE_LOGIN_URL, loginUser, registerUser } from './authApi.js';

describe('authApi', () => {
  const originalFetch = global.fetch;
  const user = { id: 7, name: 'Ana López', email: 'ana@correo.es' };
  const respond = (body, status = 200) =>
    jest.fn().mockResolvedValue({ ok: status < 400, status, json: async () => body });

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('registers a user and returns the session', async () => {
    global.fetch = respond({ token: 'jwt', user }, 201);

    await expect(
      registerUser({ name: 'Ana López', email: 'ana@correo.es', password: 'segura123' })
    ).resolves.toEqual({ token: 'jwt', user });
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/register', {
      method: 'POST',
      body: JSON.stringify({ name: 'Ana López', email: 'ana@correo.es', password: 'segura123' }),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('logs in with email and password only', async () => {
    global.fetch = respond({ token: 'jwt', user });

    await loginUser({ email: 'ana@correo.es', password: 'segura123' });

    expect(global.fetch.mock.calls[0][1].body).toBe(
      JSON.stringify({ email: 'ana@correo.es', password: 'segura123' })
    );
  });

  it.each([
    [401, 'El correo o la contraseña no son correctos.'],
    [409, 'Ya existe una cuenta con este correo electrónico.'],
    [503, 'El inicio de sesión no está disponible ahora mismo.'],
    [500, 'No se ha podido completar la operación.'],
  ])('shows a clear message for status %s', async (status, message) => {
    global.fetch = respond({ error: { message: 'server text' } }, status);

    await expect(loginUser({ email: 'a@b.es', password: 'x' })).rejects.toThrow(message);
  });

  it.each([null, { token: 'jwt' }, { token: '', user }, { token: 'jwt', user: { id: '7' } }])(
    'rejects an invalid session response %#',
    async (body) => {
      global.fetch = respond(body);

      await expect(loginUser({ email: 'a@b.es', password: 'x' })).rejects.toThrow(
        'respuesta no válida'
      );
    }
  );

  it('reads the current user', async () => {
    global.fetch = respond({ user });

    await expect(getCurrentUser()).resolves.toEqual(user);
    expect(global.fetch).toHaveBeenCalledWith('/api/auth/me', {
      signal: undefined,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('reports an expired session and an invalid current user', async () => {
    global.fetch = respond({}, 401);
    await expect(getCurrentUser()).rejects.toMatchObject({
      status: 401,
      message: 'Tu sesión ha caducado. Inicia sesión de nuevo.',
    });

    global.fetch = respond({ user: null });
    await expect(getCurrentUser()).rejects.toThrow('respuesta no válida');
  });

  it('points the Google button at the backend', () => {
    expect(GOOGLE_LOGIN_URL).toBe('/api/auth/google');
  });
});
