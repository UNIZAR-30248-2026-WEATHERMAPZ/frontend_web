import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { GuidedTour, TOUR_STEPS } from './GuidedTour.jsx';

const stepIndex = (id) => TOUR_STEPS.findIndex((step) => step.id === id);
const renderStep = (id, handlers = {}) =>
  render(
    <GuidedTour
      step={stepIndex(id)}
      onNext={jest.fn()}
      onPrevious={jest.fn()}
      onSkip={jest.fn()}
      {...handlers}
    />
  );

describe('GuidedTour', () => {
  it('shows nine accessible steps with navigation and skip actions', async () => {
    const user = userEvent.setup();
    const next = jest.fn();
    const skip = jest.fn();
    renderStep('points', { onNext: next, onSkip: skip });
    expect(TOUR_STEPS.map((step) => step.id)).toEqual([
      'points',
      'preferences',
      'weather-today',
      'extra-time',
      'compare',
      'start-navigation',
      'current-weather',
      'favorites',
      'repeat',
    ]);
    expect(screen.getByRole('dialog', { name: 'Origen y destino' })).toHaveAttribute(
      'aria-modal',
      'true'
    );
    expect(screen.getByText('Paso 1 de 9')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Siguiente' }));
    expect(next).toHaveBeenCalledTimes(1);
    await user.click(screen.getByRole('button', { name: 'Saltar tutorial' }));
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it('can skip with Escape', async () => {
    const user = userEvent.setup();
    const skip = jest.fn();
    renderStep('preferences', { onSkip: skip });
    await user.keyboard('{Escape}');
    expect(skip).toHaveBeenCalledTimes(1);
  });

  it('explains «Según el tiempo de hoy» on its own step', () => {
    renderStep('weather-today');
    expect(screen.getByRole('dialog', { name: 'Según el tiempo de hoy' })).toBeInTheDocument();
    expect(TOUR_STEPS[stepIndex('weather-today')].target).toBe('[data-tour="weather-today"]');
  });

  it('simulates the comparison, and the example routes can be chosen', async () => {
    const user = userEvent.setup();
    renderStep('compare');
    const dialog = screen.getByRole('dialog', { name: 'Calcula y compara' });
    // The real result of PBI-19 with example routes: title, reasons, cards and «Ver detalle».
    expect(within(dialog).getByRole('heading', { name: 'Tu ruta · 16 min' })).toBeInTheDocument();
    expect(within(dialog).getByText(/las cifras no son de una ruta real/)).toBeInTheDocument();
    expect(within(dialog).getByRole('list', { name: 'Por qué esta ruta' })).toHaveTextContent(
      'Vas a la sombra por Calle Alfonso I'
    );
    const fastest = within(dialog).getByRole('button', { name: /^Más rápida/ });
    expect(fastest).toHaveAttribute('aria-pressed', 'false');
    await user.click(fastest);
    expect(fastest).toHaveAttribute('aria-pressed', 'true');
    await user.click(within(dialog).getByRole('button', { name: 'Ver detalle' }));
    expect(within(dialog).getByRole('table')).toBeInTheDocument();
  });

  it('points at the profile for the favourites and to repeat the tutorial, which ends the tour', () => {
    const { unmount } = renderStep('favorites');
    expect(screen.getByRole('dialog', { name: 'Tus favoritos' })).toBeInTheDocument();
    expect(TOUR_STEPS[stepIndex('favorites')].target).toBe('.user-menu-item-favorites');
    expect(TOUR_STEPS[stepIndex('repeat')].target).toBe('.user-menu-item-tutorial');

    unmount();
    renderStep('repeat');
    expect(screen.getByRole('dialog', { name: 'Vuelve a verlo cuando quieras' })).toHaveTextContent(
      'Ver tutorial'
    );
    expect(screen.getByRole('button', { name: 'Terminar' })).toBeInTheDocument();
  });

  it('includes the weather details in the step of the current weather', () => {
    const step = TOUR_STEPS[stepIndex('current-weather')];
    expect(step.target).toBe('[data-tour="current-weather"]');
    expect(step.include).toBe('.weather-details:not([hidden])');
  });
});
