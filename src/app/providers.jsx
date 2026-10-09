import { AuthProvider } from '../features/auth/AuthProvider.jsx';

export function AppProviders({ children }) {
  return <AuthProvider>{children}</AuthProvider>;
}
