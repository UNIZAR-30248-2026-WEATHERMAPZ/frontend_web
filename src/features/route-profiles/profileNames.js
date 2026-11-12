// Names of the saved routes (#165): like the backend, they are compared without case or
// surrounding spaces, but accents still count ("Rapida" is not "Rápida").
export const MAX_PROFILE_NAME_LENGTH = 40;
// The recommended route (PBI-9.1) is shown among the saved ones: none may take its name.
export const RESERVED_PROFILE_NAME = 'Recomendada';
export const RESERVED_NAME_MESSAGE = `«${RESERVED_PROFILE_NAME}» es la ruta automática: elige otro nombre.`;

export const profileNameKey = (name) => name.trim().toLowerCase();

export const isReservedName = (name) =>
  profileNameKey(name) === profileNameKey(RESERVED_PROFILE_NAME);

// The saved route, other than the one being edited, that already has this name.
export function findNameConflict(profiles, name, editedId = null) {
  const key = profileNameKey(name);
  if (!key) return null;
  return (
    profiles.find(
      (profile) =>
        !profile.readOnly && profile.id !== editedId && profileNameKey(profile.name) === key
    ) ?? null
  );
}

// A free name "X (2)", "X (3)"... that fits in 40 characters.
export function suggestFreeName(name, profiles) {
  const taken = new Set(profiles.map((profile) => profileNameKey(profile.name)));
  const base = name.trim().replace(/ \(\d+\)$/, '');
  for (let number = 2; ; number += 1) {
    const suffix = ` (${number})`;
    const candidate = `${Array.from(base)
      .slice(0, MAX_PROFILE_NAME_LENGTH - suffix.length)
      .join('')
      .trimEnd()}${suffix}`;
    if (!taken.has(profileNameKey(candidate)) && !isReservedName(candidate)) return candidate;
  }
}
