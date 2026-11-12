import { useEffect, useRef, useState } from 'react';

import { autocompletePlaces } from '../../services/api/geocodingApi.js';

const EMPTY = { errorMessage: '', isLoading: false, results: [] };

// `onSettled(results)` is called when a search ends (with [] if it failed), so that the field can act on
// suggestions that arrive after the user pressed Enter.
export function usePlaceAutocomplete(query, enabled = true, field = '', onSettled = null) {
  const text = query.trim();
  const key = enabled && text.length >= 3 ? `${field}:${text}` : '';
  const [state, setState] = useState({ ...EMPTY, key: '' });
  const onSettledRef = useRef(onSettled);

  useEffect(() => {
    onSettledRef.current = onSettled;
  });

  useEffect(() => {
    if (!key) return undefined;
    let current = true;
    const controller = new AbortController();
    let requestTimeout;
    const debounce = window.setTimeout(async () => {
      requestTimeout = window.setTimeout(() => controller.abort(), 12000);
      try {
        const data = await autocompletePlaces(text, { signal: controller.signal });
        if (current) {
          setState({ ...EMPTY, key, results: data.results });
          onSettledRef.current?.(data.results);
        }
      } catch (error) {
        if (current) onSettledRef.current?.([]);
        if (current)
          setState({
            ...EMPTY,
            key,
            errorMessage: controller.signal.aborted
              ? 'La búsqueda ha tardado demasiado. Edita el texto para intentarlo de nuevo.'
              : error.message || 'La búsqueda de lugares no está disponible ahora mismo.',
          });
      } finally {
        window.clearTimeout(requestTimeout);
      }
    }, 350);
    // Mark this exact query pending, including revisiting a previous query.
    setState({ ...EMPTY, key, isLoading: true });
    return () => {
      current = false;
      window.clearTimeout(debounce);
      window.clearTimeout(requestTimeout);
      controller.abort();
    };
  }, [key, text]);

  if (!key) return EMPTY;
  // Never display another query/field's suggestions, even before effects run.
  return state.key === key ? state : { ...EMPTY, isLoading: true };
}
