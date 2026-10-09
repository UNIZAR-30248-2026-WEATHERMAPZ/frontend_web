const GOOGLE_ERROR_MESSAGE = 'No se ha podido iniciar sesión con Google. Inténtalo de nuevo.';

/*
 * After the Google login the backend redirects to "/#authToken=..." or "/#authError=google".
 * Reads that fragment and removes it from the address bar so the token is not left in the
 * history or shared by copying the URL.
 */
export function consumeAuthRedirect(location = window.location, history = window.history) {
  const params = new URLSearchParams(location.hash.replace(/^#/, ''));
  const token = params.get('authToken');
  const error = params.get('authError');
  if (!token && !error) return {};

  history.replaceState(null, '', `${location.pathname}${location.search}`);
  return token ? { token } : { notice: GOOGLE_ERROR_MESSAGE };
}
