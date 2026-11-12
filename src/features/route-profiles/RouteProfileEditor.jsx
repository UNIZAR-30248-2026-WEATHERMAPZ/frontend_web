import { useEffect, useRef, useState } from 'react';

import { ProfileIcon } from './ProfileIcon.jsx';
import {
  MAX_PROFILE_NAME_LENGTH,
  RESERVED_NAME_MESSAGE,
  findNameConflict,
  isReservedName,
  profileNameKey,
  suggestFreeName,
} from './profileNames.js';
import {
  SHADE_SUN_MAX,
  SHADE_SUN_STEP,
  balanceSide,
  balanceText,
  shadeSunBalance,
  weightsFromBalance,
} from './shadeSun.js';

// Shade and sun share one bar (ADR-030); wind and green have their own (ADR-031).
const FACTOR_FIELDS = [
  { key: 'wind', label: 'Evitar viento', icon: 'wind' },
  { key: 'vegetation', label: 'Verde', icon: 'vegetation' },
];
// The same limit as the backend (ADR-023).
const MAX_DETOUR_PERCENTAGE = 40;

// `profiles` are the saved routes, to warn about a repeated name while typing (#165).
export function RouteProfileEditor({ profile = null, profiles = [], onSave, onReplace, onCancel }) {
  const [name, setName] = useState(profile?.name ?? '');
  const nameInput = useRef(null);
  const replaceButton = useRef(null);
  const confirmButton = useRef(null);
  // A 409 of the backend for a route the list does not have yet: { id, name, key }.
  const [serverConflict, setServerConflict] = useState(null);
  const [isConfirmingReplace, setIsConfirmingReplace] = useState(false);
  // Routes saved before PBI-8.2 come without wind: it counts as 0. A route saved with shade and sun
  // at once keeps the larger one (ADR-030).
  const [weights, setWeights] = useState(() => {
    const saved = { shade: 50, sun: 0, wind: 0, vegetation: 0, ...profile?.weights };
    return { ...saved, ...weightsFromBalance(shadeSunBalance(saved)) };
  });
  const balance = shadeSunBalance(weights);
  const [maxDetour, setMaxDetour] = useState(profile?.maxDetourPercentage ?? 25);
  const onlyTime =
    weights.shade === 0 && weights.sun === 0 && weights.wind === 0 && weights.vegetation === 0;
  const [errors, setErrors] = useState({});
  const shadeSunError = errors.shade || errors.sun;
  const [isSaving, setIsSaving] = useState(false);
  const conflict =
    findNameConflict(profiles, name, profile?.id ?? null) ??
    (serverConflict?.key === profileNameKey(name) ? serverConflict : null);
  const nameError = errors.name || (isReservedName(name) ? RESERVED_NAME_MESSAGE : '');
  // Replacing from another route moves its weights to the existing one and deletes it.
  const deletesEdited = Boolean(profile && conflict && profile.id !== conflict.id);
  const nameDescription =
    [nameError && 'route-profile-name-error', conflict && 'route-profile-name-conflict']
      .filter(Boolean)
      .join(' ') || undefined;

  // After "No reemplazar", the focus goes back to the button the question came from.
  const returnsFocus = useRef(false);
  useEffect(() => {
    if (isConfirmingReplace) {
      confirmButton.current?.focus();
    } else if (returnsFocus.current) {
      returnsFocus.current = false;
      replaceButton.current?.focus();
    }
  }, [isConfirmingReplace]);

  function changeName(value) {
    setName(value);
    setIsConfirmingReplace(false);
    if (errors.name) setErrors(({ name: _name, ...rest }) => rest);
  }

  async function submit(event) {
    event.preventDefault();
    if (!name.trim()) {
      setErrors({ name: 'Escribe un nombre para la ruta.' });
      return;
    }
    if (nameError) return;
    // The warning below the name already offers what to do: take the user there.
    if (conflict) {
      (isConfirmingReplace ? confirmButton : replaceButton).current?.focus();
      return;
    }
    setIsSaving(true);
    setErrors({});
    try {
      await onSave({ name: name.trim(), weights, maxDetourPercentage: maxDetour });
    } catch (error) {
      if (error.status === 409 && Number.isInteger(error.existingId)) {
        const existing = profiles.find(({ id }) => id === error.existingId);
        setServerConflict({
          id: error.existingId,
          name: existing?.name ?? name.trim(),
          key: profileNameKey(name),
        });
        setErrors({});
      } else {
        setErrors({ ...error.fields, form: error.fields ? '' : error.message });
      }
      setIsSaving(false);
    }
  }

  async function replace() {
    setIsSaving(true);
    setErrors({});
    try {
      await onReplace(
        conflict.id,
        { name: conflict.name, weights, maxDetourPercentage: maxDetour },
        deletesEdited ? profile.id : null
      );
    } catch (error) {
      setErrors({ form: error.message });
      setIsConfirmingReplace(false);
      setIsSaving(false);
    }
  }

  function rename() {
    setName(suggestFreeName(name, profiles));
    setServerConflict(null);
    setIsConfirmingReplace(false);
    nameInput.current?.focus();
  }

  function cancelReplace() {
    returnsFocus.current = true;
    setIsConfirmingReplace(false);
  }

  return (
    <form className="route-profile-editor" onSubmit={submit} noValidate>
      <label className="route-profile-name">
        Nombre
        <input
          ref={nameInput}
          value={name}
          maxLength={MAX_PROFILE_NAME_LENGTH}
          placeholder="Por ejemplo, Verano"
          aria-invalid={Boolean(nameError || conflict)}
          aria-describedby={nameDescription}
          onChange={(event) => changeName(event.target.value)}
        />
      </label>
      {nameError && (
        <p id="route-profile-name-error" className="field-error">
          {nameError}
        </p>
      )}
      {/* Always present, so that screen readers announce the warning when it appears. */}
      <div className="name-conflict-live" aria-live="polite">
        {conflict && (
          <p id="route-profile-name-conflict" className="field-error">
            Ya tienes una ruta llamada «{conflict.name}».
          </p>
        )}
      </div>
      {conflict && !isConfirmingReplace && (
        <div className="name-conflict-actions">
          <button
            ref={replaceButton}
            type="button"
            className="secondary-button"
            disabled={isSaving || !onReplace}
            onClick={() => setIsConfirmingReplace(true)}
          >
            Reemplazar
          </button>
          <button type="button" className="secondary-button" disabled={isSaving} onClick={rename}>
            Cambiar nombre
          </button>
        </div>
      )}
      {conflict && isConfirmingReplace && (
        <div
          className="name-conflict-confirm"
          role="group"
          aria-labelledby="route-profile-replace-question"
        >
          <p id="route-profile-replace-question">
            Se sustituirán los pesos de «{conflict.name}»
            {deletesEdited ? ` y se borrará «${profile.name}»` : ''}.
          </p>
          <div className="name-conflict-actions">
            <button
              type="button"
              className="secondary-button"
              disabled={isSaving}
              onClick={cancelReplace}
            >
              No reemplazar
            </button>
            <button
              ref={confirmButton}
              type="button"
              className="profile-dialog-danger"
              disabled={isSaving}
              onClick={replace}
            >
              {isSaving ? 'Guardando...' : `Reemplazar «${conflict.name}»`}
            </button>
          </div>
        </div>
      )}
      {/* One bar: shade to the left, neutral in the middle, sun to the right (ADR-030). */}
      <div className="route-profile-weight route-profile-weight-shade-sun">
        <span>
          <ProfileIcon kind={balance > 0 ? 'sun' : 'shade'} />
          <label htmlFor="route-profile-shade-sun">Sombra o sol</label>
          <output htmlFor="route-profile-shade-sun">{balanceText(balance)}</output>
        </span>
        <span className="shade-sun-ends" aria-hidden="true">
          <span>
            <ProfileIcon kind="shade" />
            Sombra
          </span>
          <span>
            Sol
            <ProfileIcon kind="sun" />
          </span>
        </span>
        <input
          id="route-profile-shade-sun"
          className={`shade-sun-range is-${balanceSide(balance)}`}
          type="range"
          min={-SHADE_SUN_MAX}
          max={SHADE_SUN_MAX}
          step={SHADE_SUN_STEP}
          value={balance}
          aria-valuetext={balanceText(balance)}
          aria-invalid={Boolean(shadeSunError)}
          onChange={(event) =>
            setWeights((current) => ({
              ...current,
              ...weightsFromBalance(Number(event.target.value)),
            }))
          }
        />
        {shadeSunError && <small className="field-error">{shadeSunError}</small>}
      </div>
      {FACTOR_FIELDS.map(({ key, label, icon }) => (
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
            ? 'Con sombra y sol en neutro y el viento y el verde a 0 % es la ruta más rápida: no hay rodeo.'
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
