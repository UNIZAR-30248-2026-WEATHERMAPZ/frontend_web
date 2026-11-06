import { act, fireEvent, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RouteSearchPanel } from './RouteSearchPanel.jsx';
import { usePlaceAutocomplete } from './usePlaceAutocomplete.js';
import { useRoutePoints } from './useRoutePoints.js';

function StatefulPanel({ onSetPoint }) {
  const points = useRoutePoints();
  return (
    <RouteSearchPanel
      {...points}
      onSetActivePoint={points.setActivePoint}
      onEditPoint={points.editPoint}
      onClearPoint={points.clearPoint}
      onResetPoints={points.resetPoints}
      onSetPoint={(...args) => {
        points.setPoint(...args);
        onSetPoint?.(...args);
      }}
    />
  );
}

jest.mock('./usePlaceAutocomplete.js', () => ({
  usePlaceAutocomplete: jest.fn(() => ({
    errorMessage: '',
    isLoading: false,
    results: [],
  })),
}));

describe('RouteSearchPanel', () => {
  beforeEach(() => {
    usePlaceAutocomplete.mockReturnValue({
      errorMessage: '',
      isLoading: false,
      results: [],
    });
  });

  it('renders empty route point state', () => {
    render(<RouteSearchPanel />);

    expect(screen.getByRole('button', { name: 'Origen' })).toHaveAttribute('aria-pressed', 'true');
    expect(screen.getByRole('button', { name: 'Destino' })).toHaveAttribute(
      'aria-pressed',
      'false'
    );
    expect(screen.getByLabelText('Origen')).toBeEnabled();
    expect(screen.getByLabelText('Destino')).toBeEnabled();
    expect(screen.getAllByText('Sin seleccionar')).toHaveLength(2);
    expect(screen.getByRole('button', { name: 'Usar GPS para origen' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Usar GPS para destino' })).toBeEnabled();
    expect(screen.getByRole('button', { name: 'Limpiar selección' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Calcular ruta' })).toBeDisabled();
  });

  it('selects an autocomplete result for the active input', async () => {
    const user = userEvent.setup();
    const onSetPoint = jest.fn();

    usePlaceAutocomplete.mockReturnValue({
      errorMessage: '',
      isLoading: false,
      results: [
        {
          id: 'place-1',
          label: 'Plaza del Pilar, Zaragoza, Spain',
          lat: 41.656,
          lng: -0.878,
        },
      ],
    });

    render(<StatefulPanel onSetPoint={onSetPoint} />);

    await user.type(screen.getByLabelText('Origen'), 'Pilar');
    await user.click(screen.getByRole('option', { name: 'Plaza del Pilar, Zaragoza, Spain' }));

    expect(onSetPoint).toHaveBeenCalledWith('origin', {
      lat: 41.656,
      lng: -0.878,
      label: 'Plaza del Pilar, Zaragoza, Spain',
      source: 'search',
    });
    expect(screen.getByLabelText('Origen')).toHaveValue('Plaza del Pilar, Zaragoza, Spain');
    expect(screen.getByText('41.65600, -0.87800')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('keeps the chosen result when a phone keyboard commits its text on leaving the field', async () => {
    const user = userEvent.setup();
    usePlaceAutocomplete.mockReturnValue({
      errorMessage: '',
      isLoading: false,
      results: [{ id: 'place-1', label: 'Plaza del Pilar', lat: 41.656, lng: -0.878 }],
    });
    render(<StatefulPanel />);
    const input = screen.getByLabelText('Origen');
    await user.type(input, 'Pilar');
    input.addEventListener('blur', () => fireEvent.change(input, { target: { value: 'Pila' } }));

    await user.click(screen.getByRole('option', { name: 'Plaza del Pilar' }));

    expect(input).not.toHaveFocus();
    expect(input).toHaveValue('Plaza del Pilar');
    expect(screen.getByText('41.65600, -0.87800')).toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('calls selection and reset handlers', async () => {
    const user = userEvent.setup();
    const onClearPoint = jest.fn();
    const onRequestCurrentLocation = jest.fn();
    const onResetPoints = jest.fn();
    const onSetActivePoint = jest.fn();

    render(
      <RouteSearchPanel
        destination={{ lat: 41.66, lng: -0.88, source: 'map' }}
        onClearPoint={onClearPoint}
        onRequestCurrentLocation={onRequestCurrentLocation}
        onResetPoints={onResetPoints}
        onSetActivePoint={onSetActivePoint}
        origin={{ lat: 41.65, lng: -0.89, source: 'map' }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Destino' }));
    await user.click(screen.getByRole('button', { name: 'Usar GPS para origen' }));
    await user.click(screen.getByRole('button', { name: 'Usar GPS para destino' }));
    await user.type(screen.getByLabelText('Origen'), 'Plaza del Pilar');
    await user.click(screen.getByRole('button', { name: 'Borrar origen' }));
    await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));

    expect(onSetActivePoint).toHaveBeenCalledWith('destination');
    expect(onSetActivePoint).toHaveBeenCalledWith('origin');
    expect(onRequestCurrentLocation).toHaveBeenCalledWith('origin');
    expect(onRequestCurrentLocation).toHaveBeenCalledWith('destination');
    expect(onClearPoint).toHaveBeenCalledWith('origin');
    expect(onResetPoints).toHaveBeenCalledTimes(1);
  });

  it('calculates only with both points and shows request states', async () => {
    const user = userEvent.setup();
    const onCalculateRoute = jest.fn();
    const origin = { lat: 41.65, lng: -0.89, source: 'map' };
    const destination = { lat: 41.66, lng: -0.88, source: 'map' };
    const view = render(
      <RouteSearchPanel
        origin={origin}
        destination={destination}
        onCalculateRoute={onCalculateRoute}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));
    expect(onCalculateRoute).toHaveBeenCalledTimes(1);

    view.rerender(
      <RouteSearchPanel
        origin={origin}
        destination={destination}
        routeCalculation={{ status: 'loading', errorMessage: '' }}
      />
    );
    expect(screen.getByRole('button', { name: 'Calculando...' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Calculando la ruta más rápida');

    view.rerender(
      <RouteSearchPanel
        origin={origin}
        destination={destination}
        routeCalculation={{ status: 'error', errorMessage: 'No se ha podido calcular la ruta.' }}
      />
    );
    expect(screen.getByRole('alert')).toHaveTextContent('No se ha podido calcular la ruta.');
  });

  it('folds the mobile search panel when the route is calculated', async () => {
    const user = userEvent.setup();
    const onCalculateRoute = jest.fn();
    render(
      <RouteSearchPanel
        origin={{ lat: 41.65, lng: -0.89, source: 'map' }}
        destination={{ lat: 41.66, lng: -0.88, source: 'map' }}
        onCalculateRoute={onCalculateRoute}
      />
    );
    const toggle = screen.getByRole('button', { name: 'Ocultar' });
    expect(toggle).toHaveAttribute('aria-expanded', 'true');

    await user.click(screen.getByRole('button', { name: 'Calcular ruta' }));

    expect(onCalculateRoute).toHaveBeenCalledTimes(1);
    expect(screen.getByRole('button', { name: 'Ruta' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('never leaves the search panel and the comparison details open together', async () => {
    const user = userEvent.setup();
    render(
      <RouteSearchPanel
        renderComparison={({ isExpanded, onToggleExpanded }) => (
          <button type="button" aria-expanded={isExpanded} onClick={onToggleExpanded}>
            Detalle
          </button>
        )}
      />
    );
    const details = screen.getByRole('button', { name: 'Detalle' });
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    await user.click(details);
    expect(details).toHaveAttribute('aria-expanded', 'true');
    const toggle = screen.getByRole('button', { name: 'Ruta' });
    expect(toggle).toHaveAttribute('aria-expanded', 'false');

    await user.click(toggle);
    expect(details).toHaveAttribute('aria-expanded', 'false');
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
  });

  it('offers the steps of the route, folding the search panel to show them', async () => {
    const user = userEvent.setup();
    const onSelectStep = jest.fn();
    render(
      <RouteSearchPanel
        routeCalculation={{
          status: 'success',
          errorMessage: '',
          route: {
            distance: 100,
            duration: 60,
            steps: [
              { instruction: 'Gire a la derecha', name: null, distance: 100, wayPoints: [0, 3] },
            ],
          },
        }}
        onSelectStep={onSelectStep}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Ver recorrido' }));

    expect(screen.getByRole('button', { name: 'Ruta' })).toHaveAttribute('aria-expanded', 'false');
    await user.click(screen.getByRole('button', { name: /Gire a la derecha/ }));
    expect(onSelectStep).toHaveBeenCalledWith(0);

    await user.click(screen.getByRole('button', { name: 'Ruta' }));
    expect(screen.getByRole('button', { name: 'Ver recorrido' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
  });

  it('shows time and distance as soon as the route is calculated', () => {
    render(
      <RouteSearchPanel
        destination={{ lat: 41.66, lng: -0.88, source: 'map' }}
        origin={{ lat: 41.65, lng: -0.89, source: 'map' }}
        routeCalculation={{
          status: 'success',
          errorMessage: '',
          route: { distance: 1250.4, duration: 930.2 },
        }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Ruta rápida' })).toBeInTheDocument();
    expect(screen.getByText('16 min')).toBeInTheDocument();
    expect(screen.getByText('1,3 km')).toBeInTheDocument();
  });

  it('asks for the date and time only for routes that weigh shade or sun', () => {
    const onSolarDateChange = jest.fn();
    const onSolarTimeChange = jest.fn();
    const { rerender } = render(
      <RouteSearchPanel routeType="fastest" profilePicker={<p>Selector de rutas</p>} />
    );
    expect(screen.getByText('Selector de rutas')).toBeInTheDocument();
    expect(screen.queryByLabelText('Hora')).not.toBeInTheDocument();

    rerender(
      <RouteSearchPanel
        routeType="shaded"
        solarDate="2026-06-21"
        solarTime="14:00"
        onSolarDateChange={onSolarDateChange}
        onSolarTimeChange={onSolarTimeChange}
      />
    );
    fireEvent.change(screen.getByLabelText('Fecha'), { target: { value: '2026-06-22' } });
    fireEvent.change(screen.getByLabelText('Hora'), { target: { value: '15:30' } });
    expect(onSolarDateChange).toHaveBeenLastCalledWith('2026-06-22');
    expect(onSolarTimeChange).toHaveBeenLastCalledWith('15:30');
    expect(screen.getByRole('button', { name: 'Calcular ruta' })).toBeDisabled();

    // A route that only weighs wind uses the current wind: no date or time to ask (PBI-8.2).
    rerender(<RouteSearchPanel routeType="shaded" asksSolarDateTime={false} />);
    expect(screen.queryByLabelText('Hora')).not.toBeInTheDocument();
  });

  it('shows geolocation states', () => {
    const { rerender } = render(
      <RouteSearchPanel geolocation={{ status: 'loading', errorMessage: '' }} />
    );

    expect(screen.getByRole('button', { name: 'Usar GPS para origen' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Usar GPS para destino' })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('Obteniendo la ubicación actual...');

    rerender(
      <RouteSearchPanel
        geolocation={{ status: 'denied', errorMessage: 'Se ha denegado el permiso de ubicación.' }}
      />
    );

    expect(screen.getByRole('alert')).toHaveTextContent('Se ha denegado el permiso de ubicación.');

    rerender(
      <RouteSearchPanel
        geolocation={{ status: 'success', errorMessage: '', pointType: 'destination' }}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('Ubicación actual asignada como destino.');
  });

  it('clears draft text and invalidates selected coordinates when editing', async () => {
    const user = userEvent.setup();
    usePlaceAutocomplete.mockReturnValue({
      errorMessage: '',
      isLoading: false,
      results: [{ id: '1', label: 'Pilar', lat: 41.656, lng: -0.878 }],
    });
    render(<StatefulPanel />);
    const origin = screen.getByLabelText('Origen');
    await user.type(origin, 'Pilar');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(origin).toHaveValue('Pilar');
    await user.type(origin, ' changed');
    expect(screen.getAllByText('Sin seleccionar')).toHaveLength(2);
    await user.type(screen.getByLabelText('Destino'), 'draft');
    await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));
    expect(origin).toHaveValue('');
    expect(screen.getByLabelText('Destino')).toHaveValue('');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    await user.type(origin, 'draft');
    await user.click(screen.getByRole('button', { name: 'Borrar origen' }));
    expect(origin).toHaveValue('');
  });

  it('supports keyboard selection, Escape, and blur dismissal', async () => {
    const user = userEvent.setup();
    usePlaceAutocomplete.mockReturnValue({
      errorMessage: '',
      isLoading: false,
      results: [{ id: '1', label: 'Pilar', lat: 41.656, lng: -0.878 }],
    });
    render(<StatefulPanel />);
    const destination = screen.getByLabelText('Destino');
    await user.type(destination, 'Pilar');
    await user.keyboard('{ArrowUp}');
    expect(destination).toHaveAttribute('aria-activedescendant', 'destination-suggestions-0');
    await user.keyboard('{Escape}');
    expect(destination).toHaveAttribute('aria-expanded', 'false');
    await user.keyboard('{ArrowDown}{Enter}');
    expect(destination).toHaveValue('Pilar');
    expect(screen.getByText('41.65600, -0.87800')).toBeInTheDocument();
    await user.type(destination, ' new');
    await user.tab();
    await waitFor(() => expect(screen.queryByRole('listbox')).not.toBeInTheDocument());
  });

  it('selects a suggestion when the field loses the focus before the tap arrives', async () => {
    const user = userEvent.setup();
    usePlaceAutocomplete.mockReturnValue({
      errorMessage: '',
      isLoading: false,
      results: [{ id: '1', label: 'Plaza del Pilar', lat: 41.656, lng: -0.878 }],
    });
    render(<StatefulPanel />);
    const origin = screen.getByLabelText('Origen');
    await user.type(origin, 'Pilar');

    // The order of Safari on iPhone.
    act(() => origin.blur());
    // Without the focus, the field must keep its list above the next field.
    expect(origin.closest('.point-field')).toHaveClass('is-list-open');
    fireEvent.click(screen.getByRole('option', { name: 'Plaza del Pilar' }));

    expect(origin).toHaveValue('Plaza del Pilar');
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
  });

  it('shows loading, empty and error states for an edited input', async () => {
    const user = userEvent.setup();
    const view = render(<StatefulPanel />);
    await user.type(screen.getByLabelText('Origen'), 'Unknown');
    expect(screen.getByRole('status')).toHaveTextContent('No se han encontrado lugares');
    usePlaceAutocomplete.mockReturnValue({ results: [], isLoading: true, errorMessage: '' });
    view.rerender(<StatefulPanel />);
    expect(screen.getByRole('status')).toHaveTextContent('Buscando lugares');
    usePlaceAutocomplete.mockReturnValue({
      results: [],
      isLoading: false,
      errorMessage: 'Búsqueda no disponible',
    });
    view.rerender(<StatefulPanel />);
    expect(screen.getByRole('alert')).toHaveTextContent('Búsqueda no disponible');
  });
});
