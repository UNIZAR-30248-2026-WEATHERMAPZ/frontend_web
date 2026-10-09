import { API_BASE_URL } from './apiEnvironment.js';
import { apiRequest } from './client.js';

// Full-page navigation: the backend redirects to Google and back to the frontend.
export const GOOGLE_LOGIN_URL = `${API_BASE_URL}/auth/google`;

const AUTH_ERROR_MESSAGES = {
  400: 'Revisa los datos marcados.',
  401: 'El correo o la contraseña no son correctos.',
  409: 'Ya existe una cuenta con este correo electrónico.',
  429: 'Demasiados intentos. Espera un momento e inténtalo de nuevo.',
  503: 'El inicio de sesión no está disponible ahora mismo.',
};
const AUTH_FALLBACK_MESSAGE = 'No se ha podido completar la operación. Inténtalo de nuevo.';
const INVALID_RESPONSE_MESSAGE = 'El servidor ha devuelto una respuesta no válida.';

function isValidUser(user) {
  return (
    Number.isInteger(user?.id) && typeof user.name === 'string' && typeof user.email === 'string'
  );
}

async function requestSession(path, body) {
  const data = await apiRequest(path, {
    method: 'POST',
    body: JSON.stringify(body),
    errorMessages: AUTH_ERROR_MESSAGES,
    fallbackErrorMessage: AUTH_FALLBACK_MESSAGE,
  });

  if (typeof data?.token !== 'string' || !data.token || !isValidUser(data.user)) {
    throw new Error(INVALID_RESPONSE_MESSAGE);
  }
  return { token: data.token, user: data.user };
}

export function registerUser({ name, email, password }) {
  return requestSession('/auth/register', { name, email, password });
}

export function loginUser({ email, password }) {
  return requestSession('/auth/login', { email, password });
}

export async function getCurrentUser({ signal } = {}) {
  const data = await apiRequest('/auth/me', {
    signal,
    errorMessages: { 401: 'Tu sesión ha caducado. Inicia sesión de nuevo.' },
    fallbackErrorMessage: 'No se ha podido comprobar tu sesión.',
  });

  if (!isValidUser(data?.user)) throw new Error(INVALID_RESPONSE_MESSAGE);
  return data.user;
}
