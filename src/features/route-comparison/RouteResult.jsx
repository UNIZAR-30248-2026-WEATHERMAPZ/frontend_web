import { Icon } from '../../components/ui/Icon.jsx';
import { preferencesSummary } from '../route-preferences/preferenceTexts.js';
import {
  formatExtraDuration,
  formatRouteDistance,
  formatRouteDuration,
} from '../routing/RouteSummary.jsx';
import { comfortLevel, factorPercentage } from './comfortLevels.js';
import { askedImprovement, explanationReasons, suggestionText } from './explanationTexts.js';
import { LevelBar } from './LevelBar.jsx';

/*
 * The result of a comparison as in the sketches «Resultado explicado» and «Ver detalle» (PBI-19,
 * ADR-038): the route and its minutes, why in plain words with an icon per reason, two compact cards
 * with «Poco / Algo / Mucho» per factor (tap one to see it on the map), and the calculated data under
 * «Ver detalle». Without a better route it says why and offers the suggested change.
 */

// The sun or shade reason takes the icon of what was asked («sun» or «shade»).
const REASON_ICONS = { wind: 'wind', parks: 'vegetation' };
const FACTOR_ROWS = {
  shade: { label: 'Sombra', words: ['Poca', 'Algo', 'Mucha'] },
  sun: { label: 'Sol', words: ['Poco', 'Algo', 'Mucho'] },
  wind: { label: 'Viento', words: ['Poco', 'Algo', 'Mucho'] },
  green: { label: 'Verde', words: ['Poco', 'Algo', 'Mucho'] },
};

function answersOf(comparison) {
  if (comparison.preferences) return comparison.preferences;
  const weights = comparison.weights ?? {};
  let sunShade = 'any';
  if (weights.shade > 0) sunShade = 'shade';
  else if (weights.sun > 0) sunShade = 'sun';
  return { sunShade, avoidWind: weights.wind > 0, preferParks: weights.vegetation > 0 };
}

// The factors of the cards: those asked for (as in the sketches) or, without any, those measured.
function cardFactors(comparison) {
  const answers = answersOf(comparison);
  const asked = [
    answers.sunShade !== 'any' && answers.sunShade,
    answers.avoidWind && 'wind',
    answers.preferParks && 'green',
  ].filter(Boolean);
  // What was asked first, then the rest of what was measured, so the cards are never empty.
  const others = ['shade', 'wind', 'green'].filter(
    (kind) => !asked.includes(kind) && !(kind === 'shade' && asked.includes('sun'))
  );
  return [...asked, ...others].filter((kind) =>
    [comparison.fastest, comparison.shaded].some((route) =>
      Number.isFinite(factorPercentage(route, kind))
    )
  );
}

function RouteCard({ title, route, factors, selected, disabled = false, onSelect }) {
  return (
    <button
      type="button"
      className={`result-card ${selected ? 'is-selected' : ''}`}
      aria-pressed={selected}
      disabled={disabled}
      onClick={onSelect}
    >
      <strong>
        {title}
        {route && ` · ${formatRouteDuration(route.duration)}`}
      </strong>
      {route ? (
        factors.map((kind) => {
          const level = comfortLevel(factorPercentage(route, kind));
          if (!level) return null;
          const { label, words } = FACTOR_ROWS[kind];
          return (
            <span key={kind} className={`result-factor result-factor-${kind}`}>
              <span>{label}</span>
              <LevelBar level={level} />
              <b>{words[level - 1]}</b>
            </span>
          );
        })
      ) : (
        <span className="result-factor">Sin alternativa</span>
      )}
    </button>
  );
}

const percent = (value) => (Number.isFinite(value) ? `${Math.round(value)} %` : '—');
const points = (value) => (Number.isFinite(value) ? `${Math.round(value)}` : '—');

// A dropdown of the result: a button with the arrow and, open, its content.
function Dropdown({ id, title, isOpen, onToggle, children }) {
  return (
    <div className={`result-dropdown ${isOpen ? 'is-open' : ''}`}>
      <button
        type="button"
        className="result-dropdown-toggle"
        aria-expanded={isOpen}
        aria-controls={id}
        onClick={onToggle}
      >
        {title}
      </button>
      {isOpen && (
        <div id={id} className="result-dropdown-content">
          {children}
        </div>
      )}
    </div>
  );
}

function DetailTable({ comparison, alternativeLabel }) {
  const routes = [comparison.fastest, comparison.shaded].filter(Boolean);
  const rows = [
    ['Recorrido a la sombra', (r) => percent(factorPercentage(r, 'shade'))],
    ['Exposición al viento (0-100)', (r) => points(factorPercentage(r, 'wind'))],
    ['Junto a árboles o parques', (r) => percent(factorPercentage(r, 'green'))],
    ['Duración', (r) => formatRouteDuration(r.duration)],
    ['Distancia', (r) => (Number.isFinite(r.distance) ? formatRouteDistance(r.distance) : '—')],
  ];
  return (
    <div className="result-detail">
      <h3>Los datos calculados</h3>
      <table>
        <thead>
          <tr>
            <th scope="col">Factor</th>
            <th scope="col">Más rápida</th>
            {routes.length > 1 && <th scope="col">{alternativeLabel}</th>}
          </tr>
        </thead>
        <tbody>
          {rows.map(([label, value]) => (
            <tr key={label}>
              <th scope="row">{label}</th>
              {routes.map((route, index) => (
                <td key={index}>{value(route)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
      <p className="result-detail-note">
        La sombra se calcula con la posición del Sol en la fecha y hora elegidas, y el viento con
        los datos de Open-Meteo.
      </p>
    </div>
  );
}

// What the fastest route gives up against the chosen one, for the answers given: shown when the user
// looks at the fastest one, instead of the reasons of the chosen route.
const LOSSES = {
  shade: 'vas menos a la sombra',
  sun: 'vas menos al sol',
  wind: 'tienes más viento de cara',
  green: 'pasas junto a menos zonas verdes',
};

function fastestTradeOff(comparison, factors) {
  const losses = factors
    .filter((kind) => {
      // By the levels of the cards, so the sentence never contradicts them.
      const fastest = comfortLevel(factorPercentage(comparison.fastest, kind));
      const chosen = comfortLevel(factorPercentage(comparison.shaded, kind));
      if (!fastest || !chosen) return false;
      return kind === 'wind' ? fastest > chosen : fastest < chosen;
    })
    .map((kind) => LOSSES[kind]);
  const saved = comparison.additionalDurationSeconds;
  const savedText = saved > 0 ? `Ahorras ${formatExtraDuration(saved)}` : 'Tardas lo mismo';
  if (!losses.length) return `${savedText}.`;
  const list =
    losses.length > 1 ? `${losses.slice(0, -1).join(', ')} y ${losses.at(-1)}` : losses[0];
  return `${savedText}, pero ${list}.`;
}

function noBetterText(comparison) {
  if (comparison.status === 'fastest_only') {
    return 'Con tus preferencias no hace falta desviarse: esta es la ruta más rápida.';
  }
  const minutes = comparison.strategy?.maximumExtraMinutes;
  const asked = askedImprovement(comparison);
  if (comparison.status === 'over_extra_time' && Number.isFinite(minutes)) {
    return `Hay caminos ${asked}, pero todos tardan más de ${minutes} min extra.`;
  }
  if (comparison.status === 'no_better_alternative' && Number.isFinite(minutes)) {
    return minutes === 0
      ? `No hay ningún camino ${asked} que tarde lo mismo que la más rápida.`
      : `No hay ningún camino ${asked} sin andar más de ${minutes} min.`;
  }
  const reasons = {
    sun_below_horizon: 'El Sol está bajo el horizonte en el momento elegido: no hay sombras.',
    sun_too_low: 'El Sol está demasiado bajo en el momento elegido para estimar la sombra.',
    insufficient_exposure_data: 'No hay datos de sombra suficientes para comparar estas rutas.',
  };
  return reasons[comparison.status] ?? 'No hay una ruta mejor que la más rápida.';
}

export function RouteResult({
  comparison,
  selectedRouteType,
  alternativeLabel = 'Tu ruta',
  onSelectRoute,
  onTrySuggestion = null,
  // «Cambiar preferencias» (the questions, from the panel) and «Ver detalle»: one open at a time.
  preferences = null,
  openSection = null,
  onToggleSection = () => {},
}) {
  if (!comparison?.fastest) return null;
  const { fastest, shaded } = comparison;
  const hasAlternative = comparison.status === 'selected' && Boolean(shaded);
  const showsAlternative = hasAlternative && selectedRouteType === 'shaded';
  const route = showsAlternative ? shaded : fastest;
  const title = showsAlternative ? alternativeLabel : 'La más rápida';
  const extra = comparison.additionalDurationSeconds;
  let subtitle = Number.isFinite(route.distance) ? formatRouteDistance(route.distance) : '';
  if (showsAlternative) {
    const more =
      extra > 0
        ? `${formatExtraDuration(extra)} más que la más rápida`
        : 'Lo mismo que la más rápida';
    subtitle = [more, subtitle].filter(Boolean).join(' · ');
  } else if (hasAlternative) {
    const less =
      extra > 0
        ? `${formatExtraDuration(extra)} menos que ${alternativeLabel.toLowerCase()}`
        : `Lo mismo que ${alternativeLabel.toLowerCase()}`;
    subtitle = [less, subtitle].filter(Boolean).join(' · ');
  }
  // The answers of the route, so the dropdown does not have to be opened to see them.
  const asked = comparison.preferences
    ? preferencesSummary(comparison.preferences).split(' · ')
    : [];
  const reasons = explanationReasons(comparison, `«${alternativeLabel}»`).filter(
    (reason) => reason.key !== 'time'
  );
  const kind = answersOf(comparison).sunShade;
  const suggestion = comparison.explanation?.suggestion;
  const factors = cardFactors(comparison);

  return (
    <section className="panel-section route-result" aria-labelledby="route-result-title">
      <header className="result-header">
        <h2 id="route-result-title">
          {title} · {formatRouteDuration(route.duration)}
        </h2>
        {subtitle && <p>{subtitle}</p>}
      </header>
      {asked.length > 0 && (
        <ul className="result-asked" aria-label="Tus preferencias">
          {asked.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      )}

      {hasAlternative && !showsAlternative && (
        <ul className="result-reasons" aria-label="Si vas por la más rápida">
          <li className="result-reason result-reason-tradeoff">
            <span className="result-reason-icon" aria-hidden="true">
              <Icon kind="time" />
            </span>
            <p>{fastestTradeOff(comparison, factors)}</p>
          </li>
        </ul>
      )}
      {hasAlternative ? (
        showsAlternative &&
        reasons.length > 0 && (
          <ul className="result-reasons" aria-label="Por qué esta ruta">
            {reasons.map((reason) => {
              const icon = REASON_ICONS[reason.key] ?? kind;
              return (
                <li key={reason.key} className={`result-reason result-reason-${reason.key}`}>
                  <span className="result-reason-icon" aria-hidden="true">
                    <Icon kind={icon} />
                  </span>
                  <p>
                    <strong>{reason.lead}</strong>
                    {reason.rest}
                  </p>
                </li>
              );
            })}
          </ul>
        )
      ) : (
        <div
          className={`result-no-better ${comparison.status === 'fastest_only' ? 'is-plain' : ''}`}
          role="status"
        >
          {comparison.status !== 'fastest_only' && (
            <span className="result-reason-icon" aria-hidden="true">
              <Icon kind="time" />
            </span>
          )}
          <div className="result-no-better-text">
            <p>{noBetterText(comparison)}</p>
            {suggestion?.kind === 'more_minutes' && onTrySuggestion ? (
              <button
                type="button"
                className="result-try"
                onClick={() => onTrySuggestion(suggestion.minutes)}
              >
                Probar con +{suggestion.minutes} min
              </button>
            ) : (
              suggestionText(suggestion) && <p>{suggestionText(suggestion)}</p>
            )}
          </div>
        </div>
      )}

      {/* Both cards whenever a better route was looked for: without one, the second one says so.
          With only the fastest route there is nothing to compare. */}
      {comparison.status !== 'fastest_only' && (
        <div className="result-cards">
          <RouteCard
            title="Más rápida"
            route={fastest}
            factors={factors}
            selected={!showsAlternative}
            onSelect={() => onSelectRoute('fastest')}
          />
          <RouteCard
            title={alternativeLabel}
            route={hasAlternative ? shaded : null}
            factors={factors}
            selected={showsAlternative}
            disabled={!hasAlternative}
            onSelect={() => onSelectRoute('shaded')}
          />
        </div>
      )}

      {hasAlternative && (
        <p className="result-legend">
          Línea verde: {alternativeLabel.toLowerCase()} · Línea gris discontinua: la más rápida
        </p>
      )}

      {preferences && (
        <Dropdown
          id="result-preferences"
          title="Cambiar preferencias"
          isOpen={openSection === 'preferences'}
          onToggle={() => onToggleSection('preferences')}
        >
          {preferences}
        </Dropdown>
      )}
      <Dropdown
        id="result-detail"
        title="Ver detalle"
        isOpen={openSection === 'detail'}
        onToggle={() => onToggleSection('detail')}
      >
        <DetailTable comparison={comparison} alternativeLabel={alternativeLabel} />
      </Dropdown>
    </section>
  );
}
