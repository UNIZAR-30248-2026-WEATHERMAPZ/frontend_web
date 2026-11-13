import { MapContainer, TileLayer, ZoomControl } from 'react-leaflet';

import { LocationMarker } from './LocationMarker.jsx';
import { MapClickHandler } from './MapClickHandler.jsx';
import { MapFocusHandler } from './MapFocusHandler.jsx';
import { NavigationMarker } from './NavigationMarker.jsx';
import { RouteLayer } from './RouteLayer.jsx';
import { WeatherPanel } from '../weather/WeatherPanel.jsx';
import { MAP_BOUNDS, MAP_MIN_ZOOM } from './zaragozaArea.js';

const ZARAGOZA_CENTER = [41.6488, -0.8891];
const noop = () => {};

export function MapView({
  activePoint = 'origin',
  destination,
  focusPoint,
  onSelectPoint = noop,
  origin,
  fastestRoute,
  shadedRoute,
  alternativeLabel = 'Ruta Sombreada',
  selectedRouteType = 'fastest',
  selectedStepGeometry = null,
  navigationPosition = null,
  followNavigation = false,
  onNavigationDrag = noop,
}) {
  return (
    <div className="map-wrapper">
      <MapContainer
        center={ZARAGOZA_CENTER}
        zoom={13}
        minZoom={MAP_MIN_ZOOM}
        maxBounds={MAP_BOUNDS}
        maxBoundsViscosity={1}
        zoomControl={false}
        className="map-view"
        scrollWheelZoom
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          bounds={MAP_BOUNDS}
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ZoomControl position="topright" />
        <MapClickHandler onSelectPoint={onSelectPoint} />
        <MapFocusHandler point={focusPoint} />
        <RouteLayer
          fastestGeometry={fastestRoute?.geometry}
          shadedGeometry={shadedRoute?.geometry}
          selectedRouteType={selectedRouteType}
          selectedStepGeometry={selectedStepGeometry}
        />
        <LocationMarker point={origin} title="Origen" type="origin" />
        <LocationMarker point={destination} title="Destino" type="destination" />
        <NavigationMarker
          position={navigationPosition}
          follow={followNavigation}
          onUserDrag={onNavigationDrag}
        />
      </MapContainer>
      <WeatherPanel />
      <div className="map-selection-hint" aria-live="polite">
        Toca el mapa para fijar el {activePoint === 'origin' ? 'origen' : 'destino'}.
      </div>
      <div className="map-legend" aria-label="Leyenda de marcadores del mapa">
        <span>
          <i className="legend-dot legend-dot-origin" aria-hidden="true" />
          Origen
        </span>
        <span>
          <i className="legend-dot legend-dot-destination" aria-hidden="true" />
          Destino
        </span>
        {fastestRoute && (
          <span>
            <i
              // Same line as on the map: dashed only next to the shaded route.
              className={`legend-route ${shadedRoute ? 'legend-route-fastest' : 'legend-route-shaded'}`}
              aria-hidden="true"
            />
            Ruta rápida
          </span>
        )}
        {shadedRoute && (
          <span>
            <i className="legend-route legend-route-shaded" aria-hidden="true" />
            {alternativeLabel}
          </span>
        )}
      </div>
    </div>
  );
}
