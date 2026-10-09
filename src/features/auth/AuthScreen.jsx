import { useId, useRef, useState } from 'react';

import { GOOGLE_LOGIN_URL } from '../../services/api/authApi.js';
import { useAuth } from './AuthProvider.jsx';

const FIELD_ORDER = ['name', 'email', 'password'];
const EMPTY_FORM = { name: '', email: '', password: '' };

function GoogleIcon() {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 48 48">
      <path
        fill="#EA4335"
        d="M24 9.5c3.54 0 6.71 1.22 9.21 3.6l6.85-6.85C35.9 2.38 30.47 0 24 0 14.62 0 6.51 5.38 2.56 13.22l7.98 6.19C12.43 13.72 17.74 9.5 24 9.5z"
      />
      <path
        fill="#4285F4"
        d="M46.98 24.55c0-1.57-.15-3.09-.38-4.55H24v9.02h12.94c-.58 2.96-2.26 5.48-4.78 7.18l7.73 6c4.51-4.18 7.09-10.36 7.09-17.65z"
      />
      <path
        fill="#FBBC05"
        d="M10.53 28.59c-.48-1.45-.76-2.99-.76-4.59s.27-3.14.76-4.59l-7.98-6.19C.92 16.46 0 20.12 0 24c0 3.88.92 7.54 2.56 10.78l7.97-6.19z"
      />
      <path
        fill="#34A853"
        d="M24 48c6.48 0 11.93-2.13 15.89-5.81l-7.73-6c-2.15 1.45-4.92 2.3-8.16 2.3-6.26 0-11.57-4.22-13.47-9.91l-7.98 6.19C6.51 42.62 14.62 48 24 48z"
      />
    </svg>
  );
}

function EyeIcon({ crossed }) {
  return (
    <svg aria-hidden="true" focusable="false" viewBox="0 0 24 24">
      <path d="M2 12s3.6-7 10-7 10 7 10 7-3.6 7-10 7S2 12 2 12z" />
      <circle cx="12" cy="12" r="3" />
      {crossed && <path d="M4 4l16 16" />}
    </svg>
  );
}

function FormField({ id, label, error, hint, children }) {
  const hintId = hint ? `${id}-hint` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className="auth-field">
      <label htmlFor={id}>{label}</label>
      {children({
        'aria-invalid': error ? true : undefined,
        'aria-describedby': [hintId, errorId].filter(Boolean).join(' ') || undefined,
      })}
      {hint && (
        <p className="auth-field-hint" id={hintId}>
          {hint}
        </p>
      )}
      {error && (
        <p className="auth-field-error" id={errorId}>
          {error}
        </p>
      )}
    </div>
  );
}

export function AuthScreen() {
  const { login, register, notice } = useAuth();
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState({});
  const [formError, setFormError] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const fieldRefs = useRef({});
  const id = useId();
  const isRegister = mode === 'register';

  function updateField(event) {
    const { name, value } = event.target;
    setForm((current) => ({ ...current, [name]: value }));
    setFieldErrors((current) => ({ ...current, [name]: undefined }));
  }

  function switchMode() {
    setMode(isRegister ? 'login' : 'register');
    setFieldErrors({});
    setFormError(null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setSubmitting(true);
    setFieldErrors({});
    setFormError(null);
    try {
      if (isRegister) await register(form);
      else await login({ email: form.email, password: form.password });
    } catch (error) {
      if (error.fields) {
        setFieldErrors(error.fields);
        const firstInvalid = FIELD_ORDER.find((field) => error.fields[field]);
        fieldRefs.current[firstInvalid]?.focus();
      } else {
        setFormError(error.message);
      }
      setSubmitting(false);
    }
  }

  const inputProps = (name) => ({
    id: `${id}-${name}`,
    name,
    value: form[name],
    onChange: updateField,
    ref: (element) => {
      fieldRefs.current[name] = element;
    },
  });

  return (
    <main className="auth-page">
      <section className="auth-card" aria-labelledby={`${id}-title`}>
        <header className="auth-header">
          <img className="auth-logo" src="/weathermapz-logo.png" alt="" />
          <h1 id={`${id}-title`}>WeatherMapZ</h1>
          <p>Navegación peatonal urbana</p>
        </header>

        <h2 className="auth-mode-title">{isRegister ? 'Crear cuenta' : 'Iniciar sesión'}</h2>

        {notice && !formError && (
          <p className="auth-notice" role="status">
            {notice}
          </p>
        )}

        <form className="auth-form" noValidate onSubmit={handleSubmit}>
          {isRegister && (
            <FormField id={`${id}-name`} label="Nombre" error={fieldErrors.name}>
              {(a11y) => <input {...inputProps('name')} {...a11y} autoComplete="name" />}
            </FormField>
          )}

          <FormField id={`${id}-email`} label="Correo electrónico" error={fieldErrors.email}>
            {(a11y) => (
              <input
                {...inputProps('email')}
                {...a11y}
                autoComplete="email"
                inputMode="email"
                placeholder="tu@correo.com"
                type="email"
              />
            )}
          </FormField>

          <FormField
            id={`${id}-password`}
            label="Contraseña"
            error={fieldErrors.password}
            hint={isRegister ? 'Mínimo 8 caracteres.' : undefined}
          >
            {(a11y) => (
              <div className="auth-password">
                <input
                  {...inputProps('password')}
                  {...a11y}
                  autoComplete={isRegister ? 'new-password' : 'current-password'}
                  type={showPassword ? 'text' : 'password'}
                />
                <button
                  aria-label={showPassword ? 'Ocultar contraseña' : 'Mostrar contraseña'}
                  aria-pressed={showPassword}
                  className="auth-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  type="button"
                >
                  <EyeIcon crossed={showPassword} />
                </button>
              </div>
            )}
          </FormField>

          {formError && (
            <p className="auth-form-error" role="alert">
              {formError}
            </p>
          )}

          <button className="auth-primary-button" disabled={submitting} type="submit">
            {isRegister ? 'Crear cuenta' : 'Iniciar sesión'}
          </button>
        </form>

        <div className="auth-divider" aria-hidden="true">
          <span>o</span>
        </div>

        <a className="auth-google-button" href={GOOGLE_LOGIN_URL}>
          <GoogleIcon />
          Continuar con Google
        </a>

        <p className="auth-switch">
          {isRegister ? '¿Ya tienes cuenta?' : '¿No tienes cuenta?'}{' '}
          <button className="auth-link-button" onClick={switchMode} type="button">
            {isRegister ? 'Inicia sesión' : 'Regístrate'}
          </button>
        </p>
      </section>
    </main>
  );
}
