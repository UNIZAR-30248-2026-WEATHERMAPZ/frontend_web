import { ProfileIcon } from '../route-profiles/ProfileIcon.jsx';
import { SHADE_SUN_MAX, balanceText, shadeSunBalance } from '../route-profiles/shadeSun.js';

const COMPASS = ['N', 'NE', 'E', 'SE', 'S', 'SO', 'O', 'NO'];
const numberFormat = new Intl.NumberFormat('es-ES', { maximumFractionDigits: 1 });
const format = (value) => numberFormat.format(value);

// Where the wind comes from, as the eight points of the compass.
export function compassPoint(directionDeg) {
  return COMPASS[Math.round((((directionDeg % 360) + 360) % 360) / 45) % 8];
}

// The local time of the Open-Meteo value ("2026-11-12T10:45" → "10:45").
const observedTime = (observedAt) =>
  typeof observedAt === 'string' && observedAt.length >= 16 ? observedAt.slice(11, 16) : null;

export function weatherSummary(weather) {
  if (!weather) return 'No hay datos del tiempo actual.';
  const time = observedTime(weather.observedAt);
  const feels = Number.isFinite(weather.apparentTemperature)
    ? ` (sensación ${format(weather.apparentTemperature)} °C)`
    : '';
  const gusts = Number.isFinite(weather.windGusts)
    ? `, rachas de ${format(weather.windGusts)} km/h`
    : '';
  return (
    `Tiempo usado${time ? ` (dato de las ${time})` : ''}: ${format(weather.temperature)} °C${feels}` +
    ` · viento de ${format(weather.windSpeed)} km/h del ${compassPoint(weather.windDirection)}${gusts}.`
  );
}

/**
 * Why the recommended route (PBI-9.1) is what it is: the criterion, the reason, the weights the
 * backend applied (same icons and 0-100 scale as the route editor) and the weather it used. On small
 * screens it folds with the comparison and keeps only the criterion and the reason.
 */
export function RecommendationCard({ recommendation, isExpanded = true }) {
  if (!recommendation) return null;
  const { label, reason, weights, maxDetourPercentage, weather } = recommendation;
  const vegetation = weights.vegetation ?? 0;
  const weighs = weights.shade > 0 || weights.sun > 0 || weights.wind > 0 || vegetation > 0;
  const balance = shadeSunBalance(weights);
  // Fill of the shade-sun bar from the centre: to the left for shade, to the right for sun.
  const fill = {
    left: `${50 - Math.max(0, -balance) / 2}%`,
    width: `${Math.abs(balance) / 2}%`,
  };

  return (
    <section
      className={`panel-section recommendation-card ${isExpanded ? '' : 'is-collapsed'}`}
      aria-labelledby="recommendation-title"
    >
      <h2 id="recommendation-title">
        <ProfileIcon kind="recommended" />
        Recomendada: {label}
      </h2>
      <p className="recommendation-reason" role="status">
        {reason}
      </p>
      <div className="recommendation-details">
        <ul className="recommendation-weights" aria-label="Pesos aplicados">
          {/* The same scale as the route editor: one bar from shade to sun (ADR-030). */}
          <li className="recommendation-weight recommendation-weight-shade-sun">
            <ProfileIcon kind={balance > 0 ? 'sun' : 'shade'} />
            <span id="recommendation-weight-shade-sun">Sombra o sol</span>
            <span
              className={`shade-sun-scale ${balance > 0 ? 'is-sun' : 'is-shade'}`}
              role="meter"
              aria-labelledby="recommendation-weight-shade-sun"
              aria-valuemin={-SHADE_SUN_MAX}
              aria-valuemax={SHADE_SUN_MAX}
              aria-valuenow={balance}
              aria-valuetext={balanceText(balance)}
            >
              <span className="shade-sun-scale-fill" style={fill} />
            </span>
            <span className="recommendation-weight-value">{balanceText(balance)}</span>
          </li>
          <li className="recommendation-weight recommendation-weight-wind">
            <ProfileIcon kind="wind" />
            <span id="recommendation-weight-wind">Evitar viento</span>
            <meter
              min="0"
              max="100"
              value={weights.wind}
              aria-labelledby="recommendation-weight-wind"
            />
            <span className="recommendation-weight-value">{weights.wind} %</span>
          </li>
          <li className="recommendation-weight recommendation-weight-vegetation">
            <ProfileIcon kind="vegetation" />
            <span id="recommendation-weight-vegetation">Verde</span>
            <meter
              min="0"
              max="100"
              value={vegetation}
              aria-labelledby="recommendation-weight-vegetation"
            />
            <span className="recommendation-weight-value">{vegetation} %</span>
          </li>
          <li className="recommendation-weight recommendation-weight-time">
            <ProfileIcon kind="time" />
            <span>Tiempo extra máximo</span>
            <span className="recommendation-weight-value">
              {weighs ? `+${maxDetourPercentage} %` : 'Sin rodeo'}
            </span>
          </li>
        </ul>
        <p className="recommendation-weather">{weatherSummary(weather)}</p>
        {weather && <p className="recommendation-attribution">Datos del tiempo: Open-Meteo.</p>}
      </div>
    </section>
  );
}
