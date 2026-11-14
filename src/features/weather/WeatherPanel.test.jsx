import { act, fireEvent, render, screen } from '@testing-library/react';

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
    expect(screen.getByRole('button', { name: /Consultando el tiempo/ })).toBeDisabled();
  });

  it('shows the rounded temperature and the wind in the pill', async () => {
    getCurrentWeather.mockResolvedValue(weather);

    render(<WeatherPanel />);

    const pill = await screen.findByRole('button', { name: /Tiempo ahora: 18 °C, Cubierto/ });
    expect(pill).toHaveTextContent('18 °C');
    expect(pill).toHaveTextContent('9 km/h SO');
    expect(pill).toHaveAttribute('aria-expanded', 'false');
  });

  it('opens the details with temperature, wind direction, sky condition and attribution', async () => {
    getCurrentWeather.mockResolvedValue({ ...weather, apparentTemperature: 16.1, windGusts: 21 });

    render(<WeatherPanel />);
    fireEvent.click(await screen.findByRole('button', { name: /Ver detalles/ }));

    expect(screen.getByRole('button', { name: /Ocultar detalles/ })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('17.5 °C')).toBeVisible();
    expect(screen.getByText('9.2 km/h SO')).toBeVisible();
    expect(screen.getByText('16.1 °C')).toBeVisible();
    expect(screen.getByText('21 km/h')).toBeVisible();
    expect(screen.getByText('Cubierto')).toBeVisible();
    expect(screen.getByText(/Estimación para las/)).toBeVisible();
    expect(screen.getByRole('link', { name: /Open-Meteo/ })).toHaveAttribute(
      'href',
      'https://open-meteo.com/'
    );
  });

  it('closes the details with Escape and returns the focus to the pill', async () => {
    getCurrentWeather.mockResolvedValue(weather);

    render(<WeatherPanel />);
    const pill = await screen.findByRole('button', { name: /Ver detalles/ });
    fireEvent.click(pill);
    fireEvent.keyDown(document, { key: 'Escape' });

    expect(pill).toHaveAttribute('aria-expanded', 'false');
    expect(pill).toHaveFocus();
    expect(screen.queryByRole('link', { name: /Open-Meteo/ })).not.toBeInTheDocument();
  });

  it('keeps the app usable and shows a clear message when the API fails', async () => {
    getCurrentWeather.mockRejectedValue(new Error('provider unavailable'));

    render(<WeatherPanel />);

    expect(await screen.findByRole('alert')).toHaveTextContent(
      'El mapa y las rutas siguen disponibles'
    );
    fireEvent.click(screen.getByRole('button', { name: /Tiempo no disponible/ }));
    expect(screen.getByRole('link', { name: /Open-Meteo/ })).toBeInTheDocument();
  });

  it('announces that the sky condition is unavailable when Open-Meteo omits its code', async () => {
    getCurrentWeather.mockResolvedValue({ ...weather, weatherCode: null });

    await act(async () => render(<WeatherPanel />));
    fireEvent.click(screen.getByRole('button', { name: /Estado del cielo no disponible/ }));

    expect(screen.getByText('Estado del cielo no disponible')).toBeVisible();
  });
});
