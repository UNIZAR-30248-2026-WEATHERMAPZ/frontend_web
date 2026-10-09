import { AuthScreen } from './AuthScreen.jsx';
import { useAuth } from './AuthProvider.jsx';

// Without a session the rest of the application is not rendered: the login screen replaces it.
export function AuthGate({ children }) {
  const { status } = useAuth();

  if (status === 'checking') {
    return (
      <main className="auth-page">
        <p className="auth-loading" role="status">
          Comprobando tu sesión…
        </p>
      </main>
    );
  }

  if (status !== 'authenticated') return <AuthScreen />;

  return children;
}
