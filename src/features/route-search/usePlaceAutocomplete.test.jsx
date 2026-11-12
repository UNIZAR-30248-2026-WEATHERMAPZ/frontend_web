import { act, cleanup, renderHook, waitFor } from '@testing-library/react';

import { autocompletePlaces } from '../../services/api/geocodingApi.js';
import { usePlaceAutocomplete } from './usePlaceAutocomplete.js';

jest.mock('../../services/api/geocodingApi.js', () => ({
  autocompletePlaces: jest.fn(),
}));

describe('usePlaceAutocomplete', () => {
  beforeEach(() => {
    jest.useFakeTimers();
    autocompletePlaces.mockReset();
  });

  afterEach(() => {
    cleanup();
    jest.clearAllTimers();
    jest.useRealTimers();
  });

  it('does not search for short queries', () => {
    const { result } = renderHook(() => usePlaceAutocomplete('za'));

    expect(result.current.results).toEqual([]);
    expect(autocompletePlaces).not.toHaveBeenCalled();
  });

  it('debounces autocomplete requests and stores results', async () => {
    autocompletePlaces.mockResolvedValue({
      results: [{ id: 'place-1', label: 'Plaza del Pilar', lat: 41.656, lng: -0.878 }],
    });

    const { result } = renderHook(() => usePlaceAutocomplete('Pilar'));

    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() => expect(result.current.isLoading).toBe(false));

    expect(autocompletePlaces).toHaveBeenCalledWith('Pilar', { signal: expect.any(AbortSignal) });
    expect(result.current.results).toEqual([
      { id: 'place-1', label: 'Plaza del Pilar', lat: 41.656, lng: -0.878 },
    ]);
  });

  it('reports unavailable search errors', async () => {
    autocompletePlaces.mockRejectedValue(
      new Error('La búsqueda de lugares no está disponible ahora mismo.')
    );

    const { result } = renderHook(() => usePlaceAutocomplete('Pilar'));

    act(() => {
      jest.advanceTimersByTime(350);
    });

    await waitFor(() =>
      expect(result.current.errorMessage).toBe(
        'La búsqueda de lugares no está disponible ahora mismo.'
      )
    );
  });

  it('hides old suggestions immediately and ignores superseded responses', async () => {
    let finishOld;
    autocompletePlaces
      .mockImplementationOnce(
        () =>
          new Promise((resolve) => {
            finishOld = resolve;
          })
      )
      .mockResolvedValueOnce({ results: [{ id: 'new', label: 'New place' }] });
    const { result, rerender } = renderHook(({ query }) => usePlaceAutocomplete(query), {
      initialProps: { query: 'Old' },
    });
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    const oldSignal = autocompletePlaces.mock.calls[0][1].signal;
    rerender({ query: 'New' });
    expect(oldSignal.aborted).toBe(true);
    expect(result.current.results).toEqual([]);
    await act(async () => {
      jest.advanceTimersByTime(350);
    });
    await act(async () => {
      finishOld({ results: [{ id: 'old' }] });
    });
    expect(result.current.results).toEqual([{ id: 'new', label: 'New place' }]);
    rerender({ query: 'Another' });
    expect(result.current.results).toEqual([]);
    expect(result.current.isLoading).toBe(true);
  });

  it('aborts a timed out request and suppresses disabled searches', async () => {
    autocompletePlaces.mockImplementation(
      (_text, { signal }) =>
        new Promise((_resolve, reject) => {
          signal.addEventListener('abort', () => reject(new Error('aborted')));
        })
    );
    const { result, rerender } = renderHook(
      ({ enabled }) => usePlaceAutocomplete('Pilar', enabled),
      { initialProps: { enabled: true } }
    );
    await act(async () => {
      jest.advanceTimersByTime(12350);
    });
    expect(result.current.errorMessage).toContain('tardado demasiado');
    rerender({ enabled: false });
    expect(result.current).toEqual({ results: [], errorMessage: '', isLoading: false });
  });

  it('tells when a search ends, with its results or with none if it fails', async () => {
    const onSettled = jest.fn();
    const results = [{ id: 'place-1', label: 'Plaza del Pilar', lat: 41.656, lng: -0.878 }];
    autocompletePlaces.mockResolvedValueOnce({ results });
    const { rerender } = renderHook(
      ({ query }) => usePlaceAutocomplete(query, true, 'origin', onSettled),
      {
        initialProps: { query: 'Pilar' },
      }
    );

    act(() => {
      jest.advanceTimersByTime(350);
    });
    await waitFor(() => expect(onSettled).toHaveBeenCalledWith(results));

    autocompletePlaces.mockRejectedValueOnce(new Error('Sin servicio'));
    rerender({ query: 'Plaza de España' });
    act(() => {
      jest.advanceTimersByTime(350);
    });
    await waitFor(() => expect(onSettled).toHaveBeenLastCalledWith([]));
    expect(onSettled).toHaveBeenCalledTimes(2);
  });
});
