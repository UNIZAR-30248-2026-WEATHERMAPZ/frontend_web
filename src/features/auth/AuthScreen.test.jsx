import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AuthGate } from './AuthGate.jsx';
import { useAuth } from './AuthProvider.jsx';
import { AuthScreen } from './AuthScreen.jsx';
import { UserMenu } from './UserMenu.jsx';

jest.mock('./AuthProvider.jsx', () => ({ useAuth: jest.fn() }));

describe('authentication screens', () => {
  let auth;

  beforeEach(() => {
    auth = {
      status: 'anonymous',
      user: null,
      notice: null,
      login: jest.fn().mockResolvedValue(undefined),
      register: jest.fn().mockResolvedValue(undefined),
      logout: jest.fn(),
    };
    useAuth.mockImplementation(() => auth);
  });

  describe('AuthScreen', () => {
    it('logs in with email and password', async () => {
      render(<AuthScreen />);

      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.es');
      await userEvent.type(screen.getByLabelText('Contraseña'), 'segura123');
      await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      expect(auth.login).toHaveBeenCalledWith({ email: 'ana@correo.es', password: 'segura123' });
    });

    it('registers with name, email and password', async () => {
      render(<AuthScreen />);

      await userEvent.click(screen.getByRole('button', { name: 'Regístrate' }));
      expect(screen.getByRole('heading', { name: 'Crear cuenta' })).toBeInTheDocument();
      expect(screen.getByText('Mínimo 8 caracteres.')).toBeInTheDocument();
      await userEvent.type(screen.getByLabelText('Nombre'), 'Ana');
      await userEvent.type(screen.getByLabelText('Correo electrónico'), 'ana@correo.es');
      await userEvent.type(screen.getByLabelText('Contraseña'), 'segura123');
      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      expect(auth.register).toHaveBeenCalledWith({
        name: 'Ana',
        email: 'ana@correo.es',
        password: 'segura123',
      });
    });

    it('shows each field error next to its field and focuses the first one', async () => {
      auth.register.mockRejectedValue(
        Object.assign(new Error('Revisa los datos marcados.'), {
          fields: {
            email: 'Introduce un correo electrónico válido.',
            password: 'La contraseña debe tener al menos 8 caracteres.',
          },
        })
      );
      render(<AuthScreen />);
      await userEvent.click(screen.getByRole('button', { name: 'Regístrate' }));

      await userEvent.click(screen.getByRole('button', { name: 'Crear cuenta' }));

      const email = screen.getByLabelText('Correo electrónico');
      expect(email).toHaveAttribute('aria-invalid', 'true');
      expect(email).toHaveAccessibleDescription('Introduce un correo electrónico válido.');
      expect(screen.getByLabelText('Contraseña')).toHaveAccessibleDescription(
        'Mínimo 8 caracteres. La contraseña debe tener al menos 8 caracteres.'
      );
      expect(email).toHaveFocus();

      await userEvent.type(email, 'a');
      expect(email).not.toHaveAttribute('aria-invalid');
    });

    it('shows a general error when the credentials are wrong', async () => {
      auth.login.mockRejectedValue(new Error('El correo o la contraseña no son correctos.'));
      render(<AuthScreen />);

      await userEvent.click(screen.getByRole('button', { name: 'Iniciar sesión' }));

      expect(screen.getByRole('alert')).toHaveTextContent(
        'El correo o la contraseña no son correctos.'
      );
      expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeEnabled();
    });

    it('toggles the password visibility', async () => {
      render(<AuthScreen />);
      const password = screen.getByLabelText('Contraseña');

      await userEvent.click(screen.getByRole('button', { name: 'Mostrar contraseña' }));
      expect(password).toHaveAttribute('type', 'text');
      await userEvent.click(screen.getByRole('button', { name: 'Ocultar contraseña' }));
      expect(password).toHaveAttribute('type', 'password');
    });

    it('offers Google login and shows notices from the session', async () => {
      auth.notice = 'No se ha podido iniciar sesión con Google. Inténtalo de nuevo.';
      render(<AuthScreen />);

      expect(screen.getByRole('link', { name: 'Continuar con Google' })).toHaveAttribute(
        'href',
        '/api/auth/google'
      );
      expect(screen.getByRole('status')).toHaveTextContent('Google');

      await userEvent.click(screen.getByRole('button', { name: 'Regístrate' }));
      await userEvent.click(screen.getByRole('button', { name: 'Inicia sesión' }));
      expect(screen.getByRole('heading', { name: 'Iniciar sesión' })).toBeInTheDocument();
    });
  });

  describe('AuthGate', () => {
    it('shows the login screen instead of the application without a session', () => {
      render(
        <AuthGate>
          <p>Aplicación</p>
        </AuthGate>
      );

      expect(screen.queryByText('Aplicación')).not.toBeInTheDocument();
      expect(screen.getByRole('button', { name: 'Iniciar sesión' })).toBeInTheDocument();
    });

    it('waits while the session is being checked', () => {
      auth.status = 'checking';
      render(
        <AuthGate>
          <p>Aplicación</p>
        </AuthGate>
      );

      expect(screen.getByRole('status')).toHaveTextContent('Comprobando tu sesión');
      expect(screen.queryByText('Aplicación')).not.toBeInTheDocument();
    });

    it('renders the application with a session', () => {
      auth.status = 'authenticated';
      render(
        <AuthGate>
          <p>Aplicación</p>
        </AuthGate>
      );

      expect(screen.getByText('Aplicación')).toBeInTheDocument();
    });
  });

  it('UserMenu shows the user and logs out', async () => {
    auth.user = { id: 7, name: 'Ana López', email: 'ana@correo.es' };
    render(<UserMenu />);

    expect(screen.getByText('Ana López')).toHaveAttribute('title', 'ana@correo.es');
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(auth.logout).toHaveBeenCalled();
  });
});
