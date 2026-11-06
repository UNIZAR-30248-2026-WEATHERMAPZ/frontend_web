import { useState } from 'react';

import { ProfileIcon } from './ProfileIcon.jsx';

const MAX_NAME_LENGTH = 40;
const WEIGHT_FIELDS = [
  { key: 'shade', label: 'Sombra', icon: 'shade' },
  { key: 'sun', label: 'Sol', icon: 'sun' },
  { key: 'wind', label: 'Evitar viento', icon: 'wind' },
];
// The same limit as the backend (ADR-023).
const MAX_DETOUR_PERCENTAGE = 40;

export function RouteProfileEditor({ profile = null, onSave, onCancel }) {
  const [name, setName] = useState(profile?.name ?? '');
  // Routes saved before PBI-8.2 come without wind: it counts as 0.
  const [weights, setWeights] = useState({ shade: 50, sun: 0, wind: 0, ...profile?.weights });
  const [maxDetour, setMaxDetour] = useState(profile?.maxDetourPercentage ?? 25);
  const onlyTime = weights.shade === 0 && weights.sun === 0 && weights.wind === 0;
  const [errors, setErrors] = useState({});
  const [isSaving, setIsSaving] = useState(false);

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Escribe un nombre para la ruta.' });
      return;
    }
    setIsSaving(true);
    setErrors({});
    try {
      await onSave({ name: name.trim(), weights, maxDetourPercentage: maxDetour });
    } catch (error) {
      setErrors({ ...error.fields, form: error.fields ? '' : error.message });
      setIsSaving(false);
    }
  }

  return (
    <form className="route-profile-editor" onSubmit={submit} noValidate>
      <label className="route-profile-name">
        Nombre
        <input
          value={name}
          maxLength={MAX_NAME_LENGTH}
          placeholder="Por ejemplo, Verano"
          aria-invalid={Boolean(errors.name)}
          aria-describedby={errors.name ? 'route-profile-name-error' : undefined}
          onChange={(event) => setName(event.target.value)}
        />
      </label>
      {errors.name && (
        <p id="route-profile-name-error" className="field-error">
          {errors.name}
        </p>
      )}
      {WEIGHT_FIELDS.map(({ key, label, icon }) => (
        // An <output> inside the label would take the label instead of the slider.
        <div key={key} className={`route-profile-weight route-profile-weight-${key}`}>
          <span>
            <ProfileIcon kind={icon} />
            <label htmlFor={`route-profile-${key}`}>{label}</label>
            <output htmlFor={`route-profile-${key}`}>{weights[key]} %</output>
          </span>
          <input
            id={`route-profile-${key}`}
            type="range"
            min="0"
            max="100"
            step="5"
            value={weights[key]}
            aria-valuetext={`${weights[key]} %`}
            onChange={(event) =>
              setWeights((current) => ({ ...current, [key]: Number(event.target.value) }))
            }
          />
          {errors[key] && <small className="field-error">{errors[key]}</small>}
        </div>
      ))}
      <div className="route-profile-weight route-profile-weight-time">
        <span>
          <ProfileIcon kind="time" />
          <label htmlFor="route-profile-detour">Tiempo extra máximo</label>
          <output htmlFor="route-profile-detour">+{maxDetour} %</output>
        </span>
        <input
          id="route-profile-detour"
          type="range"
          min="0"
          max={MAX_DETOUR_PERCENTAGE}
          step="5"
          value={maxDetour}
          disabled={onlyTime}
          aria-valuetext={`${maxDetour} % más de tiempo`}
          aria-describedby="route-profile-detour-help"
          onChange={(event) => setMaxDetour(Number(event.target.value))}
        />
        <small id="route-profile-detour-help" className="route-profile-help">
          {onlyTime
            ? 'Con sombra, sol y viento a 0 % es la ruta más rápida: no hay rodeo.'
            : `Cuánto más puede tardar que la ruta más rápida: con +${maxDetour} %, un paseo de 20 min puede durar hasta ${Math.floor(20 * (1 + maxDetour / 100))} min.`}
        </small>
        {errors.maxDetourPercentage && (
          <small className="field-error">{errors.maxDetourPercentage}</small>
        )}
      </div>
      {errors.form && (
        <p className="form-message form-message-error" role="alert">
          {errors.form}
        </p>
      )}
      <div className="profile-dialog-actions">
        <button type="button" className="secondary-button" disabled={isSaving} onClick={onCancel}>
          Cancelar
        </button>
        <button type="submit" className="profile-dialog-confirm" disabled={isSaving}>
          {isSaving ? 'Guardando...' : 'Guardar'}
        </button>
      </div>
    </form>
  );
}
