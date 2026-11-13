import { act, render, screen } from '@testing-library/react';

import { getCurrentWeather } from '../../services/api/weatherApi.js';
import { WeatherPanel } from './WeatherPanel.jsx';

jest.mock('../../services/api/weatherApi.js', () => ({
  getCurrentWeather: jest.fn(),
}));

describe('WeatherPanel', () => {
  const weather = {
    temperature: 17.5,
    temperatureUnit: '°C',
    windSpeed: 9.2,
    windSpeedUnit: 'km/h',
    windDirection: 240,
    weatherCode: 3,
    time: '2026-11-12T13:00',
  };

  beforeEach(() => getCurrentWeather.mockReset());

  it('shows a loading state while the current weather is being retrieved', () => {
    getCurrentWeather.mockReturnValue(new Promise(() => {}));

    render(<WeatherPanel />);

    expect(screen.getByRole('status')).toHaveTextContent('Consultando el tiempo');
    expect(screen.getByLabelText('Tiempo actual de Zaragoza')).toBeInTheDocument();
  });

  it('shows temperature, wind direction and sky condition returned by the API', async () => {
    getCurrentWeather.mockResolvedValue(weather);

    render(<WeatherPanel />);

    expect(await screen.findByText('17.5 °C')).toBeInTheDocument();
    expect(screen.getByText('9.2 km/h SO')).toBeInTheDocument();
    expect(screen.getByText('Cubierto')).toBeInTheDocument();
    expect(screen.getByText(/Estimación para las/)).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Open-Meteo/ })).toHaveAttribute(
      'href',
      'https://open-meteo.com/'
    );
  });

  it('keeps the app usable and shows a clear message when the API fails', async () => {
    getCurrentWeather.mockRejectedValue(new Error('provider unavailable'));

    render(<WeatherPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El mapa y las rutas siguen disponibles'
    );
    expect(screen.getByRole('link', { name: /Open-Meteo/ })).toBeInTheDocument();
  });

  it('announces that the sky condition is unavailable when Open-Meteo omits its code', async () => {
    getCurrentWeather.mockResolvedValue({ ...weather, weatherCode: null });

    await act(async () => render(<WeatherPanel />));

    expect(await screen.findByText('Estado del cielo no disponible')).toBeInTheDocument();
  });
});
