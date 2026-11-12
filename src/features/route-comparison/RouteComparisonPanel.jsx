import { formatRouteDistance, formatRouteDuration } from '../routing/RouteSummary.jsx';

const statusMessages = {
  no_better_alternative:
    'No hay una alternativa que mejore lo suficiente lo que has elegido dentro del tiempo extra permitido.',
  insufficient_exposure_data: 'No hay datos de exposición suficientes para comparar estas rutas.',
  sun_below_horizon: 'El Sol está bajo el horizonte en el momento seleccionado.',
  sun_too_low:
    'El Sol está demasiado bajo en el momento seleccionado para estimar la sombra. Prueba con una hora más central del día.',
  // Only the recommended route (PBI-9.1) asks for the fastest one alone.
  fastest_only: 'Con el tiempo actual, la ruta recomendada es la más rápida.',
};

// Without shade to compare, the reason must stay visible on small screens: the cards do not explain
// it. "No better alternative" is already readable from the disabled card.
const REASON_ALWAYS_VISIBLE = ['insufficient_exposure_data', 'sun_below_horizon', 'sun_too_low'];

// A route that only weighs wind has no shadows calculated (ADR-025): nothing to say about shade.
// The same when only the fastest route was asked for (a recommended route with every weight at 0).
const formatShade = (route) => {
  if (!route?.exposure || route.exposure.reason === 'not_requested') return null;
  return route?.exposure?.status === 'available'
    ? `${Math.round(route.exposure.shadePercentage)} % de sombra`
    : 'Sombra no disponible';
};

const formatWind = (route) =>
  route?.windExposure?.status === 'available'
    ? `${Math.round(route.windExposure.exposure)} % de exposición al viento`
    : null;

// Only when it was calculated (shade, sun or green weigh; PBI-10 phase B).
const formatGreen = (route) =>
  route?.vegetation?.status === 'available'
    ? `${Math.round(route.vegetation.greenPercentage)} % verde`
    : null;

const routeFactors = (route) =>
  [formatShade(route), formatWind(route), formatGreen(route)].filter(Boolean);

function RouteFactors({ route }) {
  return routeFactors(route).map((factor) => <span key={factor}>{factor}</span>);
}

function pointsChange(points, what) {
  const rounded = Math.round(points);
  return `${Math.abs(rounded)} puntos ${rounded >= 0 ? 'más' : 'menos'} de ${what}`;
}

// What the chosen route changes: shade, wind or both, whatever the weights compared.
function changesSummary(comparison) {
  const changes = [];
  if (Number.isFinite(comparison.shadeImprovementPercentagePoints)) {
    changes.push(pointsChange(comparison.shadeImprovementPercentagePoints, 'sombra'));
  }
  if (Number.isFinite(comparison.windChangePoints)) {
    changes.push(pointsChange(comparison.windChangePoints, 'exposición al viento'));
  }
  if (Number.isFinite(comparison.greenChangePercentagePoints)) {
    changes.push(pointsChange(comparison.greenChangePercentagePoints, 'verde'));
  }
  return changes.join(' y ');
}

function RouteTimeAndDistance({ route }) {
  return (
    <span>
      {formatRouteDuration(route.duration)}
      {Number.isFinite(route.distance) && (
        <span className="comparison-distance"> · {formatRouteDistance(route.distance)}</span>
      )}
    </span>
  );
}

export function RouteComparisonPanel({
  comparison,
  selectedRouteType,
  alternativeLabel = 'Con sombra',
  onSelectRoute,
  isExpanded = true,
  onToggleExpanded = null,
}) {
  if (!comparison) return null;
  const durationFactor = comparison.strategy?.maximumDurationFactor;
  const maxDetourPercentage = Number.isFinite(durationFactor)
    ? Math.round((durationFactor - 1) * 100)
    : null;
  const hasShadedRoute = Boolean(comparison.shaded);
  const showsShadedRoute = selectedRouteType === 'shaded' && hasShadedRoute;
  const selectedRoute = showsShadedRoute ? comparison.shaded : comparison.fastest;
  const resultClass = REASON_ALWAYS_VISIBLE.includes(comparison.status)
    ? 'comparison-result comparison-result-important'
    : 'comparison-result';

  return (
    <section
      className={`panel-section route-comparison ${isExpanded ? '' : 'is-collapsed'}`}
      aria-labelledby="route-comparison-title"
    >
      <div className="comparison-header">
        <h2 id="route-comparison-title">Comparación</h2>
        {!isExpanded && (
          <p className="comparison-collapsed-summary">
            <strong>{showsShadedRoute ? alternativeLabel : 'Más rápida'}</strong>
            {[formatRouteDuration(selectedRoute.duration), ...routeFactors(selectedRoute)]
              .map((part) => ` · ${part}`)
              .join('')}
          </p>
        )}
        {onToggleExpanded && (
          <button
            type="button"
            className="comparison-toggle"
            aria-expanded={isExpanded}
            onClick={onToggleExpanded}
          >
            {isExpanded ? 'Ver menos' : 'Ver más'}
          </button>
        )}
      </div>
      <div className="comparison-routes">
        <button
          type="button"
          className={selectedRouteType === 'fastest' ? 'is-selected' : ''}
          aria-pressed={selectedRouteType === 'fastest'}
          onClick={() => onSelectRoute('fastest')}
        >
          <strong>Más rápida</strong>
          <RouteTimeAndDistance route={comparison.fastest} />
          <RouteFactors route={comparison.fastest} />
        </button>
        <button
          type="button"
          className={selectedRouteType === 'shaded' ? 'is-selected' : ''}
          aria-pressed={selectedRouteType === 'shaded'}
          disabled={!hasShadedRoute}
          onClick={() => onSelectRoute('shaded')}
        >
          <strong>{alternativeLabel}</strong>
          {hasShadedRoute ? (
            <>
              <RouteTimeAndDistance route={comparison.shaded} />
              <RouteFactors route={comparison.shaded} />
            </>
          ) : (
            <span>Sin alternativa</span>
          )}
        </button>
      </div>
      {comparison.status === 'selected' ? (
        <p className={resultClass}>
          {alternativeLabel} añade {formatRouteDuration(comparison.additionalDurationSeconds)}
          {changesSummary(comparison) ? ` y tiene ${changesSummary(comparison)}` : ''}.
        </p>
      ) : (
        <p className={resultClass} role="status">
          {comparison.status === 'no_better_alternative' && maxDetourPercentage !== null
            ? `No hay una alternativa que mejore lo suficiente lo que has elegido sin tardar más de un ${maxDetourPercentage} % extra.`
            : statusMessages[comparison.status] || 'No hay una comparación disponible.'}
        </p>
      )}
    </section>
  );
}
