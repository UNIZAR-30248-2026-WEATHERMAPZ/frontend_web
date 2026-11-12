import { getFastestRoute, getRecommendedRoute, getWeightedRouteComparison } from './routesApi.js';

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
    [502, 'No se ha podido calcular'],
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
      greenChangePercentagePoints: null,
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

  describe('getRecommendedRoute (PBI-9.1)', () => {
    const recommendation = {
      criterion: 'hot',
      label: 'Calor',
      reason:
        'Hace calor (sensación de 31 °C): se busca sombra aceptando hasta un 25 % más de tiempo.',
      weights: { shade: 50, sun: 0, wind: 0 },
      maxDetourPercentage: 25,
      weather: {
        temperature: 30,
        windSpeed: 8,
        windDirection: 300,
        observedAt: '2026-07-15T13:00',
      },
      rules: [],
    };
    const shadedRoute = {
      ...route,
      exposure: { status: 'available', shadePercentage: 80, sunPercentage: 20 },
      windExposure: { status: 'available', exposure: 0 },
    };
    const reply = (comparison) => ({ ok: true, json: async () => ({ comparison }) });

    it('posts only the points and keeps the recommendation', async () => {
      const comparison = {
        status: 'selected',
        fastest: shadedRoute,
        selected: shadedRoute,
        additionalDurationSeconds: 60,
        shadeChangePercentagePoints: 60,
        windChangePoints: 0,
        recommendation,
      };
      global.fetch = jest.fn().mockResolvedValue(reply(comparison));

      await expect(getRecommendedRoute({ origin, destination })).resolves.toEqual({
        ...comparison,
        shaded: shadedRoute,
        shadeImprovementPercentagePoints: 60,
        windChangePoints: 0,
        greenChangePercentagePoints: null,
      });
      expect(global.fetch.mock.calls[0][0]).toMatch(/\/routes\/recommended$/);
      // Always for now: no date, time or weights are sent.
      expect(JSON.parse(global.fetch.mock.calls[0][1].body)).toEqual({
        origin: { lat: origin.lat, lng: origin.lng },
        destination: { lat: destination.lat, lng: destination.lng },
      });
    });

    it('accepts the fastest route alone, without shade data, and a missing weather', async () => {
      global.fetch = jest.fn().mockResolvedValue(
        reply({
          status: 'fastest_only',
          fastest: { ...route, windExposure: { status: 'unavailable', exposure: null } },
          selected: null,
          additionalDurationSeconds: null,
          recommendation: {
            ...recommendation,
            criterion: 'weather_unavailable',
            weights: { shade: 0, sun: 0, wind: 0 },
            weather: null,
          },
        })
      );

      await expect(getRecommendedRoute({ origin, destination })).resolves.toMatchObject({
        status: 'fastest_only',
        shaded: null,
        recommendation: { criterion: 'weather_unavailable', weather: null },
      });
    });

    it.each([
      ['without recommendation', { recommendation: undefined }],
      [
        'with weights out of range',
        { recommendation: { ...recommendation, weights: { shade: 150, sun: 0, wind: 0 } } },
      ],
      ['without reason', { recommendation: { ...recommendation, reason: null } }],
      ['with an invalid route', { fastest: { ...shadedRoute, distance: -1 } }],
    ])('rejects a reply %s', async (_case, overrides) => {
      global.fetch = jest.fn().mockResolvedValue(
        reply({
          status: 'no_better_alternative',
          fastest: shadedRoute,
          selected: null,
          additionalDurationSeconds: null,
          recommendation,
          ...overrides,
        })
      );

      await expect(getRecommendedRoute({ origin, destination })).rejects.toThrow(
        'ruta recomendada no válida'
      );
    });

    it('keeps the route error messages', async () => {
      global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 504 });
      await expect(getRecommendedRoute({ origin, destination })).rejects.toThrow(
        'ha tardado demasiado'
      );
    });
  });
});

describe('green percentage in the weighted comparison (PBI-10 phase B)', () => {
  const originalFetch = global.fetch;
  afterEach(() => {
    global.fetch = originalFetch;
  });
  const geometry = {
    type: 'LineString',
    coordinates: [
      [-0.8891, 41.6488],
      [-0.878, 41.656],
    ],
  };
  const greenRoute = (greenPercentage) => ({
    geometry,
    distance: 1000,
    duration: 600,
    exposure: { status: 'unavailable', shadePercentage: null, sunPercentage: null },
    vegetation: { status: 'available', greenPercentage },
  });
  const request = {
    origin: { lat: 41.6488, lng: -0.8891 },
    destination: { lat: 41.656, lng: -0.878 },
    date: '2026-11-12',
    time: '23:00',
    weights: { shade: 0, sun: 0, wind: 0, vegetation: 100 },
  };
  const reply = (selected, greenChangePercentagePoints) => ({
    ok: true,
    json: async () => ({
      comparison: {
        status: 'selected',
        fastest: greenRoute(5),
        selected,
        additionalDurationSeconds: 60,
        greenChangePercentagePoints,
      },
    }),
  });

  it('keeps the green of each route and its change, and sends the vegetation weight', async () => {
    global.fetch = jest.fn().mockResolvedValue(reply(greenRoute(80), 75));

    await expect(getWeightedRouteComparison(request)).resolves.toMatchObject({
      shaded: { vegetation: { greenPercentage: 80 } },
      greenChangePercentagePoints: 75,
    });
    expect(JSON.parse(global.fetch.mock.calls[0][1].body).weights).toEqual(request.weights);
  });

  it('rejects an impossible green percentage', async () => {
    global.fetch = jest.fn().mockResolvedValue(reply(greenRoute(130), 125));

    await expect(getWeightedRouteComparison(request)).rejects.toThrow('comparación no válida');
  });
});
