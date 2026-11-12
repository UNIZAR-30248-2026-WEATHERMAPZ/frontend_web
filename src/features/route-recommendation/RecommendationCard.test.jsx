import { render, screen, within } from '@testing-library/react';

import { RecommendationCard, compassPoint, weatherSummary } from './RecommendationCard.jsx';

const hotAndCierzo = {
  criterion: 'hot_windy',
  label: 'Calor y cierzo',
  reason:
    'Hace calor (sensación de 31 °C) y sopla cierzo de 35 km/h: se busca sombra y evitar el viento de cara, aceptando hasta un 25 % más de tiempo.',
  weights: { shade: 50, sun: 0, wind: 50 },
  maxDetourPercentage: 25,
  weather: {
    temperature: 29.5,
    apparentTemperature: 31,
    windSpeed: 35,
    windGusts: 58.3,
    windDirection: 300,
    observedAt: '2026-07-15T13:00',
  },
  rules: [],
};

describe('RecommendationCard', () => {
  it('shows the criterion, the reason, the weights applied and the weather used', () => {
    render(<RecommendationCard recommendation={hotAndCierzo} />);

    expect(
      screen.getByRole('heading', { name: 'Recomendada: Calor y cierzo' })
    ).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(hotAndCierzo.reason);
    const weights = within(screen.getByRole('list', { name: 'Pesos aplicados' }));
    // Same labels and 0-100 scale as the route editor.
    // Same scale as the route editor: one bar from shade (-100) to sun (100) (ADR-030).
    const shadeSun = weights.getByRole('meter', { name: 'Sombra o sol' });
    expect(shadeSun).toHaveAttribute('aria-valuenow', '-50');
    expect(shadeSun).toHaveAttribute('aria-valuemin', '-100');
    expect(shadeSun).toHaveAttribute('aria-valuemax', '100');
    expect(shadeSun).toHaveAttribute('aria-valuetext', 'Sombra 50 %');
    expect(shadeSun.closest('li')).toHaveTextContent('Sombra 50 %');
    expect(weights.getByLabelText('Evitar viento')).toHaveAttribute('value', '50');
    // The recommendation does not weigh the green yet (ADR-029): the row shows 0 %.
    expect(weights.getByLabelText('Verde')).toHaveAttribute('value', '0');
    expect(weights.getByText('Tiempo extra máximo').closest('li')).toHaveTextContent('+25 %');
    expect(
      screen.getByText(
        'Tiempo usado (dato de las 13:00): 29,5 °C (sensación 31 °C) · viento de 35 km/h del NO, rachas de 58,3 km/h.'
      )
    ).toBeInTheDocument();
    expect(screen.getByText('Datos del tiempo: Open-Meteo.')).toBeInTheDocument();
  });

  it('says there is no detour when the recommended route is the fastest one', () => {
    render(
      <RecommendationCard
        recommendation={{
          ...hotAndCierzo,
          criterion: 'mild',
          label: 'Tiempo templado',
          reason: 'Temperatura agradable…',
          weights: { shade: 0, sun: 0, wind: 0 },
        }}
      />
    );

    expect(screen.getByText('Tiempo extra máximo').closest('li')).toHaveTextContent('Sin rodeo');
    expect(screen.getByRole('meter', { name: 'Sombra o sol' })).toHaveAttribute(
      'aria-valuetext',
      'Neutro'
    );
  });

  it('explains a recommendation without weather', () => {
    render(
      <RecommendationCard
        recommendation={{
          ...hotAndCierzo,
          criterion: 'weather_unavailable',
          label: 'Sin datos del tiempo',
          reason:
            'No se ha podido consultar el tiempo actual: la ruta recomendada es la más rápida.',
          weights: { shade: 0, sun: 0, wind: 0 },
          weather: null,
        }}
      />
    );

    expect(screen.getByRole('status')).toHaveTextContent('No se ha podido consultar el tiempo');
    expect(screen.getByText('No hay datos del tiempo actual.')).toBeInTheDocument();
    expect(screen.queryByText(/Open-Meteo/)).not.toBeInTheDocument();
  });

  it('marks itself as folded so small screens keep only the criterion and the reason', () => {
    const { container } = render(
      <RecommendationCard recommendation={hotAndCierzo} isExpanded={false} />
    );

    expect(container.querySelector('.recommendation-card')).toHaveClass('is-collapsed');
    expect(screen.getByRole('status')).toHaveTextContent(hotAndCierzo.reason);
  });

  it('renders nothing without a recommendation', () => {
    const { container } = render(<RecommendationCard recommendation={null} />);
    expect(container).toBeEmptyDOMElement();
  });
});

describe('weather helpers', () => {
  it.each([
    [0, 'N'],
    [22, 'N'],
    [23, 'NE'],
    [270, 'O'],
    [300, 'NO'],
    [338, 'N'],
    [360, 'N'],
  ])('wind from %s° is %s', (degrees, point) => {
    expect(compassPoint(degrees)).toBe(point);
  });

  it('leaves out the values the provider did not send', () => {
    expect(
      weatherSummary({
        temperature: 12,
        apparentTemperature: null,
        windSpeed: 10,
        windGusts: null,
        windDirection: 180,
        observedAt: null,
      })
    ).toBe('Tiempo usado: 12 °C · viento de 10 km/h del S.');
  });
});
