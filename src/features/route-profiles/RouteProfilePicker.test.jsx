import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { RouteProfilePicker } from './RouteProfilePicker.jsx';
import { RECOMMENDED_PROFILE } from './useRouteProfiles.js';

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
    // One bar for shade and sun (ADR-030): shade to the left, so 50 % of shade is -50.
    const shadeSun = within(dialog).getByRole('slider', { name: 'Sombra o sol' });
    expect(shadeSun).toHaveValue('-50');
    expect(shadeSun).toHaveAttribute('aria-valuetext', 'Sombra 50 %');
    await user.clear(within(dialog).getByLabelText('Nombre'));
    await user.type(within(dialog).getByLabelText('Nombre'), 'Mucha sombra');
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(2, {
      name: 'Mucha sombra',
      weights: { shade: 50, sun: 0, wind: 0, vegetation: 0 },
      maxDetourPercentage: 25,
    });
    expect(onSelect).toHaveBeenCalledWith(2);
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
  });

  it('creates a new route, with the weights set on the sliders', async () => {
    const user = userEvent.setup();
    const { onSave } = renderPicker();
    onSave.mockResolvedValue({ id: 3, name: 'Invierno', weights: { shade: 0, sun: 30 } });

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    const dialog = screen.getByRole('dialog', { name: 'Nueva ruta' });
    await user.type(within(dialog).getByLabelText('Nombre'), 'Invierno');
    fireEvent.change(within(dialog).getByRole('slider', { name: 'Sombra o sol' }), {
      target: { value: '30' },
    });
    await user.click(within(dialog).getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(null, {
      name: 'Invierno',
      weights: { shade: 0, sun: 30, wind: 0, vegetation: 0 },
      maxDetourPercentage: 25,
    });
  });

  describe('one bar for shade and sun (ADR-030)', () => {
    async function openNewRoute(user) {
      await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
      return within(screen.getByRole('dialog', { name: 'Nueva ruta' }));
    }

    it('goes from shade on the left, through neutral, to sun on the right', async () => {
      const user = userEvent.setup();
      renderPicker();
      const dialog = await openNewRoute(user);
      const bar = dialog.getByRole('slider', { name: 'Sombra o sol' });

      expect(bar).toHaveAttribute('min', '-100');
      expect(bar).toHaveAttribute('max', '100');
      expect(bar).toHaveAttribute('step', '5');
      expect(dialog.queryByRole('slider', { name: 'Sombra' })).not.toBeInTheDocument();
      expect(dialog.queryByRole('slider', { name: 'Sol' })).not.toBeInTheDocument();
      fireEvent.change(bar, { target: { value: '0' } });
      expect(bar).toHaveAttribute('aria-valuetext', 'Neutro');
      expect(dialog.getByText('Neutro', { selector: 'output' })).toBeInTheDocument();
      fireEvent.change(bar, { target: { value: '30' } });
      expect(bar).toHaveAttribute('aria-valuetext', 'Sol 30 %');
      fireEvent.change(bar, { target: { value: '-100' } });
      expect(bar).toHaveAttribute('aria-valuetext', 'Sombra 100 %');
    });

    it('is one native range reachable with Tab (the arrows move it in the browser)', async () => {
      const user = userEvent.setup();
      renderPicker();
      const dialog = await openNewRoute(user);
      const bar = dialog.getByRole('slider', { name: 'Sombra o sol' });

      expect(bar).toHaveAttribute('type', 'range');
      dialog.getByLabelText('Nombre').focus();
      await user.tab();
      expect(bar).toHaveFocus();
      await user.tab();
      expect(dialog.getByRole('slider', { name: 'Evitar viento' })).toHaveFocus();
    });

    it('opens a route saved with shade and sun at once with the larger one', async () => {
      const user = userEvent.setup();
      const both = {
        id: 3,
        name: 'Antigua',
        presetKey: null,
        weights: { shade: 30, sun: 60, wind: 0 },
        maxDetourPercentage: 25,
      };
      renderPicker({ profiles: [...profiles, both], selectedId: 3 });

      await user.click(screen.getByRole('button', { name: 'Editar Antigua' }));

      expect(screen.getByRole('slider', { name: 'Sombra o sol' })).toHaveValue('60');
    });

    it('shows the error of the backend under the bar', async () => {
      const user = userEvent.setup();
      const { onSave } = renderPicker();
      onSave.mockRejectedValue(
        Object.assign(new Error('Los pesos no son válidos.'), {
          fields: {
            shade: 'Elige sombra o sol, no los dos a la vez.',
            sun: 'Elige sombra o sol, no los dos a la vez.',
          },
        })
      );
      const dialog = await openNewRoute(user);
      await user.type(dialog.getByLabelText('Nombre'), 'Mal');
      await user.click(dialog.getByRole('button', { name: 'Guardar' }));

      expect(
        await dialog.findByText('Elige sombra o sol, no los dos a la vez.')
      ).toBeInTheDocument();
      expect(dialog.getByRole('slider', { name: 'Sombra o sol' })).toHaveAttribute(
        'aria-invalid',
        'true'
      );
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
      screen.getByText(
        'Con sombra y sol en neutro y el viento y el verde a 0 % es la ruta más rápida: no hay rodeo.'
      )
    ).toBeInTheDocument();
    fireEvent.change(wind, { target: { value: '90' } });
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(3, {
      name: 'Cierzo',
      weights: { shade: 0, sun: 0, wind: 90, vegetation: 0 },
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
        fields: { name: 'Escribe un nombre de 1 a 40 caracteres.' },
      })
    );

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    // A name the list does not have: a repeated one is warned about before saving (#165).
    await user.type(screen.getByLabelText('Nombre'), 'Paseo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Escribe un nombre de 1 a 40 caracteres.')).toBeInTheDocument();
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

  describe('recommended route (PBI-9.1)', () => {
    it('shows it with its own summary and without edit or delete', () => {
      renderPicker({ profiles: [RECOMMENDED_PROFILE, ...profiles], selectedId: 'recommended' });

      expect(screen.getByRole('button', { name: 'Recomendada' })).toHaveAttribute(
        'aria-pressed',
        'true'
      );
      expect(screen.getByText('Según el tiempo')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Nueva ruta' })).toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Editar/ })).not.toBeInTheDocument();
      expect(screen.queryByRole('button', { name: /Borrar/ })).not.toBeInTheDocument();
    });

    it('lists it in "Ver todas" with its summary', async () => {
      const user = userEvent.setup();
      renderPicker({
        profiles: [RECOMMENDED_PROFILE, ...profiles, { ...profiles[1], id: 3, name: 'Verano' }],
      });

      await user.click(screen.getByRole('button', { name: 'Ver todas' }));

      expect(within(screen.getByRole('dialog')).getByText('Según el tiempo')).toBeInTheDocument();
    });
  });
});

describe('RouteProfilePicker with the green (PBI-10 phase B)', () => {
  it('saves a route with a vegetation weight from its own bar', async () => {
    const user = userEvent.setup();
    const onSave = jest.fn().mockResolvedValue({ id: 3, name: 'Parques' });
    render(
      <RouteProfilePicker
        profiles={profiles}
        selectedId={1}
        isEditable
        loadFailed={false}
        onSelect={jest.fn()}
        onSave={onSave}
        onDelete={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    const dialog = within(screen.getByRole('dialog', { name: 'Nueva ruta' }));
    await user.type(dialog.getByLabelText('Nombre'), 'Parques');
    fireEvent.change(dialog.getByRole('slider', { name: 'Sombra o sol' }), {
      target: { value: '0' },
    });
    const green = dialog.getByRole('slider', { name: 'Verde' });
    expect(green).toHaveValue('0');
    // Only the green weighs: there is still a detour to choose.
    fireEvent.change(green, { target: { value: '80' } });
    expect(green).toHaveAttribute('aria-valuetext', '80 %');
    expect(dialog.getByRole('slider', { name: 'Tiempo extra máximo' })).toBeEnabled();
    await user.click(dialog.getByRole('button', { name: 'Guardar' }));

    expect(onSave).toHaveBeenCalledWith(null, {
      name: 'Parques',
      weights: { shade: 0, sun: 0, wind: 0, vegetation: 80 },
      maxDetourPercentage: 25,
    });
  });

  it('opens a route saved before the green with it at 0', async () => {
    const user = userEvent.setup();
    render(
      <RouteProfilePicker
        profiles={profiles}
        selectedId={2}
        isEditable
        loadFailed={false}
        onSelect={jest.fn()}
        onSave={jest.fn()}
        onDelete={jest.fn()}
      />
    );

    await user.click(screen.getByRole('button', { name: 'Editar Sombreada' }));

    expect(screen.getByRole('slider', { name: 'Verde' })).toHaveValue('0');
  });
});

describe('RouteProfilePicker with a repeated name (#165)', () => {
  function renderWithReplace(props = {}) {
    const handlers = {
      onSelect: jest.fn(),
      onSave: jest.fn(),
      onDelete: jest.fn(),
      onReplace: jest.fn().mockImplementation(async (id) => ({ id })),
    };
    render(
      <RouteProfilePicker
        profiles={[RECOMMENDED_PROFILE, ...profiles]}
        selectedId={2}
        isEditable
        loadFailed={false}
        {...handlers}
        {...props}
      />
    );
    return handlers;
  }

  it('warns while typing, next to the name, and does not save', async () => {
    const user = userEvent.setup();
    const { onSave } = renderWithReplace();

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    const name = screen.getByLabelText('Nombre');
    await user.type(name, '  sombreada ');

    const warning = screen.getByText('Ya tienes una ruta llamada «Sombreada».');
    expect(name).toHaveAttribute('aria-invalid', 'true');
    expect(name.getAttribute('aria-describedby')).toContain(warning.id);
    await user.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(onSave).not.toHaveBeenCalled();
    // Saving takes the user to the choice.
    expect(screen.getByRole('button', { name: 'Reemplazar' })).toHaveFocus();
  });

  it('replaces the existing route after confirming, with the keyboard', async () => {
    const user = userEvent.setup();
    const { onReplace, onSelect } = renderWithReplace();

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.type(screen.getByLabelText('Nombre'), 'Sombreada{Enter}');
    await user.keyboard('{Enter}');

    const question = screen.getByRole('group', {
      name: 'Se sustituirán los pesos de «Sombreada».',
    });
    const confirm = within(question).getByRole('button', { name: 'Reemplazar «Sombreada»' });
    expect(confirm).toHaveFocus();
    await user.keyboard('{Enter}');

    expect(onReplace).toHaveBeenCalledWith(
      2,
      {
        name: 'Sombreada',
        weights: { shade: 50, sun: 0, wind: 0, vegetation: 0 },
        maxDetourPercentage: 25,
      },
      null
    );
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('warns that the edited route will be deleted when it is renamed to an existing name', async () => {
    const user = userEvent.setup();
    const { onReplace } = renderWithReplace({ selectedId: 1 });

    await user.click(screen.getByRole('button', { name: 'Editar Rápida' }));
    const name = screen.getByLabelText('Nombre');
    await user.clear(name);
    await user.type(name, 'Sombreada');
    await user.click(screen.getByRole('button', { name: 'Reemplazar' }));

    expect(
      screen.getByText('Se sustituirán los pesos de «Sombreada» y se borrará «Rápida».')
    ).toBeInTheDocument();
    // "No reemplazar" goes back to the choice.
    await user.click(screen.getByRole('button', { name: 'No reemplazar' }));
    expect(screen.getByRole('button', { name: 'Reemplazar' })).toHaveFocus();
    await user.click(screen.getByRole('button', { name: 'Reemplazar' }));
    await user.click(screen.getByRole('button', { name: 'Reemplazar «Sombreada»' }));

    expect(onReplace).toHaveBeenCalledWith(2, expect.objectContaining({ name: 'Sombreada' }), 1);
  });

  it('suggests a free name with "Cambiar nombre" and puts the focus on it', async () => {
    const user = userEvent.setup();
    renderWithReplace();

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.type(screen.getByLabelText('Nombre'), 'rápida');
    await user.click(screen.getByRole('button', { name: 'Cambiar nombre' }));

    expect(screen.getByLabelText('Nombre')).toHaveValue('rápida (2)');
    expect(screen.getByLabelText('Nombre')).toHaveFocus();
    expect(screen.queryByText(/Ya tienes una ruta llamada/)).not.toBeInTheDocument();
  });

  it('offers the same choice when the server answers 409 with the existing route', async () => {
    const user = userEvent.setup();
    const { onSave, onReplace } = renderWithReplace();
    onSave.mockRejectedValue(
      Object.assign(new Error('Ya tienes una ruta con ese nombre.'), {
        status: 409,
        existingId: 9,
        fields: { name: 'Ya tienes una ruta llamada «Paseo».' },
      })
    );

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.type(screen.getByLabelText('Nombre'), 'Paseo');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(await screen.findByText('Ya tienes una ruta llamada «Paseo».')).toBeInTheDocument();
    await user.click(screen.getByRole('button', { name: 'Reemplazar' }));
    await user.click(screen.getByRole('button', { name: 'Reemplazar «Paseo»' }));
    expect(onReplace).toHaveBeenCalledWith(9, expect.objectContaining({ name: 'Paseo' }), null);
  });

  it('does not let a saved route be called "Recomendada"', async () => {
    const user = userEvent.setup();
    const { onSave } = renderWithReplace();

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.type(screen.getByLabelText('Nombre'), ' recomendada');
    await user.click(screen.getByRole('button', { name: 'Guardar' }));

    expect(
      screen.getByText('«Recomendada» es la ruta automática: elige otro nombre.')
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Reemplazar' })).not.toBeInTheDocument();
    expect(onSave).not.toHaveBeenCalled();
  });

  it('closes the pop-up and says what happened when the edited route could not be deleted', async () => {
    const user = userEvent.setup();
    const { onReplace, onSelect } = renderWithReplace({ selectedId: 1 });
    onReplace.mockRejectedValue(
      Object.assign(
        new Error('Se ha actualizado «Sombreada», pero no se ha podido borrar «Rápida».'),
        { saved: { id: 2 } }
      )
    );

    await user.click(screen.getByRole('button', { name: 'Editar Rápida' }));
    await user.clear(screen.getByLabelText('Nombre'));
    await user.type(screen.getByLabelText('Nombre'), 'Sombreada');
    await user.click(screen.getByRole('button', { name: 'Reemplazar' }));
    await user.click(screen.getByRole('button', { name: 'Reemplazar «Sombreada»' }));

    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent(
      'Se ha actualizado «Sombreada», pero no se ha podido borrar «Rápida».'
    );
    expect(onSelect).toHaveBeenCalledWith(2);
  });

  it('keeps the pop-up open with the error when the replacement fails', async () => {
    const user = userEvent.setup();
    const { onReplace } = renderWithReplace();
    onReplace.mockRejectedValue(new Error('No se ha podido guardar la ruta. Inténtalo de nuevo.'));

    await user.click(screen.getByRole('button', { name: 'Nueva ruta' }));
    await user.type(screen.getByLabelText('Nombre'), 'Sombreada');
    await user.click(screen.getByRole('button', { name: 'Reemplazar' }));
    await user.click(screen.getByRole('button', { name: 'Reemplazar «Sombreada»' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('No se ha podido guardar la ruta.');
    expect(screen.getByRole('dialog')).toBeInTheDocument();
  });
});
