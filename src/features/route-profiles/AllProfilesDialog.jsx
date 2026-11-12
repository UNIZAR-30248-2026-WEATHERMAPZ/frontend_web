import { useState } from 'react';

import { weightsSummary } from './ProfileCarousel.jsx';
import { ProfileDialog } from './ProfileDialog.jsx';
import { ProfileIcon, ProfileIcons } from './ProfileIcon.jsx';

// Accents and capitals do not matter: "rapida" finds "Rápida".
const normalise = (text) =>
  text
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .toLowerCase();

export function AllProfilesDialog({ profiles, selectedId, onSelect, onClose }) {
  const [query, setQuery] = useState('');
  const shown = profiles.filter((profile) =>
    normalise(profile.name).includes(normalise(query.trim()))
  );

  return (
    <ProfileDialog title="Tus rutas" onClose={onClose}>
      <label className="all-profiles-search">
        <span className="visually-hidden">Buscar ruta</span>
        <ProfileIcon kind="search" />
        <input
          type="search"
          value={query}
          placeholder="Buscar ruta"
          onChange={(event) => setQuery(event.target.value)}
        />
      </label>
      {shown.length ? (
        <ul className="all-profiles-list">
          {shown.map((profile) => (
            <li key={profile.id}>
              <button
                type="button"
                className={profile.id === selectedId ? 'is-active' : ''}
                aria-pressed={profile.id === selectedId}
                onClick={() => {
                  onSelect(profile.id);
                  onClose();
                }}
              >
                <ProfileIcons weights={profile.weights} icon={profile.icon} />
                <strong>{profile.name}</strong>
                <small>{weightsSummary(profile).join(' · ')}</small>
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="profile-dialog-text" role="status">
          No tienes ninguna ruta con ese nombre.
        </p>
      )}
    </ProfileDialog>
  );
}
