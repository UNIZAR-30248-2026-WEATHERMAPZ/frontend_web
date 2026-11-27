import { formatExtraDuration, formatRouteDuration } from '../routing/RouteSummary.jsx';
import { factorPercentage } from './comfortLevels.js';

/*
 * Why the chosen route suits the answers, in streets, parks and minutes (PBI-19, ADR-038), from the
 * `explanation` of the backend. No percentages: they stay under «Ver detalle». When the backend could
 * not name a street (no verifiable data, or a route of the assistant, which has no explanation), the
 * sentence only compares the two routes in words.
 */

const joined = (items) =>
  items.length <= 1 ? (items[0] ?? '') : `${items.slice(0, -1).join(', ')} y ${items.at(-1)}`;
const available = (part) => part?.status === 'available';
const plural = (count, singular, pluralForm) => (count === 1 ? singular : pluralForm);

// The answers behind the comparison: those of the backend or, without them, read from the weights.
function answersOf(comparison) {
  if (comparison.preferences) return comparison.preferences;
  const weights = comparison.weights ?? {};
  let sunShade = 'any';
  if (weights.shade > 0) sunShade = 'shade';
  else if (weights.sun > 0) sunShade = 'sun';
  return { sunShade, avoidWind: weights.wind > 0, preferParks: weights.vegetation > 0 };
}

function timeReason(comparison, subject) {
  const { fastest, shaded } = comparison;
  const extra = comparison.additionalDurationSeconds;
  if (!(extra > 0)) {
    return `${subject} tarda lo mismo que la más rápida: ${formatRouteDuration(shaded.duration)}.`;
  }
  const minutes = formatRouteDuration(shaded.duration);
  // Rounded to minutes both may read the same: then only the difference is said.
  if (minutes === formatRouteDuration(fastest.duration)) {
    return `${subject} tarda casi lo mismo que la más rápida (${minutes}): solo ${formatExtraDuration(extra)} más.`;
  }
  return `${subject} tarda ${minutes}, ${formatExtraDuration(extra)} más que la más rápida (${formatRouteDuration(fastest.duration)}).`;
}

// The alternative has more of the factor than the fastest route (or less, for the wind).
function better(comparison, kind) {
  const alternative = factorPercentage(comparison.shaded, kind);
  const fastest = factorPercentage(comparison.fastest, kind);
  if (!Number.isFinite(alternative) || !Number.isFinite(fastest)) return false;
  return kind === 'wind'
    ? Math.round(alternative) < Math.round(fastest)
    : Math.round(alternative) > Math.round(fastest);
}

function sunShadeReason(comparison, kind, subject) {
  const part = comparison.explanation?.sunShade;
  const where = kind === 'shade' ? 'a la sombra' : 'al sol';
  const opposite = kind === 'shade' ? 'al sol' : 'a la sombra';
  if (available(part)) {
    const instead = part.instead
      ? `, en vez de por ${part.instead.street}, que va ${opposite}`
      : '';
    return `Vas ${where} por ${joined(part.streets.map((street) => street.street))}${instead}.`;
  }
  return better(comparison, kind) ? `${subject} va más ${where} que la más rápida.` : null;
}

function windReason(comparison, subject) {
  const part = comparison.explanation?.wind;
  if (available(part)) {
    const avoided = joined(part.avoided.map((street) => street.street));
    const via = joined(part.via.map((street) => street.street));
    if (avoided && via) return `Evitas el viento de cara de ${avoided} yendo por ${via}.`;
    if (avoided) return `Evitas ${avoided}, donde el viento sopla de cara.`;
    return `Vas por ${via}, ${plural(part.via.length, 'más resguardada', 'más resguardadas')} del viento.`;
  }
  return better(comparison, 'wind')
    ? `${subject} tiene menos viento de cara que la más rápida.`
    : null;
}

function parksReason(comparison, subject) {
  const part = comparison.explanation?.parks;
  if (available(part)) {
    const { named, moreNamedCount, unnamedCount } = part;
    const others = moreNamedCount + unnamedCount;
    if (!named.length) {
      return `Pasas junto a ${unnamedCount} ${plural(unnamedCount, 'zona verde', 'zonas verdes')}.`;
    }
    const more = others ? `, y ${others} ${plural(others, 'zona verde', 'zonas verdes')} más` : '';
    return `Pasas junto a ${plural(named.length, 'esta zona verde', 'estas zonas verdes')}: ${joined(named)}${more}.`;
  }
  return better(comparison, 'green')
    ? `${subject} pasa más junto a árboles y parques que la más rápida.`
    : null;
}

// The words that go in bold at the start of each reason, as in the sketches («Vas a la sombra», «Evitas
// el viento de cara»…): up to the street names, or the whole sentence if it has none.
const LEAD_ENDS = [' por ', ' de ', ': ', ', '];
function withLeads(reasons) {
  return reasons.map((reason) => {
    const cut = Math.min(
      ...LEAD_ENDS.map((end) => reason.text.indexOf(end)).filter((index) => index > 0),
      reason.text.length
    );
    return { ...reason, lead: reason.text.slice(0, cut), rest: reason.text.slice(cut) };
  });
}

/**
 * The reasons of a comparison with a chosen route, the time first: [{ key, text, asked }]. «asked»
 * marks the reasons of the answers the user gave.
 */
export function explanationReasons(comparison, subject) {
  if (comparison?.status !== 'selected' || !comparison.shaded) return [];
  const answers = answersOf(comparison);
  return withLeads(
    [
      { key: 'time', text: timeReason(comparison, subject), asked: false },
      answers.sunShade !== 'any' && {
        key: 'sunShade',
        text: sunShadeReason(comparison, answers.sunShade, subject),
        asked: true,
      },
      answers.avoidWind && { key: 'wind', text: windReason(comparison, subject), asked: true },
      answers.preferParks && { key: 'parks', text: parksReason(comparison, subject), asked: true },
    ].filter((reason) => reason && reason.text)
  );
}

/**
 * What the user asked for, to say what no route improves: «con más sombra», «con más sol y menos
 * viento de cara»… or, without answers, «mejor para lo que has pedido».
 */
export function askedImprovement(comparison) {
  const answers = answersOf(comparison ?? {});
  const parts = [
    answers.sunShade === 'shade' && 'más sombra',
    answers.sunShade === 'sun' && 'más sol',
    answers.avoidWind && 'menos viento de cara',
    answers.preferParks && 'más zonas verdes',
  ].filter(Boolean);
  return parts.length ? `con ${joined(parts)}` : 'mejor para lo que has pedido';
}

/** The change to try when there is no better route (PBI-19), or null. */
export function suggestionText(suggestion) {
  switch (suggestion?.kind) {
    case 'more_minutes':
      return `Prueba con +${suggestion.minutes} min.`;
    case 'too_long':
      return 'Ni con +15 min hay un camino mejor: prueba con otra preferencia.';
    case 'other_time':
      return 'Prueba con otra hora del día, con el sol más alto.';
    case 'without_sun_shade':
      return 'Aquí faltan datos de sombra: prueba sin «Sombra» ni «Sol».';
    case 'other_preference':
      return 'Prueba con otra preferencia, por ejemplo «Por parques» o «Evitar el viento».';
    default:
      return null;
  }
}
