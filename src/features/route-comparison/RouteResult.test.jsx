import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RouteResult } from './RouteResult.jsx';

const route = (duration, distance, shade, wind, green) => ({
  duration,
  distance,
  exposure: { status: 'available', shadePercentage: shade, sunPercentage: 100 - shade },
  windExposure: { status: 'available', exposure: wind },
  vegetation: { status: 'available', greenPercentage: green },
});

const comparison = {
  status: 'selected',
  fastest: route(900, 1200, 13, 72, 31),
  shaded: route(960, 1300, 91, 18, 28),
  additionalDurationSeconds: 60,
  preferences: { sunShade: 'shade', avoidWind: true, preferParks: false, extraMinutes: 5 },
  strategy: { maximumExtraMinutes: 5 },
  explanation: {
    status: 'selected',
    sunShade: {
      status: 'available',
      kind: 'shade',
      streets: [{ street: 'Calle Alfonso I' }],
      instead: null,
    },
    wind: {
      status: 'available',
      avoided: [{ street: 'Calle del Coso' }],
      via: [{ street: 'Calle de San Miguel' }],
    },
    suggestion: null,
  },
};

function renderResult(props = {}) {
  const onSelectRoute = jest.fn();
  const onTrySuggestion = jest.fn();
  render(
    <RouteResult
      comparison={comparison}
      selectedRouteType="shaded"
      onSelectRoute={onSelectRoute}
      onTrySuggestion={onTrySuggestion}
      {...props}
    />
  );
  return { onSelectRoute, onTrySuggestion };
}

describe('RouteResult (PBI-19, sketches «Resultado explicado» and «Ver detalle»)', () => {
  it('shows the route, its minutes and the extra time over the fastest one', () => {
    renderResult();
    expect(screen.getByRole('heading', { name: 'Tu ruta · 16 min' })).toBeInTheDocument();
    expect(screen.getByText('1 min más que la más rápida · 1,3 km')).toBeInTheDocument();
  });

  it('explains why with streets, the start of each reason in bold', () => {
    renderResult();
    const reasons = within(screen.getByRole('list', { name: 'Por qué esta ruta' })).getAllByRole(
      'listitem'
    );
    expect(reasons.map((item) => item.textContent)).toEqual([
      'Vas a la sombra por Calle Alfonso I.',
      'Evitas el viento de cara de Calle del Coso yendo por Calle de San Miguel.',
    ]);
    expect(within(reasons[0]).getByText('Vas a la sombra').tagName).toBe('STRONG');
  });

  it('compares the two routes with words and bars for what was asked, and lets choose one', async () => {
    const user = userEvent.setup();
    const { onSelectRoute } = renderResult();
    const fastest = screen.getByRole('button', { name: /^Más rápida · 15 min/ });
    const chosen = screen.getByRole('button', { name: /^Tu ruta · 16 min/ });
    expect(fastest).toHaveTextContent('SombraPocaVientoMuchoVerdePoco');
    expect(chosen).toHaveTextContent('SombraMuchaVientoPocoVerdePoco');
    expect(chosen).toHaveAttribute('aria-pressed', 'true');
    expect(chosen).not.toHaveTextContent(/%/);
    await user.click(fastest);
    expect(onSelectRoute).toHaveBeenCalledWith('fastest');
  });

  it('keeps the calculated data in a table under «Ver detalle»', async () => {
    const user = userEvent.setup();
    const onToggleSection = jest.fn();
    const { rerender } = render(
      <RouteResult
        comparison={comparison}
        selectedRouteType="shaded"
        onSelectRoute={jest.fn()}
        onToggleSection={onToggleSection}
      />
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Ver detalle' }));
    expect(onToggleSection).toHaveBeenCalledWith('detail');

    rerender(
      <RouteResult
        comparison={comparison}
        selectedRouteType="shaded"
        onSelectRoute={jest.fn()}
        openSection="detail"
      />
    );
    expect(screen.getByRole('button', { name: 'Ver detalle' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    const row = (name) => screen.getByRole('row', { name: new RegExp(`^${name}`) });
    expect(row('Recorrido a la sombra')).toHaveTextContent('13 %91 %');
    expect(row('Exposición al viento')).toHaveTextContent('7218');
    expect(row('Distancia')).toHaveTextContent('1,2 km1,3 km');
  });

  it('shows the questions in «Cambiar preferencias», one dropdown open at a time', () => {
    render(
      <RouteResult
        comparison={comparison}
        selectedRouteType="shaded"
        onSelectRoute={jest.fn()}
        preferences={<p>Preguntas</p>}
        openSection="preferences"
      />
    );
    expect(screen.getByRole('button', { name: 'Cambiar preferencias' })).toHaveAttribute(
      'aria-expanded',
      'true'
    );
    expect(screen.getByText('Preguntas')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Ver detalle' })).toHaveAttribute(
      'aria-expanded',
      'false'
    );
    expect(screen.queryByRole('table')).not.toBeInTheDocument();
  });

  it('without a better route says why and offers the suggested minutes', async () => {
    const user = userEvent.setup();
    const { onTrySuggestion } = renderResult({
      comparison: {
        ...comparison,
        status: 'no_better_alternative',
        shaded: null,
        explanation: {
          status: 'no_better_alternative',
          suggestion: { kind: 'more_minutes', minutes: 10 },
        },
      },
      selectedRouteType: 'fastest',
    });
    expect(screen.getByRole('heading', { name: 'La más rápida · 15 min' })).toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent(
      'No hay ningún camino con más sombra y menos viento de cara sin andar más de 5 min.'
    );
    expect(screen.queryByRole('list', { name: 'Por qué esta ruta' })).not.toBeInTheDocument();
    // The answers are summed up under the title, so the dropdown need not be opened.
    expect(
      within(screen.getByRole('list', { name: 'Tus preferencias' }))
        .getAllByRole('listitem')
        .map((item) => item.textContent)
    ).toEqual(['Sombra', 'Evitar el viento', '+5 min']);
    // Both cards stay: the second one says there is no alternative.
    expect(screen.getByRole('button', { name: /^Más rápida · 15 min/ })).toBeEnabled();
    expect(screen.getByRole('button', { name: /^Tu ruta/ })).toHaveTextContent('Sin alternativa');
    expect(screen.getByRole('button', { name: /^Tu ruta/ })).toBeDisabled();
    await user.click(screen.getByRole('button', { name: 'Probar con +10 min' }));
    expect(onTrySuggestion).toHaveBeenCalledWith(10);
  });

  it('says in words the suggestions that are not minutes', () => {
    renderResult({
      comparison: {
        ...comparison,
        status: 'sun_too_low',
        shaded: null,
        explanation: { status: 'sun_too_low', suggestion: { kind: 'other_time' } },
      },
      selectedRouteType: 'fastest',
    });
    expect(screen.getByRole('status')).toHaveTextContent(
      'El Sol está demasiado bajo en el momento elegido para estimar la sombra.Prueba con otra hora del día, con el sol más alto.'
    );
    expect(screen.queryByRole('button', { name: /Probar con/ })).not.toBeInTheDocument();
  });

  it('looking at the fastest route says what it saves and what it gives up', async () => {
    const user = userEvent.setup();
    const { rerender } = render(
      <RouteResult comparison={comparison} selectedRouteType="shaded" onSelectRoute={jest.fn()} />
    );
    expect(screen.getByRole('list', { name: 'Por qué esta ruta' })).toBeInTheDocument();
    rerender(
      <RouteResult comparison={comparison} selectedRouteType="fastest" onSelectRoute={jest.fn()} />
    );
    expect(screen.getByRole('heading', { name: 'La más rápida · 15 min' })).toBeInTheDocument();
    expect(screen.getByText('1 min menos que tu ruta · 1,2 km')).toBeInTheDocument();
    expect(screen.queryByRole('list', { name: 'Por qué esta ruta' })).not.toBeInTheDocument();
    expect(screen.getByRole('list', { name: 'Si vas por la más rápida' })).toHaveTextContent(
      'Ahorras 1 min, pero vas menos a la sombra y tienes más viento de cara.'
    );
    expect(user).toBeTruthy();
  });
});
