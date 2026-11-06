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
  { id: 'fastest', name: 'Rápida', presetKey: 'fastest', weights: { shade: 0, sun: 0, wind: 0 } },
  { id: 'shaded', name: 'Sombreada', presetKey: 'shaded', weights: { shade: 50, sun: 0, wind: 0 } },
  { id: 'sunny', name: 'Soleada', presetKey: 'sunny', weights: { shade: 0, sun: 50, wind: 0 } },
].map((profile) => ({ ...profile, maxDetourPercentage: 25 }));

// Wind is one more factor since PBI-8.2 (ADR-025).
export const hasEnvironmentalWeight = (weights) =>
  weights.shade > 0 || weights.sun > 0 || weights.wind > 0;

// Only shade and sun depend on the date and time: wind is always the current one (ADR-025).
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

  return {
    profiles: state.profiles,
    isEditable: state.status === 'ready',
    loadFailed: state.status === 'offline',
    saveProfile,
    deleteProfile,
  };
}
