import { getCurrentWeather } from './weatherApi.js';

describe('getCurrentWeather', () => {
  const originalFetch = global.fetch;
  const weather = {
    temperature: 17.5,
    temperatureUnit: '°C',
    windSpeed: 9.2,
    windSpeedUnit: 'km/h',
    windDirection: 240,
    windDirectionUnit: '°',
    weatherCode: 3,
    time: '2026-11-12T13:00',
    timeZone: 'Europe/Madrid',
  };

  afterEach(() => {
    global.fetch = originalFetch;
  });

  it('gets current weather through the authenticated API client', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ weather }),
    });
    const { signal } = new AbortController();

    await expect(getCurrentWeather({ signal })).resolves.toEqual(weather);
    expect(global.fetch).toHaveBeenCalledWith('/api/weather/current', {
      signal,
      headers: { 'Content-Type': 'application/json' },
    });
  });

  it('shows a clear error when the weather provider is unavailable', async () => {
    global.fetch = jest.fn().mockResolvedValue({ ok: false, status: 502 });

    await expect(getCurrentWeather()).rejects.toThrow('Open-Meteo no está disponible');
  });

  it('rejects an invalid response instead of showing invented values', async () => {
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ weather: { ...weather, windSpeed: null } }),
    });

    await expect(getCurrentWeather()).rejects.toThrow('datos meteorológicos no válidos');
  });
});
