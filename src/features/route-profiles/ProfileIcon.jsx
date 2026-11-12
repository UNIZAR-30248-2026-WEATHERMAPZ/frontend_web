import { shadeSunBalance } from './shadeSun.js';

const PATHS = {
  // Lightning: only time matters.
  fastest: <path d="M13 2 4.5 13.5H11L10 22l8.5-11.5H12L13 2Z" />,
  // Tree: shade.
  shade: (
    <>
      <path d="M12 3a5 5 0 0 0-4.6 7A4.5 4.5 0 0 0 9 18.5h6a4.5 4.5 0 0 0 1.6-8.5A5 5 0 0 0 12 3Z" />
      <path d="M12 12v9" />
    </>
  ),
  sun: (
    <>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 2.5v2M12 19.5v2M2.5 12h2M19.5 12h2M5.3 5.3l1.4 1.4M17.3 17.3l1.4 1.4M5.3 18.7l1.4-1.4M17.3 6.7l1.4-1.4" />
    </>
  ),
  // Leaf: green, vegetation (PBI-10 phase B). The tree is shade.
  vegetation: (
    <>
      <path d="M5 19c0-8 5-13 14-14-1 9-6 14-14 14Z" />
      <path d="M5 19 13 11" />
    </>
  ),
  // Gusts: wind.
  wind: <path d="M3 8h11a3 3 0 1 0-3-3M3 12h16a3 3 0 1 1-3 3M3 16h8a2.5 2.5 0 1 1-2.5 2.5" />,
  // Thermometer: the route chosen with the current weather (PBI-9.1).
  recommended: (
    <>
      <path d="M10 14.5V5a2 2 0 1 1 4 0v9.5a4 4 0 1 1-4 0Z" />
      <path d="M12 9v8" />
    </>
  ),
  plus: <path d="M12 5v14M5 12h14" />,
  time: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </>
  ),
  previous: <path d="m15 5-7 7 7 7" />,
  next: <path d="m9 5 7 7-7 7" />,
  search: (
    <>
      <circle cx="11" cy="11" r="6.5" />
      <path d="m16 16 4 4" />
    </>
  ),
  edit: (
    <>
      <path d="M4 20h4L19 9a2.8 2.8 0 0 0-4-4L4 16v4Z" />
      <path d="m13.5 6.5 4 4" />
    </>
  ),
  delete: (
    <>
      <path d="M4 7h16M10 11v6M14 11v6" />
      <path d="M6 7l1 13h10l1-13M9 7V4h6v3" />
    </>
  ),
};

export function ProfileIcon({ kind }) {
  return (
    <svg className={`profile-icon profile-icon-${kind}`} viewBox="0 0 24 24" aria-hidden="true">
      {PATHS[kind]}
    </svg>
  );
}

// What a route favours: shade, sun, wind or several, and time if every weight is 0. A route with its
// own icon (the recommended one) shows only that.
export function ProfileIcons({ weights, icon = null }) {
  if (icon) {
    return (
      <span className="profile-icons">
        <ProfileIcon kind={icon} />
      </span>
    );
  }
  const balance = shadeSunBalance(weights);
  const kinds = [
    balance < 0 && 'shade',
    balance > 0 && 'sun',
    weights.wind > 0 && 'wind',
    weights.vegetation > 0 && 'vegetation',
  ].filter(Boolean);
  return (
    <span className="profile-icons">
      {(kinds.length ? kinds : ['fastest']).map((kind) => (
        <ProfileIcon key={kind} kind={kind} />
      ))}
    </span>
  );
}
