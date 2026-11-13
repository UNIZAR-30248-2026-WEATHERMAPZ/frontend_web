import { useEffect, useState } from 'react';

import { getCurrentWeather } from '../../services/api/weatherApi.js';
import { getWeatherDescription, getWindDirectionLabel } from './weatherConditions.js';

function formatObservedTime(time) {
  const date = new Date(time);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat('es-ES', {
    hour: '2-digit',
    minute: '2-digit',
    timeZone: 'Europe/Madrid',
  }).format(date);
}

export function WeatherPanel() {
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    const controller = new AbortController();
    getCurrentWeather({ signal: controller.signal })
      .then((currentWeather) => {
        setWeather(currentWeather);
        setStatus('ready');
      })
      .catch(() => {
        if (!controller.signal.aborted) setStatus('error');
      });
    return () => controller.abort();
  }, []);

  const observedTime = weather ? formatObservedTime(weather.time) : null;

  return (
    <section className="weather-panel" aria-label="Tiempo actual de Zaragoza" aria-live="polite">
      <header className="weather-panel-header">
        <h2>Tiempo ahora</h2>
        <span>Zaragoza</span>
      </header>
      {status === 'loading' && <p role="status">Consultando el tiempo…</p>}
      {status === 'error' && (
        <p className="weather-panel-message" role="alert">
          No se ha podido obtener el tiempo actual. El mapa y las rutas siguen disponibles.
        </p>
      )}
      {status === 'ready' && (
        <>
          <dl className="weather-metrics">
            <div>
              <dt>Temperatura</dt>
              <dd>
                {weather.temperature} {weather.temperatureUnit}
              </dd>
            </div>
            <div>
              <dt>Viento</dt>
              <dd>
                {weather.windSpeed} {weather.windSpeedUnit}{' '}
                {getWindDirectionLabel(weather.windDirection) || 'dirección no disponible'}
              </dd>
            </div>
            <div>
              <dt>Cielo</dt>
              <dd>{getWeatherDescription(weather.weatherCode)}</dd>
            </div>
          </dl>
          {(Number.isFinite(weather.apparentTemperature) || Number.isFinite(weather.windGusts)) && (
            <details className="weather-extra">
              <summary>Más datos</summary>
              <dl className="weather-extra-metrics">
                {Number.isFinite(weather.apparentTemperature) && (
                  <div>
                    <dt>Sensación térmica</dt>
                    <dd>
                      {weather.apparentTemperature} {weather.apparentTemperatureUnit || '°C'}
                    </dd>
                  </div>
                )}
                {Number.isFinite(weather.windGusts) && (
                  <div>
                    <dt>Rachas</dt>
                    <dd>
                      {weather.windGusts} {weather.windGustsUnit || weather.windSpeedUnit}
                    </dd>
                  </div>
                )}
              </dl>
            </details>
          )}
          {observedTime && (
            <p className="weather-observed-time">Estimación para las {observedTime}</p>
          )}
        </>
      )}
      <a
        className="weather-attribution"
        href="https://open-meteo.com/"
        target="_blank"
        rel="noreferrer"
      >
        Datos meteorológicos: Open-Meteo
      </a>
    </section>
  );
}
