import { act, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { App } from './App.jsx';
import {
  createRouteProfile,
  deleteRouteProfile,
  listRouteProfiles,
  updateRouteProfile,
} from '../services/api/routeProfilesApi.js';
import {
  getFastestRoute,
  getRecommendedRoute,
  getWeightedRouteComparison,
} from '../services/api/routesApi.js';

jest.mock('../services/api/geocodingApi.js', () => ({
  autocompletePlaces: jest.fn(),
  reversePlace: jest.fn().mockResolvedValue({ place: null }),
}));

jest.mock('../services/api/routesApi.js', () => ({
  getFastestRoute: jest.fn(),
  getRecommendedRoute: jest.fn(),
  getWeightedRouteComparison: jest.fn(),
}));

jest.mock('../services/api/routeProfilesApi.js', () => ({
  listRouteProfiles: jest.fn(),
  createRouteProfile: jest.fn(),
  updateRouteProfile: jest.fn(),
  deleteRouteProfile: jest.fn(),
}));

const PROFILES = [
  { id: 1, name: 'Rápida', presetKey: 'fastest', weights: { shade: 0, sun: 0 } },
  { id: 2, name: 'Sombreada', presetKey: 'shaded', weights: { shade: 50, sun: 0 } },
  { id: 3, name: 'Soleada', presetKey: 'sunny', weights: { shade: 0, sun: 50 } },
].map((profile) => ({ ...profile, maxDetourPercentage: 25 }));

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
    getRecommendedRoute.mockReset();
    getWeightedRouteComparison.mockReset();
    listRouteProfiles.mockReset().mockResolvedValue(PROFILES);
    createRouteProfile.mockReset();
    updateRouteProfile.mockReset();
    deleteRouteProfile.mockReset();
  });

  it('renders the base application shell', () => {
    render(<App />);
    expect(screen.getByRole('heading', { name: 'WeatherMapZ' })).toBeInTheDocument();
    expect(screen.getByLabelText('Controles de ruta')).toBeInTheDocument();
    expect(screen.getByTestId('map-view')).toBeInTheDocument();
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
    await user.click(screen.getByLabelText('Usar GPS para origen'));
    await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    act(() => success(position));
    expect(screen.getByTestId('origin-marker')).toHaveTextContent('none');
    await user.click(screen.getByLabelText('Usar GPS para origen'));
    await user.click(screen.getByText('Select map point'));
    act(() => success(position));
    expect(screen.getByTestId('origin-marker')).toHaveTextContent('41.65');
    await user.click(screen.getByLabelText('Usar GPS para destino'));
    act(() => success(position));
    expect(screen.getByTestId('destination-marker')).toHaveTextContent('41.7');
    expect(screen.getByRole('status')).toHaveTextContent('Ubicación actual asignada como destino');
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

    await user.click(screen.getByLabelText('Usar GPS para origen'));

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

  it('asks to calculate again after choosing the shaded type with only the fastest route', async () => {
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

    await user.click(await screen.findByRole('button', { name: 'Sombreada' }));

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
    expect(screen.getByText('0 m')).toBeInTheDocument();
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
    getWeightedRouteComparison.mockResolvedValue({
      status: 'selected',
      fastest,
      shaded,
      additionalDurationSeconds: 60,
      shadeImprovementPercentagePoints: 50,
    });
    render(<App />);

    await user.click(screen.getByText('Select map point'));
    await user.click(screen.getByText('Select map point'));
    await user.click(await screen.findByRole('button', { name: 'Sombreada' }));
    await user.clear(screen.getByLabelText('Fecha'));
    await user.type(screen.getByLabelText('Fecha'), '2026-06-21');
    await user.clear(screen.getByLabelText('Hora'));
    await user.type(screen.getByLabelText('Hora'), '14:00');
    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

    expect(getWeightedRouteComparison).toHaveBeenCalledWith(
      expect.objectContaining({
        date: '2026-06-21',
        time: '14:00',
        timeZone: 'Europe/Madrid',
        weights: { shade: 50, sun: 0 },
      }),
      { signal: expect.any(AbortSignal) }
    );
    expect(await screen.findByText('70 % de sombra')).toBeInTheDocument();
    expect(screen.getByTestId('route-geometry')).toHaveTextContent(
      JSON.stringify(shaded.geometry.coordinates)
    );
    await user.click(screen.getByRole('button', { name: /Más rápida 10 min/ }));
    expect(screen.getByTestId('route-geometry')).toHaveTextContent(
      JSON.stringify(fastest.geometry.coordinates)
    );
    // Showing the fastest one does not change the chosen route type.
    expect(screen.getByRole('button', { name: 'Sombreada' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
  });

  describe('routes of the user', () => {
    it('calculates a green route without asking for date and time (PBI-10 phase B)', async () => {
      const user = userEvent.setup();
      const parks = {
        id: 4,
        name: 'Parques',
        presetKey: null,
        weights: { shade: 0, sun: 0, wind: 0, vegetation: 80 },
        maxDetourPercentage: 25,
      };
      listRouteProfiles.mockResolvedValue([...PROFILES, parks]);
      getWeightedRouteComparison.mockReturnValue(new Promise(() => {}));
      render(<App />);

      await user.click(await screen.findByRole('button', { name: 'Parques' }));
      // The green does not depend on the Sun: no date and time.
      expect(screen.queryByLabelText('Hora')).not.toBeInTheDocument();
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      expect(getWeightedRouteComparison).toHaveBeenCalledWith(
        expect.objectContaining({ weights: parks.weights, maxDetourPercentage: 25 }),
        { signal: expect.any(AbortSignal) }
      );
      expect(getFastestRoute).not.toHaveBeenCalled();
    });

    it('starts with the fastest route and only asks for it, without weights', async () => {
      const user = userEvent.setup();
      getFastestRoute.mockReturnValue(new Promise(() => {}));
      render(<App />);

      expect(await screen.findByRole('button', { name: 'Rápida' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.queryByLabelText('Hora')).not.toBeInTheDocument();
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      expect(getFastestRoute).toHaveBeenCalledTimes(1);
      expect(getWeightedRouteComparison).not.toHaveBeenCalled();
    });

    it('calculates with the weights of a route created by the user', async () => {
      const user = userEvent.setup();
      const summer = {
        id: 4,
        name: 'Verano',
        presetKey: null,
        weights: { shade: 80, sun: 0 },
        maxDetourPercentage: 10,
      };
      createRouteProfile.mockResolvedValue(summer);
      getWeightedRouteComparison.mockReturnValue(new Promise(() => {}));
      render(<App />);

      await user.click(await screen.findByRole('button', { name: 'Nueva ruta' }));
      await user.type(screen.getByLabelText('Nombre'), 'Verano');
      await user.click(screen.getByRole('button', { name: 'Guardar' }));

      expect(createRouteProfile).toHaveBeenCalledWith({
        name: 'Verano',
        weights: { shade: 50, sun: 0, wind: 0, vegetation: 0 },
        maxDetourPercentage: 25,
      });
      expect(await screen.findByRole('button', { name: 'Verano' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));
      expect(getWeightedRouteComparison).toHaveBeenCalledWith(
        expect.objectContaining({ weights: { shade: 80, sun: 0 }, maxDetourPercentage: 10 }),
        { signal: expect.any(AbortSignal) }
      );
      expect(screen.getByRole('status')).toHaveTextContent('Calculando la ruta «Verano»');
    });

    it('goes back to the first route after deleting the chosen one', async () => {
      const user = userEvent.setup();
      deleteRouteProfile.mockResolvedValue();
      render(<App />);
      // Editing is offered once the routes of the user have arrived.
      await screen.findByRole('button', { name: 'Nueva ruta' });

      await user.click(screen.getByRole('button', { name: 'Soleada' }));
      await user.click(screen.getByRole('button', { name: 'Borrar Soleada' }));
      await user.click(screen.getByRole('button', { name: 'Borrar' }));

      expect(deleteRouteProfile).toHaveBeenCalledWith(3);
      expect(screen.queryByRole('button', { name: 'Soleada' })).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Rápida' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('offers the presets without editing when the routes cannot be loaded', async () => {
      listRouteProfiles.mockRejectedValue(new Error('offline'));
      render(<App />);

      expect(await screen.findByText(/No se han podido cargar tus rutas/)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Sombreada' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: 'Nueva ruta' })).not.toBeInTheDocument();
    });
  });

  describe('recommended route (PBI-9.1)', () => {
    const line = (lng) => ({
      type: 'LineString',
      coordinates: [
        [-0.89, 41.65],
        [lng, 41.66],
      ],
    });
    const fastest = {
      geometry: line(-0.88),
      distance: 1000,
      duration: 600,
      exposure: { status: 'available', shadePercentage: 10, sunPercentage: 90 },
      windExposure: { status: 'available', exposure: 0 },
    };
    const shaded = {
      ...fastest,
      geometry: line(-0.87),
      distance: 1100,
      duration: 660,
      exposure: { status: 'available', shadePercentage: 80, sunPercentage: 20 },
    };
    const recommendation = {
      criterion: 'hot',
      label: 'Calor',
      reason:
        'Hace calor (sensación de 31 °C): se busca sombra aceptando hasta un 25 % más de tiempo.',
      weights: { shade: 50, sun: 0, wind: 0 },
      maxDetourPercentage: 25,
      weather: {
        temperature: 30,
        apparentTemperature: 31,
        windSpeed: 8,
        windGusts: 20,
        windDirection: 300,
        observedAt: '2026-07-15T13:00',
      },
      rules: [],
    };

    it('goes first in the row, but the fastest route is still the default', async () => {
      render(<App />);
      await screen.findByRole('button', { name: 'Nueva ruta' });

      const cards = within(document.querySelector('.route-profile-list')).getAllByRole('button');
      expect(cards[0]).toHaveAccessibleName('Recomendada');
      expect(cards[0]).toHaveAttribute('aria-pressed', 'false');
      expect(screen.getByRole('button', { name: 'Rápida' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
    });

    it('is calculated for now with the weather and explains the criterion', async () => {
      const user = userEvent.setup();
      getRecommendedRoute.mockResolvedValue({
        status: 'selected',
        fastest,
        shaded,
        additionalDurationSeconds: 60,
        shadeImprovementPercentagePoints: 70,
        windChangePoints: 0,
        recommendation,
      });
      render(<App />);
      await screen.findByRole('button', { name: 'Nueva ruta' });

      await user.click(screen.getByRole('button', { name: 'Recomendada' }));
      // Always for now: no date or time, and nothing to edit or delete.
      expect(screen.queryByLabelText('Hora')).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      expect(getRecommendedRoute).toHaveBeenCalledWith(
        { origin: expect.any(Object), destination: expect.any(Object) },
        { signal: expect.any(AbortSignal) }
      );
      expect(getWeightedRouteComparison).not.toHaveBeenCalled();
      expect(getFastestRoute).not.toHaveBeenCalled();
      expect(
        await screen.findByRole('heading', { name: 'Recomendada: Calor' })
      ).toBeInTheDocument();
      expect(screen.getByText(recommendation.reason)).toBeInTheDocument();
      expect(screen.getByRole('meter', { name: 'Sombra o sol' })).toHaveAttribute(
        'aria-valuetext',
        'Sombra 50 %'
      );
      expect(screen.getByText(/Tiempo usado \(dato de las 13:00\): 30 °C/)).toBeInTheDocument();
      expect(screen.getByText('Recomendada añade 1 min.')).toBeInTheDocument();
      // The comfort breakdown (PBI-11) explains the recommended route with the weights applied.
      expect(
        screen.getByRole('heading', { name: 'Confort de la ruta «Recomendada»' })
      ).toBeVisible();
      expect(screen.getByText(/«Recomendada» va a la sombra el \d+ % del recorrido/)).toHaveClass(
        'is-asked'
      );
      expect(screen.getByTestId('route-geometry')).toHaveTextContent(
        JSON.stringify(shaded.geometry.coordinates)
      );
    });

    it('shows the fastest route when the weather recommends it', async () => {
      const user = userEvent.setup();
      getRecommendedRoute.mockResolvedValue({
        status: 'fastest_only',
        fastest: { ...fastest, exposure: undefined },
        shaded: null,
        additionalDurationSeconds: null,
        recommendation: {
          ...recommendation,
          criterion: 'mild',
          label: 'Tiempo templado',
          reason:
            'Temperatura agradable (sensación de 17 °C) y poco viento (13 km/h): la ruta recomendada es la más rápida.',
          weights: { shade: 0, sun: 0, wind: 0 },
        },
      });
      render(<App />);
      await screen.findByRole('button', { name: 'Nueva ruta' });

      await user.click(screen.getByRole('button', { name: 'Recomendada' }));
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByText('Select map point'));
      await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

      expect(
        await screen.findByRole('heading', { name: 'Recomendada: Tiempo templado' })
      ).toBeInTheDocument();
      expect(
        screen.getByText('Con el tiempo actual, la ruta recomendada es la más rápida.')
      ).toBeInTheDocument();
      expect(screen.getByTestId('route-geometry')).toHaveTextContent(
        JSON.stringify(fastest.geometry.coordinates)
      );
      expect(screen.getByRole('button', { name: 'Iniciar ruta' })).toBeInTheDocument();
    });
  });
});
