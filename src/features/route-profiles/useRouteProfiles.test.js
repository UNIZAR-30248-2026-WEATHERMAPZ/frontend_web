import { FALLBACK_PROFILES, hasEnvironmentalWeight, hasShadeWeight } from './useRouteProfiles.js';

describe('route profile weights', () => {
  it('compares routes when shade, sun or wind weigh (PBI-8.2)', () => {
    expect(hasEnvironmentalWeight({ shade: 0, sun: 0, wind: 0 })).toBe(false);
    expect(hasEnvironmentalWeight({ shade: 0, sun: 0, wind: 30 })).toBe(true);
    expect(hasEnvironmentalWeight({ shade: 10, sun: 0, wind: 0 })).toBe(true);
  });

  it('only needs the date and time when shade or sun weigh', () => {
    expect(hasShadeWeight({ shade: 0, sun: 0, wind: 80 })).toBe(false);
    expect(hasShadeWeight({ shade: 0, sun: 20, wind: 80 })).toBe(true);
  });

  it('offers the presets with the wind at 0 without the backend', () => {
    expect(FALLBACK_PROFILES.map(({ weights }) => weights.wind)).toEqual([0, 0, 0]);
  });
});
