import { comfortLevel, levelText, routeLevels } from './comfortLevels.js';
import { explanationReasons, suggestionText } from './explanationTexts.js';

const route = (duration, shade = 50, wind = 30, green = 20) => ({
  duration,
  exposure: { status: 'available', shadePercentage: shade, sunPercentage: 100 - shade },
  windExposure: { status: 'available', exposure: wind },
  vegetation: { status: 'available', greenPercentage: green },
});

describe('comfort levels (PBI-19, ADR-038)', () => {
  it.each([
    [0, 1],
    [33.9, 1],
    [34, 2],
    [66.9, 2],
    [67, 3],
    [100, 3],
    [null, null],
  ])('%s %% is level %s', (percentage, level) => {
    expect(comfortLevel(percentage)).toBe(level);
  });

  it('says the level in words for each factor', () => {
    expect(levelText('shade', 80)).toBe('Mucha sombra');
    expect(levelText('sun', 10)).toBe('Poco sol');
    expect(levelText('wind', 50)).toBe('Algo de viento de cara');
    expect(levelText('green', null)).toBeNull();
  });

  it('shows sun instead of shade when sun was asked, and leaves out factors without data', () => {
    expect(routeLevels(route(600, 20), { sun: 50 }).map((level) => level.text)).toEqual([
      'Mucho sol',
      'Poco viento de cara',
      'Poco verde',
    ]);
    expect(
      routeLevels({ windExposure: { status: 'available', exposure: 90 } }).map((l) => l.text)
    ).toEqual(['Mucho viento de cara']);
  });
});

describe('explanation texts (PBI-19, ADR-038)', () => {
  const comparison = (overrides = {}) => ({
    status: 'selected',
    fastest: route(840, 20, 60, 10),
    shaded: route(960, 70, 20, 40),
    additionalDurationSeconds: 120,
    preferences: { sunShade: 'any', avoidWind: false, preferParks: false, extraMinutes: 5 },
    explanation: { status: 'selected' },
    ...overrides,
  });
  const texts = (c) => explanationReasons(c, '«Tu ruta»').map((reason) => reason.text);

  it('always starts with the minutes', () => {
    expect(texts(comparison())).toEqual([
      '«Tu ruta» tarda 16 min, 2 min más que la más rápida (14 min).',
    ]);
    expect(texts(comparison({ additionalDurationSeconds: 0 }))[0]).toBe(
      '«Tu ruta» tarda lo mismo que la más rápida: 16 min.'
    );
  });

  it('says only the street it avoids or only the one it takes, when that is all it knows', () => {
    const wind = (avoided, via) =>
      comparison({
        preferences: { sunShade: 'any', avoidWind: true, preferParks: false },
        explanation: { wind: { status: 'available', avoided, via } },
      });
    expect(texts(wind([{ street: 'Paseo de la Independencia' }], []))[1]).toBe(
      'Evitas Paseo de la Independencia, donde el viento sopla de cara.'
    );
    expect(texts(wind([], [{ street: 'Calle del Coso' }, { street: 'Calle Alfonso I' }]))[1]).toBe(
      'Vas por Calle del Coso y Calle Alfonso I, más resguardadas del viento.'
    );
  });

  it('speaks of the sun with «Sol» and of green areas without a name', () => {
    const c = comparison({
      preferences: { sunShade: 'sun', avoidWind: false, preferParks: true },
      explanation: {
        sunShade: {
          status: 'available',
          kind: 'sun',
          streets: [{ street: 'Paseo Independencia' }],
          instead: null,
        },
        parks: { status: 'available', named: [], moreNamedCount: 0, unnamedCount: 1 },
      },
    });
    expect(texts(c).slice(1)).toEqual([
      'Vas al sol por Paseo Independencia.',
      'Pasas junto a 1 zona verde.',
    ]);
  });

  it('falls back to words without numbers and says nothing if the route is not better', () => {
    const c = comparison({
      preferences: { sunShade: 'shade', avoidWind: true, preferParks: true },
      explanation: undefined,
    });
    expect(texts(c).slice(1)).toEqual([
      '«Tu ruta» va más a la sombra que la más rápida.',
      '«Tu ruta» tiene menos viento de cara que la más rápida.',
      '«Tu ruta» pasa más junto a árboles y parques que la más rápida.',
    ]);
    const notBetter = comparison({
      fastest: route(840, 80, 10, 60),
      preferences: { sunShade: 'shade', avoidWind: true, preferParks: true },
      explanation: undefined,
    });
    expect(texts(notBetter)).toHaveLength(1);
    expect(texts(notBetter).join(' ')).not.toMatch(/%/);
  });

  it('has no reasons without a chosen route', () => {
    expect(
      explanationReasons(comparison({ status: 'no_better_alternative', shaded: null }))
    ).toEqual([]);
  });

  it.each([
    [{ kind: 'more_minutes', minutes: 10 }, 'Prueba con +10 min.'],
    [{ kind: 'too_long' }, 'Ni con +15 min hay un camino mejor: prueba con otra preferencia.'],
    [{ kind: 'other_time' }, 'Prueba con otra hora del día, con el sol más alto.'],
    [{ kind: 'without_sun_shade' }, 'Aquí faltan datos de sombra: prueba sin «Sombra» ni «Sol».'],
    [{ kind: 'other_preference' }, expect.stringContaining('otra preferencia')],
    [null, null],
  ])('suggests %j', (suggestion, text) => {
    expect(suggestionText(suggestion)).toEqual(text);
  });
});
