import { useEffect, useState } from 'react';

import {
  createRouteProfile,
  deleteRouteProfile,
  listRouteProfiles,
  updateRouteProfile,
} from '../../services/api/routeProfilesApi.js';

// Without the backend the app still offers the presets, with the same weights (ADR-023), but they
// cannot be changed.
export const FALLBACK_PROFILES = [
  { id: 'fastest', name: 'Rápida', presetKey: 'fastest', weights: { shade: 0, sun: 0 } },
  { id: 'shaded', name: 'Sombreada', presetKey: 'shaded', weights: { shade: 50, sun: 0 } },
  { id: 'sunny', name: 'Soleada', presetKey: 'sunny', weights: { shade: 0, sun: 50 } },
].map((profile) => ({
  ...profile,
  weights: { ...profile.weights, wind: 0, vegetation: 0 },
  maxDetourPercentage: 25,
}));

// The recommended route (PBI-9.1, ADR-029) is not a saved route: the backend chooses its weights
// with the current weather, so it cannot be edited or deleted and is not stored per user.
export const RECOMMENDED_PROFILE_ID = 'recommended';
export const RECOMMENDED_PROFILE = {
  id: RECOMMENDED_PROFILE_ID,
  name: 'Recomendada',
  presetKey: null,
  readOnly: true,
  icon: 'recommended',
  summary: ['Según el tiempo'],
  weights: { shade: 0, sun: 0, wind: 0, vegetation: 0 },
  maxDetourPercentage: 25,
};

// Wind is one more factor since PBI-8.2 (ADR-025) and vegetation since PBI-10 phase B (ADR-031).
export const hasEnvironmentalWeight = (weights) =>
  weights.shade > 0 || weights.sun > 0 || weights.wind > 0 || weights.vegetation > 0;

// Only shade and sun depend on the date and time: wind is always the current one (ADR-025) and the
// green does not depend on the Sun (ADR-026).
export const hasShadeWeight = (weights) => weights.shade > 0 || weights.sun > 0;

export function useRouteProfiles() {
  const [state, setState] = useState({ status: 'loading', profiles: FALLBACK_PROFILES });

  useEffect(() => {
    const controller = new AbortController();
    listRouteProfiles({ signal: controller.signal })
      .then((profiles) => setState({ status: 'ready', profiles }))
      .catch(() => {
        if (!controller.signal.aborted)
          setState({ status: 'offline', profiles: FALLBACK_PROFILES });
      });
    return () => controller.abort();
  }, []);

  async function saveProfile(id, draft) {
    const saved = id ? await updateRouteProfile(id, draft) : await createRouteProfile(draft);
    setState((current) => ({
      ...current,
      profiles: id
        ? current.profiles.map((profile) => (profile.id === id ? saved : profile))
        : [...current.profiles, saved],
    }));
    return saved;
  }

  async function deleteProfile(id) {
    await deleteRouteProfile(id);
    setState((current) => ({
      ...current,
      profiles: current.profiles.filter((profile) => profile.id !== id),
    }));
  }

  // "Reemplazar" a route with the same name (#165): the existing one takes the new weights and,
  // when another route was being renamed to its name, that one is deleted.
  async function replaceProfile(existingId, draft, editedId = null) {
    const editedName = state.profiles.find(({ id }) => id === editedId)?.name;
    const saved = await updateRouteProfile(existingId, draft);
    setState((current) => ({
      ...current,
      profiles: current.profiles.map((profile) => (profile.id === existingId ? saved : profile)),
    }));
    if (editedId === null) return saved;
    try {
      await deleteRouteProfile(editedId);
      setState((current) => ({
        ...current,
        profiles: current.profiles.filter((profile) => profile.id !== editedId),
      }));
    } catch {
      // The list shows again what the server has.
      try {
        setState({ status: 'ready', profiles: await listRouteProfiles() });
      } catch {
        // The list stays as it was.
      }
      throw Object.assign(
        new Error(
          `Se ha actualizado «${saved.name}», pero no se ha podido borrar «${editedName}».`
        ),
        { saved }
      );
    }
    return saved;
  }

  return {
    profiles: state.profiles,
    isEditable: state.status === 'ready',
    loadFailed: state.status === 'offline',
    saveProfile,
    deleteProfile,
    replaceProfile,
  };
}
