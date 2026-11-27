import { useEffect, useRef, useState } from 'react';

import { RouteResult } from '../route-comparison/RouteResult.jsx';

// The steps of the guided tour (PBI-20). `include` adds another element to the highlighted area (the
// weather details, which open below the pill); a step with `demo` shows a simulated result instead of
// pointing at the screen.
export const TOUR_STEPS = [
  {
    id: 'points',
    target: '[data-tour="points"]',
    title: 'Origen y destino',
    text: 'Elige de dónde sales y adónde quieres llegar. Puedes escribir una dirección, usar tu ubicación o tocar el mapa.',
  },
  {
    id: 'preferences',
    target: '[data-tour="preferences"]',
    title: 'Elige cómo quieres ir',
    text: 'Elige sombra o sol, evitar el viento o pasar por parques. Si lo dejas todo en «Me da igual», se calcula la ruta más rápida.',
  },
  {
    id: 'weather-today',
    target: '[data-tour="weather-today"]',
    title: 'Según el tiempo de hoy',
    text: 'Con este botón activado, WeatherMapZ marca las opciones según el tiempo que hace: sombra si hace calor, sol si hace frío y evitar el viento si sopla fuerte. Debajo te explica por qué. Puedes cambiar cualquier opción después.',
  },
  {
    id: 'extra-time',
    target: '[data-tour="extra-time"]',
    title: 'Ajusta el tiempo extra',
    text: 'Al elegir una preferencia aparece este control. Elige cuántos minutos más estás dispuesto a andar para conseguirla.',
  },
  {
    id: 'compare',
    demo: true,
    title: 'Calcula y compara',
    text: 'Al calcular verás algo así: tu ruta, cuánto tarda y por qué te conviene. Las tarjetas la comparan con la más rápida (tócalas) y en «Ver detalle» están los datos. Pruébalo:',
  },
  {
    id: 'start-navigation',
    target: '[data-tour="start-navigation"]',
    fallback: '[data-tour="calculate-route"]',
    title: 'Empieza la navegación',
    text: 'Después de calcular, este botón cambia a «Iniciar ruta». Al pulsarlo, la navegación GPS te guía con indicaciones y tu posición en el mapa.',
    // On a computer there is no GPS navigation (global.css): the steps of the route instead.
    desktopTitle: 'Revisa el recorrido',
    desktopText:
      'Después de calcular, en «Recorrido» tienes las calles y las indicaciones paso a paso; al tocar un paso se resalta en el mapa. Para que la app te guíe por GPS mientras caminas, ábrela en el móvil.',
  },
  {
    id: 'current-weather',
    target: '[data-tour="current-weather"]',
    include: '.weather-details:not([hidden])',
    title: 'Consulta el tiempo actual',
    text: 'Aquí tienes la temperatura, el estado del cielo y el viento de ahora en Zaragoza. Tócalo para ver el detalle.',
  },
  {
    id: 'favorites',
    target: '.user-menu-item-favorites',
    fallback: '[data-tour="user-menu"]',
    title: 'Tus favoritos',
    text: 'Toca tu perfil y entra en «Favoritos»: puedes guardar el trayecto que tienes elegido con un nombre y repetirlo después con un toque. Los lugares que uses también aparecen como recientes al escribir el origen o el destino.',
  },
  {
    id: 'repeat',
    target: '.user-menu-item-tutorial',
    fallback: '[data-tour="user-menu"]',
    title: 'Vuelve a verlo cuando quieras',
    text: 'Si quieres repasar cómo funciona la aplicación, toca tu perfil y pulsa «Ver tutorial».',
  },
];

// A simulated result for the «Calcula y compara» step: the real result (PBI-19) with example routes.
const DEMO_COMPARISON = {
  status: 'selected',
  preferences: { sunShade: 'shade', avoidWind: false, preferParks: true, extraMinutes: 5 },
  strategy: { maximumExtraMinutes: 5 },
  explanation: {
    status: 'selected',
    sunShade: {
      status: 'available',
      kind: 'shade',
      streets: [{ street: 'Calle Alfonso I' }],
      instead: { street: 'Calle del Coso' },
    },
    parks: {
      status: 'available',
      named: ['Parque Pignatelli'],
      moreNamedCount: 0,
      unnamedCount: 2,
    },
    suggestion: null,
  },
  fastest: {
    duration: 900,
    distance: 1200,
    exposure: { status: 'available', shadePercentage: 35, sunPercentage: 65 },
    windExposure: { status: 'available', exposure: 40 },
    vegetation: { status: 'available', greenPercentage: 15 },
  },
  shaded: {
    duration: 960,
    distance: 1300,
    exposure: { status: 'available', shadePercentage: 70, sunPercentage: 30 },
    windExposure: { status: 'available', exposure: 25 },
    vegetation: { status: 'available', greenPercentage: 30 },
  },
  additionalDurationSeconds: 60,
};

function ComparisonDemo() {
  const [selected, setSelected] = useState('shaded');
  const [openSection, setOpenSection] = useState(null);
  return (
    <div className="guided-tour-demo">
      <RouteResult
        comparison={DEMO_COMPARISON}
        selectedRouteType={selected}
        onSelectRoute={setSelected}
        openSection={openSection}
        onToggleSection={(section) =>
          setOpenSection((current) => (current === section ? null : section))
        }
      />
      <p className="guided-tour-demo-note">Ejemplo: las cifras no son de una ruta real.</p>
    </div>
  );
}

function boundsOf(stepInfo) {
  const target =
    document.querySelector(stepInfo.target) ||
    (stepInfo.fallback ? document.querySelector(stepInfo.fallback) : null);
  if (!target) return { target: null, rect: null };
  const boxes = [target, stepInfo.include && document.querySelector(stepInfo.include)]
    .filter(Boolean)
    .map((element) => element.getBoundingClientRect());
  const left = Math.min(...boxes.map((box) => box.left));
  const top = Math.min(...boxes.map((box) => box.top));
  const right = Math.max(...boxes.map((box) => box.right));
  const bottom = Math.max(...boxes.map((box) => box.bottom));
  return { target, rect: { left, top, width: right - left, height: bottom - top } };
}

export function GuidedTour({ step, onPrevious, onNext, onSkip, saving = false, error = '' }) {
  const dialog = useRef(null);
  const [rect, setRect] = useState(null);
  const stepInfo = TOUR_STEPS[step];
  const target = stepInfo.demo ? null : boundsOf(stepInfo).target;
  const isDesktop = window.innerWidth >= 1100;
  // The same rule as global.css for hiding «Iniciar ruta» on a computer.
  const isComputer =
    window.matchMedia?.('(min-width: 56.25rem) and (hover: hover) and (pointer: fine)').matches ??
    false;
  const title = (isComputer && stepInfo.desktopTitle) || stepInfo.title;
  const text = (isComputer && stepInfo.desktopText) || stepInfo.text;
  const cardWidth = Math.min(544, window.innerWidth * 0.42);
  const cardHeight = 440;
  const placeRight = rect ? rect.left + rect.width / 2 < window.innerWidth / 2 : true;
  const cardClasses = ['guided-tour-card'];
  if (isDesktop && rect) {
    cardClasses.push('is-anchored');
    cardClasses.push(placeRight ? 'is-right-of-target' : 'is-left-of-target');
  }
  // On smaller screens the card goes to the half of the screen the target is not in.
  if (!isDesktop && rect && rect.top + rect.height / 2 < window.innerHeight / 2) {
    cardClasses.push('is-at-bottom');
  }
  const left = rect
    ? Math.max(
        16,
        Math.min(
          window.innerWidth - cardWidth - 16,
          placeRight ? rect.left + rect.width + 24 : rect.left - cardWidth - 24
        )
      )
    : 0;
  const top = rect
    ? Math.max(
        16,
        Math.min(window.innerHeight - cardHeight - 16, rect.top + rect.height / 2 - cardHeight / 2)
      )
    : 0;

  useEffect(() => {
    const updateRect = () => setRect(stepInfo.demo ? null : boundsOf(stepInfo).rect);
    const timer = window.setTimeout(updateRect, 0);
    window.addEventListener('resize', updateRect);
    window.addEventListener('scroll', updateRect, true);
    return () => {
      window.clearTimeout(timer);
      window.removeEventListener('resize', updateRect);
      window.removeEventListener('scroll', updateRect, true);
    };
  }, [target, step, stepInfo]);

  useEffect(() => {
    dialog.current?.focus();
    target?.scrollIntoView?.({ block: 'center', behavior: 'smooth' });
  }, [step, target]);

  function keyDown(event) {
    if (event.key === 'Escape') {
      event.preventDefault();
      onSkip();
    }
    if (event.key === 'Tab') {
      const items = Array.from(dialog.current.querySelectorAll('button:not(:disabled)'));
      const first = items[0];
      const last = items[items.length - 1];
      if (
        event.shiftKey &&
        (document.activeElement === first || document.activeElement === dialog.current)
      ) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  }

  return (
    <div className="guided-tour-layer" onKeyDown={keyDown}>
      {!rect && <div aria-hidden="true" className="guided-tour-backdrop" />}
      {rect && (
        <div
          aria-hidden="true"
          className="guided-tour-highlight"
          style={{
            left: rect.left - 6,
            top: rect.top - 6,
            width: rect.width + 12,
            height: rect.height + 12,
          }}
        />
      )}
      <section
        ref={dialog}
        className={cardClasses.join(' ')}
        style={isDesktop && rect ? { left, top } : undefined}
        role="dialog"
        aria-modal="true"
        aria-labelledby="guided-tour-title"
        aria-describedby="guided-tour-description"
        tabIndex={-1}
      >
        <div className="guided-tour-header">
          <p className="guided-tour-progress" aria-live="polite">
            Paso {step + 1} de {TOUR_STEPS.length}
          </p>
          <button type="button" className="guided-tour-skip" disabled={saving} onClick={onSkip}>
            {saving ? 'Guardando…' : 'Saltar tutorial'}
          </button>
        </div>
        <h2 id="guided-tour-title">{title}</h2>
        <p id="guided-tour-description">{text}</p>
        {stepInfo.demo && <ComparisonDemo />}
        {error && (
          <p role="alert" className="form-message-error">
            No se ha podido guardar el estado: {error}
          </p>
        )}
        <div className="guided-tour-actions">
          <button
            type="button"
            className="secondary-button"
            disabled={step === 0 || saving}
            onClick={onPrevious}
          >
            Atrás
          </button>
          <button type="button" className="route-submit" disabled={saving} onClick={onNext}>
            {step === TOUR_STEPS.length - 1 ? 'Terminar' : 'Siguiente'}
          </button>
        </div>
      </section>
    </div>
  );
}
