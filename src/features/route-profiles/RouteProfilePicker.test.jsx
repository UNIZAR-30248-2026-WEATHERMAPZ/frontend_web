import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RouteProfilePicker } from './RouteProfilePicker.jsx';

const profiles = [
  { id: 1, name: 'Rápida', presetKey: 'fastest', weights: { shade: 0, sun: 0 } },
  { id: 2, name: 'Sombreada', presetKey: 'shaded', weights: { shade: 50, sun: 0 } },
].map((profile) => ({ ...profile, maxDetourPercentage: 25 }));

function renderPicker(props = {}) {
  const handlers = { onSelect: jest.fn(), onSave: jest.fn(), onDelete: jest.fn() };
  render(
    <RouteProfilePicker
      profiles={profiles}
      selectedId={2}
      isEditable
      loadFailed={false}
      {...handlers}
      {...props}
    />
  );
  return handlers;
}

describe('RouteProfilePicker', () => {
  it('shows each route with what it favours and which one is chosen', async () => {
    const user = userEvent.setup();
    const { onSelect } = renderPicker();

    expect(screen.getByRole('button', { name: 'Sombreada' })).toHaveAttribute(
      'aria-pressed',
      'true'
    );
    expect(screen.getByText('Sombra 50 %')).toBeInTheDocument();
    expect(screen.getByText('Tiempo +25 %')).toBeInTheDocument();
    expect(screen.getByText('Lo antes posible')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Rápida' }));
    expect(onSelect).toHaveBeenCalledWith(1);
  });

  it('edits the chosen route in a pop-up with its current values', async () => {
    const user = userEvent.setup();
    const { onSave, onSelect } = renderPicker();
    onSave.mockResolvedValue({ ...profiles[1], name: 'Mucha sombra' });

    await user.click(screen.getByRole('button', { name: 'Editar Sombreada' }));
    const dialog = screen.getByRole('dialog', { name: 'Editar ruta' });
    expect(within(dialog).getByLabelText('Nombre')).toHaveValue('Sombreada');
    expect(within(dialog).getByLabelText('Nombre')).toHaveFocus();
    expect(within(dialog).getByRole('slider', { name: 'Sombra' })).toHaveValue('50');
    await user.clear(within(dialog).getByLabelText('Nombre'));
    await user.type(within(dialog).getByLabelText('Nombre'), 'Mucha sombra');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(2, {
      name: 'Mucha sombra',
      weights: { shade: 50, sun: 0, wind: 0 },
      maxDetourPercentage: 25,
    });
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('creates a new route, with the weights set on the sliders', async () => {
    const user = userEvent.setup();
    const { onSave } = renderPicker();
    onSave.mockResolvedValue({ id: 3, name: 'Invierno', weights: { shade: 50, sun: 10 } });

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    const dialog = screen.getByRole('dialog', { name: 'Nueva ruta' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Invierno');
    within(dialog).getByRole('slider', { name: 'Sol' }).focus();
    await user.keyboard('{ArrowRight}{ArrowRight}');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(null, {
      name: 'Invierno',
      weights: { shade: 50, sun: expect.any(Number), wind: 0 },
      maxDetourPercentage: 25,
    });
  });

  it('shows and edits the wind weight of a route (PBI-8.2)', async () => {
    const user = userEvent.setup();
    const cierzo = {
      id: 3,
      name: 'Cierzo',
      presetKey: null,
      weights: { shade: 0, sun: 0, wind: 70 },
      maxDetourPercentage: 25,
    };
    const { onSave } = renderPicker({ profiles: [...profiles, cierzo], selectedId: 3 });
    onSave.mockResolvedValue(cierzo);

    expect(screen.getByText('Evitar viento 70 %')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Editar Cierzo' }));
    const wind = screen.getByRole('slider', { name: 'Evitar viento' });
    expect(wind).toHaveValue('70');
    fireEvent.change(wind, { target: { value: '0' } });
    expect(
      screen.getByText('Con sombra, sol y viento a 0 % es la ruta más rápida: no hay rodeo.')
    ).toBeInTheDocument();
    fireEvent.change(wind, { target: { value: '90' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(3, {
      name: 'Cierzo',
      weights: { shade: 0, sun: 0, wind: 90 },
      maxDetourPercentage: 25,
    });
  });

  it('lets the user choose how much extra time the route may take', async () => {
    const user = userEvent.setup();
    const { onSave } = renderPicker();
    onSave.mockResolvedValue(profiles[1]);

    await user.click(screen.getByRole('button', { name: 'Editar Sombreada' }));
    const detour = screen.getByRole('slider', { name: 'Tiempo extra máximo' });
    expect(detour).toHaveValue('25');
    expect(screen.getByText(/un paseo de 20 min puede durar hasta 25 min/)).toBeInTheDocument();
    fireEvent.change(detour, { target: { value: '10' } });
    expect(screen.getByText('+10 %')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(2, expect.objectContaining({ maxDetourPercentage: 10 }));
  });

  it('does not ask for extra time when only time matters', async () => {
    const user = userEvent.setup();
    renderPicker({ selectedId: 1 });

    await user.click(screen.getByRole('button', { name: 'Editar Rápida' }));

    expect(screen.getByRole('slider', { name: 'Tiempo extra máximo' })).toBeDisabled();
    expect(screen.getByText(/es la ruta más rápida: no hay rodeo/)).toBeInTheDocument();
  });

  it('shows the error of a field returned by the server and keeps the pop-up open', async () => {
    const user = userEvent.setup();
    const { onSave } = renderPicker();
    onSave.mockRejectedValue(
      Object.assign(new Error('Revisa los datos'), {
        fields: { name: 'Ya tienes una ruta con ese nombre.' },
      })
    );

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.type(screen.getByLabelText('Nombre'), 'Rápida');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Ya tienes una ruta con ese nombre.')).toBeInTheDocument();
    expect(screen.getByLabelText('Nombre')).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('asks for a name before saving', async () => {
    const user = userEvent.setup();
    const { onSave } = renderPicker();

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(screen.getByText('Escribe un nombre para la ruta.')).toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('closes the pop-up with Escape or Cancelar, without saving', async () => {
    const user = userEvent.setup();
    const { onSave } = renderPicker();

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Nueva ruta' })).toHaveFocus();

    await user.click(screen.getByRole('button', { name: 'Editar Sombreada' }));
    await user.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('asks for confirmation before deleting', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderPicker();
    onDelete.mockResolvedValue();

    await user.click(screen.getByRole('button', { name: 'Borrar Sombreada' }));
    const dialog = screen.getByRole('dialog', { name: '¿Borrar «Sombreada»?' });
    expect(onDelete).not.toHaveBeenCalled();
    await user.click(within(dialog).getByRole('button', { name: 'Borrar' }));

    expect(onDelete).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('keeps the confirmation open with the reason when deleting fails', async () => {
    const user = userEvent.setup();
    const { onDelete } = renderPicker();
    onDelete.mockRejectedValue(new Error('No se ha podido borrar la ruta.'));

    await user.click(screen.getByRole('button', { name: 'Borrar Sombreada' }));
    await user.click(screen.getByRole('button', { name: 'Borrar' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido borrar');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });

  it('offers the full list only when there are many routes', async () => {
    const user = userEvent.setup();
    const many = [
      ...profiles,
      { id: 3, name: 'Soleada', weights: { shade: 0, sun: 50 } },
      { id: 4, name: 'Verano', weights: { shade: 80, sun: 0 } },
    ];
    const { onSelect } = renderPicker({ profiles: many });

    await user.click(screen.getByRole('button', { name: 'Ver todas' }));
    await user.click(within(screen.getByRole('dialog')).getByRole('button', { name: /Verano/ }));

    expect(onSelect).toHaveBeenCalledWith(4);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('does not offer the full list with few routes', () => {
    renderPicker();

    expect(screen.queryByRole('button', { name: 'Ver todas' })).not.toBeInTheDocument();
  });

  it('does not offer deleting the only route left', () => {
    renderPicker({ profiles: [profiles[0]], selectedId: 1 });

    expect(screen.getByRole('button', { name: 'Editar Rápida' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Borrar Rápida' })).not.toBeInTheDocument();
  });

  it('only lets the presets be used when the routes could not be loaded', () => {
    renderPicker({ isEditable: false, loadFailed: true });

    expect(screen.getByRole('status')).toHaveTextContent('No se han podido cargar tus rutas');
    expect(screen.queryByRole('button', { name: 'Nueva ruta' })).not.toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
  });
});
