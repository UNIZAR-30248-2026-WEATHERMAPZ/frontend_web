import { useEffect, useRef, useState } from 'react';

import {
  getFastestRoute,
  getRecommendedRoute,
  getWeightedRouteComparison,
} from '../../services/api/routesApi.js';

const EMPTY_STATE = {
  status: 'idle',
  fastest: null,
  shaded: null,
  comparison: null,
  errorMessage: '',
};

export function useRoutePlanner() {
  const [state, setState] = useState(EMPTY_STATE);
  const controllerRef = useRef(null);
  const requestIdRef = useRef(0);

  function clearRoutes() {
    requestIdRef.current += 1;
    controllerRef.current?.abort();
    controllerRef.current = null;
    setState(EMPTY_STATE);
  }

  async function calculateRoute(origin, destination, options = {}) {
    controllerRef.current?.abort();
    const controller = new AbortController();
    const requestId = requestIdRef.current + 1;
    requestIdRef.current = requestId;
    controllerRef.current = controller;
    setState({ ...EMPTY_STATE, status: 'loading' });

    try {
      // The recommended route (PBI-9.1): the backend chooses the weights with the current weather.
      if (options.recommended) {
        const comparison = await getRecommendedRoute(
          { origin, destination },
          { signal: controller.signal }
        );
        if (requestId !== requestIdRef.current || controller.signal.aborted) return null;
        setState({
          status: 'success',
          fastest: comparison.fastest,
          shaded: comparison.shaded,
          comparison,
          errorMessage: '',
        });
        return comparison;
      }

      // Any route that weighs shade or sun is compared with the fastest one (ADR-023).
      if (options.routeType === 'shaded') {
        const comparison = await getWeightedRouteComparison(
          {
            origin,
            destination,
            date: options.date,
            time: options.time,
            timeZone: options.timeZone,
            weights: options.weights,
            maxDetourPercentage: options.maxDetourPercentage,
          },
          { signal: controller.signal }
        );
        if (requestId !== requestIdRef.current || controller.signal.aborted) return null;
        setState({
          status: 'success',
          fastest: comparison.fastest,
          shaded: comparison.shaded,
          comparison,
          errorMessage: '',
        });
        return comparison;
      }

      const fastest = await getFastestRoute({ origin, destination }, { signal: controller.signal });
      if (requestId !== requestIdRef.current || controller.signal.aborted) return null;
      setState({ status: 'success', fastest, shaded: null, comparison: null, errorMessage: '' });
      return fastest;
    } catch (error) {
      if (requestId !== requestIdRef.current || controller.signal.aborted) return null;
      setState({
        ...EMPTY_STATE,
        status: 'error',
        errorMessage: error.message || 'No se ha podido calcular la ruta. Inténtalo de nuevo.',
      });
      return null;
    } finally {
      if (requestId === requestIdRef.current) controllerRef.current = null;
    }
  }

  useEffect(() => () => controllerRef.current?.abort(), []);

  return { ...state, calculateRoute, clearRoutes };
}
