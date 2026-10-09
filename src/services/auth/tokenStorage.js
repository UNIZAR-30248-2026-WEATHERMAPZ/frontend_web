const TOKEN_KEY = 'weathermapz.authToken';

// localStorage can throw (private mode, blocked storage); without it the session simply
// is not remembered between visits.
export function getStoredToken() {
  try {
    return window.localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

export function storeToken(token) {
  try {
    window.localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // The session still works until the page is closed.
  }
}

export function clearStoredToken() {
  try {
    window.localStorage.removeItem(TOKEN_KEY);
  } catch {
    // Nothing stored, nothing to clear.
  }
}
