const distanceFormatter = new Intl.NumberFormat('es-ES', {
  maximumFractionDigits: 1,
});

export function formatRouteDuration(durationInSeconds) {
  const minutes = durationInSeconds > 0 ? Math.ceil(durationInSeconds / 60) : 0;
  return `${minutes} min`;
}

// Extra time of an alternative: in seconds under a minute, so "25 s" is not shown as "1 min".
export function formatExtraDuration(seconds) {
  if (!(seconds > 0)) return '0 s';
  return seconds < 60 ? `${Math.round(seconds)} s` : formatRouteDuration(seconds);
}

export function formatRouteDistance(distanceInMetres) {
  if (distanceInMetres < 1000) {
    return `${Math.round(distanceInMetres)} m`;
  }

  return `${distanceFormatter.format(distanceInMetres / 1000)} km`;
}

function ClockIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="8" />
      <path d="M12 7v5l3 2" />
    </svg>
  );
}

function DistanceIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <path d="M7 5H5a3 3 0 0 0 0 6h14a3 3 0 0 1 0 6h-2" />
      <circle cx="9" cy="5" r="2" />
      <path d="m9 7 0 2" />
      <path d="m14 15 3 2-3 2" />
    </svg>
  );
}

export function RouteSummary({
  distance,
  duration,
  shadePercentage = null,
  greenPercentage = null,
  title = 'Ruta rápida',
}) {
  return (
    <section className="route-summary" aria-labelledby="route-summary-title">
      <div className="route-summary-heading">
        <span className="route-summary-mark" aria-hidden="true" />
        <div>
          <h3 id="route-summary-title">{title}</h3>
          <p>A pie</p>
        </div>
      </div>
      <dl className="route-summary-metrics">
        <div className="route-summary-metric">
          <ClockIcon />
          <dt>Tiempo</dt>
          <dd>{formatRouteDuration(duration)}</dd>
        </div>
        {Number.isFinite(shadePercentage) && (
          <div className="route-summary-metric route-summary-shade">
            <span aria-hidden="true">☂</span>
            <dt>Sombra</dt>
            <dd>{Math.round(shadePercentage)} %</dd>
          </div>
        )}
        {Number.isFinite(greenPercentage) && (
          <div className="route-summary-metric route-summary-green">
            <span aria-hidden="true">❦</span>
            <dt>Verde</dt>
            <dd>{Math.round(greenPercentage)} %</dd>
          </div>
        )}
        <div className="route-summary-metric">
          <DistanceIcon />
          <dt>Distancia</dt>
          <dd>{formatRouteDistance(distance)}</dd>
        </div>
      </dl>
    </section>
  );
}
