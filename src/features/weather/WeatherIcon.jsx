// Icono del estado del cielo a partir del código WMO de Open-Meteo.
function weatherKind(code) {
  if (!Number.isInteger(code)) return 'unknown';
  if (code <= 1) return 'clear';
  if (code === 2) return 'partly';
  if (code <= 48) return 'cloudy';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code >= 95) return 'storm';
  return 'rain';
}

const CLOUD = 'M7 18h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 11.2 3.5 3.5 0 0 0 7 18Z';

export function WeatherIcon({ code }) {
  const kind = weatherKind(code);
  return (
    <svg
      className={`weather-icon weather-icon-${kind}`}
      viewBox="0 0 24 24"
      aria-hidden="true"
      focusable="false"
    >
      {kind === 'clear' && (
        <>
          <circle cx="12" cy="12" r="4.2" />
          <path d="M12 2.5v2.2M12 19.3v2.2M2.5 12h2.2M19.3 12h2.2M5.3 5.3l1.6 1.6M17.1 17.1l1.6 1.6M5.3 18.7l1.6-1.6M17.1 6.9l1.6-1.6" />
        </>
      )}
      {kind === 'partly' && (
        <>
          <circle className="weather-icon-sun" cx="9" cy="8.5" r="3.3" />
          <path className="weather-icon-sun" d="M9 2.4v1.4M3 8.5h1.4M4.8 4.3l1 1M13.2 4.3l-1 1" />
          <path d="M8.5 19.5h8.5a3.6 3.6 0 0 0 .4-7.17 5.2 5.2 0 0 0-9.8.9A3.2 3.2 0 0 0 8.5 19.5Z" />
        </>
      )}
      {(kind === 'cloudy' || kind === 'unknown') && <path d={CLOUD} />}
      {kind === 'rain' && (
        <>
          <path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.2 3.5 3.5 0 0 0 7 15Z" />
          <path d="M8.5 18l-1 2.5M12.5 18l-1 2.5M16.5 18l-1 2.5" />
        </>
      )}
      {kind === 'snow' && (
        <>
          <path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.2 3.5 3.5 0 0 0 7 15Z" />
          <path d="M8 19h.01M12 20.5h.01M16 19h.01" strokeWidth="2.6" />
        </>
      )}
      {kind === 'storm' && (
        <>
          <path d="M7 15h10a4 4 0 0 0 .5-7.97A6 6 0 0 0 6.1 8.2 3.5 3.5 0 0 0 7 15Z" />
          <path d="M12.5 15.5l-2 3.5h3l-2 3.5" />
        </>
      )}
    </svg>
  );
}
