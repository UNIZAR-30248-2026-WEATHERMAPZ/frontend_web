import { useEffect, useRef, useState } from 'react';

import { HistoryIcon } from '../route-history/RouteHistory.jsx';
import { placeKey } from '../route-history/useRouteHistory.js';
import { RouteSteps } from '../routing/RouteSteps.jsx';
import { InfoButton } from '../../components/ui/InfoButton.jsx';
import { RouteSummary } from '../routing/RouteSummary.jsx';
import { DEVICE_SOURCE, MY_LOCATION_LABEL } from './useDeviceLocation.js';
import { usePlaceAutocomplete } from './usePlaceAutocomplete.js';
import { useSheetHeight } from './useSheetHeight.js';

// Safari on iPhone takes the focus away from the field before delivering the tap on a suggestion:
// closing the list at once would leave the tap without a target, and it would reach the map below.
const LIST_CLOSE_DELAY_MS = 200;
// From this length the text is searched with the autocomplete; shorter, the list shows the options
// that need no text ("Mi ubicación").
const MIN_SEARCH_LENGTH = 3;
const MY_LOCATION_OPTION = { id: 'my-location', kind: 'location', label: MY_LOCATION_LABEL };
// While typing, the recent places whose name contains the text go before the suggestions.
const MAX_MATCHING_RECENT_PLACES = 3;

// Without case nor accents: "san jose" finds "Plaza San José".
const normalize = (text) =>
  text
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

// The recent places (#180) as options of a field, without the place chosen in the other field: the
// same place cannot be the origin and the destination.
function recentOptions(places, otherPoint) {
  const otherKey = otherPoint ? placeKey(otherPoint) : null;
  return places
    .filter((place) => placeKey(place) !== otherKey)
    .map((place) => ({
      id: `recent-${place.id}`,
      kind: 'recent',
      lat: place.lat,
      lng: place.lng,
      label: place.label || `${place.lat.toFixed(5)}, ${place.lng.toFixed(5)}`,
    }));
}

const noop = () => {};
const pointLabel = (name) => (name === 'origin' ? 'origen' : 'destino');
const pointTitle = (name) => (name === 'origin' ? 'Origen' : 'Destino');

function SearchIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </svg>
  );
}

function GpsIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true">
      <circle cx="12" cy="12" r="3" />
      <circle cx="12" cy="12" r="7" />
      <path d="M12 2v3M12 19v3M2 12h3M19 12h3" />
    </svg>
  );
}

function PointInput({
  name,
  title,
  value,
  point,
  otherPoint,
  recentPlaces,
  activePoint,
  isLocating,
  onActivate,
  onEditPoint,
  onClearPoint,
  onSetPoint,
  onRequestCurrentLocation,
}) {
  const [focused, setFocused] = useState(false);
  const [dismissed, setDismissed] = useState(false);
  const [highlight, setHighlight] = useState(-1);
  // The list the field had when it lost the focus ('search', 'initial' or 'none'); null while focused.
  const [listOnBlur, setListOnBlur] = useState(null);
  const inputRef = useRef(null);
  const closeTimer = useRef(null);
  // Enter pressed while the suggestions were still loading: the first one is chosen when they come.
  const enterPending = useRef(false);
  // With a point chosen the field shows its name: focusing it offers the options again instead of
  // searching that name.
  const isSearching = !point && value.trim().length >= MIN_SEARCH_LENGTH;
  const listKind = isSearching ? 'search' : 'initial';
  const recents = recentOptions(recentPlaces, otherPoint);
  // "Mi ubicación" is offered in only one of the two fields at a time; below it, the recent places.
  const initialOptions = [
    ...(otherPoint?.source === DEVICE_SOURCE ? [] : [MY_LOCATION_OPTION]),
    ...recents,
  ];
  // During the delay after losing the focus only the list that was open stays (for the tap). Another
  // one must not open in a field the user has left, e.g. the empty list after "Limpiar".
  const open =
    focused &&
    !dismissed &&
    activePoint === name &&
    (isSearching || initialOptions.length > 0) &&
    (listOnBlur === null || listOnBlur === listKind);
  const listId = `${name}-suggestions`;

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function choose(option) {
    if (option.kind === 'location' && isLocating) return;
    enterPending.current = false;
    setDismissed(true);
    setHighlight(-1);
    // Before setting the point: on leaving the field a phone keyboard commits the text it was still
    // composing, which would count as editing and clear the point. It also closes the keyboard.
    inputRef.current?.blur();
    // The choice is made: the list closes now, not after the delay kept for taps (it would show the
    // options of a field that already has its point).
    window.clearTimeout(closeTimer.current);
    setFocused(false);
    if (option.kind === 'location') {
      // The same request as before with the GPS button: its messages say how it went, and nothing is
      // set if the permission is denied or it fails.
      onRequestCurrentLocation(name);
      return;
    }
    onSetPoint(name, {
      lat: option.lat,
      lng: option.lng,
      label: option.label,
      source: option.kind === 'recent' ? 'recent' : 'search',
    });
  }

  const search = usePlaceAutocomplete(value, open && isSearching, name, (results) => {
    if (!enterPending.current) return;
    enterPending.current = false;
    // With none, the list keeps its "not found" message.
    if (results.length) choose(results[0]);
  });
  // While typing: the matching recent places first and then the suggestions, without repeating a
  // place that is in both.
  const text = normalize(value.trim());
  const matchingRecents = isSearching
    ? recents
        .filter((option) => normalize(option.label).includes(text))
        .slice(0, MAX_MATCHING_RECENT_PLACES)
    : [];
  const recentKeys = new Set(matchingRecents.map(placeKey));
  const options = isSearching
    ? [...matchingRecents, ...search.results.filter((result) => !recentKeys.has(placeKey(result)))]
    : initialOptions;

  const selectedIndex = highlight < options.length ? highlight : -1;

  function renderOption(option, index) {
    return (
      <li
        key={option.id}
        id={`${listId}-${index}`}
        role="option"
        className={option.kind ? `suggestion-${option.kind}` : undefined}
        aria-selected={selectedIndex === index}
        aria-disabled={option.kind === 'location' && isLocating ? true : undefined}
        onPointerDown={(event) => event.preventDefault()}
        onClick={() => choose(option)}
      >
        {option.kind === 'location' && (
          <span className="suggestion-icon">
            <GpsIcon />
          </span>
        )}
        {option.kind === 'recent' && (
          <span className="suggestion-icon">
            <HistoryIcon kind="clock" />
          </span>
        )}
        {option.label}
      </li>
    );
  }

  function handleKey(event) {
    if (event.key === 'Escape') {
      enterPending.current = false;
      setDismissed(true);
      setHighlight(-1);
      return;
    }
    if (event.key === 'ArrowDown' || event.key === 'ArrowUp') {
      event.preventDefault();
      setDismissed(false);
      if (options.length) {
        setHighlight((index) =>
          event.key === 'ArrowDown'
            ? (index + 1) % options.length
            : (index <= 0 ? options.length : index) - 1
        );
      }
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      // The highlighted option or, while searching and without one, the first option (a matching
      // recent place or the first suggestion). If they are still loading, it waits for them; with
      // none, the list keeps its "not found" message. Without text, Enter alone never asks for the
      // location nor chooses a recent place.
      if (selectedIndex >= 0) choose(options[selectedIndex]);
      else if (isSearching && options.length) choose(options[0]);
      else if (isSearching && search.isLoading) enterPending.current = true;
    }
  }

  return (
    <div
      className={`point-field point-field-${name} ${activePoint === name ? 'is-active' : ''} ${
        open ? 'is-list-open' : ''
      }`}
    >
      <span className={`point-symbol point-symbol-${name}`} aria-hidden="true">
        {name === 'destination' && (
          <svg viewBox="0 0 24 30">
            <path d="M12 1C5.92 1 1 5.92 1 12c0 8.14 11 17 11 17s11-8.86 11-17C23 5.92 18.08 1 12 1Z" />
            <circle cx="12" cy="12" r="4" />
          </svg>
        )}
      </span>
      <div className="point-control">
        <label className="visually-hidden" htmlFor={name}>
          {title}
        </label>
        <div className="point-input-shell">
          <span className="search-icon">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            id={name}
            name={name}
            type="text"
            inputMode="search"
            autoComplete="off"
            role="combobox"
            aria-autocomplete="list"
            aria-expanded={open}
            aria-controls={open ? listId : undefined}
            aria-activedescendant={
              open && selectedIndex >= 0 ? `${listId}-${selectedIndex}` : undefined
            }
            aria-describedby={`${name}-coordinates`}
            maxLength={200}
            placeholder={name === 'origin' ? 'Elige un origen' : 'Elige un destino'}
            value={value}
            onFocus={() => {
              window.clearTimeout(closeTimer.current);
              setFocused(true);
              setDismissed(false);
              setListOnBlur(null);
              onActivate(name);
            }}
            onBlur={() => {
              setListOnBlur(open ? listKind : 'none');
              // Leaving the field cancels an Enter still waiting for its suggestions.
              enterPending.current = false;
              window.clearTimeout(closeTimer.current);
              closeTimer.current = window.setTimeout(() => setFocused(false), LIST_CLOSE_DELAY_MS);
              setHighlight(-1);
            }}
            onChange={(event) => {
              // Another text: an earlier Enter no longer applies.
              enterPending.current = false;
              setDismissed(false);
              setHighlight(-1);
              onEditPoint(name, event.target.value);
            }}
            onKeyDown={handleKey}
          />
          {Boolean(point || value) && (
            <button
              type="button"
              className="input-icon-button clear-point-button"
              aria-label={`Borrar ${pointLabel(name)}`}
              onClick={() => {
                setDismissed(true);
                onClearPoint(name);
              }}
            >
              ×
            </button>
          )}
        </div>
        {open && (
          <div className="autocomplete-panel">
            <ul
              id={listId}
              className="autocomplete-results"
              role="listbox"
              aria-label={`Lugares para ${title.toLowerCase()}`}
              aria-busy={isSearching && search.isLoading}
            >
              {options.map((option, index) => {
                if (option.kind !== 'recent') return renderOption(option, index);
                // The recent places go together in a group with a visible title.
                if (options[index - 1]?.kind === 'recent') return null;
                const group = options.slice(index).filter(({ kind }) => kind === 'recent');
                return (
                  <li key="recent-places" role="none">
                    <ul className="autocomplete-group" role="group" aria-label="Recientes">
                      <li role="none" className="autocomplete-group-title" aria-hidden="true">
                        Recientes
                      </li>
                      {group.map((recent, offset) => renderOption(recent, index + offset))}
                    </ul>
                  </li>
                );
              })}
            </ul>
            {isSearching && search.isLoading && (
              <p className="autocomplete-message" role="status">
                Buscando lugares...
              </p>
            )}
            {isSearching && search.errorMessage && (
              <p className="autocomplete-message autocomplete-error" role="alert">
                {search.errorMessage}
              </p>
            )}
            {isSearching && !search.isLoading && !search.errorMessage && options.length === 0 && (
              <p className="autocomplete-message" role="status">
                No se han encontrado lugares. Prueba otra dirección o selecciónala en el mapa.
              </p>
            )}
          </div>
        )}
        <p
          id={`${name}-coordinates`}
          // Points picked on the map already show their coordinates in the input.
          className={`point-coordinate ${point?.label ? 'has-point' : ''}`}
          aria-live="polite"
        >
          {point ? `${point.lat.toFixed(5)}, ${point.lng.toFixed(5)}` : 'Sin seleccionar'}
        </p>
      </div>
    </div>
  );
}

export function RouteSearchPanel({
  activePoint = 'origin',
  origin = null,
  destination = null,
  originInput = '',
  destinationInput = '',
  geolocation = { status: 'idle', errorMessage: '' },
  onSetActivePoint = noop,
  onEditPoint = noop,
  onClearPoint = noop,
  onSetPoint = noop,
  onResetPoints = noop,
  onRequestCurrentLocation = noop,
  onClearGeolocationMessage = noop,
  onCalculateRoute = noop,
  routeCalculation = { status: 'idle', errorMessage: '' },
  routeType = 'fastest',
  asksSolarDateTime = routeType === 'shaded',
  alternativeLabel = 'Tu ruta',
  preferences = null,
  // The places used recently as origin or destination (#180), offered in both fields.
  recentPlaces = [],
  solarDate = '',
  solarTime = '',
  onSolarDateChange = noop,
  onSolarTimeChange = noop,
  renderComparison = null,
  selectedStepIndex = null,
  onSelectStep = noop,
  onStartNavigation = noop,
  navigationError = '',
  pointErrorMessage = '',
  guidedTourActive = false,
}) {
  const isLocating = geolocation.status === 'loading';
  const isCalculating = routeCalculation.status === 'loading';
  const canCalculate = Boolean(origin && destination) && !isCalculating;
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(true);
  // On small screens the search panel and the details of the bottom sheet (the comparison or the
  // steps) never open together: they would overlap. Opening one folds the other. On large screens
  // only the steps react to this state.
  const [sheetDetail, setSheetDetail] = useState(null);
  // On small screens the handle on top of the bottom sheet folds the questions and the date, as in
  // the sketches; calculating a route folds them too so the result and the map are seen.
  const [isSheetFolded, setIsSheetFolded] = useState(false);
  const panelOpen = guidedTourActive || isMobilePanelOpen;
  // The handle folds the questions (without a route) or the result, leaving its title and the buttons
  // (with one), so more map is seen.
  const sheetFolded = guidedTourActive ? false : isSheetFolded;
  const routeActionsRef = useRef(null);
  // The drag of the handle of the bottom sheet, if any.
  const handleDragRef = useRef(null);

  useSheetHeight(routeActionsRef);

  // A new result starts at the top of the sheet, with its title in view.
  const shownResult = routeCalculation.comparison ?? routeCalculation.route;
  useEffect(() => {
    if (shownResult && routeActionsRef.current) routeActionsRef.current.scrollTop = 0;
  }, [shownResult]);

  function toggleMobilePanel() {
    setSheetDetail(null);
    setIsMobilePanelOpen((open) => !open);
  }

  function toggleSheetDetail(detail) {
    setIsMobilePanelOpen(false);
    setIsSheetFolded(false);
    setSheetDetail((current) => (current === detail ? null : detail));
  }
  const displayedRoute = routeCalculation.activeRoute || routeCalculation.route;
  // The questions and the date. Without a result they are in the sheet (on small screens, next to
  // «Calcular ruta», as in the sketches); with one, they are the dropdown «Cambiar preferencias».
  const hasResult = Boolean(routeCalculation.comparison || displayedRoute);
  const preferencesBlock = (
    <>
      <div data-tour="preferences">{preferences}</div>
      {asksSolarDateTime && (
        <div className="solar-date-time" aria-label="Momento para estimar la sombra">
          <label>
            Fecha
            <input
              type="date"
              value={solarDate}
              required
              onChange={(event) => onSolarDateChange(event.target.value)}
            />
          </label>
          <label>
            Hora
            <input
              type="time"
              value={solarTime}
              required
              onChange={(event) => onSolarTimeChange(event.target.value)}
            />
          </label>
        </div>
      )}
    </>
  );
  // With the shaded type chosen but only the fastest route calculated, there is still a calculation
  // to do.
  const canStartRoute =
    Boolean(displayedRoute) &&
    !isCalculating &&
    !(routeType === 'shaded' && !routeCalculation.comparison);
  const calculateButtonLabel = isCalculating ? 'Calculando...' : 'Calcular ruta';
  const showsAlternative =
    Boolean(routeCalculation.shaded) && displayedRoute === routeCalculation.shaded;

  return (
    <section
      className={`panel-section route-search-panel ${panelOpen ? '' : 'is-collapsed'}`}
      aria-labelledby="route-search-title"
    >
      <h2 id="route-search-title" className="visually-hidden">
        Ruta
      </h2>
      <button
        type="button"
        className="mobile-panel-toggle"
        aria-expanded={panelOpen}
        aria-controls="route-search-content"
        onClick={toggleMobilePanel}
      >
        <span>{panelOpen ? 'Ocultar' : 'Ruta'}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>
      <div id="route-search-content" className="route-form">
        <fieldset className="selection-mode">
          <legend>
            El clic en el mapa fija{' '}
            <InfoButton label="selección en el mapa">
              Elige primero si el toque fijará el origen o el destino. También puedes buscar una
              dirección o usar tu ubicación.
            </InfoButton>
          </legend>
          <div className="segmented-control">
            {['origin', 'destination'].map((name) => (
              <button
                key={name}
                type="button"
                className={activePoint === name ? 'is-active' : ''}
                aria-pressed={activePoint === name}
                onClick={() => onSetActivePoint(name)}
              >
                {pointTitle(name)}
              </button>
            ))}
          </div>
        </fieldset>
        <div className="point-list" data-tour="points">
          {['origin', 'destination'].map((name) => (
            <PointInput
              key={name}
              name={name}
              title={pointTitle(name)}
              value={name === 'origin' ? originInput : destinationInput}
              point={name === 'origin' ? origin : destination}
              otherPoint={name === 'origin' ? destination : origin}
              recentPlaces={recentPlaces}
              activePoint={activePoint}
              isLocating={isLocating}
              onActivate={onSetActivePoint}
              onEditPoint={onEditPoint}
              onClearPoint={onClearPoint}
              onSetPoint={onSetPoint}
              onRequestCurrentLocation={onRequestCurrentLocation}
            />
          ))}
        </div>
        <div className={`route-actions ${sheetFolded ? 'is-folded' : ''}`} ref={routeActionsRef}>
          <button
            type="button"
            className="sheet-handle"
            aria-expanded={!sheetFolded}
            aria-label={
              hasResult
                ? `${sheetFolded ? 'Mostrar' : 'Ocultar'} detalles de la ruta`
                : `${sheetFolded ? 'Mostrar' : 'Ocultar'} preferencias`
            }
            onClick={() => {
              // A drag already folded or unfolded it: the click that follows must not undo it.
              if (handleDragRef.current?.moved) {
                handleDragRef.current = null;
                return;
              }
              setIsSheetFolded((folded) => !folded);
            }}
            onPointerDown={(event) => {
              handleDragRef.current = { y: event.clientY, moved: false };
              // Keeps the finger on the handle while dragging out of it.
              event.currentTarget.setPointerCapture?.(event.pointerId);
            }}
            onPointerMove={(event) => {
              const drag = handleDragRef.current;
              if (!drag || drag.moved) return;
              const dy = event.clientY - drag.y;
              // Dragged down folds the sheet; up unfolds it.
              if (Math.abs(dy) >= 24) {
                drag.moved = true;
                setIsSheetFolded(dy > 0);
              }
            }}
            onPointerCancel={() => {
              handleDragRef.current = null;
            }}
          >
            <span aria-hidden="true" />
          </button>
          {/* The questions and the date go in the bottom sheet on small screens, next to «Calcular
              ruta», as in the sketches; on large screens this box adds nothing and the order is the
              same as before. */}
          {/* With a result the questions are a dropdown of it («Cambiar preferencias», PBI-19). */}
          {(!hasResult || guidedTourActive) && preferencesBlock}
          <div className="map-guidance">
            <p>También puedes marcar el origen y el destino tocando directamente el mapa.</p>
            <p className={`active-map-target active-map-target-${activePoint}`}>
              <span className="active-map-dot" aria-hidden="true" />
              <span>Selección en el mapa</span>
              <strong>{pointTitle(activePoint)}</strong>
            </p>
          </div>
          {navigationError && (
            <p className="form-message form-message-error" role="alert">
              {navigationError}
            </p>
          )}
          {pointErrorMessage && (
            <p className="form-message form-message-error" role="alert">
              {pointErrorMessage}
            </p>
          )}
          {geolocation.errorMessage && (
            <div className="form-message form-message-error" role="alert">
              {geolocation.errorMessage}
              <button type="button" onClick={onClearGeolocationMessage}>
                Cerrar
              </button>
            </div>
          )}
          {isLocating && (
            <div className="form-message" role="status">
              Obteniendo la ubicación actual...
              <button type="button" onClick={onClearGeolocationMessage}>
                Cancelar ubicación
              </button>
            </div>
          )}
          {geolocation.status === 'success' && (
            <p className="form-message" role="status">
              Se ha puesto tu ubicación como {pointLabel(geolocation.pointType)}.
            </p>
          )}
          {routeCalculation.errorMessage && (
            <p className="form-message form-message-error" role="alert">
              {routeCalculation.errorMessage}
            </p>
          )}
          {isCalculating && (
            <p className="form-message" role="status">
              Calculando{' '}
              {routeType === 'shaded' ? `la ruta «${alternativeLabel}»` : 'la ruta más rápida'}...
            </p>
          )}
          {displayedRoute && (
            <RouteSummary
              distance={displayedRoute.distance}
              duration={displayedRoute.duration}
              shadePercentage={displayedRoute.exposure?.shadePercentage}
              greenPercentage={displayedRoute.vegetation?.greenPercentage}
              title={showsAlternative ? alternativeLabel : 'La más rápida'}
            />
          )}
          {/* «Cambiar preferencias», «Ver detalle» and «Recorrido»: only one open at a time. */}
          {renderComparison?.({
            openSection: sheetDetail,
            onToggleSection: toggleSheetDetail,
            preferences: guidedTourActive ? null : preferencesBlock,
          })}
          {displayedRoute && (
            <RouteSteps
              steps={displayedRoute.steps ?? []}
              isOpen={sheetDetail === 'steps'}
              onToggle={() => toggleSheetDetail('steps')}
              selectedStepIndex={selectedStepIndex}
              onSelectStep={onSelectStep}
            />
          )}
          <div className="route-footer">
            <button
              type="button"
              className="secondary-button clear-selection-button"
              aria-label="Limpiar selección"
              disabled={
                !origin &&
                !destination &&
                !originInput &&
                !destinationInput &&
                geolocation.status === 'idle'
              }
              onClick={onResetPoints}
            >
              <span aria-hidden="true">×</span> Limpiar
            </button>
            {canStartRoute ? (
              <>
                <button
                  type="button"
                  className="route-submit"
                  data-tour="start-navigation"
                  onClick={onStartNavigation}
                >
                  Iniciar ruta
                </button>
              </>
            ) : (
              <>
                <button
                  type="button"
                  className={`route-submit ${isCalculating ? 'is-loading' : ''}`}
                  data-tour="calculate-route"
                  disabled={!canCalculate}
                  onClick={() => {
                    // On mobile the open search panel covers most of the map; fold it so the route
                    // is visible. The toggle (and this state) only has an effect on small screens.
                    setIsMobilePanelOpen(false);
                    setIsSheetFolded(false);
                    setSheetDetail(null);
                    onCalculateRoute();
                  }}
                  title={!origin || !destination ? 'Selecciona un origen y un destino' : undefined}
                >
                  {isCalculating && <span className="route-submit-spinner" aria-hidden="true" />}
                  {calculateButtonLabel}
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
