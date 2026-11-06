import { apiRequest } from './client.js';

const PROFILE_ERROR_MESSAGES = {
  400: 'Revisa los datos de la ruta.',
  404: 'Esa ruta ya no existe.',
  409: 'Ya tienes una ruta con ese nombre.',
};
const FALLBACK_MESSAGE = 'No se ha podido guardar la ruta. Inténtalo de nuevo.';
const INVALID_RESPONSE_MESSAGE = 'El servidor ha devuelto una ruta no válida.';

const isWeight = (value) => Number.isInteger(value) && value >= 0 && value <= 100;
const isDetour = (value) => Number.isInteger(value) && value >= 0 && value <= 40;

function isValidProfile(profile) {
  return (
    Number.isInteger(profile?.id) &&
    typeof profile.name === 'string' &&
    isWeight(profile.weights?.shade) &&
    isWeight(profile.weights?.sun) &&
    (profile.weights.wind === undefined || isWeight(profile.weights.wind)) &&
    isDetour(profile.maxDetourPercentage)
  );
}

// A backend older than PBI-8.2 sends no wind weight: it counts as 0.
function checkedProfile(profile) {
  if (!isValidProfile(profile)) throw new Error(INVALID_RESPONSE_MESSAGE);
  return { ...profile, weights: { wind: 0, ...profile.weights } };
}

// The backend repeats the message of a 409 (name or maximum reached) in the error itself.
async function saveRequest(path, method, { name, weights, maxDetourPercentage }) {
  try {
    const data = await apiRequest(path, {
      method,
      body: JSON.stringify({ name, weights, maxDetourPercentage }),
      errorMessages: PROFILE_ERROR_MESSAGES,
      fallbackErrorMessage: FALLBACK_MESSAGE,
    });
    return checkedProfile(data?.profile);
  } catch (error) {
    if (error.status === 409 && !error.fields) {
      error.message = 'No puedes guardar más rutas. Borra alguna para crear otra.';
    }
    throw error;
  }
}

export async function listRouteProfiles({ signal } = {}) {
  const data = await apiRequest('/route-profiles', {
    signal,
    fallbackErrorMessage: 'No se han podido cargar tus rutas.',
  });
  if (!Array.isArray(data?.profiles)) throw new Error(INVALID_RESPONSE_MESSAGE);
  return data.profiles.map(checkedProfile);
}

export function createRouteProfile(profile) {
  return saveRequest('/route-profiles', 'POST', profile);
}

export function updateRouteProfile(id, profile) {
  return saveRequest(`/route-profiles/${id}`, 'PUT', profile);
}

export async function deleteRouteProfile(id) {
  try {
    await apiRequest(`/route-profiles/${id}`, {
      method: 'DELETE',
      errorMessages: {},
      fallbackErrorMessage: 'No se ha podido borrar la ruta. Inténtalo de nuevo.',
    });
  } catch (error) {
    // Already gone counts as deleted.
    if (error.status !== 404) throw error;
  }
}
