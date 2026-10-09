import { AppShell } from '../components/layout/AppShell.jsx';
import { ComfortSummary } from '../features/comfort-summary/ComfortSummary.jsx';
import { MapView } from '../features/map/MapView.jsx';
import { RouteComparisonPanel } from '../features/route-comparison/RouteComparisonPanel.jsx';
import { useFastestRoute } from '../features/routing/useFastestRoute.js';
import { RouteSearchPanel } from '../features/route-search/RouteSearchPanel.jsx';
import { useDeviceLocation } from '../features/route-search/useDeviceLocation.js';
import { useRoutePoints } from '../features/route-search/useRoutePoints.js';

export function App({ headerActions = null }) {
  const routePoints = useRoutePoints();
  const fastestRoute = useFastestRoute();
  const geolocation = useDeviceLocation({
    onLocated: (pointType, point) => {
      fastestRoute.clearRoute();
      routePoints.setPoint(pointType, point);
    },
  });
  function withSelectionUpdated(action) {
    return (...args) => {
      geolocation.clearGeolocationMessage();
      fastestRoute.clearRoute();
      action(...args);
    };
  }

  return (
    <AppShell
      headerActions={headerActions}
      map={
        <MapView
          activePoint={routePoints.activePoint}
          destination={routePoints.destination}
          focusPoint={routePoints.lastSelectedPoint}
          onSelectPoint={withSelectionUpdated(routePoints.selectPoint)}
          origin={routePoints.origin}
          route={fastestRoute.route}
        />
      }
      sidebar={
        <>
          <RouteSearchPanel
            activePoint={routePoints.activePoint}
            destination={routePoints.destination}
            geolocation={geolocation.geolocation}
            onClearGeolocationMessage={geolocation.clearGeolocationMessage}
            onCalculateRoute={() =>
              fastestRoute.calculateRoute(routePoints.origin, routePoints.destination)
            }
            originInput={routePoints.originInput}
            destinationInput={routePoints.destinationInput}
            onEditPoint={withSelectionUpdated(routePoints.editPoint)}
            onClearPoint={withSelectionUpdated(routePoints.clearPoint)}
            onRequestCurrentLocation={geolocation.requestCurrentLocation}
            onResetPoints={withSelectionUpdated(routePoints.resetPoints)}
            onSetActivePoint={routePoints.setActivePoint}
            onSetPoint={withSelectionUpdated(routePoints.setPoint)}
            origin={routePoints.origin}
            routeCalculation={fastestRoute}
          />
          <div className="future-panels">
            <RouteComparisonPanel />
            <ComfortSummary />
          </div>
        </>
      }
    />
  );
}
