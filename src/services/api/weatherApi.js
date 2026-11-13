import { apiRequest } from './client.js';

const WEATHER_ERROR_MESSAGES = {
  429: 'El servicio meteorológico está ocupado. Inténtalo de nuevo en unos instantes.',
  502: 'Open-Meteo no está disponible ahora mismo.',
  503: 'El servicio meteorológico no está disponible ahora mismo.',
  504: 'La consulta meteorológica ha tardado demasiado.',
};

function isValidWeather(weather) {
  return (
    weather &&
    Number.isFinite(weather.temperature) &&
    typeof weather.temperatureUnit === 'string' &&
    Number.isFinite(weather.windSpeed) &&
    typeof weather.windSpeedUnit === 'string' &&
    Number.isFinite(weather.windDirection) &&
    weather.windDirection >= 0 &&
    weather.windDirection <= 360 &&
    typeof weather.time === 'string'
  );
}

export async function getCurrentWeather({ signal } = {}) {
  const data = await apiRequest('/weather/current', {
    signal,
    errorMessages: WEATHER_ERROR_MESSAGES,
    fallbackErrorMessage: 'No se ha podido obtener el tiempo de Zaragoza.',
  });

  if (!isValidWeather(data?.weather)) {
    throw new Error('El servidor ha devuelto datos meteorológicos no válidos.');
  }

  return data.weather;
}
