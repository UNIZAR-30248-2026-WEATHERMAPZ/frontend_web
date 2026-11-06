import {
  createRouteProfile,
  deleteRouteProfile,
  listRouteProfiles,
  updateRouteProfile,
} from './routeProfilesApi.js';

const profile = {
  id: 4,
  name: 'Verano',
  presetKey: null,
  weights: { shade: 80, sun: 0, wind: 20 },
  maxDetourPercentage: 10,
};
const draft = { name: 'Verano', weights: profile.weights, maxDetourPercentage: 10 };
const reply = (status, body) => ({ ok: status < 400, status, json: async () => body });

describe('routeProfilesApi', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('lists, creates and updates the routes of the user', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(reply(200, { profiles: [profile] }))
      .mockResolvedValueOnce(reply(201, { profile }))
      .mockResolvedValueOnce(reply(200, { profile }));

    await expect(listRouteProfiles()).resolves.toEqual([profile]);
    await expect(createRouteProfile(draft)).resolves.toEqual(profile);
    await expect(updateRouteProfile(4, draft)).resolves.toEqual(profile);

    const [, created, updated] = global.fetch.mock.calls;
    expect(created[0]).toMatch(/\/route-profiles$/);
    expect(created[1]).toMatchObject({ method: 'POST' });
    expect(JSON.parse(created[1].body)).toEqual(draft);
    expect(updated[0]).toMatch(/\/route-profiles\/4$/);
    expect(updated[1]).toMatchObject({ method: 'PUT' });
  });

  it('rejects a saved route with an impossible extra time', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(reply(200, { profiles: [{ ...profile, maxDetourPercentage: 90 }] }));

    await expect(listRouteProfiles()).rejects.toThrow('no válida');
  });

  it('rejects routes with impossible weights', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValue(
        reply(200, { profiles: [{ ...profile, weights: { shade: 150, sun: 0 } }] })
      );

    await expect(listRouteProfiles()).rejects.toThrow('no válida');
  });

  it('gives a wind weight of 0 to routes from a backend without wind and checks it otherwise', async () => {
    const withoutWind = { ...profile, weights: { shade: 80, sun: 0 } };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(reply(200, { profiles: [withoutWind] }))
      .mockResolvedValueOnce(
        reply(200, { profiles: [{ ...profile, weights: { shade: 0, sun: 0, wind: 150 } }] })
      );

    await expect(listRouteProfiles()).resolves.toEqual([
      { ...withoutWind, weights: { shade: 80, sun: 0, wind: 0 } },
    ]);
    await expect(listRouteProfiles()).rejects.toThrow('no válida');
  });

  it('keeps the field errors of the server', async () => {
    global.fetch = jest.fn().mockResolvedValue(
      reply(409, {
        error: { message: 'Duplicada', fields: { name: 'Ya tienes una ruta con ese nombre.' } },
      })
    );

    await expect(
      createRouteProfile({ name: 'Rápida', weights: profile.weights })
    ).rejects.toMatchObject({
      status: 409,
      fields: { name: 'Ya tienes una ruta con ese nombre.' },
    });
  });

  it('explains the limit of saved routes', async () => {
    global.fetch = jest.fn().mockResolvedValue(reply(409, { error: { message: 'Máximo' } }));

    await expect(createRouteProfile({ name: 'Otra', weights: profile.weights })).rejects.toThrow(
      'No puedes guardar más rutas'
    );
  });

  it('deletes a route, and one already gone counts as deleted', async () => {
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce({ ok: true, status: 204, json: async () => null })
      .mockResolvedValueOnce(reply(404, { error: { message: 'No existe' } }))
      .mockResolvedValueOnce(reply(500, { error: { message: 'Error' } }));

    await expect(deleteRouteProfile(4)).resolves.toBeUndefined();
    await expect(deleteRouteProfile(4)).resolves.toBeUndefined();
    await expect(deleteRouteProfile(4)).rejects.toThrow('No se ha podido borrar');
    expect(global.fetch.mock.calls[0][1]).toMatchObject({ method: 'DELETE' });
  });
});
