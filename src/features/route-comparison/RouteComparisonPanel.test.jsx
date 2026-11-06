import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RouteComparisonPanel } from './RouteComparisonPanel.jsx';

const route = (duration, shadePercentage) => ({
  duration,
  exposure: { status: 'available', shadePercentage, sunPercentage: 100 - shadePercentage },
});

const windy = (duration, exposure, shadePercentage = null) => ({
  duration,
  exposure:
    shadePercentage === null
      ? {
          status: 'unavailable',
          reason: 'not_requested',
          shadePercentage: null,
          sunPercentage: null,
        }
      : route(duration, shadePercentage).exposure,
  windExposure: { status: 'available', exposure },
});

describe('RouteComparisonPanel with wind (PBI-8.2)', () => {
  it('shows the wind exposure and, in a wind-only route, no shade', () => {
    render(
      <RouteComparisonPanel
        comparison={{
          status: 'selected',
          fastest: windy(900, 92),
          shaded: windy(1020, 38),
          additionalDurationSeconds: 120,
          shadeImprovementPercentagePoints: null,
          windChangePoints: -54,
        }}
        selectedRouteType="shaded"
        alternativeLabel="Cierzo"
        onSelectRoute={jest.fn()}
      />
    );

    expect(screen.getByText('92 % de exposición al viento')).toBeInTheDocument();
    expect(screen.getByText('38 % de exposición al viento')).toBeInTheDocument();
    expect(screen.queryByText(/sombra/)).not.toBeInTheDocument();
    expect(
      screen.getByText('Cierzo añade 2 min y tiene 54 puntos menos de exposición al viento.')
    ).toBeInTheDocument();
  });

  it('sums up shade and wind when both count', () => {
    render(
      <RouteComparisonPanel
        comparison={{
          status: 'selected',
          fastest: windy(900, 60, 20),
          shaded: windy(1020, 40, 70),
          additionalDurationSeconds: 120,
          shadeImprovementPercentagePoints: 50,
          windChangePoints: -20,
        }}
        selectedRouteType="shaded"
        onSelectRoute={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Con sombra/ })).toHaveTextContent(
      '70 % de sombra40 % de exposición al viento'
    );
    expect(
      screen.getByText(/50 puntos más de sombra y 20 puntos menos de exposición al viento/)
    ).toBeInTheDocument();
  });
});

describe('RouteComparisonPanel', () => {
  it('compares both routes and lets the user alternate between them', async () => {
    const user = userEvent.setup();
    const onSelectRoute = jest.fn();
    render(
      <RouteComparisonPanel
        comparison={{
          status: 'selected',
          fastest: route(900, 20),
          shaded: route(1020, 70),
          additionalDurationSeconds: 120,
          shadeImprovementPercentagePoints: 50,
        }}
        selectedRouteType="fastest"
        onSelectRoute={onSelectRoute}
      />
    );

    expect(screen.getByText('20 % de sombra')).toBeInTheDocument();
    expect(screen.getByText('70 % de sombra')).toBeInTheDocument();
    expect(screen.getByText(/añade 2 min/)).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: /Con sombra/ }));
    expect(onSelectRoute).toHaveBeenCalledWith('shaded');
  });

  it('shows the distance of each route next to its duration', () => {
    render(
      <RouteComparisonPanel
        comparison={{
          status: 'selected',
          fastest: { ...route(900, 20), distance: 1250 },
          shaded: { ...route(1020, 70), distance: 980 },
          additionalDurationSeconds: 120,
          shadeImprovementPercentagePoints: 50,
        }}
        selectedRouteType="shaded"
        onSelectRoute={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Más rápida/ })).toHaveTextContent('15 min · 1,3 km');
    expect(screen.getByRole('button', { name: /Con sombra/ })).toHaveTextContent('17 min · 980 m');
  });

  it('sums up the selected route in one line when collapsed', () => {
    const comparison = {
      status: 'selected',
      fastest: route(900, 20),
      shaded: route(1020, 70),
      additionalDurationSeconds: 120,
      shadeImprovementPercentagePoints: 50,
    };
    const { container, rerender } = render(
      <RouteComparisonPanel
        comparison={comparison}
        selectedRouteType="shaded"
        onSelectRoute={jest.fn()}
        isExpanded={false}
        onToggleExpanded={jest.fn()}
      />
    );
    const summary = () => container.querySelector('.comparison-collapsed-summary');
    expect(summary()).toHaveTextContent('Con sombra · 17 min · 70 % de sombra');

    rerender(
      <RouteComparisonPanel
        comparison={comparison}
        selectedRouteType="fastest"
        onSelectRoute={jest.fn()}
        isExpanded={false}
        onToggleExpanded={jest.fn()}
      />
    );
    expect(summary()).toHaveTextContent('Más rápida · 15 min · 20 % de sombra');

    rerender(
      <RouteComparisonPanel
        comparison={comparison}
        selectedRouteType="fastest"
        onSelectRoute={jest.fn()}
      />
    );
    expect(summary()).not.toBeInTheDocument();
  });

  it('offers a collapse toggle only when it can be collapsed', async () => {
    const user = userEvent.setup();
    const onToggleExpanded = jest.fn();
    const comparison = { status: 'no_better_alternative', fastest: route(900, 20), shaded: null };
    const { container, rerender } = render(
      <RouteComparisonPanel comparison={comparison} onSelectRoute={jest.fn()} />
    );
    expect(screen.queryByRole('button', { name: 'Ver más' })).not.toBeInTheDocument();

    rerender(
      <RouteComparisonPanel
        comparison={comparison}
        onSelectRoute={jest.fn()}
        isExpanded={false}
        onToggleExpanded={onToggleExpanded}
      />
    );
    expect(container.querySelector('.route-comparison')).toHaveClass('is-collapsed');
    await user.click(screen.getByRole('button', { name: 'Ver más' }));
    expect(onToggleExpanded).toHaveBeenCalledTimes(1);
  });

  it.each([
    ['sun_too_low', true],
    ['sun_below_horizon', true],
    ['insufficient_exposure_data', true],
    ['no_better_alternative', false],
  ])('keeps the reason of %s visible when collapsed: %s', (status, important) => {
    render(
      <RouteComparisonPanel
        comparison={{ status, fastest: route(900, 20), shaded: null }}
        onSelectRoute={jest.fn()}
        isExpanded={false}
        onToggleExpanded={jest.fn()}
      />
    );
    expect(screen.getByRole('status').classList.contains('comparison-result-important')).toBe(
      important
    );
  });

  it('explains when no real shaded alternative exists', () => {
    render(
      <RouteComparisonPanel
        comparison={{ status: 'no_better_alternative', fastest: route(900, 20), shaded: null }}
        selectedRouteType="fastest"
        onSelectRoute={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Con sombra/ })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('No hay una alternativa');
  });

  it('says how much extra time the chosen route allowed', () => {
    render(
      <RouteComparisonPanel
        comparison={{
          status: 'no_better_alternative',
          fastest: route(900, 20),
          shaded: null,
          strategy: { maximumDurationFactor: 1.1 },
        }}
        selectedRouteType="fastest"
        onSelectRoute={jest.fn()}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('sin tardar más de un 10 % extra');
  });

  it('names the alternative after the chosen route and says when it has less shade', () => {
    render(
      <RouteComparisonPanel
        comparison={{
          status: 'selected',
          fastest: route(900, 80),
          shaded: route(960, 10),
          additionalDurationSeconds: 60,
          shadeImprovementPercentagePoints: -70,
        }}
        selectedRouteType="shaded"
        alternativeLabel="Soleada"
        onSelectRoute={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Soleada/ })).toHaveAttribute('aria-pressed', 'true');
    expect(
      screen.getByText(/Soleada añade 1 min y tiene 70 puntos menos de sombra/)
    ).toBeInTheDocument();
  });

  it('explains when the sun is too low to estimate shade', () => {
    render(
      <RouteComparisonPanel
        comparison={{
          status: 'sun_too_low',
          fastest: { duration: 900, exposure: { status: 'unavailable' } },
          shaded: null,
        }}
        selectedRouteType="fastest"
        onSelectRoute={jest.fn()}
      />
    );

    expect(screen.getByRole('button', { name: /Con sombra/ })).toBeDisabled();
    expect(screen.getByRole('status')).toHaveTextContent('El Sol está demasiado bajo');
  });
});
