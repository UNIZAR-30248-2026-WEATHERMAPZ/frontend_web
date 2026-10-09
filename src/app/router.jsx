import { AuthGate } from '../features/auth/AuthGate.jsx';
import { UserMenu } from '../features/auth/UserMenu.jsx';
import { App } from './App.jsx';

export function Router() {
  return (
    <AuthGate>
      <App headerActions={<UserMenu />} />
    </AuthGate>
  );
}
