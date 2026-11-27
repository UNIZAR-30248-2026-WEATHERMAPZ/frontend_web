import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RouteSearchPanel } from './RouteSearchPanel.jsx';
import { usePlaceAutocomplete } from './usePlaceAutocomplete.js';
import { useRoutePoints } from './useRoutePoints.js';

function StatefulPanel({ onSetPoint, ...props }) {
  const points = useRoutePoints();
  return (
    <RouteSearchPanel
      {...points}
      {...props}
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
    // The location is offered in the list of each field, not with a button of its own.
    expect(screen.queryByRole('button', { name: /GPS/ })).not.toBeInTheDocument();
    expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Limpiar selección' })).toBeDisabled();
    expect(screen.getByRole('button', { name: 'Calcular ruta' })).toBeDisabled();
  });

  it('opens a folded panel and preference sheet for the guided tour, then restores the panel state', async () => {
    const user = userEvent.setup();
    const { rerender } = render(<RouteSearchPanel guidedTourActive={false} />);
    const toggle = screen.getByRole('button', { name: 'Ocultar' });
    await user.click(toggle);
    expect(screen.getByRole('button', { name: 'Ruta' })).toHaveAttribute('aria-expanded', 'false');

    rerender(<RouteSearchPanel guidedTourActive />);
    expect(screen.getByRole('button', { name: 'Ocultar' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByRole('button', { name: 'Ocultar preferencias' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );

    rerender(<RouteSearchPanel guidedTourActive={false} />);
    expect(screen.getByRole('button', { name: 'Ruta' })).toHaveAttribute('aria-expanded', 'false');
  });

  it('keeps the route panel free of the tutorial launcher and of loose help buttons', () => {
    render(<RouteSearchPanel />);

    expect(screen.queryByRole('button', { name: 'Te ayudo paso a paso' })).not.toBeInTheDocument();
    expect(screen.queryByText('Ayuda sobre cómo elegir los puntos')).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Ayuda: calcular ruta' })).not.toBeInTheDocument();
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
    const onResetPoints = jest.fn();
    const onSetActivePoint = jest.fn();

    render(
      <RouteSearchPanel
        destination={{ lat: 41.66, lng: -0.88, source: 'map' }}
        onClearPoint={onClearPoint}
        onResetPoints={onResetPoints}
        onSetActivePoint={onSetActivePoint}
        origin={{ lat: 41.65, lng: -0.89, source: 'map' }}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Destino' }));
    await user.type(screen.getByLabelText('Origen'), 'Plaza del Pilar');
    await user.click(screen.getByRole('button', { name: 'Borrar origen' }));
    await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));

    expect(onSetActivePoint).toHaveBeenCalledWith('destination');
    expect(onSetActivePoint).toHaveBeenCalledWith('origin');
    expect(onClearPoint).toHaveBeenCalledWith('origin');
    expect(onResetPoints).toHaveBeenCalledTimes(1);
  });

  describe('recent places (#180)', () => {
    const recent = (id, lat, label) => ({ id, lat, lng: -0.88, label, usedAt: '2026-11-16' });
    const RECENT = [
      recent(3, 41.6572, 'Plaza del Pilar, Zaragoza'),
      recent(2, 41.6488, 'Plaza San José, Zaragoza'),
      recent(1, 41.65, null),
    ];

    it('come below «Mi ubicación» in a group, the same in both fields', async () => {
      const user = userEvent.setup();
      render(<StatefulPanel recentPlaces={RECENT} />);

      await user.click(screen.getByLabelText('Origen'));
      const options = screen.getAllByRole('option').map((option) => option.textContent);
      expect(options).toEqual([
        'Mi ubicación',
        'Plaza del Pilar, Zaragoza',
        'Plaza San José, Zaragoza',
        // Without a name, its coordinates.
        '41.65000, -0.88000',
      ]);
      expect(
        within(screen.getByRole('group', { name: 'Recientes' })).getAllByRole('option')
      ).toHaveLength(3);

      await user.keyboard('{Escape}');
      await user.click(screen.getByLabelText('Destino'));
      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual(options);
    });

    it('do not offer the place chosen in the other field', async () => {
      const user = userEvent.setup();
      const onSetPoint = jest.fn();
      render(<StatefulPanel recentPlaces={RECENT} onSetPoint={onSetPoint} />);

      await user.click(screen.getByLabelText('Origen'));
      await user.click(screen.getByRole('option', { name: 'Plaza del Pilar, Zaragoza' }));
      expect(onSetPoint).toHaveBeenCalledWith('origin', {
        lat: 41.6572,
        lng: -0.88,
        label: 'Plaza del Pilar, Zaragoza',
        source: 'recent',
      });
      expect(screen.getByLabelText('Origen')).toHaveValue('Plaza del Pilar, Zaragoza');

      await user.click(screen.getByLabelText('Destino'));
      expect(
        screen.queryByRole('option', { name: 'Plaza del Pilar, Zaragoza' })
      ).not.toBeInTheDocument();
      expect(screen.getByRole('option', { name: 'Plaza San José, Zaragoza' })).toBeInTheDocument();
    });

    it('go first while typing when their name matches, without repeating a suggestion', async () => {
      const user = userEvent.setup();
      usePlaceAutocomplete.mockReturnValue({
        errorMessage: '',
        isLoading: false,
        results: [
          // The same place as a recent one: shown once, as recent.
          { id: 'a', label: 'Plaza San José, Zaragoza, España', lat: 41.6488, lng: -0.88 },
          { id: 'b', label: 'Calle San José de Calasanz', lat: 41.64, lng: -0.89 },
        ],
      });
      render(<StatefulPanel recentPlaces={RECENT} />);

      // Without case nor accents.
      await user.type(screen.getByLabelText('Origen'), 'san jose');

      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Plaza San José, Zaragoza',
        'Calle San José de Calasanz',
      ]);
      expect(screen.getByRole('group', { name: 'Recientes' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Mi ubicación' })).not.toBeInTheDocument();
    });

    it('show at most three while typing', async () => {
      const user = userEvent.setup();
      const many = [1, 2, 3, 4].map((id) => recent(id, 41.6 + id / 100, `Plaza ${id}`));
      render(<StatefulPanel recentPlaces={many} />);

      await user.type(screen.getByLabelText('Origen'), 'plaza');

      expect(screen.getAllByRole('option').map((option) => option.textContent)).toEqual([
        'Plaza 1',
        'Plaza 2',
        'Plaza 3',
      ]);
      expect(screen.queryByText(/No se han encontrado lugares/)).not.toBeInTheDocument();
    });

    it('Enter chooses the first matching recent place while the suggestions load', async () => {
      const user = userEvent.setup();
      const onSetPoint = jest.fn();
      usePlaceAutocomplete.mockReturnValue({ errorMessage: '', isLoading: true, results: [] });
      render(<StatefulPanel recentPlaces={RECENT} onSetPoint={onSetPoint} />);

      await user.type(screen.getByLabelText('Destino'), 'pilar{Enter}');

      expect(onSetPoint).toHaveBeenCalledWith(
        'destination',
        expect.objectContaining({ label: 'Plaza del Pilar, Zaragoza', source: 'recent' })
      );
    });

    it('work with the arrows, after «Mi ubicación»', async () => {
      const user = userEvent.setup();
      const onSetPoint = jest.fn();
      render(<StatefulPanel recentPlaces={RECENT} onSetPoint={onSetPoint} />);
      const input = screen.getByLabelText('Origen');

      await user.click(input);
      await user.keyboard('{ArrowDown}{ArrowDown}');
      const option = screen.getByRole('option', { name: 'Plaza del Pilar, Zaragoza' });
      expect(option).toHaveAttribute('aria-selected', 'true');
      expect(input).toHaveAttribute('aria-activedescendant', option.id);
      await user.keyboard('{Enter}');

      expect(onSetPoint).toHaveBeenCalledWith(
        'origin',
        expect.objectContaining({ label: 'Plaza del Pilar, Zaragoza' })
      );
    });
  });

  describe('«Mi ubicación»', () => {
    const devicePoint = { lat: 41.65, lng: -0.89, label: 'Mi ubicación', source: 'device' };

    it('is the first option of an empty field and asks for the location', async () => {
      const user = userEvent.setup();
      const onRequestCurrentLocation = jest.fn();
      render(<StatefulPanel onRequestCurrentLocation={onRequestCurrentLocation} />);

      await user.click(screen.getByLabelText('Origen'));
      const list = screen.getByRole('listbox', { name: 'Lugares para origen' });
      expect(screen.getByLabelText('Origen')).toHaveAttribute('aria-expanded', 'true');
      expect(screen.getAllByRole('option')[0]).toHaveTextContent('Mi ubicación');
      // No "not found" message without text.
      expect(list.parentElement).not.toHaveTextContent('No se han encontrado lugares');

      await user.click(screen.getByRole('option', { name: 'Mi ubicación' }));
      expect(onRequestCurrentLocation).toHaveBeenCalledWith('origin');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      expect(screen.getByLabelText('Origen')).not.toHaveFocus();
    });

    it('is offered again in a field that already has a point', async () => {
      const user = userEvent.setup();
      const onRequestCurrentLocation = jest.fn();
      render(
        <RouteSearchPanel
          activePoint="destination"
          destination={{ lat: 41.66, lng: -0.88, label: 'Plaza del Pilar', source: 'search' }}
          destinationInput="Plaza del Pilar"
          onRequestCurrentLocation={onRequestCurrentLocation}
        />
      );

      await user.click(screen.getByLabelText('Destino'));
      await user.click(screen.getByRole('option', { name: 'Mi ubicación' }));

      expect(onRequestCurrentLocation).toHaveBeenCalledWith('destination');
      // The name of the point is not searched.
      expect(usePlaceAutocomplete).toHaveBeenLastCalledWith(
        'Plaza del Pilar',
        false,
        'destination',
        expect.any(Function)
      );
    });

    it('is not offered in a field when the other one already uses it', async () => {
      const user = userEvent.setup();
      const { rerender } = render(
        <RouteSearchPanel
          activePoint="destination"
          origin={devicePoint}
          originInput="Mi ubicación"
        />
      );

      await user.click(screen.getByLabelText('Destino'));
      expect(screen.queryByRole('option', { name: 'Mi ubicación' })).not.toBeInTheDocument();
      expect(screen.getByLabelText('Destino')).toHaveAttribute('aria-expanded', 'false');

      // And the other way round.
      rerender(
        <RouteSearchPanel
          activePoint="origin"
          destination={devicePoint}
          destinationInput="Mi ubicación"
        />
      );
      await user.click(screen.getByLabelText('Origen'));
      expect(screen.queryByRole('option', { name: 'Mi ubicación' })).not.toBeInTheDocument();
    });

    it('is offered in its own field when that field uses it', async () => {
      const user = userEvent.setup();
      render(<RouteSearchPanel origin={devicePoint} originInput="Mi ubicación" />);

      await user.click(screen.getByLabelText('Origen'));

      expect(screen.getByRole('option', { name: 'Mi ubicación' })).toBeInTheDocument();
    });

    it('works with the keyboard and Enter alone never asks for the location', async () => {
      const user = userEvent.setup();
      const onRequestCurrentLocation = jest.fn();
      render(<StatefulPanel onRequestCurrentLocation={onRequestCurrentLocation} />);
      const input = screen.getByLabelText('Origen');

      await user.click(input);
      await user.keyboard('{Enter}');
      expect(onRequestCurrentLocation).not.toHaveBeenCalled();

      await user.keyboard('{Escape}');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
      await user.keyboard('{ArrowDown}');
      const option = screen.getByRole('option', { name: 'Mi ubicación' });
      expect(option).toHaveAttribute('aria-selected', 'true');
      expect(input).toHaveAttribute('aria-activedescendant', option.id);

      await user.keyboard('{Enter}');
      expect(onRequestCurrentLocation).toHaveBeenCalledWith('origin');
    });

    it('cannot be chosen again while the location is being requested', async () => {
      const user = userEvent.setup();
      const onRequestCurrentLocation = jest.fn();
      render(
        <StatefulPanel
          geolocation={{ status: 'loading', errorMessage: '' }}
          onRequestCurrentLocation={onRequestCurrentLocation}
        />
      );

      await user.click(screen.getByLabelText('Origen'));
      const option = screen.getByRole('option', { name: 'Mi ubicación' });
      expect(option).toHaveAttribute('aria-disabled', 'true');
      await user.click(option);

      expect(onRequestCurrentLocation).not.toHaveBeenCalled();
    });

    it('does not open in a field the user has just left', async () => {
      const user = userEvent.setup();
      render(<StatefulPanel />);
      const origin = screen.getByLabelText('Origen');
      await user.type(origin, 'Pilar');

      // "Limpiar" empties the field that had the focus: within the delay kept for taps, its empty
      // list must not appear.
      await user.click(screen.getByRole('button', { name: 'Limpiar selección' }));

      expect(origin).toHaveValue('');
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('gives way to the suggestions when the user types', async () => {
      const user = userEvent.setup();
      usePlaceAutocomplete.mockReturnValue({
        errorMessage: '',
        isLoading: false,
        results: [{ id: 'place-1', label: 'Plaza del Pilar', lat: 41.656, lng: -0.878 }],
      });
      render(<StatefulPanel />);

      await user.type(screen.getByLabelText('Origen'), 'Pi');
      expect(screen.getByRole('option', { name: 'Mi ubicación' })).toBeInTheDocument();
      expect(screen.queryByRole('option', { name: 'Plaza del Pilar' })).not.toBeInTheDocument();

      await user.type(screen.getByLabelText('Origen'), 'l');
      expect(screen.queryByRole('option', { name: 'Mi ubicación' })).not.toBeInTheDocument();
      expect(screen.getAllByRole('option')).toHaveLength(1);
      expect(screen.getByRole('option', { name: 'Plaza del Pilar' })).toBeInTheDocument();
    });
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
        renderComparison={({ openSection, onToggleSection }) => (
          <button
            type="button"
            aria-expanded={openSection === 'detail'}
            onClick={() => onToggleSection('detail')}
          >
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

    expect(screen.getByRole('heading', { name: 'La más rápida' })).toBeInTheDocument();
    expect(screen.getByText('16 min')).toBeInTheDocument();
    expect(screen.getByText('1,3 km')).toBeInTheDocument();
  });

  it('asks for the date and time only for routes that weigh shade or sun', () => {
    const onSolarDateChange = jest.fn();
    const onSolarTimeChange = jest.fn();
    const { rerender } = render(
      <RouteSearchPanel routeType="fastest" preferences={<p>Preguntas</p>} />
    );
    expect(screen.getByText('Preguntas')).toBeInTheDocument();
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

    expect(screen.getByRole('status')).toHaveTextContent('Se ha puesto tu ubicación como destino.');
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

  describe('Enter without a highlighted suggestion', () => {
    const PLAZA = {
      id: 'place-1',
      label: 'Plaza de España, Zaragoza, Spain',
      lat: 41.651386,
      lng: -0.881746,
    };
    const OTHER = { id: 'place-2', label: 'Plaza de España 2', lat: 41.6519, lng: -0.8805 };
    let settled;

    // The hook is simulated: `settled.origin(results)` is what it does when the search ends.
    function simulateSearch(state) {
      settled = {};
      usePlaceAutocomplete.mockImplementation((_query, _enabled, field, onSettled) => {
        settled[field] = onSettled;
        return state();
      });
    }

    it('chooses the first suggestion', async () => {
      const user = userEvent.setup();
      const onSetPoint = jest.fn();
      simulateSearch(() => ({ errorMessage: '', isLoading: false, results: [PLAZA, OTHER] }));
      render(<StatefulPanel onSetPoint={onSetPoint} />);

      await user.type(screen.getByLabelText('Origen'), 'plaza españa{Enter}');

      expect(onSetPoint).toHaveBeenCalledWith('origin', {
        lat: PLAZA.lat,
        lng: PLAZA.lng,
        label: PLAZA.label,
        source: 'search',
      });
      expect(screen.getByLabelText('Origen')).toHaveValue(PLAZA.label);
      expect(screen.queryByRole('listbox')).not.toBeInTheDocument();
    });

    it('still chooses the highlighted one when there is one', async () => {
      const user = userEvent.setup();
      const onSetPoint = jest.fn();
      simulateSearch(() => ({ errorMessage: '', isLoading: false, results: [PLAZA, OTHER] }));
      render(<StatefulPanel onSetPoint={onSetPoint} />);

      await user.type(screen.getByLabelText('Origen'), 'plaza españa');
      await user.keyboard('{ArrowDown}{ArrowDown}{Enter}');

      expect(onSetPoint).toHaveBeenCalledWith(
        'origin',
        expect.objectContaining({ label: OTHER.label })
      );
    });

    it('waits for the suggestions that are still loading and chooses the first', async () => {
      const user = userEvent.setup();
      const onSetPoint = jest.fn();
      let state = { errorMessage: '', isLoading: true, results: [] };
      simulateSearch(() => state);
      render(<StatefulPanel onSetPoint={onSetPoint} />);

      await user.type(screen.getByLabelText('Origen'), 'plaza españa{Enter}');
      expect(onSetPoint).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent('Buscando lugares');

      state = { errorMessage: '', isLoading: false, results: [PLAZA] };
      act(() => settled.origin([PLAZA]));

      expect(onSetPoint).toHaveBeenCalledWith(
        'origin',
        expect.objectContaining({ label: PLAZA.label })
      );
      expect(screen.getByLabelText('Origen')).toHaveValue(PLAZA.label);
    });

    it('shows the "not found" message when no suggestion arrives', async () => {
      const user = userEvent.setup();
      const onSetPoint = jest.fn();
      let state = { errorMessage: '', isLoading: true, results: [] };
      simulateSearch(() => state);
      const view = render(<StatefulPanel onSetPoint={onSetPoint} />);

      await user.type(screen.getByLabelText('Origen'), 'xyzxyz{Enter}');
      state = { errorMessage: '', isLoading: false, results: [] };
      act(() => settled.origin([]));
      view.rerender(<StatefulPanel onSetPoint={onSetPoint} />);

      expect(onSetPoint).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent('No se han encontrado lugares');
      expect(screen.getByLabelText('Origen')).toHaveValue('xyzxyz');
    });

    it('shows the "not found" message at once when the search has already ended empty', async () => {
      const user = userEvent.setup();
      const onSetPoint = jest.fn();
      simulateSearch(() => ({ errorMessage: '', isLoading: false, results: [] }));
      render(<StatefulPanel onSetPoint={onSetPoint} />);

      await user.type(screen.getByLabelText('Origen'), 'xyzxyz{Enter}');

      expect(onSetPoint).not.toHaveBeenCalled();
      expect(screen.getByRole('status')).toHaveTextContent('No se han encontrado lugares');
    });

    it('forgets the Enter if the text changes, the field loses the focus or Escape is pressed', async () => {
      const user = userEvent.setup();
      const onSetPoint = jest.fn();
      simulateSearch(() => ({ errorMessage: '', isLoading: true, results: [] }));
      render(<StatefulPanel onSetPoint={onSetPoint} />);
      const input = screen.getByLabelText('Origen');

      await user.type(input, 'plaza españa{Enter}');
      await user.type(input, 'a');
      act(() => settled.origin([PLAZA]));
      await user.type(input, '{Enter}{Escape}');
      act(() => settled.origin([PLAZA]));
      await user.type(input, '{Enter}');
      fireEvent.blur(input);
      act(() => settled.origin([PLAZA]));

      expect(onSetPoint).not.toHaveBeenCalled();
    });
  });

  it('folds and unfolds the questions with the handle of the bottom sheet (small screens)', async () => {
    const user = userEvent.setup();
    const { container } = render(
      <RouteSearchPanel preferences={<p>Preguntas</p>} asksSolarDateTime solarDate="2026-11-23" />
    );
    const sheet = container.querySelector('.route-actions');
    const handle = screen.getByRole('button', { name: 'Ocultar preferencias' });

    expect(sheet).toContainElement(screen.getByText('Preguntas'));
    expect(handle).toHaveAttribute('aria-expanded', 'true');
    await user.click(handle);
    expect(sheet).toHaveClass('is-folded');
    expect(screen.getByRole('button', { name: 'Mostrar preferencias' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    await user.click(screen.getByRole('button', { name: 'Mostrar preferencias' }));
    expect(sheet).not.toHaveClass('is-folded');
  });

  it('with a result the questions are its dropdown «Cambiar preferencias», not the sheet', () => {
    const received = [];
    render(
      <RouteSearchPanel
        preferences={<p>Preguntas</p>}
        routeCalculation={{
          status: 'success',
          errorMessage: '',
          comparison: { status: 'selected' },
          route: { distance: 100, duration: 60, steps: [] },
        }}
        renderComparison={(sections) => {
          received.push(sections);
          return <div>Resultado</div>;
        }}
      />
    );
    expect(screen.queryByText('Preguntas')).not.toBeInTheDocument();
    expect(received.at(-1).preferences).toBeTruthy();
    expect(received.at(-1).openSection).toBeNull();
  });
});
