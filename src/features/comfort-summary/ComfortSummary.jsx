import { formatExtraDuration, formatRouteDuration } from '../routing/RouteSummary.jsx';

// PBI-11: desglose del confort de la ruta mostrada y por qué se ha elegido frente a la más rápida.
// Solo presenta los datos que calcula el backend (sombra, viento y verde de cada ruta); no calcula
// nada. Se habla en porcentajes del recorrido, no en "puntos", para que se entienda sin explicación.

const round = (value) => Math.round(value);

const shadeOf = (route) =>
  route?.exposure?.status === 'available' ? route.exposure.shadePercentage : null;
const sunOf = (route) =>
  route?.exposure?.status === 'available' ? route.exposure.sunPercentage : null;
const windOf = (route) =>
  route?.windExposure?.status === 'available' ? route.windExposure.exposure : null;
const greenOf = (route) =>
  route?.vegetation?.status === 'available' ? route.vegetation.greenPercentage : null;

// Un factor solo se explica si la ruta y la más rápida tienen el dato y no coinciden.
const FACTORS = [
  {
    key: 'shade',
    value: shadeOf,
    sentence: (subject, a, b) =>
      `${subject} va a la sombra el ${round(a)} % del recorrido, frente al ${round(b)} % de la más rápida.`,
  },
  {
    key: 'sun',
    value: sunOf,
    sentence: (subject, a, b) =>
      `${subject} va al sol el ${round(a)} % del recorrido, frente al ${round(b)} % de la más rápida.`,
  },
  {
    key: 'wind',
    value: windOf,
    sentence: (subject, a, b) =>
      `${subject} tiene una exposición al viento del ${round(a)} %, frente al ${round(b)} % de la más rápida.`,
  },
  {
    key: 'vegetation',
    value: greenOf,
    sentence: (subject, a, b) =>
      `${subject} pasa junto a árboles o parques el ${round(a)} % del recorrido, frente al ${round(b)} % de la más rápida.`,
  },
];

const weighs = (weights, key) => Number.isFinite(weights?.[key]) && weights[key] > 0;

// Lo pedido primero: es la diferencia principal. La sombra y el sol son la misma barra, así que
// solo se explica el que se ha pedido (o la sombra si no se ha pedido ninguno).
function explainedFactors(weights, alternative, fastest) {
  const asksSun = weighs(weights, 'sun');
  return FACTORS.filter((factor) => (asksSun ? factor.key !== 'shade' : factor.key !== 'sun'))
    .filter(
      (factor) =>
        Number.isFinite(factor.value(alternative)) &&
        Number.isFinite(factor.value(fastest)) &&
        round(factor.value(alternative)) !== round(factor.value(fastest))
    )
    .map((factor) => ({ ...factor, asked: weighs(weights, factor.key) }))
    .sort((a, b) => Number(b.asked) - Number(a.asked));
}

// Los minutos de cada ruta solo se dan si son distintos: "15 min frente a 15 min" confunde.
function extraTimeSentence(subject, extraTime, alternative, fastest) {
  const minutes = [
    formatRouteDuration(alternative.duration),
    formatRouteDuration(fastest.duration),
  ];
  const detail = minutes[0] === minutes[1] ? '' : ` (${minutes[0]} frente a ${minutes[1]})`;
  return `A cambio, ${subject} tarda ${formatExtraDuration(extraTime)} más${detail}.`;
}

const NO_ALTERNATIVE_REASONS = {
  no_better_alternative:
    'Ninguna alternativa mejora lo que has pedido sin tardar más de lo que aceptas, así que la mejor opción es la más rápida.',
  fastest_only:
    'Con el tiempo actual no merece la pena desviarse: la recomendada es la más rápida.',
};

function Bar({ label, value, hint }) {
  return (
    <div className="comfort-bar">
      <div className="comfort-bar-label">
        <span>{label}</span>
        <strong>{round(value)} %</strong>
      </div>
      <div
        className="comfort-bar-track"
        role="img"
        aria-label={`${label}: ${round(value)} %${hint ? `. ${hint}` : ''}`}
      >
        <span
          className="comfort-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, value))}%` }}
        />
      </div>
      {hint && <p className="comfort-bar-hint">{hint}</p>}
    </div>
  );
}

function ShadeSunBar({ shade, sun }) {
  return (
    <div className="comfort-bar">
      <div className="comfort-bar-label">
        <span>Sombra {round(shade)} %</span>
        <span>Sol {round(sun)} %</span>
      </div>
      <div
        className="comfort-bar-track comfort-bar-shade-sun"
        role="img"
        aria-label={`Sombra ${round(shade)} % y sol ${round(sun)} % del recorrido`}
      >
        <span
          className="comfort-bar-fill"
          style={{ width: `${Math.min(100, Math.max(0, shade))}%` }}
        />
      </div>
    </div>
  );
}

export function ComfortSummary({
  comparison,
  selectedRouteType,
  alternativeLabel = 'Con sombra',
  weights = null,
  isExpanded = true,
}) {
  if (!comparison?.fastest) return null;
  const { fastest } = comparison;
  const alternative = comparison.status === 'selected' ? comparison.shaded : null;
  const showsAlternative = Boolean(alternative) && selectedRouteType === 'shaded';
  const route = showsAlternative ? alternative : fastest;

  const shade = shadeOf(route);
  const wind = windOf(route);
  const green = greenOf(route);
  const hasBreakdown = [shade, wind, green].some(Number.isFinite);

  const factors = alternative ? explainedFactors(weights, alternative, fastest) : [];
  const subject = `«${alternativeLabel}»`;
  const extraTime = comparison.additionalDurationSeconds;

  return (
    <section
      className={`panel-section comfort-summary ${isExpanded ? '' : 'is-collapsed'}`}
      aria-labelledby="comfort-summary-title"
    >
      <h2 id="comfort-summary-title">
        Confort de la ruta {showsAlternative ? `«${alternativeLabel}»` : 'más rápida'}
      </h2>

      {hasBreakdown ? (
        <div className="comfort-bars">
          {Number.isFinite(shade) && <ShadeSunBar shade={shade} sun={sunOf(route)} />}
          {Number.isFinite(wind) && (
            <Bar
              label="Exposición al viento"
              value={wind}
              hint="0 % es sin viento molesto; 100 %, todo el camino con viento fuerte de cara."
            />
          )}
          {Number.isFinite(green) && <Bar label="Junto a árboles o parques" value={green} />}
        </div>
      ) : (
        <p className="comfort-empty">No hay datos de confort para esta ruta en este momento.</p>
      )}

      <h3 className="comfort-why-title">Por qué esta ruta</h3>
      {alternative ? (
        <ul className="comfort-why">
          {factors.map((factor) => (
            <li key={factor.key} className={factor.asked ? 'is-asked' : ''}>
              {factor.sentence(subject, factor.value(alternative), factor.value(fastest))}
            </li>
          ))}
          {extraTime > 0 && <li>{extraTimeSentence(subject, extraTime, alternative, fastest)}</li>}
        </ul>
      ) : (
        <p className="comfort-why-text">
          {NO_ALTERNATIVE_REASONS[comparison.status] ||
            'Se muestra la más rápida: no se ha podido comparar con una alternativa en este momento.'}
        </p>
      )}
    </section>
  );
}
