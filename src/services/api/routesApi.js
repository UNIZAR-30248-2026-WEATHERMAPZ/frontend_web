import { apiRequest } from './client.js';

export function getApiHealth() {
  return apiRequest('/health');
}

const ROUTE_ERROR_MESSAGES = {
  401: 'Tu sesión ha caducado. Inicia sesión de nuevo para calcular rutas.',
  400: 'El origen o el destino no son válidos.',
  429: 'El servicio de rutas está ocupado. Inténtalo de nuevo en unos instantes.',
  500: 'El servidor ha encontrado un problema al calcular la ruta. Inténtalo otra vez.',
  502: 'OpenRouteService no ha podido responder. Espera un momento y vuelve a calcular la ruta.',
  503: 'El cálculo de rutas no está configurado.',
  504: 'El cálculo de la ruta ha tardado demasiado. Inténtalo de nuevo.',
};

function isValidRoute(route) {
  return (
    route?.geometry?.type === 'LineString' &&
    Array.isArray(route.geometry.coordinates) &&
    route.geometry.coordinates.length >= 2 &&
    route.geometry.coordinates.every(
      (coordinate) =>
        Array.isArray(coordinate) &&
        coordinate.length >= 2 &&
        Number.isFinite(coordinate[0]) &&
        Number.isFinite(coordinate[1])
    ) &&
    Number.isFinite(route.distance) &&
    route.distance >= 0 &&
    Number.isFinite(route.duration) &&
    route.duration >= 0
  );
}

export async function getFastestRoute({ origin, destination }, { signal } = {}) {
  const data = await apiRequest('/routes/fastest', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
    }),
    errorMessages: ROUTE_ERROR_MESSAGES,
    fallbackErrorMessage: 'No se ha podido calcular la ruta. Inténtalo de nuevo.',
  });

  if (!isValidRoute(data?.route)) {
    throw new Error('El servidor ha devuelto una ruta no válida. Inténtalo de nuevo.');
  }

  return data.route;
}

function isValidExposure(exposure) {
  if (exposure?.status === 'unavailable') {
    return exposure.shadePercentage === null && exposure.sunPercentage === null;
  }
  return (
    exposure?.status === 'available' &&
    Number.isFinite(exposure.shadePercentage) &&
    exposure.shadePercentage >= 0 &&
    exposure.shadePercentage <= 100 &&
    Number.isFinite(exposure.sunPercentage) &&
    exposure.sunPercentage >= 0 &&
    exposure.sunPercentage <= 100
  );
}

// Wind exposure of the route (PBI-8.2), 0-100. The Shaded Route of PBI-5.4 does not send it.
function isValidWindExposure(windExposure) {
  if (windExposure === undefined || windExposure?.status === 'unavailable') {
    return windExposure === undefined || windExposure.exposure === null;
  }
  return (
    windExposure?.status === 'available' &&
    Number.isFinite(windExposure.exposure) &&
    windExposure.exposure >= 0 &&
    windExposure.exposure <= 100
  );
}

// Green percentage of the route (PBI-10 phase B), 0-100.
function isValidVegetation(vegetation) {
  if (vegetation === undefined || vegetation?.status === 'unavailable') {
    return vegetation === undefined || vegetation.greenPercentage === null;
  }
  return (
    vegetation?.status === 'available' &&
    Number.isFinite(vegetation.greenPercentage) &&
    vegetation.greenPercentage >= 0 &&
    vegetation.greenPercentage <= 100
  );
}

function isValidEnvironmentalRoute(route) {
  return (
    isValidRoute(route) &&
    isValidExposure(route.exposure) &&
    isValidWindExposure(route.windExposure) &&
    isValidVegetation(route.vegetation)
  );
}

function isValidComparison(comparison) {
  return (
    comparison &&
    typeof comparison.status === 'string' &&
    isValidEnvironmentalRoute(comparison.fastest) &&
    (comparison.shaded === null || isValidEnvironmentalRoute(comparison.shaded)) &&
    (comparison.additionalDurationSeconds === null ||
      (Number.isFinite(comparison.additionalDurationSeconds) &&
        comparison.additionalDurationSeconds >= 0))
  );
}

// Same shape as the Shaded Route comparison: the route chosen with the weights takes the place of
// the shaded one.
export async function getWeightedRouteComparison(
  { origin, destination, date, time, timeZone, weights, maxDetourPercentage },
  { signal } = {}
) {
  const data = await apiRequest('/routes/weighted', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
      date,
      time,
      timeZone,
      weights,
      maxDetourPercentage,
    }),
    errorMessages: ROUTE_ERROR_MESSAGES,
    fallbackErrorMessage: 'No se ha podido calcular la ruta. Inténtalo de nuevo.',
  });
  const comparison = data?.comparison && {
    ...data.comparison,
    shaded: data.comparison.selected ?? null,
    shadeImprovementPercentagePoints: data.comparison.shadeChangePercentagePoints ?? null,
    windChangePoints: data.comparison.windChangePoints ?? null,
    greenChangePercentagePoints: data.comparison.greenChangePercentagePoints ?? null,
  };

  if (!isValidComparison(comparison)) {
    throw new Error('El servidor ha devuelto una comparación no válida. Inténtalo de nuevo.');
  }

  return comparison;
}

const WEIGHT_KEYS = ['shade', 'sun', 'wind'];

// The weights and the reason chosen by the backend with the current weather (PBI-9.1, ADR-029).
function isValidRecommendation(recommendation) {
  return (
    typeof recommendation?.criterion === 'string' &&
    typeof recommendation.label === 'string' &&
    typeof recommendation.reason === 'string' &&
    WEIGHT_KEYS.every(
      (key) =>
        Number.isFinite(recommendation.weights?.[key]) &&
        recommendation.weights[key] >= 0 &&
        recommendation.weights[key] <= 100
    ) &&
    Number.isFinite(recommendation.maxDetourPercentage) &&
    (recommendation.weather === null || Number.isFinite(recommendation.weather?.temperature))
  );
}

// With every weight at 0 the backend only asks for the fastest route: it has no shade exposure.
function isValidRecommendedComparison(comparison) {
  if (comparison?.status === 'fastest_only') {
    return (
      isValidRoute(comparison.fastest) &&
      isValidWindExposure(comparison.fastest.windExposure) &&
      comparison.shaded === null
    );
  }
  return isValidComparison(comparison);
}

// Recommended route (PBI-9.1): only the points. It is always for now, with the current weather, so
// no date or time is sent. Same shape as the weighted comparison, plus `recommendation`.
export async function getRecommendedRoute({ origin, destination }, { signal } = {}) {
  const data = await apiRequest('/routes/recommended', {
    method: 'POST',
    signal,
    body: JSON.stringify({
      origin: { lat: origin.lat, lng: origin.lng },
      destination: { lat: destination.lat, lng: destination.lng },
    }),
    errorMessages: ROUTE_ERROR_MESSAGES,
    fallbackErrorMessage: 'No se ha podido calcular la ruta. Inténtalo de nuevo.',
  });
  const comparison = data?.comparison && {
    ...data.comparison,
    shaded: data.comparison.selected ?? null,
    shadeImprovementPercentagePoints: data.comparison.shadeChangePercentagePoints ?? null,
    windChangePoints: data.comparison.windChangePoints ?? null,
    greenChangePercentagePoints: data.comparison.greenChangePercentagePoints ?? null,
  };

  if (
    !isValidRecommendedComparison(comparison) ||
    !isValidRecommendation(comparison.recommendation)
  ) {
    throw new Error('El servidor ha devuelto una ruta recomendada no válida. Inténtalo de nuevo.');
  }

  return comparison;
}
