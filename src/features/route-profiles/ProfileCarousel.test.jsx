import { act, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AllProfilesDialog } from './AllProfilesDialog.jsx';
import { ProfileCarousel } from './ProfileCarousel.jsx';

const profiles = [
  { id: 1, name: 'Rápida', weights: { shade: 0, sun: 0 } },
  { id: 2, name: 'Sombreada', weights: { shade: 50, sun: 0 } },
  { id: 3, name: 'Paseo de tarde', weights: { shade: 30, sun: 20 } },
  { id: 4, name: 'Soleada', weights: { shade: 0, sun: 50 } },
].map((profile) => ({ ...profile, maxDetourPercentage: 25 }));

// jsdom has no layout: the size of the row is set by hand.
function setRowSize(list, { scrollWidth, clientWidth, scrollLeft = 0 }) {
  Object.defineProperties(list, {
    scrollWidth: { configurable: true, value: scrollWidth },
    clientWidth: { configurable: true, value: clientWidth },
    scrollLeft: { configurable: true, writable: true, value: scrollLeft },
  });
}

describe('ProfileCarousel', () => {
  beforeEach(() => {
    jest.spyOn(window, 'requestAnimationFrame').mockImplementation((callback) => {
      callback();
      return 1;
    });
  });
  afterEach(() => jest.restoreAllMocks());

  it('shows shade and sun as one scale, with the larger one for an old route (ADR-030)', () => {
    const { container } = render(
      <ProfileCarousel profiles={profiles} selectedId={2} onSelect={jest.fn()} />
    );
    const card = screen.getByRole('button', { name: 'Paseo de tarde' });

    // Saved with shade 30 and sun 20: shade wins, with one icon and one line.
    expect(card.querySelectorAll('.profile-icon-shade')).toHaveLength(1);
    expect(card.querySelectorAll('.profile-icon-sun')).toHaveLength(0);
    expect(screen.getByText('Sombra 30 %')).toBeInTheDocument();
    expect(screen.queryByText('Sol 20 %')).not.toBeInTheDocument();
    expect(container.querySelector('.route-profile-arrow')).toBeNull();
  });

  it('shows an arrow on each side with cut cards and moves the row with it', () => {
    const { container } = render(
      <ProfileCarousel profiles={profiles} selectedId={2} onSelect={jest.fn()} />
    );
    const list = container.querySelector('.route-profile-list');
    list.scrollBy = jest.fn();

    setRowSize(list, { scrollWidth: 500, clientWidth: 300 });
    act(() => fireEvent.scroll(list));
    expect(container.querySelector('.route-profile-arrow-before')).toBeNull();
    fireEvent.click(container.querySelector('.route-profile-arrow-after'));
    expect(list.scrollBy).toHaveBeenCalledWith(expect.objectContaining({ behavior: 'smooth' }));
    expect(list.scrollBy.mock.calls[0][0].left).toBeGreaterThan(0);

    setRowSize(list, { scrollWidth: 500, clientWidth: 300, scrollLeft: 200 });
    act(() => fireEvent.scroll(list));
    expect(container.querySelector('.route-profile-arrow-after')).toBeNull();
    fireEvent.click(container.querySelector('.route-profile-arrow-before'));
    expect(list.scrollBy.mock.calls[1][0].left).toBeLessThan(0);
  });
});

describe('AllProfilesDialog', () => {
  it('finds routes without caring about accents or capitals, and chooses one', async () => {
    const user = userEvent.setup();
    const onSelect = jest.fn();
    const onClose = jest.fn();
    render(
      <AllProfilesDialog profiles={profiles} selectedId={1} onSelect={onSelect} onClose={onClose} />
    );

    expect(screen.getByRole('dialog', { name: 'Tus rutas' })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(4);
    await user.type(screen.getByRole('searchbox'), 'RAPIDA');
    expect(screen.getAllByRole('listitem')).toHaveLength(1);

    await user.click(screen.getByRole('button', { name: /Rápida/ }));
    expect(onSelect).toHaveBeenCalledWith(1);
    expect(onClose).toHaveBeenCalled();
  });

  it('says so when no route matches', async () => {
    const user = userEvent.setup();
    render(
      <AllProfilesDialog
        profiles={profiles}
        selectedId={1}
        onSelect={jest.fn()}
        onClose={jest.fn()}
      />
    );

    await user.type(screen.getByRole('searchbox'), 'nieve');

    expect(screen.queryByRole('listitem')).not.toBeInTheDocument();
    expect(screen.getByRole('status')).toHaveTextContent('No tienes ninguna ruta con ese nombre.');
  });
});

describe('ProfileCarousel with the green (PBI-10 phase B)', () => {
  it('shows a leaf and a "Verde N %" line for a route that weighs the green', () => {
    render(
      <ProfileCarousel
        profiles={[
          {
            id: 7,
            name: 'Parques',
            weights: { shade: 40, sun: 0, wind: 0, vegetation: 60 },
            maxDetourPercentage: 20,
          },
        ]}
        selectedId={7}
        onSelect={jest.fn()}
      />
    );
    const card = screen.getByRole('button', { name: 'Parques' });

    expect(card.querySelectorAll('.profile-icon-shade, .profile-icon-vegetation')).toHaveLength(2);
    expect(screen.getByText('Sombra 40 %')).toBeInTheDocument();
    expect(screen.getByText('Verde 60 %')).toBeInTheDocument();
    expect(screen.getByText('Tiempo +20 %')).toBeInTheDocument();
  });
});
