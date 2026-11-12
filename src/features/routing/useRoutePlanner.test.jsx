import { act, renderHook, waitFor } from '@testing-library/react';

import {
  getFastestRoute,
  getRecommendedRoute,
  getWeightedRouteComparison,
} from '../../services/api/routesApi.js';
import { useRoutePlanner } from './useRoutePlanner.js';

jest.mock('../../services/api/routesApi.js', () => ({
  getFastestRoute: jest.fn(),
  getRecommendedRoute: jest.fn(),
  getWeightedRouteComparison: jest.fn(),
}));

const origin = { lat: 41.6488, lng: -0.8891 };
const destination = { lat: 41.656, lng: -0.878 };
const route = {
  geometry: {
    type: 'LineString',
    coordinates: [
      [-0.8891, 41.6488],
      [-0.878, 41.656],
    ],
  },
  distance: 1000,
  duration: 600,
};

describe('useRoutePlanner', () => {
  beforeEach(() => {
    getFastestRoute.mockReset();
    getRecommendedRoute.mockReset();
    getWeightedRouteComparison.mockReset();
  });

  it('asks the backend for the recommended route with only the points (PBI-9.1)', async () => {
    const comparison = {
      status: 'selected',
      fastest: route,
      shaded: { ...route, duration: 660 },
      recommendation: { criterion: 'hot' },
    };
    getRecommendedRoute.mockResolvedValue(comparison);
    const { result } = renderHook(() => useRoutePlanner());

    await act(async () => {
      await result.current.calculateRoute(origin, destination, {
        routeType: 'shaded',
        recommended: true,
        date: '2026-07-15',
        weights: { shade: 0, sun: 0, wind: 0 },
      });
    });

    expect(getRecommendedRoute).toHaveBeenCalledWith(
      { origin, destination },
      { signal: expect.any(AbortSignal) }
    );
    expect(getWeightedRouteComparison).not.toHaveBeenCalled();
    expect(result.current).toMatchObject({
      status: 'success',
      fastest: route,
      shaded: comparison.shaded,
      comparison,
    });
  });

  it('keeps the existing fastest route flow independent from environmental data', async () => {
    getFastestRoute.mockResolvedValue(route);
    const { result } = renderHook(() => useRoutePlanner());

    await act(async () => {
      await result.current.calculateRoute(origin, destination, { routeType: 'fastest' });
    });

    expect(result.current.fastest).toEqual(route);
    expect(result.current.shaded).toBeNull();
    expect(getWeightedRouteComparison).not.toHaveBeenCalled();
  });

  it('stores both routes and their comparison for shaded routing', async () => {
    const comparison = { status: 'selected', fastest: route, shaded: { ...route, duration: 660 } };
    getWeightedRouteComparison.mockResolvedValue(comparison);
    const { result } = renderHook(() => useRoutePlanner());

    await act(async () => {
      await result.current.calculateRoute(origin, destination, {
        routeType: 'shaded',
        weights: { shade: 50, sun: 0 },
        date: '2026-06-21',
        time: '14:00',
        timeZone: 'Europe/Madrid',
      });
    });

    expect(result.current).toMatchObject({
      status: 'success',
      fastest: comparison.fastest,
      shaded: comparison.shaded,
      comparison,
    });
    expect(getWeightedRouteComparison).toHaveBeenCalledWith(
      expect.objectContaining({ weights: { shade: 50, sun: 0 }, date: '2026-06-21' }),
      { signal: expect.any(AbortSignal) }
    );
  });

  it('clears and aborts an obsolete request', async () => {
    getFastestRoute.mockImplementation(
      (_points, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new DOMException('Aborted', 'AbortError')));
        })
    );
    const { result } = renderHook(() => useRoutePlanner());

    let pending;
    act(() => {
      pending = result.current.calculateRoute(origin, destination);
    });
    act(() => result.current.clearRoutes());
    await act(async () => pending);

    await waitFor(() => expect(result.current.status).toBe('idle'));
    expect(result.current.fastest).toBeNull();
  });
});
