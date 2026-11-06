import { useEffect, useRef, useState } from 'react';

import { ProfileIcon, ProfileIcons } from './ProfileIcon.jsx';

const FACTOR_LABELS = { shade: 'Sombra', sun: 'Sol', wind: 'Evitar viento' };

// One line per factor that counts, so a new factor (wind) is one more line, not a longer one.
export function weightsSummary({ weights, maxDetourPercentage }) {
  const lines = Object.entries(FACTOR_LABELS)
    .filter(([factor]) => weights[factor] > 0)
    .map(([factor, label]) => `${label} ${weights[factor]} %`);
  if (!lines.length) return ['Lo antes posible'];
  return [...lines, `Tiempo +${maxDetourPercentage} %`];
}

// Row of route cards that can be dragged. The arrows only appear on the side where some card is
// cut, and move the row one card at a time.
export function ProfileCarousel({ profiles, selectedId, onSelect }) {
  const listRef = useRef(null);
  const [overflow, setOverflow] = useState({ before: false, after: false });

  useEffect(() => {
    const list = listRef.current;
    if (!list) return undefined;
    const update = () =>
      setOverflow({
        before: list.scrollLeft > 1,
        after: list.scrollLeft + list.clientWidth < list.scrollWidth - 1,
      });
    const frame = window.requestAnimationFrame(update);
    const observer = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(update);
    observer?.observe(list);
    list.addEventListener('scroll', update, { passive: true });
    return () => {
      window.cancelAnimationFrame(frame);
      observer?.disconnect();
      list.removeEventListener('scroll', update);
    };
  }, [profiles.length]);

  // The chosen card is always visible, also after choosing it from "Ver todas".
  useEffect(() => {
    listRef.current
      ?.querySelector('.is-active')
      ?.scrollIntoView?.({ block: 'nearest', inline: 'nearest' });
  }, [selectedId]);

  function move(direction) {
    const list = listRef.current;
    const card = list.querySelector('button');
    list.scrollBy?.({
      left: direction * (card?.offsetWidth ?? 100) + direction * 6,
      behavior: 'smooth',
    });
  }

  return (
    <div className="route-profile-carousel">
      {/* The cards can also be reached with Tab: the arrows are only a help for the eyes. */}
      {overflow.before && (
        <button
          type="button"
          className="route-profile-arrow route-profile-arrow-before"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => move(-1)}
        >
          <ProfileIcon kind="previous" />
        </button>
      )}
      <div ref={listRef} className="route-profile-list">
        {profiles.map((profile) => (
          <button
            key={profile.id}
            type="button"
            className={profile.id === selectedId ? 'is-active' : ''}
            aria-pressed={profile.id === selectedId}
            aria-label={profile.name}
            onClick={() => onSelect(profile.id)}
          >
            <ProfileIcons weights={profile.weights} />
            <strong>{profile.name}</strong>
            <span className="route-profile-summary" aria-hidden="true">
              {weightsSummary(profile).map((line) => (
                <small key={line}>{line}</small>
              ))}
            </span>
          </button>
        ))}
      </div>
      {overflow.after && (
        <button
          type="button"
          className="route-profile-arrow route-profile-arrow-after"
          aria-hidden="true"
          tabIndex={-1}
          onClick={() => move(1)}
        >
          <ProfileIcon kind="next" />
        </button>
      )}
    </div>
  );
}
