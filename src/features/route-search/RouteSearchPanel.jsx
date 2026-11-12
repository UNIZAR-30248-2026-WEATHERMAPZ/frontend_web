import { useEffect, useRef, useState } from 'react';

import { RouteSteps } from '../routing/RouteSteps.jsx';
import { RouteSummary } from '../routing/RouteSummary.jsx';
import { usePlaceAutocomplete } from './usePlaceAutocomplete.js';
import { useSheetHeight } from './useSheetHeight.js';

// Safari on iPhone takes the focus away from the field before delivering the tap on a suggestion:
// closing the list at once would leave the tap without a target, and it would reach the map below.
const LIST_CLOSE_DELAY_MS = 200;

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
  const inputRef = useRef(null);
  const closeTimer = useRef(null);
  // Enter pressed while the suggestions were still loading: the first one is chosen when they come.
  const enterPending = useRef(false);
  const open = focused && !dismissed && activePoint === name && !point && value.trim().length >= 3;
  const listId = `${name}-suggestions`;

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  function choose(result) {
    enterPending.current = false;
    setDismissed(true);
    setHighlight(-1);
    // Before setting the point: on leaving the field a phone keyboard commits the text it was still
    // composing, which would count as editing and clear the point. It also closes the keyboard.
    inputRef.current?.blur();
    onSetPoint(name, { lat: result.lat, lng: result.lng, label: result.label, source: 'search' });
  }

  const search = usePlaceAutocomplete(value, open, name, (results) => {
    if (!enterPending.current) return;
    enterPending.current = false;
    // With none, the list keeps its "not found" message.
    if (results.length) choose(results[0]);
  });
  const selectedIndex = highlight < search.results.length ? highlight : -1;

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
      if (search.results.length) {
        setHighlight((index) =>
          event.key === 'ArrowDown'
            ? (index + 1) % search.results.length
            : (index <= 0 ? search.results.length : index) - 1
        );
      }
    }
    if (event.key === 'Enter' && open) {
      event.preventDefault();
      // The highlighted suggestion or, without one, the first. If they are still loading, it waits
      // for them; with none, the list keeps its "not found" message.
      if (selectedIndex >= 0) choose(search.results[selectedIndex]);
      else if (search.results.length) choose(search.results[0]);
      else if (search.isLoading) enterPending.current = true;
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
              onActivate(name);
            }}
            onBlur={() => {
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
          <button
            type="button"
            className="input-icon-button gps-button"
            aria-label={`Usar GPS para ${pointLabel(name)}`}
            disabled={isLocating}
            onClick={() => {
              setDismissed(true);
              onRequestCurrentLocation(name);
            }}
          >
            <GpsIcon />
          </button>
        </div>
        {open && (
          <div className="autocomplete-panel">
            <ul
              id={listId}
              className="autocomplete-results"
              role="listbox"
              aria-label={`Lugares para ${title.toLowerCase()}`}
              aria-busy={search.isLoading}
            >
              {search.results.map((result, index) => (
                <li
                  key={result.id}
                  id={`${listId}-${index}`}
                  role="option"
                  aria-selected={selectedIndex === index}
                  onPointerDown={(event) => event.preventDefault()}
                  onClick={() => choose(result)}
                >
                  {result.label}
                </li>
              ))}
            </ul>
            {search.isLoading && (
              <p className="autocomplete-message" role="status">
                Buscando lugares...
              </p>
            )}
            {search.errorMessage && (
              <p className="autocomplete-message autocomplete-error" role="alert">
                {search.errorMessage}
              </p>
            )}
            {!search.isLoading && !search.errorMessage && search.results.length === 0 && (
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
  alternativeLabel = 'Con sombra',
  profilePicker = null,
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
}) {
  const isLocating = geolocation.status === 'loading';
  const isCalculating = routeCalculation.status === 'loading';
  const canCalculate = Boolean(origin && destination) && !isCalculating;
  const [isMobilePanelOpen, setIsMobilePanelOpen] = useState(true);
  // On small screens the search panel and the details of the bottom sheet (the comparison or the
  // steps) never open together: they would overlap. Opening one folds the other. On large screens
  // only the steps react to this state.
  const [sheetDetail, setSheetDetail] = useState(null);
  const routeActionsRef = useRef(null);

  useSheetHeight(routeActionsRef);

  function toggleMobilePanel() {
    setSheetDetail(null);
    setIsMobilePanelOpen((open) => !open);
  }

  function toggleSheetDetail(detail) {
    setIsMobilePanelOpen(false);
    setSheetDetail((current) => (current === detail ? null : detail));
  }
  const displayedRoute = routeCalculation.activeRoute || routeCalculation.route;
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
      className={`panel-section route-search-panel ${isMobilePanelOpen ? '' : 'is-collapsed'}`}
      aria-labelledby="route-search-title"
    >
      <h2 id="route-search-title" className="visually-hidden">
        Ruta
      </h2>
      <button
        type="button"
        className="mobile-panel-toggle"
        aria-expanded={isMobilePanelOpen}
        aria-controls="route-search-content"
        onClick={toggleMobilePanel}
      >
        <span>{isMobilePanelOpen ? 'Ocultar' : 'Ruta'}</span>
        <svg viewBox="0 0 20 20" aria-hidden="true">
          <path d="m5 8 5 5 5-5" />
        </svg>
      </button>
      <div id="route-search-content" className="route-form">
        <fieldset className="selection-mode">
          <legend>El clic en el mapa fija</legend>
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
        <div className="point-list">
          {['origin', 'destination'].map((name) => (
            <PointInput
              key={name}
              name={name}
              title={pointTitle(name)}
              value={name === 'origin' ? originInput : destinationInput}
              point={name === 'origin' ? origin : destination}
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
        {profilePicker}
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
        <div className="route-actions" ref={routeActionsRef}>
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
              Ubicación actual asignada como {pointLabel(geolocation.pointType)}.
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
              title={showsAlternative ? alternativeLabel : 'Ruta rápida'}
            />
          )}
          {renderComparison?.({
            isExpanded: sheetDetail === 'comparison',
            onToggleExpanded: () => toggleSheetDetail('comparison'),
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
              <button type="button" className="route-submit" onClick={onStartNavigation}>
                Iniciar ruta
              </button>
            ) : (
              <button
                type="button"
                className={`route-submit ${isCalculating ? 'is-loading' : ''}`}
                disabled={!canCalculate}
                onClick={() => {
                  // On mobile the open search panel covers most of the map; fold it so the route
                  // is visible. The toggle (and this state) only has an effect on small screens.
                  setIsMobilePanelOpen(false);
                  setSheetDetail(null);
                  onCalculateRoute();
                }}
                title={!origin || !destination ? 'Selecciona un origen y un destino' : undefined}
              >
                {isCalculating && <span className="route-submit-spinner" aria-hidden="true" />}
                {calculateButtonLabel}
              </button>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
