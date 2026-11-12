import { act, renderHook, waitFor } from '@testing-library/react';

import {
  deleteRouteProfile,
  listRouteProfiles,
  updateRouteProfile,
} from '../../services/api/routeProfilesApi.js';
import { useRouteProfiles } from './useRouteProfiles.js';

jest.mock('../../services/api/routeProfilesApi.js', () => ({
  createRouteProfile: jest.fn(),
  deleteRouteProfile: jest.fn(),
  listRouteProfiles: jest.fn(),
  updateRouteProfile: jest.fn(),
}));

const weights = { shade: 0, sun: 0, wind: 0, vegetation: 0 };
const route = (id, name, shade = 0) => ({
  id,
  name,
  presetKey: null,
  weights: { ...weights, shade },
  maxDetourPercentage: 25,
});
const summer = route(2, 'Verano', 50);
const walk = route(5, 'Paseo', 20);

async function renderLoaded() {
  listRouteProfiles.mockResolvedValue([route(1, 'Rápida'), summer, walk]);
  const hook = renderHook(() => useRouteProfiles());
  await waitFor(() => expect(hook.result.current.isEditable).toBe(true));
  return hook;
}

describe('useRouteProfiles: replace a route with the same name (#165)', () => {
  beforeEach(() => jest.clearAllMocks());

  it('puts the new weights on the existing route and deletes the edited one', async () => {
    const { result } = await renderLoaded();
    const replaced = { ...summer, weights: { ...weights, shade: 80 } };
    updateRouteProfile.mockResolvedValue(replaced);
    deleteRouteProfile.mockResolvedValue();

    let saved;
    await act(async () => {
      saved = await result.current.replaceProfile(
        2,
        { name: 'Verano', weights: replaced.weights },
        5
      );
    });

    expect(saved).toBe(replaced);
    expect(updateRouteProfile).toHaveBeenCalledWith(2, {
      name: 'Verano',
      weights: replaced.weights,
    });
    expect(deleteRouteProfile).toHaveBeenCalledWith(5);
    // PUT first, then DELETE.
    expect(updateRouteProfile.mock.invocationCallOrder[0]).toBeLessThan(
      deleteRouteProfile.mock.invocationCallOrder[0]
    );
    expect(result.current.profiles.map(({ id, weights: { shade } }) => [id, shade])).toEqual([
      [1, 0],
      [2, 80],
    ]);
  });

  it('only updates the existing route when a new one was being created', async () => {
    const { result } = await renderLoaded();
    updateRouteProfile.mockResolvedValue(summer);

    await act(async () => {
      await result.current.replaceProfile(2, { name: 'Verano', weights }, null);
    });

    expect(deleteRouteProfile).not.toHaveBeenCalled();
    expect(result.current.profiles).toHaveLength(3);
  });

  it('says clearly when the edited route could not be deleted, and reloads the list', async () => {
    const { result } = await renderLoaded();
    updateRouteProfile.mockResolvedValue(summer);
    deleteRouteProfile.mockRejectedValue(new Error('No se ha podido borrar la ruta.'));
    listRouteProfiles.mockResolvedValue([route(1, 'Rápida'), summer, walk, route(7, 'Nueva')]);

    let failure;
    await act(async () => {
      failure = await result.current
        .replaceProfile(2, { name: 'Verano', weights }, 5)
        .catch((error) => error);
    });

    expect(failure.message).toBe(
      'Se ha actualizado «Verano», pero no se ha podido borrar «Paseo».'
    );
    expect(failure.saved).toBe(summer);
    expect(listRouteProfiles).toHaveBeenCalledTimes(2);
    expect(result.current.profiles.map(({ name }) => name)).toEqual([
      'Rápida',
      'Verano',
      'Paseo',
      'Nueva',
    ]);
  });
});
