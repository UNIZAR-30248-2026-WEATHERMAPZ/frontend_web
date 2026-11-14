import { render, screen, within } from '@testing-library/react';

import { ComfortSummary } from './ComfortSummary.jsx';

const route = ({ shade, wind = null, green = null, duration }) => ({
  duration,
  distance: 1200,
  exposure:
    shade === null
      ? { status: 'unavailable', reason: 'insufficient_segment_coverage' }
      : { status: 'available', shadePercentage: shade, sunPercentage: 100 - shade },
  windExposure: wind === null ? null : { status: 'available', exposure: wind },
  vegetation: green === null ? null : { status: 'available', greenPercentage: green },
});

const comparison = {
  status: 'selected',
  fastest: route({ shade: 14.2, wind: 35, green: 31, duration: 840 }),
  shaded: route({ shade: 46.8, wind: 20, green: 50, duration: 900 }),
  additionalDurationSeconds: 60,
};

const reasons = () => within(screen.getByRole('list')).getAllByRole('listitem');

describe('ComfortSummary', () => {
  it('renders nothing without a comparison', () => {
    const { container } = render(<ComfortSummary comparison={null} />);
    expect(container).toBeEmptyDOMElement();
  });

  it('breaks down the comfort of the chosen route with labelled bars', () => {
    render(
      <ComfortSummary
        comparison={comparison}
        selectedRouteType="shaded"
        alternativeLabel="Sombreada"
        weights={{ shade: 50, sun: 0 }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Confort de la ruta «Sombreada»' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Sombra 47 % y sol 53 % del recorrido' })).toBeVisible();
    expect(screen.getByRole('img', { name: /Exposición al viento: 20 %/ })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Junto a árboles o parques: 50 %' })).toBeVisible();
  });

  it('explains first what was asked, with both percentages and the extra time, never in points', () => {
    const { container } = render(
      <ComfortSummary
        comparison={comparison}
        selectedRouteType="shaded"
        alternativeLabel="Sombreada"
        weights={{ shade: 50, sun: 0 }}
      />
    );

    const [first, ...rest] = reasons();
    expect(first).toHaveTextContent(
      '«Sombreada» va a la sombra el 47 % del recorrido, frente al 14 % de la más rápida.'
    );
    expect(first).toHaveClass('is-asked');
    expect(rest.map((item) => item.textContent)).toEqual([
      '«Sombreada» tiene una exposición al viento del 20 %, frente al 35 % de la más rápida.',
      '«Sombreada» pasa junto a árboles o parques el 50 % del recorrido, frente al 31 % de la más rápida.',
      'A cambio, «Sombreada» tarda 1 min más (15 min frente a 14 min).',
    ]);
    expect(container).not.toHaveTextContent(/puntos/);
  });

  it('explains the sun instead of the shade when the route asks for sun', () => {
    render(
      <ComfortSummary
        comparison={comparison}
        selectedRouteType="shaded"
        alternativeLabel="Soleada"
        weights={{ shade: 0, sun: 50 }}
      />
    );

    expect(reasons()[0]).toHaveTextContent(
      '«Soleada» va al sol el 53 % del recorrido, frente al 86 % de la más rápida.'
    );
    expect(screen.queryByText(/va a la sombra/)).not.toBeInTheDocument();
  });

  it('gives the extra time in seconds and skips a factor that does not change', () => {
    render(
      <ComfortSummary
        comparison={{
          status: 'selected',
          fastest: route({ shade: 72, wind: 0, duration: 870 }),
          shaded: route({ shade: 91, wind: 0, duration: 895 }),
          additionalDurationSeconds: 25,
        }}
        selectedRouteType="shaded"
        alternativeLabel="Sombreada"
        weights={{ shade: 50 }}
      />
    );

    expect(reasons().map((item) => item.textContent)).toEqual([
      '«Sombreada» va a la sombra el 91 % del recorrido, frente al 72 % de la más rápida.',
      'A cambio, «Sombreada» tarda 25 s más.',
    ]);
  });

  it('shows the fastest route breakdown while still explaining the alternative', () => {
    render(
      <ComfortSummary
        comparison={comparison}
        selectedRouteType="fastest"
        alternativeLabel="Sombreada"
        weights={{ wind: 60 }}
      />
    );

    expect(screen.getByRole('heading', { name: 'Confort de la ruta más rápida' })).toBeVisible();
    expect(screen.getByRole('img', { name: 'Sombra 14 % y sol 86 % del recorrido' })).toBeVisible();
    expect(reasons()[0]).toHaveTextContent(/exposición al viento del 20 %, frente al 35 %/);
  });

  it('says why the fastest route is the best one when no alternative improves enough', () => {
    render(
      <ComfortSummary
        comparison={{ ...comparison, status: 'no_better_alternative', shaded: null }}
        selectedRouteType="fastest"
      />
    );

    expect(screen.getByText(/la mejor opción es la más rápida/)).toBeVisible();
    expect(screen.queryByRole('list')).not.toBeInTheDocument();
  });

  it('tells when there is no comfort data for the route', () => {
    render(
      <ComfortSummary
        comparison={{
          status: 'insufficient_exposure_data',
          fastest: route({ shade: null, duration: 600 }),
          shaded: null,
        }}
        selectedRouteType="fastest"
      />
    );

    expect(
      screen.getByText('No hay datos de confort para esta ruta en este momento.')
    ).toBeVisible();
    expect(screen.getByText(/no se ha podido comparar con una alternativa/)).toBeVisible();
  });
});
