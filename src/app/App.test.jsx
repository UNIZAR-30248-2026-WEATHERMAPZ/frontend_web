import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App.jsx';
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

jest.mock('../services/api/geocodingApi.js', () => ({
  autocompletePlaces: jest.fn(),
  reversePlace: jest.fn().mockResolvedValue({ place: null }),
}));

jest.mock('../services/api/routesApi.js', () => ({
  getFastestRoute: jest.fn(),
  getPreferredRouteComparison: jest.fn(),
}));

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

// The location is chosen with «Mi ubicación», the first option of the list of each field.
async function chooseMyLocation(user, field) {
  await user.click(screen.getByLabelText(field));
  await user.click(screen.getByRole('option', { name: 'Mi ubicación' }));
}

// The preferences of the account (PBI-18): everything indifferent and 5 minutes. «Según el tiempo de
// hoy» (PBI-21) is off here; its own tests turn it on.
const PREFERENCES = {
  sunShade: 'any',
  avoidWind: false,
  preferParks: false,
  extraMinutes: 5,
  byWeather: false,
};
// What a route is calculated with: the answers and the minutes, without «Según el tiempo de hoy».
const ANSWERS = { sunShade: 'any', avoidWind: false, preferParks: false, extraMinutes: 5 };
const HOT_SUGGESTION = {
  status: 'available',
  answers: { sunShade: 'shade', avoidWind: false },
  message: 'Hace calor (sensación de 31 °C): he marcado «Sombra».',
};

jest.mock('../features/weather/WeatherPanel.jsx', () => ({
  WeatherPanel: () => <section data-testid="weather-panel" />,
}));

jest.mock('../features/map/MapView.jsx', () => ({
  MapView: ({
    origin,
    destination,
    onSelectPoint,
    fastestRoute,
    shadedRoute,
    selectedRouteType,
    selectedStepGeometry,
  }) => {
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
        <span data-testid="origin-marker">{origin ? origin.lat : 'none'}</span>
        <span data-testid="destination-marker">{destination ? destination.lat : 'none'}</span>
        <span data-testid="route-geometry">{geometry}</span>
        <span data-testid="step-geometry">
          {selectedStepGeometry ? JSON.stringify(selectedStepGeometry.coordinates) : 'none'}
        </span>
      </div>
    );
  },
}));

describe('App', () => {
  const originalLocation = navigator.geolocation;
  afterEach(() => {
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: originalLocation,
    });
  });

  beforeEach(() => {
    getFastestRoute.mockReset();
    getWeatherSuggestion.mockReset().mockResolvedValue(HOT_SUGGESTION);
    getPreferredRouteComparison.mockReset();
    getRoutePreferences.mockReset().mockResolvedValue(PREFERENCES);
    saveRoutePreferences.mockReset().mockImplementation(async (preferences) => preferences);
    listRecentPlaces.mockReset().mockResolvedValue([]);
    listRouteFavorites.mockReset().mockResolvedValue([]);
    recordRecentPlaces.mockReset().mockResolvedValue([]);
  });

  it('renders the base application shell', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'WeatherMapZ' })).toBeInTheDocument();
    expect(screen.getByLabelText('Controles de ruta')).toBeInTheDocument();
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
  });

  it('opens the tutorial when requested from the profile menu', async () => {
    render(
      <App user={{ id: 7, name: 'Ana', email: 'ana@example.com', tutorialStatus: 'completed' }} />
    );

    act(() => window.dispatchEvent(new window.Event('weathermapz:open-tour')));

    expect(await screen.findByRole('dialog', { name: 'Origen y destino' })).toBeInTheDocument();
  });

  it('shows the current weather outside the map and the route controls', () => {
    render(<App />);
    const weather = screen.getByTestId('weather-panel');
    expect(screen.getByTestId('map-view')).not.toContainElement(weather);
    expect(screen.getByLabelText('Controles de ruta')).not.toContainElement(weather);
  });

  it('opens the favorites section from the profile menu action', async () => {
    render(<App />);

    act(() => window.dispatchEvent(new window.Event('weathermapz:open-favorites')));

    expect(await screen.findByRole('dialog', { name: 'Favoritos' })).toBeInTheDocument();
  });

  it('keeps map selection, editable inputs and markers synchronized', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByText('Select map point'));
    expect(screen.getByLabelText('Origen')).toHaveValue('41.65000, -0.89000');
    await user.click(screen.getByText('Select map point'));
    expect(screen.getByTestId('destination-marker')).toHaveTextContent('41.65');
    await user.clear(screen.getByLabelText('Origen'));
    expect(screen.getByTestId('origin-marker')).toHaveTextContent('none');
    await user.type(screen.getByLabelText('Origen'), 'draft');
    await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    expect(screen.getByLabelText('Origen')).toHaveValue('');
    expect(screen.getByLabelText('Destino')).toHaveValue('');
    expect(screen.getByTestId('destination-marker')).toHaveTextContent('none');
  });

  it('ignores GPS after reset or a newer map selection and clears old success messages', async () => {
    const user = userEvent.setup();
    let success;
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: jest.fn((callback) => {
          success = callback;
        }),
      },
    });
    render(<App />);
    const position = { coords: { latitude: 41.7, longitude: -1 } };
    await chooseMyLocation(user, 'Origen');
    await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    act(() => success(position));
    expect(screen.getByTestId('origin-marker')).toHaveTextContent('none');
    await chooseMyLocation(user, 'Origen');
    await user.click(screen.getByText('Select map point'));
    act(() => success(position));
    expect(screen.getByTestId('origin-marker')).toHaveTextContent('41.65');
    await chooseMyLocation(user, 'Destino');
    act(() => success(position));
    expect(screen.getByTestId('destination-marker')).toHaveTextContent('41.7');
    expect(screen.getByRole('status')).toHaveTextContent('Se ha puesto tu ubicación como destino');
    await user.clear(screen.getByLabelText('Destino'));
    expect(screen.queryByRole('status')).not.toBeInTheDocument();
  });

  it('does not accept a GPS position outside Zaragoza', async () => {
    const user = userEvent.setup();
    Object.defineProperty(navigator, 'geolocation', {
      configurable: true,
      value: {
        getCurrentPosition: jest.fn((onSuccess) =>
          onSuccess({ coords: { latitude: 40.4168, longitude: -3.7038 } })
        ),
      },
    });
    render(<App />);

    await chooseMyLocation(user, 'Origen');

    expect(screen.getByTestId('origin-marker')).toHaveTextContent('none');
    expect(screen.getByRole('alert')).toHaveTextContent('solo funciona dentro de Zaragoza');
  });

  it('highlights on the map the part of the route of the chosen step', async () => {
    const user = userEvent.setup();
    getFastestRoute.mockResolvedValue({
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.89, 41.65],
          [-0.88, 41.65],
          [-0.87, 41.65],
        ],
      },
      distance: 200,
      duration: 100,
      steps: [
        { instruction: 'Primero', name: null, distance: 100, duration: 50, wayPoints: [0, 1] },
        { instruction: 'Después', name: null, distance: 100, duration: 50, wayPoints: [1, 2] },
      ],
    });
    render(<App />);
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

    await user.click(await screen.findByRole('button', { name: 'Ver recorrido' }));
    expect(screen.getByTestId('step-geometry')).toHaveTextContent('none');

    await user.click(screen.getByRole('button', { name: /Después/ }));

    expect(screen.getByRole('button', { name: /Después/ })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByTestId('step-geometry')).toHaveTextContent(
      JSON.stringify([
        [-0.88, 41.65],
        [-0.87, 41.65],
      ])
    );
  });

  describe('walking a route', () => {
    const fastest = {
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.89, 41.65],
          [-0.888, 41.65],
        ],
      },
      distance: 170,
      duration: 120,
      steps: [
        { instruction: 'Camina hacia el este', name: null, distance: 170, wayPoints: [0, 1] },
        { instruction: 'Llegar a su destino', name: null, distance: 0, wayPoints: [1, 1] },
      ],
    };
    let onPosition;
    let clearWatch;

    async function calculateAndStart(user) {
      getFastestRoute.mockResolvedValue(fastest);
      clearWatch = jest.fn();
      Object.defineProperty(navigator, 'geolocation', {
        configurable: true,
        value: {
          clearWatch,
          watchPosition: jest.fn((success) => {
            onPosition = success;
            return 1;
          }),
        },
      });
      render(<App />);
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));
      await user.click(await screen.findByRole('button', { name: 'Iniciar ruta' }));
    }

    it('replaces the search with the instructions until the user finishes', async () => {
      const user = userEvent.setup();
      await calculateAndStart(user);

      expect(screen.getByText('Buscando tu ubicación…')).toBeInTheDocument();
      expect(screen.queryByLabelText('Origen')).not.toBeInTheDocument();

      act(() => onPosition({ coords: { latitude: 41.65, longitude: -0.889 } }));
      expect(screen.getByText('Llegar a su destino')).toBeInTheDocument();
      expect(screen.getByText(/^En /)).toBeInTheDocument();

      act(() => onPosition({ coords: { latitude: 41.65, longitude: -0.888 } }));
      expect(screen.getByText('Has llegado a tu destino')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: 'Terminar' }));

      expect(clearWatch).toHaveBeenCalledWith(1);
      expect(screen.getByLabelText('Origen')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Iniciar ruta' })).toBeInTheDocument();
    });

    it('does not change the route when the map is tapped while walking', async () => {
      const user = userEvent.setup();
      await calculateAndStart(user);

      const geometry = screen.getByTestId('route-geometry').textContent;
      await user.click(screen.getByText('Select map point'));

      expect(screen.getByTestId('route-geometry')).toHaveTextContent(geometry);
      expect(screen.getByText('Buscando tu ubicación…')).toBeInTheDocument();
    });
  });

  it('asks to calculate again after asking for shade with only the fastest route', async () => {
    const user = userEvent.setup();
    getFastestRoute.mockResolvedValue({
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.89, 41.65],
          [-0.888, 41.65],
        ],
      },
      distance: 170,
      duration: 120,
      steps: [],
    });
    render(<App />);
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));
    await screen.findByRole('button', { name: 'Iniciar ruta' });

    // Once a route is calculated, the questions fold into a summary.
    await user.click(screen.getByRole('button', { name: 'Cambiar preferencias' }));
    await user.click(screen.getByRole('radio', { name: 'Sombra' }));

    expect(screen.getByRole('button', { name: 'Calcular ruta' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Iniciar ruta' })).not.toBeInTheDocument();
    expect(screen.getByTestId('route-geometry')).toHaveTextContent('none');
  });

  it('requests the fastest route with the selected points', async () => {
    const user = userEvent.setup();
    getFastestRoute.mockResolvedValue({
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.89, 41.65],
          [-0.89, 41.65],
        ],
      },
      distance: 0,
      duration: 0,
    });
    render(<App />);

    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

    expect(getFastestRoute).toHaveBeenCalledWith(
      {
        origin: { lat: 41.65, lng: -0.89, source: 'map' },
        destination: { lat: 41.65, lng: -0.89, source: 'map' },
      },
      { signal: expect.any(AbortSignal) }
    );
    expect(await screen.findByText('0 min')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'La más rápida · 0 min' })).toBeInTheDocument();
    expect(screen.getAllByText('0 m')[0]).toBeInTheDocument();
    expect(screen.getByTestId('route-geometry')).toHaveTextContent(
      JSON.stringify([
        [-0.89, 41.65],
        [-0.89, 41.65],
      ])
    );
  });

  it('shows loading and a comprehensible error when route calculation fails', async () => {
    const user = userEvent.setup();
    let rejectRequest;
    getFastestRoute.mockReturnValue(
      new Promise((_resolve, reject) => {
        rejectRequest = reject;
      })
    );
    render(<App />);

    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

    expect(screen.getByRole('button', { name: 'Calculando...' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Calculando la ruta más rápida');
    expect(screen.getByTestId('route-geometry')).toHaveTextContent('none');

    await act(async () => {
      rejectRequest(new Error('No se ha podido calcular la ruta. Inténtalo de nuevo.'));
    });

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido calcular la ruta');
    expect(screen.getByTestId('route-geometry')).toHaveTextContent('none');
    // The places of a route that could not be calculated do not go to the recent places (#180).
    expect(recordRecentPlaces).not.toHaveBeenCalled();
  });

  describe('recent places (#180) and favourites (PBI-12)', () => {
    const route = {
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.89, 41.65],
          [-0.88, 41.66],
        ],
      },
      distance: 900,
      duration: 660,
    };

    it('saves the places of a calculated route as recent places, origin first', async () => {
      const user = userEvent.setup();
      getFastestRoute.mockResolvedValue(route);
      render(<App />);

      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      expect(await screen.findByText('11 min')).toBeInTheDocument();
      expect(recordRecentPlaces).toHaveBeenCalledWith([
        { lat: 41.65, lng: -0.89, source: 'map' },
        { lat: 41.65, lng: -0.89, source: 'map' },
      ]);
    });

    it('offers the same recent places in both fields, without the place of the other one', async () => {
      const user = userEvent.setup();
      const pilar = { id: 2, lat: 41.6572, lng: -0.88039, label: 'Plaza del Pilar, Zaragoza' };
      const sitios = { id: 1, lat: 41.6488, lng: -0.8793, label: 'Plaza de los Sitios, Zaragoza' };
      listRecentPlaces.mockResolvedValue(
        [pilar, sitios].map((place) => ({ ...place, usedAt: '2026-11-16T10:00:00.000Z' }))
      );
      render(<App />);

      await user.click(screen.getByLabelText('Origen'));
      const originList = within(await screen.findByRole('group', { name: 'Recientes' }));
      expect(originList.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Plaza del Pilar, Zaragoza',
        'Plaza de los Sitios, Zaragoza',
      ]);
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('Mi ubicación');
      await user.click(screen.getByRole('option', { name: 'Plaza del Pilar, Zaragoza' }));
      expect(screen.getByLabelText('Origen')).toHaveValue('Plaza del Pilar, Zaragoza');

      await user.click(screen.getByLabelText('Destino'));
      const destinationList = within(screen.getByRole('group', { name: 'Recientes' }));
      expect(destinationList.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Plaza de los Sitios, Zaragoza',
      ]);
      await user.click(screen.getByRole('option', { name: 'Plaza de los Sitios, Zaragoza' }));
      expect(screen.getByLabelText('Destino')).toHaveValue('Plaza de los Sitios, Zaragoza');
      expect(screen.getByRole('button', { name: 'Calcular ruta' })).toBeEnabled();
    });

    it('calculates a favourite trip again with its place names', async () => {
      const user = userEvent.setup();
      const favorite = {
        id: 7,
        name: 'Casa',
        origin: { lat: 41.66, lng: -0.88, label: 'Calle Mayor, Zaragoza' },
        destination: { lat: 41.64, lng: -0.9, label: 'Plaza España, Zaragoza' },
        createdAt: '2026-11-10T10:00:00.000Z',
      };
      listRouteFavorites.mockResolvedValue([favorite]);
      getFastestRoute.mockResolvedValue(route);
      render(<App />);

      act(() => window.dispatchEvent(new window.Event('weathermapz:open-favorites')));
      await user.click(await screen.findByRole('button', { name: /^Casa/ }));

      expect(screen.getByLabelText('Origen')).toHaveValue('Calle Mayor, Zaragoza');
      expect(screen.getByLabelText('Destino')).toHaveValue('Plaza España, Zaragoza');
      expect(getFastestRoute).toHaveBeenCalledWith(
        { origin: favorite.origin, destination: favorite.destination },
        { signal: expect.any(AbortSignal) }
      );
      expect(await screen.findByText('11 min')).toBeInTheDocument();
    });
  });

  it('calculates, compares and alternates a genuinely shaded route', async () => {
    const user = userEvent.setup();
    const fastest = {
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.89, 41.65],
          [-0.88, 41.66],
        ],
      },
      distance: 1000,
      duration: 600,
      exposure: { status: 'available', shadePercentage: 20, sunPercentage: 80 },
    };
    const shaded = {
      geometry: {
        type: 'LineString',
        coordinates: [
          [-0.89, 41.65],
          [-0.87, 41.67],
        ],
      },
      distance: 1100,
      duration: 660,
      exposure: { status: 'available', shadePercentage: 70, sunPercentage: 30 },
    };
    getPreferredRouteComparison.mockResolvedValue({
      status: 'selected',
      fastest,
      shaded,
      additionalDurationSeconds: 60,
      shadeImprovementPercentagePoints: 50,
    });
    render(<App />);

    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByText('Select map point'));
    await user.click(await screen.findByRole('radio', { name: 'Sombra' }));
    await user.clear(screen.getByLabelText('Fecha'));
    await user.type(screen.getByLabelText('Fecha'), '2026-06-21');
    await user.clear(screen.getByLabelText('Hora'));
    await user.type(screen.getByLabelText('Hora'), '14:00');
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

    expect(getPreferredRouteComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-06-21',
        time: '14:00',
        timeZone: 'Europe/Madrid',
        preferences: { ...ANSWERS, sunShade: 'shade' },
      }),
      { signal: expect.any(AbortSignal) }
    );
    expect(
      within(await screen.findByRole('button', { name: /Tu ruta/ })).getByText('Mucha')
    ).toBeInTheDocument();
    expect(screen.getByTestId('route-geometry')).toHaveTextContent(
      JSON.stringify(shaded.geometry.coordinates)
    );
    await user.click(screen.getByRole('button', { name: /^Más rápida · 10 min/ }));
    expect(screen.getByTestId('route-geometry')).toHaveTextContent(
      JSON.stringify(fastest.geometry.coordinates)
    );
    // Showing the fastest one does not change the answers: «Cambiar preferencias» still has them.
    await user.click(screen.getByRole('button', { name: 'Cambiar preferencias' }));
    expect(screen.getByRole('radio', { name: 'Sombra' })).toBeChecked();
  });

  describe('simple preferences (PBI-18)', () => {
    const choosePoints = async (user) => {
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByText('Select map point'));
    };

    it('starts with «Me da igual», without minutes, and only asks for the fastest route', async () => {
      const user = userEvent.setup();
      getFastestRoute.mockReturnValue(new Promise(() => {}));
      render(<App />);

      expect(await screen.findByRole('radio', { name: 'Me da igual' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Evitar el viento' })).not.toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Por parques' })).not.toBeChecked();
      // The minutes only appear with some preference.
      expect(
        screen.queryByRole('group', { name: '¿Cuánto más estás dispuesto a andar?' })
      ).not.toBeInTheDocument();
      expect(screen.queryByLabelText('Hora')).not.toBeInTheDocument();
      await choosePoints(user);
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      expect(getFastestRoute).toHaveBeenCalledTimes(1);
      expect(getPreferredRouteComparison).not.toHaveBeenCalled();
    });

    it('recovers the preferences of the account, on any device', async () => {
      const user = userEvent.setup();
      getRoutePreferences.mockResolvedValue({
        ...PREFERENCES,
        sunShade: 'sun',
        avoidWind: true,
        extraMinutes: 10,
      });
      getPreferredRouteComparison.mockReturnValue(new Promise(() => {}));
      render(<App />);

      expect(await screen.findByRole('radio', { name: 'Sol', checked: true })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Evitar el viento' })).toBeChecked();
      expect(screen.getByRole('radio', { name: '+10 minutos' })).toBeChecked();
      await choosePoints(user);
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      expect(getPreferredRouteComparison).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: { sunShade: 'sun', avoidWind: true, preferParks: false, extraMinutes: 10 },
        }),
        { signal: expect.any(AbortSignal) }
      );
      expect(getFastestRoute).not.toHaveBeenCalled();
      expect(saveRoutePreferences).not.toHaveBeenCalled();
    });

    it('saves every change in the account and shows the minutes with a preference', async () => {
      const user = userEvent.setup();
      render(<App />);

      await user.click(await screen.findByRole('checkbox', { name: 'Por parques' }));
      expect(saveRoutePreferences).toHaveBeenLastCalledWith(
        { ...PREFERENCES, preferParks: true },
        { signal: expect.any(AbortSignal) }
      );
      const minutes = screen.getByRole('group', { name: '¿Cuánto más estás dispuesto a andar?' });
      expect(within(minutes).getByRole('radio', { name: '+5 minutos' })).toBeChecked();
      expect(
        within(minutes)
          .getAllByRole('radio')
          .map((radio) => radio.value)
      ).toEqual(['0', '2', '5', '10', '15']);
      expect(within(minutes).getByText('+5 min')).toBeInTheDocument();

      await user.click(within(minutes).getByRole('radio', { name: 'Nada' }));
      expect(saveRoutePreferences).toHaveBeenLastCalledWith(
        { ...PREFERENCES, preferParks: true, extraMinutes: 0 },
        { signal: expect.any(AbortSignal) }
      );
      // Shade and sun cannot go together: choosing one leaves the other.
      await user.click(screen.getByRole('radio', { name: 'Sombra' }));
      await user.click(screen.getByRole('radio', { name: 'Sol' }));
      expect(screen.getByRole('radio', { name: 'Sombra' })).not.toBeChecked();
      expect(saveRoutePreferences).toHaveBeenLastCalledWith(
        { sunShade: 'sun', avoidWind: false, preferParks: true, extraMinutes: 0, byWeather: false },
        { signal: expect.any(AbortSignal) }
      );
    });

    it('calculates a parks route without asking for date and time (PBI-10 phase B)', async () => {
      const user = userEvent.setup();
      getPreferredRouteComparison.mockReturnValue(new Promise(() => {}));
      render(<App />);

      await user.click(await screen.findByRole('checkbox', { name: 'Por parques' }));
      // The green does not depend on the Sun: no date and time.
      expect(screen.queryByLabelText('Hora')).not.toBeInTheDocument();
      await choosePoints(user);
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      expect(getPreferredRouteComparison).toHaveBeenCalledWith(
        expect.objectContaining({ preferences: { ...ANSWERS, preferParks: true } }),
        { signal: expect.any(AbortSignal) }
      );
      expect(screen.getByRole('status')).toHaveTextContent('Calculando la ruta «Tu ruta»');
    });

    it('folds the questions into a summary once the route is calculated', async () => {
      const user = userEvent.setup();
      getRoutePreferences.mockResolvedValue({
        ...PREFERENCES,
        sunShade: 'sun',
        preferParks: true,
        extraMinutes: 10,
      });
      getPreferredRouteComparison.mockResolvedValue({
        status: 'over_extra_time',
        fastest: {
          geometry: {
            type: 'LineString',
            coordinates: [
              [-0.89, 41.65],
              [-0.88, 41.66],
            ],
          },
          distance: 1000,
          duration: 600,
          exposure: { status: 'available', shadePercentage: 20, sunPercentage: 80 },
        },
        shaded: null,
        additionalDurationSeconds: null,
        strategy: { maximumExtraMinutes: 10 },
      });
      render(<App />);
      await screen.findByRole('radio', { name: 'Sol', checked: true });
      await choosePoints(user);
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      // With the result the questions fold into its dropdown «Cambiar preferencias» (PBI-19).
      expect(await screen.findByRole('button', { name: 'Cambiar preferencias' })).toHaveAttribute(
        'aria-expanded',
        'false'
      );
      expect(screen.queryByRole('radio', { name: 'Sol' })).not.toBeInTheDocument();
      expect(screen.getAllByText(/pero todos tardan más de 10 min extra/)[0]).toBeInTheDocument();
      await user.click(screen.getByRole('button', { name: 'Cambiar preferencias' }));
      expect(screen.getByRole('radio', { name: 'Sol' })).toBeChecked();
      // Opening them does not lose the route; changing an answer does.
      expect(screen.getByTestId('route-geometry')).not.toHaveTextContent('none');
      await user.click(screen.getByRole('radio', { name: '+15 minutos' }));
      expect(screen.getByTestId('route-geometry')).toHaveTextContent('none');
    });

    it('uses the defaults without saving them when the preferences cannot be loaded', async () => {
      const user = userEvent.setup();
      getRoutePreferences.mockRejectedValue(new Error('offline'));
      // Without the backend the weather cannot be asked for either: the defaults stay.
      getWeatherSuggestion.mockRejectedValue(new Error('offline'));
      render(<App />);

      expect(
        await screen.findByText(/No se han podido cargar tus preferencias/)
      ).toBeInTheDocument();
      expect(
        await screen.findByText(/No se ha podido consultar el tiempo de hoy/)
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Me da igual' })).toBeChecked();
      await user.click(screen.getByRole('radio', { name: 'Sombra' }));
      expect(screen.getByRole('radio', { name: 'Sombra' })).toBeChecked();
      expect(saveRoutePreferences).not.toHaveBeenCalled();
    });

    it('says when a change could not be saved, and still uses it', async () => {
      const user = userEvent.setup();
      saveRoutePreferences.mockRejectedValue(
        new Error('No se han podido guardar tus preferencias.')
      );
      render(<App />);

      await user.click(await screen.findByRole('checkbox', { name: 'Evitar el viento' }));

      expect(await screen.findByRole('alert')).toHaveTextContent(
        'No se han podido guardar tus preferencias. Se usarán en esta ruta.'
      );
      expect(screen.getByRole('checkbox', { name: 'Evitar el viento' })).toBeChecked();
    });
  });

  describe('«Según el tiempo de hoy» (PBI-21)', () => {
    const choosePoints = async (user) => {
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByText('Select map point'));
    };

    it('is on for a new user: marks what the weather chooses and says why', async () => {
      getRoutePreferences.mockResolvedValue({ ...PREFERENCES, byWeather: true });
      render(<App />);

      const weather = await screen.findByRole('button', { name: 'Según el tiempo de hoy' });
      expect(weather).toHaveAttribute('aria-pressed', 'true');
      expect(await screen.findByText(HOT_SUGGESTION.message)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Sombra' })).toBeChecked();
      expect(screen.getByRole('checkbox', { name: 'Por parques' })).not.toBeChecked();
      expect(saveRoutePreferences).toHaveBeenLastCalledWith(
        { ...PREFERENCES, sunShade: 'shade', byWeather: true },
        { signal: expect.any(AbortSignal) }
      );
    });

    it('calculates the route of the marked answers with the minutes of the bar, for now', async () => {
      const user = userEvent.setup();
      getRoutePreferences.mockResolvedValue({ ...PREFERENCES, extraMinutes: 10, byWeather: true });
      getPreferredRouteComparison.mockReturnValue(new Promise(() => {}));
      render(<App />);
      await screen.findByText(HOT_SUGGESTION.message);

      // The weather of now: no date or time is asked, even with «Sombra» marked.
      expect(screen.queryByLabelText('Hora')).not.toBeInTheDocument();
      await choosePoints(user);
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      expect(getPreferredRouteComparison).toHaveBeenCalledWith(
        expect.objectContaining({
          preferences: {
            sunShade: 'shade',
            avoidWind: false,
            preferParks: false,
            extraMinutes: 10,
          },
        }),
        { signal: expect.any(AbortSignal) }
      );
      expect(getFastestRoute).not.toHaveBeenCalled();
    });

    it('with mild weather proposes the fastest route', async () => {
      const user = userEvent.setup();
      getRoutePreferences.mockResolvedValue({ ...PREFERENCES, byWeather: true });
      getWeatherSuggestion.mockResolvedValue({
        status: 'available',
        answers: { sunShade: 'any', avoidWind: false },
        message:
          'Temperatura agradable (sensación de 18 °C) y poco viento (5 km/h): no hace falta desviarse, así que te propongo la ruta más rápida.',
      });
      getFastestRoute.mockReturnValue(new Promise(() => {}));
      render(<App />);
      await screen.findByText(/te propongo la ruta más rápida/);

      await choosePoints(user);
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));
      expect(getFastestRoute).toHaveBeenCalledTimes(1);
      expect(getPreferredRouteComparison).not.toHaveBeenCalled();
    });

    it('without weather says so and leaves the preferences as they were', async () => {
      getRoutePreferences.mockResolvedValue({ ...PREFERENCES, sunShade: 'sun', byWeather: true });
      getWeatherSuggestion.mockResolvedValue({
        status: 'unavailable',
        answers: null,
        message:
          'No se ha podido consultar el tiempo actual: tus preferencias se quedan como estaban.',
      });
      render(<App />);

      expect(
        await screen.findByText(/tus preferencias se quedan como estaban/)
      ).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Sol' })).toBeChecked();
      expect(saveRoutePreferences).not.toHaveBeenCalled();
    });

    it('choosing an answer by hand turns it off, and the choice is saved', async () => {
      const user = userEvent.setup();
      getRoutePreferences.mockResolvedValue({ ...PREFERENCES, byWeather: true });
      render(<App />);
      await screen.findByText(HOT_SUGGESTION.message);

      await user.click(screen.getByRole('radio', { name: 'Sol' }));
      expect(screen.getByRole('button', { name: 'Según el tiempo de hoy' })).toHaveAttribute(
        'aria-pressed',
        'false'
      );
      expect(screen.queryByText(HOT_SUGGESTION.message)).not.toBeInTheDocument();
      expect(saveRoutePreferences).toHaveBeenLastCalledWith(
        { ...PREFERENCES, sunShade: 'sun', byWeather: false },
        { signal: expect.any(AbortSignal) }
      );
    });

    it('can be turned on again and asks the weather', async () => {
      const user = userEvent.setup();
      render(<App />);
      // Off once the preferences of the account (with it off) have loaded.
      const weather = await screen.findByRole('button', {
        name: 'Según el tiempo de hoy',
        pressed: false,
      });

      await user.click(weather);
      expect(weather).toHaveAttribute('aria-pressed', 'true');
      expect(await screen.findByText(HOT_SUGGESTION.message)).toBeInTheDocument();
      expect(screen.getByRole('radio', { name: 'Sombra' })).toBeChecked();
    });
  });
});
