import { useEffect, useId, useRef, useState } from 'react';

import { getCurrentWeather } from '../../services/api/weatherApi.js';
import { WeatherIcon } from './WeatherIcon.jsx';
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

const roundedTemperature = (weather) =>
  Number.isFinite(weather.temperature)
    ? `${Math.round(weather.temperature)} ${weather.temperatureUnit || '°C'}`
    : '—';

// Pastilla con el tiempo actual sobre el mapa; al pulsarla se despliega el detalle.
export function WeatherPanel() {
  const [weather, setWeather] = useState(null);
  const [status, setStatus] = useState('loading');
  const [open, setOpen] = useState(false);
  const detailsId = useId();
  const rootRef = useRef(null);
  const buttonRef = useRef(null);

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

  // Se cierra con Escape o al pulsar fuera, como el menú de usuario.
  useEffect(() => {
    if (!open) return undefined;
    const onKeyDown = (event) => {
      if (event.key === 'Escape') {
        setOpen(false);
        buttonRef.current?.focus();
      }
    };
    const onPointerDown = (event) => {
      if (!rootRef.current?.contains(event.target)) setOpen(false);
    };
    document.addEventListener('keydown', onKeyDown);
    document.addEventListener('pointerdown', onPointerDown);
    return () => {
      document.removeEventListener('keydown', onKeyDown);
      document.removeEventListener('pointerdown', onPointerDown);
    };
  }, [open]);

  const observedTime = weather ? formatObservedTime(weather.time) : null;
  const windDirection = weather ? getWindDirectionLabel(weather.windDirection) : null;
  const description = weather ? getWeatherDescription(weather.weatherCode) : null;

  let buttonLabel = 'Consultando el tiempo actual';
  if (status === 'ready') {
    buttonLabel = `Tiempo ahora: ${roundedTemperature(weather)}, ${description}. ${
      open ? 'Ocultar' : 'Ver'
    } detalles`;
  } else if (status === 'error') {
    buttonLabel = `Tiempo no disponible. ${open ? 'Ocultar' : 'Ver'} detalles`;
  }

  return (
    <section
      ref={rootRef}
      className={`weather-panel${open ? ' is-open' : ''}`}
      aria-label="Tiempo actual de Zaragoza"
    >
      <button
        ref={buttonRef}
        type="button"
        className="weather-pill"
        aria-expanded={open}
        aria-controls={detailsId}
        aria-label={buttonLabel}
        disabled={status === 'loading'}
        onClick={() => setOpen((value) => !value)}
      >
        <WeatherIcon code={status === 'ready' ? weather.weatherCode : null} />
        {status === 'loading' && <span className="weather-pill-temp">…</span>}
        {status === 'error' && <span className="weather-pill-temp">—</span>}
        {status === 'ready' && (
          <>
            <span className="weather-pill-temp">{roundedTemperature(weather)}</span>
            <span className="weather-pill-wind">
              {Math.round(weather.windSpeed)} {weather.windSpeedUnit}
              {windDirection ? ` ${windDirection}` : ''}
            </span>
          </>
        )}
      </button>

      {status === 'loading' && (
        <p className="visually-hidden" role="status">
          Consultando el tiempo…
        </p>
      )}
      {status === 'error' && (
        <p className="visually-hidden" role="alert">
          No se ha podido obtener el tiempo actual. El mapa y las rutas siguen disponibles.
        </p>
      )}

      <div id={detailsId} className="weather-details" hidden={!open}>
        <header className="weather-panel-header">
          <h2>Tiempo ahora</h2>
          <span>Zaragoza</span>
        </header>
        {status === 'error' && (
          <p className="weather-panel-message">
            No se ha podido obtener el tiempo actual. El mapa y las rutas siguen disponibles.
          </p>
        )}
        {status === 'ready' && (
          <>
            <p className="weather-sky">
              <WeatherIcon code={weather.weatherCode} />
              {description}
            </p>
            <dl className="weather-metrics">
              <div>
                <dt>Temperatura</dt>
                <dd>
                  {weather.temperature} {weather.temperatureUnit}
                </dd>
              </div>
              {Number.isFinite(weather.apparentTemperature) && (
                <div>
                  <dt>Sensación</dt>
                  <dd>
                    {weather.apparentTemperature} {weather.apparentTemperatureUnit || '°C'}
                  </dd>
                </div>
              )}
              <div>
                <dt>Viento</dt>
                <dd>
                  {weather.windSpeed} {weather.windSpeedUnit}{' '}
                  {windDirection || 'dirección no disponible'}
                </dd>
              </div>
              {Number.isFinite(weather.windGusts) && (
                <div>
                  <dt>Rachas</dt>
                  <dd>
                    {weather.windGusts} {weather.windGustsUnit || weather.windSpeedUnit}
                  </dd>
                </div>
              )}
            </dl>
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
      </div>
    </section>
  );
}
