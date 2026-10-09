import { getStoredToken } from '../auth/tokenStorage.js';
import { API_BASE_URL } from './apiEnvironment.js';

const DEFAULT_ERROR_MESSAGES = {
  429: 'La búsqueda de lugares está ocupada. Inténtalo de nuevo en unos instantes.',
  503: 'La búsqueda de lugares no está configurada. Puedes seguir usando el mapa o el GPS.',
  504: 'La búsqueda ha tardado demasiado. Edita el texto para intentarlo de nuevo.',
};

let unauthorizedHandler = null;

// Called when the backend rejects the stored session (expired or invalid token).
export function setUnauthorizedHandler(handler) {
  unauthorizedHandler = handler;
}

async function readErrorBody(response) {
  try {
    return await response.json();
  } catch {
    return null;
  }
}

export async function apiRequest(
  path,
  {
    errorMessages = DEFAULT_ERROR_MESSAGES,
    fallbackErrorMessage = 'La búsqueda de lugares no está disponible ahora mismo.',
    ...options
  } = {}
) {
  const token = getStoredToken();
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    if (response.status === 401 && token) unauthorizedHandler?.();
    const body = await readErrorBody(response);
    const error = new Error(errorMessages[response.status] || fallbackErrorMessage);
    error.status = response.status;
    if (body?.error?.fields) error.fields = body.error.fields;
    throw error;
  }

  return response.json();
}
