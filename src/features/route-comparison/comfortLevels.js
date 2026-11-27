// Three levels instead of percentages (PBI-19, ADR-038): the cards say «Poca / Algo de / Mucha
// sombra» with a bar of three steps and no numbers; the percentages stay under «Ver detalle». The
// cuts split the 0-100 scale in thirds and are provisional until the product owner confirms them.
export const LEVEL_CUTS = Object.freeze({ some: 34, much: 67 });

/** 1 (poco), 2 (algo) or 3 (mucho) for a percentage; null without one. */
export function comfortLevel(percentage) {
  if (!Number.isFinite(percentage)) return null;
  if (percentage < LEVEL_CUTS.some) return 1;
  return percentage < LEVEL_CUTS.much ? 2 : 3;
}

const WORDS = {
  shade: ['Poca sombra', 'Algo de sombra', 'Mucha sombra'],
  sun: ['Poco sol', 'Algo de sol', 'Mucho sol'],
  wind: ['Poco viento de cara', 'Algo de viento de cara', 'Mucho viento de cara'],
  green: ['Poco verde', 'Algo de verde', 'Mucho verde'],
};

const available = (part) => part?.status === 'available';

// The percentage of each factor of a route, or null if it was not measured.
export function factorPercentage(route, kind) {
  if (kind === 'shade') return available(route?.exposure) ? route.exposure.shadePercentage : null;
  if (kind === 'sun') return available(route?.exposure) ? route.exposure.sunPercentage : null;
  if (kind === 'wind') return available(route?.windExposure) ? route.windExposure.exposure : null;
  if (kind === 'green') {
    return available(route?.vegetation) ? route.vegetation.greenPercentage : null;
  }
  return null;
}

/** «Mucha sombra», «Poco viento de cara»… or null without data. */
export function levelText(kind, percentage) {
  const level = comfortLevel(percentage);
  return level ? WORDS[kind][level - 1] : null;
}

/*
 * The levels of a route in the order of the cards: sun instead of shade when the user asked for sun
 * (weights.sun > 0), then wind and green. Factors without data are left out.
 */
export function routeLevels(route, weights = {}) {
  const sunShade = weights?.sun > 0 ? 'sun' : 'shade';
  return [sunShade, 'wind', 'green']
    .map((kind) => {
      const level = comfortLevel(factorPercentage(route, kind));
      return level ? { kind, level, text: WORDS[kind][level - 1] } : null;
    })
    .filter(Boolean);
}
