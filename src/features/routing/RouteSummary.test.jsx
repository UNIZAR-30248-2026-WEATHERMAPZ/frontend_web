import { render, screen } from '@testing-library/react';

import { formatRouteDistance, formatRouteDuration, RouteSummary } from './RouteSummary.jsx';

describe('RouteSummary', () => {
  test('muestra la duración total redondeada a minutos', () => {
    expect(formatRouteDuration(930.2)).toBe('16 min');
    expect(formatRouteDuration(0)).toBe('0 min');
  });

  test('muestra las distancias menores de un kilómetro en metros', () => {
    expect(formatRouteDistance(742.4)).toBe('742 m');
    expect(formatRouteDistance(999)).toBe('999 m');
  });

  test('muestra las distancias desde un kilómetro en kilómetros', () => {
    expect(formatRouteDistance(1000)).toBe('1 km');
    expect(formatRouteDistance(1250.4)).toBe('1,3 km');
  });

  test('presenta el resumen completo de la ruta calculada', () => {
    render(<RouteSummary distance={1250.4} duration={930.2} />);

    expect(screen.getByRole('heading', { name: 'Ruta rápida' })).toBeInTheDocument();
    expect(screen.getByText('16 min')).toBeInTheDocument();
    expect(screen.getByText('1,3 km')).toBeInTheDocument();
  });

  test('presenta el título y la sombra cuando están disponibles', () => {
    render(
      <RouteSummary distance={1400} duration={1020} shadePercentage={74.4} title="Ruta Sombreada" />
    );

    expect(screen.getByRole('heading', { name: 'Ruta Sombreada' })).toBeInTheDocument();
    expect(screen.getByText('74 %')).toBeInTheDocument();
  });
});

describe('RouteSummary with the green (PBI-10 phase B)', () => {
  test('muestra el porcentaje verde de la ruta cuando se ha calculado', () => {
    const { rerender } = render(
      <RouteSummary distance={1200} duration={900} greenPercentage={71.6} />
    );

    expect(screen.getByText('Verde').nextSibling).toHaveTextContent('72 %');

    rerender(<RouteSummary distance={1200} duration={900} />);
    expect(screen.queryByText('Verde')).not.toBeInTheDocument();
  });
});
