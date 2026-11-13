import { getFastestRoute, getWeightedRouteComparison } from './routesApi.js';

describe('getFastestRoute', () => {
  const originalFetch = global.fetch;
  const origin = { lat: 41.6488, lng: -0.8891, label: 'Origen', source: 'map' };
  const destination = { lat: 41.656, lng: -0.878, label: 'Destino', source: 'search' };
  const route = {
    geometry: {
      type: 'LineString',
      coordinates: [
        [-0.8891, 41.6488],
        [-0.878, 41.656],
      ],
    },
    distance: 1250.4,
    duration: 930.2,
  };

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('posts only the selected coordinates and returns the route', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ route }),
    });
    const { signal } = new AbortController();

    await expect(getFastestRoute({ origin, destination }, { signal })).resolves.toEqual(route);
    expect(global.fetch).toHaveBeenCalledWith('/api/routes/fastest', {
      method: 'POST',
      signal,
      body: JSON.stringify({
        origin: { lat: 41.6488, lng: -0.8891 },
        destination: { lat: 41.656, lng: -0.878 },
      }),
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it.each([
    null,
    {},
    { route: {} },
    { route: { ...route, geometry: { type: 'Point', coordinates: [-0.8891, 41.6488] } } },
    { route: { ...route, distance: -1 } },
    { route: { ...route, duration: '930.2' } },
  ])('rejects an invalid route response', async (body) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: true, json: async () => body });
    await expect(getFastestRoute({ origin, destination })).rejects.toThrow(
      'El servidor ha devuelto una ruta no válida'
    );
  });

  it.each([
    [400, 'no son válidos'],
    [429, 'está ocupado'],
    [503, 'no está configurado'],
    [504, 'ha tardado demasiado'],
    [502, 'OpenRouteService no ha podido responder'],
  ])('shows a route-specific message for status %s', async (status, message) => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status });
    await expect(getFastestRoute({ origin, destination })).rejects.toThrow(message);
  });

  it('posts the solar instant and the weights and validates the comparison', async () => {
    const environmentalRoute = {
      ...route,
      exposure: {
        status: 'available',
        shadePercentage: 60,
        sunPercentage: 40,
      },
    };
    const comparison = {
      status: 'selected',
      fastest: {
        ...environmentalRoute,
        exposure: { ...environmentalRoute.exposure, shadePercentage: 20, sunPercentage: 80 },
      },
      selected: environmentalRoute,
      additionalDurationSeconds: 120,
      shadeChangePercentagePoints: 40,
    };
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ comparison }),
    });

    await expect(
      getWeightedRouteComparison({
        origin,
        destination,
        date: '2026-06-21',
        time: '14:00',
        timeZone: 'Europe/Madrid',
        weights: { shade: 50, sun: 0 },
      })
    ).resolves.toEqual({
      ...comparison,
      // The chosen route takes the place of the shaded one in the app.
      shaded: environmentalRoute,
      shadeImprovementPercentagePoints: 40,
      windChangePoints: null,
    });
    expect(global.fetch.mock.calls[0][0]).toMatch(/\/routes\/weighted$/);
    expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      date: '2026-06-21',
      time: '14:00',
      timeZone: 'Europe/Madrid',
      weights: { shade: 50, sun: 0 },
    });
  });

  it('accepts the wind exposure of each route and rejects an impossible one (PBI-8.2)', async () => {
    const windyRoute = (exposure) => ({
      ...route,
      exposure: { status: 'unavailable', shadePercentage: null, sunPercentage: null },
      windExposure: { status: 'available', exposure },
    });
    const reply = (fastest) => ({
      ok: true,
      json: async () => ({
        comparison: {
          status: 'selected',
          fastest,
          selected: windyRoute(30),
          additionalDurationSeconds: 60,
          shadeChangePercentagePoints: null,
          windChangePoints: -60,
        },
      }),
    });
    const request = {
      origin,
      destination,
      date: '2026-11-06',
      time: '23:00',
      weights: { shade: 0, sun: 0, wind: 100 },
    };
    global.fetch = jest
      .fn()
      .mockResolvedValueOnce(reply(windyRoute(90)))
      .mockResolvedValueOnce(reply(windyRoute(140)));

    await expect(getWeightedRouteComparison(request)).resolves.toMatchObject({
      shaded: { windExposure: { exposure: 30 } },
      windChangePoints: -60,
    });
    await expect(getWeightedRouteComparison(request)).rejects.toThrow('comparación no válida');
  });

  it('rejects invented or out-of-range shaded metrics', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        comparison: {
          status: 'selected',
          fastest: {
            ...route,
            exposure: { status: 'available', shadePercentage: 120, sunPercentage: -20 },
          },
          selected: null,
          additionalDurationSeconds: null,
        },
      }),
    });

    await expect(
      getWeightedRouteComparison({
        origin,
        destination,
        date: '2026-06-21',
        time: '14:00',
        weights: { shade: 50, sun: 0 },
      })
    ).rejects.toThrow('comparación no válida');
  });
});
