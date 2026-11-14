import { useState } from 'react';

import { AppShell } from '../components/layout/AppShell.jsx';
import { ComfortSummary } from '../features/comfort-summary/ComfortSummary.jsx';
import { MapView } from '../features/map/MapView.jsx';
import { isInsideZaragoza, OUTSIDE_ZARAGOZA_MESSAGE } from '../features/map/zaragozaArea.js';
import { RouteComparisonPanel } from '../features/route-comparison/RouteComparisonPanel.jsx';
import { RouteProfilePicker } from '../features/route-profiles/RouteProfilePicker.jsx';
import {
  RECOMMENDED_PROFILE,
  RECOMMENDED_PROFILE_ID,
  hasEnvironmentalWeight,
  hasShadeWeight,
  useRouteProfiles,
} from '../features/route-profiles/useRouteProfiles.js';
import { RecommendationCard } from '../features/route-recommendation/RecommendationCard.jsx';
import { NavigationPanel } from '../features/routing/NavigationPanel.jsx';
import { useRouteNavigation } from '../features/routing/useRouteNavigation.js';
import { getZaragozaDateTime } from '../features/routing/zaragozaDateTime.js';
import { useRoutePlanner } from '../features/routing/useRoutePlanner.js';
import { RouteSearchPanel } from '../features/route-search/RouteSearchPanel.jsx';
import { useDeviceLocation } from '../features/route-search/useDeviceLocation.js';
import { useRoutePoints } from '../features/route-search/useRoutePoints.js';
import { WeatherPanel } from '../features/weather/WeatherPanel.jsx';

const ignoreMapPoint = () => {};

function getStepGeometry(route, stepIndex) {
  const [start, end] = route.steps[stepIndex].wayPoints;
  return { type: 'LineString', coordinates: route.geometry.coordinates.slice(start, end + 1) };
}

export function App({ userMenu = null }) {
  const routePoints = useRoutePoints();
  const routePlanner = useRoutePlanner();
  const routeProfiles = useRouteProfiles();
  const [profileId, setProfileId] = useState(null);
  // Which of the two calculated routes is shown: the fastest one or the one chosen with the weights.
  const [shownRoute, setShownRoute] = useState('shaded');
  const [solarDateTime, setSolarDateTime] = useState(getZaragozaDateTime);
  const [selectedStep, setSelectedStep] = useState(null);
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

  // The recommended route (PBI-9.1) goes first, but the default is still the first saved route.
  const pickerProfiles = [RECOMMENDED_PROFILE, ...routeProfiles.profiles];
  // While loading, the presets are shown with their presetKey as id: a choice made then is kept
  // once the routes of the user arrive.
  const profile =
    pickerProfiles.find(({ id }) => id === profileId) ??
    routeProfiles.profiles.find(({ presetKey }) => presetKey && presetKey === profileId) ??
    routeProfiles.profiles[0] ??
    null;
  // Internally "shaded" is still the route chosen with the weights: it is shown like the Shaded
  // Route of PBI-5.4, with the name of the profile.
  // The recommended route is compared with the fastest one like any route with weights.
  const isRecommended = profile?.id === RECOMMENDED_PROFILE_ID;
  const routeType =
    isRecommended || (profile && hasEnvironmentalWeight(profile.weights)) ? 'shaded' : 'fastest';
  const alternativeLabel = profile?.name ?? 'Con sombra';
  const selectedRouteType =
    routeType === 'shaded' && shownRoute === 'shaded' && routePlanner.shaded ? 'shaded' : 'fastest';
  const activeRoute = selectedRouteType === 'shaded' ? routePlanner.shaded : routePlanner.fastest;
  // The selected step belongs to one route: with another route (or none) nothing is selected.
  const selectedStepIndex = selectedStep?.route === activeRoute ? selectedStep.index : null;
  const selectedStepGeometry =
    selectedStepIndex === null ? null : getStepGeometry(activeRoute, selectedStepIndex);
  const navigation = useRouteNavigation(activeRoute);

  function selectProfile(id) {
    routePlanner.clearRoutes();
    setShownRoute('shaded');
    setProfileId(id);
  }

  async function saveProfile(id, draft) {
    const saved = await routeProfiles.saveProfile(id, draft);
    // The calculated routes were chosen with the old weights.
    if (saved.id === profile?.id) routePlanner.clearRoutes();
    return saved;
  }

  async function deleteProfile(id) {
    await routeProfiles.deleteProfile(id);
    if (id === profile?.id) selectProfile(null);
  }

  function updateSolarDateTime(field, value) {
    routePlanner.clearRoutes();
    setSolarDateTime((current) => ({ ...current, [field]: value }));
  }

  return (
    <AppShell
      userMenu={userMenu}
      weather={<WeatherPanel />}
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
              onCalculateRoute={() => {
                setShownRoute('shaded');
                routePlanner.calculateRoute(routePoints.origin, routePoints.destination, {
                  routeType,
                  recommended: isRecommended,
                  weights: profile?.weights,
                  maxDetourPercentage: profile?.maxDetourPercentage,
                  ...solarDateTime,
                });
              }}
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
              routeCalculation={{ ...routePlanner, activeRoute }}
              selectedStepIndex={selectedStepIndex}
              onSelectStep={(index) => setSelectedStep({ route: activeRoute, index })}
              onStartNavigation={navigation.start}
              navigationError={navigation.errorMessage}
              routeType={routeType}
              // The recommended route is always for now, with the current weather.
              asksSolarDateTime={
                !isRecommended && routeType === 'shaded' && hasShadeWeight(profile.weights)
              }
              alternativeLabel={alternativeLabel}
              profilePicker={
                <RouteProfilePicker
                  profiles={pickerProfiles}
                  selectedId={profile?.id ?? null}
                  isEditable={routeProfiles.isEditable}
                  loadFailed={routeProfiles.loadFailed}
                  onSelect={selectProfile}
                  onSave={saveProfile}
                  onDelete={deleteProfile}
                  onReplace={routeProfiles.replaceProfile}
                />
              }
              solarDate={solarDateTime.date}
              solarTime={solarDateTime.time}
              onSolarDateChange={(value) => updateSolarDateTime('date', value)}
              onSolarTimeChange={(value) => updateSolarDateTime('time', value)}
              renderComparison={(collapse) =>
                routePlanner.comparison ? (
                  <>
                    <RecommendationCard
                      recommendation={routePlanner.comparison.recommendation}
                      isExpanded={collapse.isExpanded}
                    />
                    <RouteComparisonPanel
                      comparison={routePlanner.comparison}
                      selectedRouteType={selectedRouteType}
                      alternativeLabel={alternativeLabel}
                      onSelectRoute={setShownRoute}
                      {...collapse}
                    />
                    <ComfortSummary
                      comparison={routePlanner.comparison}
                      selectedRouteType={selectedRouteType}
                      alternativeLabel={alternativeLabel}
                      weights={
                        isRecommended
                          ? routePlanner.comparison.recommendation?.weights
                          : profile?.weights
                      }
                      isExpanded={collapse.isExpanded}
                    />
                  </>
                ) : null
              }
            />
          </>
        )
      }
    />
  );
}
