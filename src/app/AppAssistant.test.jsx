import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App.jsx';
import { askRouteAssistant } from '../services/api/routeAssistantApi.js';
import {
  getRoutePreferences,
  getWeatherSuggestion,
  saveRoutePreferences,
} from '../services/api/routePreferencesApi.js';
import {
  listRecentPlaces,
  listRouteFavorites,
  recordRecentPlaces,
} from '../services/api/routeHistoryApi.js';
import { getFastestRoute, getPreferredRouteComparison } from '../services/api/routesApi.js';

// The route assistant (PBI-9.2) inside the app: the API is simulated.
jest.mock('../services/api/geocodingApi.js', () => ({
  autocompletePlaces: jest.fn(),
  reversePlace: jest.fn().mockResolvedValue({ place: null }),
}));
jest.mock('../services/api/routesApi.js', () => ({
  getFastestRoute: jest.fn(),
  getPreferredRouteComparison: jest.fn(),
}));
jest.mock('../services/api/routeAssistantApi.js', () => ({ askRouteAssistant: jest.fn() }));
jest.mock('../services/api/routeHistoryApi.js', () => ({
  listRecentPlaces: jest.fn(),
  listRouteFavorites: jest.fn(),
  recordRecentPlaces: jest.fn(),
  clearRecentPlaces: jest.fn(),
  addRouteFavorite: jest.fn(),
  removeRouteFavorite: jest.fn(),
}));
jest.mock('../services/api/routePreferencesApi.js', () => ({
  ...jest.requireActual('../services/api/routePreferencesApi.js'),
  getRoutePreferences: jest.fn(),
  getWeatherSuggestion: jest.fn(),
  saveRoutePreferences: jest.fn(),
}));
jest.mock('../features/weather/WeatherPanel.jsx', () => ({
  WeatherPanel: () => <section data-testid="weather-panel" />,
}));
jest.mock('../features/map/MapView.jsx', () => ({
  MapView: ({ onSelectPoint, fastestRoute, shadedRoute, selectedRouteType, assistantButton }) => {
    let geometry = 'none';
    if (fastestRoute) geometry = JSON.stringify(fastestRoute.geometry.coordinates);
    if (selectedRouteType === 'shaded' && shadedRoute) {
      geometry = JSON.stringify(shadedRoute.geometry.coordinates);
    }
    return (
      <div data-testid="map-view">
        <button onClick={() => onSelectPoint({ lat: 41.65, lng: -0.89, source: 'map' })}>
          Select map point
        </button>
        <span data-testid="route-geometry">{geometry}</span>
        {/* The button of the assistant goes in the corner of the map, with the legend (#181). */}
        <div data-testid="map-corner">{assistantButton}</div>
      </div>
    );
  },
}));

// The answers of the panel (PBI-18, ADR-036): everything indifferent and 5 minutes.
const NO_PREFERENCES = { sunShade: 'any', avoidWind: false, preferParks: false, extraMinutes: 5 };
const line = (coordinates, distance, duration, shadePercentage) => ({
  geometry: { type: 'LineString', coordinates },
  distance,
  duration,
  exposure: { status: 'available', shadePercentage, sunPercentage: 100 - shadePercentage },
});
const FASTEST = line(
  [
    [-0.89, 41.65],
    [-0.88, 41.66],
  ],
  1000,
  600,
  20
);
const SHADED = line(
  [
    [-0.89, 41.65],
    [-0.87, 41.67],
  ],
  1100,
  700,
  70
);
const SHADE_SETTING = { ...NO_PREFERENCES, sunShade: 'shade', extraMinutes: 15 };
const APPLIED = {
  assistant: {
    status: 'applied',
    explanation: 'He buscado sombra aunque tardes un poco más.',
    before: NO_PREFERENCES,
    after: SHADE_SETTING,
    changes: [
      { question: 'sunShade', before: 'any', after: 'shade' },
      { question: 'extraMinutes', before: 5, after: 15 },
    ],
  },
  comparison: {
    status: 'selected',
    fastest: FASTEST,
    shaded: SHADED,
    additionalDurationSeconds: 100,
    shadeImprovementPercentagePoints: 50,
  },
};

async function calculateFastestRoute(user) {
  render(<App />);
  await user.click(screen.getByText('Select map point'));
  await user.click(screen.getByText('Select map point'));
  await screen.findByRole('radio', { name: 'Me da igual', checked: true });
  await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));
  await screen.findByRole('button', { name: /^Abrir Cierzo, el asistente de rutas/ });
}

// The assistant opens from its floating button (#179); the pop-up stays open between requests.
async function ask(user, text) {
  if (!screen.queryByRole('dialog', { name: 'Cierzo · Asistente de rutas' })) {
    await user.click(screen.getByRole('button', { name: /^Abrir Cierzo, el asistente de rutas/ }));
  }
  const field = screen.getByLabelText('Pide a Cierzo un ajuste de la ruta');
  await user.clear(field);
  await user.type(field, text);
  await user.click(screen.getByRole('button', { name: 'Ajustar' }));
}

const shownGeometry = () => screen.getByTestId('route-geometry').textContent;

describe('App with the route assistant', () => {
  beforeEach(() => {
    getFastestRoute.mockReset().mockResolvedValue(FASTEST);
    askRouteAssistant.mockReset();
    getRoutePreferences.mockReset().mockResolvedValue(NO_PREFERENCES);
    saveRoutePreferences.mockReset().mockImplementation(async (preferences) => preferences);
    listRecentPlaces.mockReset().mockResolvedValue([]);
    listRouteFavorites.mockReset().mockResolvedValue([]);
    recordRecentPlaces.mockReset().mockResolvedValue([]);
  });

  it('is offered only once there is a route, with a floating button and not in the panel', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByRole('radio', { name: 'Me da igual', checked: true });
    expect(screen.queryByRole('button', { name: /Cierzo/ })).not.toBeInTheDocument();
    expect(screen.queryByLabelText('Pide a Cierzo un ajuste de la ruta')).not.toBeInTheDocument();

    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));
    const fab = await screen.findByRole('button', { name: 'Abrir Cierzo, el asistente de rutas' });
    // Not inside the route panel: in the corner of the map, with the legend (#181).
    expect(screen.getByRole('complementary', { name: 'Controles de ruta' })).not.toContainElement(
      fab
    );
    expect(screen.getByTestId('map-corner')).toContainElement(fab);
    expect(screen.queryByLabelText('Pide a Cierzo un ajuste de la ruta')).not.toBeInTheDocument();

    await user.click(fab);
    const dialog = screen.getByRole('dialog', { name: 'Cierzo · Asistente de rutas' });
    expect(within(dialog).getByLabelText('Pide a Cierzo un ajuste de la ruta')).toHaveFocus();
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(fab).toHaveFocus();
  });

  it('is not offered while the route is being calculated nor while walking it', async () => {
    const user = userEvent.setup();
    let resolveRoute;
    getFastestRoute.mockReturnValue(
      new Promise((resolve) => {
        resolveRoute = resolve;
      })
    );
    render(<App />);
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByText('Select map point'));
    await screen.findByRole('radio', { name: 'Me da igual', checked: true });
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));
    expect(screen.queryByRole('button', { name: /Cierzo/ })).not.toBeInTheDocument();

    resolveRoute(FASTEST);
    await screen.findByRole('button', { name: 'Abrir Cierzo, el asistente de rutas' });
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: { watchPosition: jest.fn(() => 1), clearWatch: jest.fn() },
    });
    await user.click(screen.getByRole('button', { name: 'Iniciar ruta' }));
    expect(navigator.geolocation.watchPosition).toHaveBeenCalled();
    expect(screen.queryByRole('button', { name: /Cierzo/ })).not.toBeInTheDocument();
  });

  it('keeps what the user was writing and the answer after closing and opening it again', async () => {
    const user = userEvent.setup();
    askRouteAssistant.mockResolvedValue(APPLIED);
    await calculateFastestRoute(user);
    await ask(user, 'prefiero la sombra');
    await screen.findByText(APPLIED.assistant.explanation);
    await user.type(screen.getByLabelText('Pide a Cierzo un ajuste de la ruta'), ' y sin viento');

    await user.click(screen.getByRole('button', { name: 'Cerrar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    // The adjusted route stays on screen and the button says so.
    expect(shownGeometry()).toBe(JSON.stringify(SHADED.geometry.coordinates));
    const fab = screen.getByRole('button', {
      name: 'Abrir Cierzo, el asistente de rutas (ruta ajustada)',
    });
    expect(fab).toHaveFocus();

    await user.click(fab);
    expect(screen.getByLabelText('Pide a Cierzo un ajuste de la ruta')).toHaveValue(
      'prefiero la sombra y sin viento'
    );
    expect(screen.getByText(APPLIED.assistant.explanation)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar como mis preferencias' })).toBeInTheDocument();
  });

  it('applies the new answers, shows the new route and what changed', async () => {
    const user = userEvent.setup();
    askRouteAssistant.mockResolvedValue(APPLIED);
    await calculateFastestRoute(user);

    await ask(user, 'prefiero la sombra aunque tarde más');

    // The current answers (everything indifferent), without a date: the backend uses now.
    expect(askRouteAssistant).toHaveBeenCalledWith(
      {
        origin: expect.objectContaining({ lat: 41.65, lng: -0.89 }),
        destination: expect.objectContaining({ lat: 41.65, lng: -0.89 }),
        message: 'prefiero la sombra aunque tarde más',
        preferences: NO_PREFERENCES,
      },
      { signal: expect.any(AbortSignal) }
    );
    expect(await screen.findByText(APPLIED.assistant.explanation)).toBeInTheDocument();
    expect(shownGeometry()).toBe(JSON.stringify(SHADED.geometry.coordinates));
    const changes = screen.getByRole('list', { name: 'Cambios de Cierzo' });
    expect(within(changes).getByText('Me da igual → Sombra')).toBeInTheDocument();
    expect(within(changes).getByText('La más rápida → +15 min')).toBeInTheDocument();
    expect(
      within(screen.getByRole('button', { name: /Tu ruta/ })).getByText('Mucha')
    ).toBeInTheDocument();
  });

  it('a second request starts from the answers the assistant applied', async () => {
    const user = userEvent.setup();
    askRouteAssistant.mockResolvedValue(APPLIED);
    await calculateFastestRoute(user);
    await ask(user, 'prefiero la sombra');
    await screen.findByText(APPLIED.assistant.explanation);

    await ask(user, 'y evita el viento');

    expect(askRouteAssistant).toHaveBeenLastCalledWith(
      expect.objectContaining({ message: 'y evita el viento', preferences: SHADE_SETTING }),
      expect.anything()
    );
  });

  it('an error keeps the route on screen', async () => {
    const user = userEvent.setup();
    askRouteAssistant.mockRejectedValue(
      Object.assign(new Error('Has hecho muchas peticiones seguidas a Cierzo. Espera un minuto.'), {
        status: 429,
      })
    );
    await calculateFastestRoute(user);
    const before = shownGeometry();

    await ask(user, 'sombra');

    expect(await screen.findByText(/Espera un minuto/)).toBeInTheDocument();
    expect(shownGeometry()).toBe(before);
    expect(screen.getByRole('button', { name: 'Iniciar ruta' })).toBeInTheDocument();
  });

  it('an error after an adjustment keeps the adjusted route and its answers', async () => {
    const user = userEvent.setup();
    askRouteAssistant
      .mockResolvedValueOnce(APPLIED)
      .mockRejectedValueOnce(
        new Error('Cierzo no está disponible ahora mismo. Tu ruta no ha cambiado.')
      );
    await calculateFastestRoute(user);
    await ask(user, 'sombra');
    await screen.findByText(APPLIED.assistant.explanation);

    await ask(user, 'ahora al sol');

    expect(await screen.findByText(/Tu ruta no ha cambiado/)).toBeInTheDocument();
    expect(shownGeometry()).toBe(JSON.stringify(SHADED.geometry.coordinates));
    expect(screen.getByText(APPLIED.assistant.explanation)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Usar como mis preferencias' })).toBeInTheDocument();
  });

  it('a request it does not understand keeps the route and says so', async () => {
    const user = userEvent.setup();
    askRouteAssistant.mockResolvedValue({
      assistant: {
        status: 'not_understood',
        message: 'No he entendido la petición.',
        before: NO_PREFERENCES,
        after: null,
        changes: [],
      },
      comparison: null,
    });
    await calculateFastestRoute(user);
    const before = shownGeometry();

    await ask(user, 'cuéntame un chiste');

    expect(await screen.findByText('No he entendido la petición.')).toBeInTheDocument();
    expect(shownGeometry()).toBe(before);
  });

  it('choosing another answer leaves the assistant answer behind', async () => {
    const user = userEvent.setup();
    askRouteAssistant.mockResolvedValue(APPLIED);
    await calculateFastestRoute(user);
    await ask(user, 'sombra');
    await screen.findByText(APPLIED.assistant.explanation);
    await user.keyboard('{Escape}');

    await user.click(screen.getByRole('button', { name: 'Cambiar preferencias' }));
    await user.click(screen.getByRole('radio', { name: 'Sol' }));

    expect(screen.queryByText(APPLIED.assistant.explanation)).not.toBeInTheDocument();
    expect(shownGeometry()).toBe('none');
    // Without a route there is no assistant.
    expect(screen.queryByRole('button', { name: /Cierzo/ })).not.toBeInTheDocument();
  });

  it('"Usar como mis preferencias" saves the answers of Cierzo in the account (PBI-18)', async () => {
    const user = userEvent.setup();
    askRouteAssistant.mockResolvedValue(APPLIED);
    await calculateFastestRoute(user);
    await ask(user, 'prefiero la sombra aunque tarde más');
    await screen.findByText(APPLIED.assistant.explanation);

    await user.click(screen.getByRole('button', { name: 'Usar como mis preferencias' }));

    // The answers of Cierzo are the user's: «Según el tiempo de hoy» goes off (PBI-21).
    expect(saveRoutePreferences).toHaveBeenCalledWith(
      { ...SHADE_SETTING, byWeather: false },
      { signal: expect.any(AbortSignal) }
    );
    expect(await screen.findByText('Ya son tus preferencias.')).toBeInTheDocument();
    // The route on screen stays: it already is the route of those answers.
    expect(shownGeometry()).toBe(JSON.stringify(SHADED.geometry.coordinates));
    await user.keyboard('{Escape}');
    await user.click(screen.getByRole('button', { name: 'Cambiar preferencias' }));
    expect(screen.getByRole('radio', { name: 'Sombra' })).toBeChecked();
    expect(screen.getByRole('radio', { name: '+15 minutos' })).toBeChecked();
  });

  it('with «Según el tiempo de hoy» starts from the answers the weather marked (PBI-21)', async () => {
    const user = userEvent.setup();
    getRoutePreferences.mockResolvedValue({ ...NO_PREFERENCES, byWeather: true });
    getWeatherSuggestion.mockResolvedValue({
      status: 'available',
      answers: { sunShade: 'shade', avoidWind: true },
      message: 'Hace calor y sopla cierzo: he marcado «Sombra» y «Evitar el viento».',
    });
    getPreferredRouteComparison.mockResolvedValue({
      status: 'selected',
      fastest: { ...FASTEST, windExposure: { status: 'available', exposure: 0 } },
      shaded: { ...SHADED, windExposure: { status: 'available', exposure: 0 } },
      additionalDurationSeconds: 100,
      weights: { shade: 50, sun: 0, wind: 50, vegetation: 0 },
    });
    askRouteAssistant.mockReturnValue(new Promise(() => {}));
    render(<App />);
    await screen.findByText(/he marcado «Sombra» y «Evitar el viento»/);
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));
    await screen.findByRole('button', { name: /^Abrir Cierzo, el asistente de rutas/ });

    await ask(user, 'y por parques');

    expect(askRouteAssistant).toHaveBeenCalledWith(
      expect.objectContaining({
        preferences: { sunShade: 'shade', avoidWind: true, preferParks: false, extraMinutes: 5 },
      }),
      expect.anything()
    );
  });
});
