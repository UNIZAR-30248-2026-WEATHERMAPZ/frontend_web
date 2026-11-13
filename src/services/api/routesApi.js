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

function isValidEnvironmentalRoute(route) {
  return (
    isValidRoute(route) &&
    isValidExposure(route.exposure) &&
    isValidWindExposure(route.windExposure)
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
  };

  if (!isValidComparison(comparison)) {
    throw new Error('El servidor ha devuelto una comparación no válida. Inténtalo de nuevo.');
  }

  return comparison;
}
