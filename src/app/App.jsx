import { useCallback, useEffect, useRef, useState } from 'react';

import { AppShell } from '../components/layout/AppShell.jsx';
import { MapView } from '../features/map/MapView.jsx';
import { isInsideZaragoza, OUTSIDE_ZARAGOZA_MESSAGE } from '../features/map/zaragozaArea.js';
import { AssistantFab } from '../features/route-assistant/AssistantFab.jsx';
import { RouteAssistant } from '../features/route-assistant/RouteAssistant.jsx';
import { useRouteAssistant } from '../features/route-assistant/useRouteAssistant.js';
import { RouteResult } from '../features/route-comparison/RouteResult.jsx';
import { RoutePreferences } from '../features/route-preferences/RoutePreferences.jsx';
import { hasPreference } from '../features/route-preferences/preferenceTexts.js';
import { useRoutePreferences } from '../features/route-preferences/useRoutePreferences.js';
import { NavigationPanel } from '../features/routing/NavigationPanel.jsx';
import { useRouteNavigation } from '../features/routing/useRouteNavigation.js';
import { getZaragozaDateTime } from '../features/routing/zaragozaDateTime.js';
import { useRoutePlanner } from '../features/routing/useRoutePlanner.js';
import { RouteSearchPanel } from '../features/route-search/RouteSearchPanel.jsx';
import { useDeviceLocation } from '../features/route-search/useDeviceLocation.js';
import { FavoritesDialog } from '../features/route-history/RouteHistory.jsx';
import { useRouteHistory } from '../features/route-history/useRouteHistory.js';
import { useRoutePoints } from '../features/route-search/useRoutePoints.js';
import { WeatherPanel } from '../features/weather/WeatherPanel.jsx';
import { GuidedTour, TOUR_STEPS } from '../features/tutorial/GuidedTour.jsx';

const ignoreMapPoint = () => {};
// The route chosen with the preferences (or the weather) is "Tu ruta", as in the sketches of the
// team (Mejoras_S4); the other one is "La más rápida".
const ALTERNATIVE_LABEL = 'Tu ruta';

// What a route is calculated with: the answers and the minutes, without «Según el tiempo de hoy».
function answersAndMinutes({ sunShade, avoidWind, preferParks, extraMinutes }) {
  return { sunShade, avoidWind, preferParks, extraMinutes };
}

function getStepGeometry(route, stepIndex) {
  const [start, end] = route.steps[stepIndex].wayPoints;
  return { type: 'LineString', coordinates: route.geometry.coordinates.slice(start, end + 1) };
}

export function App({ userMenu = null, user = null, onSaveTutorialStatus = null }) {
  const routePoints = useRoutePoints();
  const routePlanner = useRoutePlanner();
  const routePreferences = useRoutePreferences();
  const { preferences } = routePreferences;
  const routeHistory = useRouteHistory();
  const routeAssistant = useRouteAssistant();
  // Which of the two calculated routes is shown: the fastest one or the one chosen with the weights.
  const [shownRoute, setShownRoute] = useState('shaded');
  const [solarDateTime, setSolarDateTime] = useState(getZaragozaDateTime);
  const [selectedStep, setSelectedStep] = useState(null);
  const [tourStep, setTourStep] = useState(null);
  const [isFavoritesOpen, setIsFavoritesOpen] = useState(false);
  const [tourError, setTourError] = useState('');
  const [isSavingTutorial, setIsSavingTutorial] = useState(false);
  const autoStartedTour = useRef(false);
  const previousFocus = useRef(null);

  const openTutorial = useCallback(() => {
    previousFocus.current = document.activeElement;
    setTourError('');
    setTourStep(0);
  }, []);

  useEffect(() => {
    if (user && user.tutorialStatus == null && !autoStartedTour.current) {
      autoStartedTour.current = true;
      openTutorial();
    }
  }, [user, openTutorial]);

  useEffect(() => {
    function listen() {
      openTutorial();
    }
    window.addEventListener('weathermapz:open-tour', listen);
    return () => window.removeEventListener('weathermapz:open-tour', listen);
  }, [openTutorial]);

  useEffect(() => {
    function listen() {
      setIsFavoritesOpen(true);
    }
    window.addEventListener('weathermapz:open-favorites', listen);
    return () => window.removeEventListener('weathermapz:open-favorites', listen);
  }, []);

  // The weather details open on their step of the tour and close on the others; the profile menu
  // opens on the steps about the favourites and «Ver tutorial», and closes when the tour ends.
  useEffect(() => {
    const id = tourStep === null ? null : TOUR_STEPS[tourStep].id;
    if (id !== null) {
      const event = id === 'current-weather' ? 'open' : 'close';
      window.dispatchEvent(new window.Event(`weathermapz:${event}-weather`));
    }
    window.dispatchEvent(
      new window.CustomEvent('weathermapz:tour-user-menu', {
        detail: { open: id === 'favorites' || id === 'repeat' },
      })
    );
  }, [tourStep]);

  async function finishTutorial(status) {
    setTourError('');
    setIsSavingTutorial(true);
    try {
      await onSaveTutorialStatus?.(status);
      setTourStep(null);
      window.setTimeout(() => previousFocus.current?.focus?.(), 0);
    } catch (error) {
      setTourError(error.message || 'Error de conexión');
    } finally {
      setIsSavingTutorial(false);
    }
  }

  async function nextTutorialStep() {
    if (tourStep === TOUR_STEPS.length - 1) {
      await finishTutorial('completed');
      return true;
    }
    setTourStep((current) => current + 1);
    return false;
  }
  const geolocation = useDeviceLocation({
    onLocated: (pointType, point) => {
      routePlanner.clearRoutes();
      routePoints.setPoint(pointType, point);
    },
    validatePoint: (point) => (isInsideZaragoza(point) ? null : OUTSIDE_ZARAGOZA_MESSAGE),
  });
  function withSelectionUpdated(action) {
    return (...args) => {
      geolocation.clearGeolocationMessage();
      routePlanner.clearRoutes();
      action(...args);
    };
  }

  // The route on screen. An answer of the route assistant (PBI-9.2) only counts while the route it
  // belongs to is shown: choosing another route, other points or another time leaves it behind.
  const shownComparisonOrRoute = routePlanner.comparison ?? routePlanner.fastest;
  const assistantIsCurrent =
    Boolean(shownComparisonOrRoute) && routeAssistant.route === shownComparisonOrRoute;
  // The last weights the assistant applied, while their route is the one on screen (a later notice
  // or error keeps them).
  const adjustment =
    routePlanner.comparison && routeAssistant.applied?.comparison === routePlanner.comparison
      ? routeAssistant.applied.assistant
      : null;
  // The answers decide how "Calcular ruta" works and whether a date is asked for: with every answer
  // indifferent only the fastest route is calculated (PBI-18). The type on screen follows the
  // assistant's answers when it changed them.
  const chosenRouteType = hasPreference(preferences) ? 'shaded' : 'fastest';
  let routeType = chosenRouteType;
  if (adjustment) routeType = hasPreference(adjustment.after) ? 'shaded' : 'fastest';
  // Only shade and sun depend on the date and time; «Según el tiempo de hoy» is the weather of now.
  const asksSolarDateTime =
    !routePreferences.byWeather && chosenRouteType === 'shaded' && preferences.sunShade !== 'any';
  const alternativeLabel = ALTERNATIVE_LABEL;
  const selectedRouteType =
    routeType === 'shaded' && shownRoute === 'shaded' && routePlanner.shaded ? 'shaded' : 'fastest';
  const activeRoute = selectedRouteType === 'shaded' ? routePlanner.shaded : routePlanner.fastest;
  // The selected step belongs to one route: with another route (or none) nothing is selected.
  const selectedStepIndex = selectedStep?.route === activeRoute ? selectedStep.index : null;
  const selectedStepGeometry =
    selectedStepIndex === null ? null : getStepGeometry(activeRoute, selectedStepIndex);
  const navigation = useRouteNavigation(activeRoute);
  // The floating button of the assistant (#179): only with a calculated route on screen and not while
  // walking it.
  const showsAssistant =
    Boolean(activeRoute) && routePlanner.status !== 'loading' && !navigation.isActive;

  // A new answer means another route: the calculated ones go away. Shade, sun or the wind chosen by
  // hand also turn «Según el tiempo de hoy» off (useRoutePreferences).
  function changePreferences(changes) {
    routePlanner.clearRoutes();
    setShownRoute('shaded');
    routePreferences.change(changes);
  }

  function toggleWeather() {
    routePlanner.clearRoutes();
    setShownRoute('shaded');
    routePreferences.toggleWeather();
  }

  // The places of a route that is calculated go to the recent places (#180); a failed one does not.
  async function calculateRoute(
    origin,
    destination,
    dateTime = solarDateTime,
    answers = preferences
  ) {
    setShownRoute('shaded');
    const result = await routePlanner.calculateRoute(origin, destination, {
      routeType: hasPreference(answers) ? 'shaded' : 'fastest',
      preferences: answersAndMinutes(answers),
      ...dateTime,
    });
    if (result) routeHistory.recordPlaces([origin, destination]);
  }

  // «Probar con +N min» (PBI-19): the suggested minutes become the user's and the route is calculated
  // again with them.
  function trySuggestion(minutes) {
    const answers = routePreferences.change({ extraMinutes: minutes });
    calculateRoute(routePoints.origin, routePoints.destination, solarDateTime, answers);
  }

  // The answers of the route on screen: the assistant's or the user's (marked by the weather or not).
  function currentPreferences() {
    return adjustment ? adjustment.after : answersAndMinutes(preferences);
  }

  // "Usar como mis preferencias": the assistant's answers become the user's. The route on screen
  // already is theirs, so it stays.
  async function usePreferences(answers) {
    await routePreferences.replace(answers);
  }

  // The assistant recalculates the route of the same points; if it fails, the route stays.
  async function askAssistant(message) {
    const result = await routeAssistant.ask(shownComparisonOrRoute, {
      origin: routePoints.origin,
      destination: routePoints.destination,
      // The date and time chosen by the user, if they chose one; otherwise the backend uses now.
      ...(asksSolarDateTime ? solarDateTime : {}),
      message,
      preferences: currentPreferences(),
    });
    if (result?.comparison) {
      setShownRoute('shaded');
      routePlanner.showComparison(result.comparison);
    }
  }

  // A favourite trip is calculated again for now, with the route type chosen.
  function repeatTrip({ origin, destination }) {
    geolocation.clearGeolocationMessage();
    routePlanner.clearRoutes();
    if (!routePoints.setTrip(origin, destination)) return;
    const now = getZaragozaDateTime();
    setSolarDateTime(now);
    calculateRoute(origin, destination, now);
  }

  function updateSolarDateTime(field, value) {
    routePlanner.clearRoutes();
    setSolarDateTime((current) => ({ ...current, [field]: value }));
  }

  return (
    <AppShell
      userMenu={userMenu}
      weather={<WeatherPanel />}
      overlay={
        <>
          {tourStep !== null && (
            <GuidedTour
              step={tourStep}
              onPrevious={() => setTourStep((step) => Math.max(0, step - 1))}
              onNext={nextTutorialStep}
              onSkip={() => finishTutorial('skipped')}
              saving={isSavingTutorial}
              error={tourError}
            />
          )}
          {isFavoritesOpen && (
            <FavoritesDialog
              history={routeHistory}
              currentTrip={
                routePoints.origin && routePoints.destination
                  ? { origin: routePoints.origin, destination: routePoints.destination }
                  : null
              }
              onSelectTrip={repeatTrip}
              onClose={() => setIsFavoritesOpen(false)}
            />
          )}
        </>
      }
      map={
        <MapView
          activePoint={routePoints.activePoint}
          destination={routePoints.destination}
          focusPoint={routePoints.lastSelectedPoint}
          // While walking a route, a tap on the map must not change it.
          onSelectPoint={
            navigation.isActive ? ignoreMapPoint : withSelectionUpdated(routePoints.selectPoint)
          }
          origin={routePoints.origin}
          fastestRoute={routePlanner.fastest}
          shadedRoute={routePlanner.shaded}
          alternativeLabel={alternativeLabel}
          selectedRouteType={selectedRouteType}
          selectedStepGeometry={navigation.isActive ? null : selectedStepGeometry}
          navigationPosition={navigation.position}
          followNavigation={navigation.followsPosition}
          onNavigationDrag={navigation.pauseFollowing}
          assistantButton={
            showsAssistant ? (
              <AssistantFab isAdjusted={Boolean(adjustment)}>
                {(draft) => (
                  <RouteAssistant
                    status={assistantIsCurrent ? routeAssistant.status : 'idle'}
                    result={assistantIsCurrent ? routeAssistant.result : null}
                    applied={adjustment}
                    errorMessage={routeAssistant.errorMessage}
                    canUsePreferences={!routePreferences.loadFailed}
                    onAsk={askAssistant}
                    onUsePreferences={usePreferences}
                    {...draft}
                  />
                )}
              </AssistantFab>
            ) : null
          }
        />
      }
      sidebar={
        navigation.isActive ? (
          <NavigationPanel
            progress={navigation.progress}
            signalLost={navigation.signalLost}
            onStop={navigation.stop}
            onRecenter={navigation.canRecenter ? navigation.resumeFollowing : null}
          />
        ) : (
          <>
            <RouteSearchPanel
              activePoint={routePoints.activePoint}
              destination={routePoints.destination}
              geolocation={geolocation.geolocation}
              onClearGeolocationMessage={geolocation.clearGeolocationMessage}
              onCalculateRoute={() => calculateRoute(routePoints.origin, routePoints.destination)}
              originInput={routePoints.originInput}
              destinationInput={routePoints.destinationInput}
              onEditPoint={withSelectionUpdated(routePoints.editPoint)}
              onClearPoint={withSelectionUpdated(routePoints.clearPoint)}
              onRequestCurrentLocation={geolocation.requestCurrentLocation}
              onResetPoints={withSelectionUpdated(routePoints.resetPoints)}
              onSetActivePoint={routePoints.setActivePoint}
              onSetPoint={withSelectionUpdated(routePoints.setPoint)}
              origin={routePoints.origin}
              pointErrorMessage={routePoints.pointError}
              guidedTourActive={tourStep !== null}
              routeCalculation={{ ...routePlanner, activeRoute }}
              selectedStepIndex={selectedStepIndex}
              onSelectStep={(index) => setSelectedStep({ route: activeRoute, index })}
              onStartNavigation={navigation.start}
              navigationError={navigation.errorMessage}
              routeType={routeType}
              asksSolarDateTime={asksSolarDateTime}
              alternativeLabel={alternativeLabel}
              recentPlaces={routeHistory.places}
              preferences={
                <RoutePreferences
                  preferences={preferences}
                  byWeather={routePreferences.byWeather}
                  weather={routePreferences.weather}
                  // With a route the questions are the dropdown «Cambiar preferencias» of the
                  // result, always in full.
                  isCompact={false}
                  showExtraTimeForTour={TOUR_STEPS[tourStep]?.id === 'extra-time'}
                  loadFailed={routePreferences.loadFailed}
                  saveError={routePreferences.saveError}
                  onChange={changePreferences}
                  onToggleWeather={toggleWeather}
                />
              }
              solarDate={solarDateTime.date}
              solarTime={solarDateTime.time}
              onSolarDateChange={(value) => updateSolarDateTime('date', value)}
              onSolarTimeChange={(value) => updateSolarDateTime('time', value)}
              renderComparison={(sections) =>
                routePlanner.comparison || routePlanner.fastest ? (
                  <RouteResult
                    {...sections}
                    // Only the fastest route (every answer indifferent): the same result, alone.
                    comparison={
                      routePlanner.comparison ?? {
                        status: 'fastest_only',
                        fastest: routePlanner.fastest,
                        shaded: null,
                        preferences: answersAndMinutes(preferences),
                      }
                    }
                    selectedRouteType={selectedRouteType}
                    alternativeLabel={alternativeLabel}
                    onSelectRoute={setShownRoute}
                    onTrySuggestion={trySuggestion}
                  />
                ) : null
              }
            />
          </>
        )
      }
    />
  );
}
