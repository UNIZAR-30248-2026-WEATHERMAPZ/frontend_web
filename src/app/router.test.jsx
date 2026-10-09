import { render, screen } from '@testing-library/react';

import { Router } from './router.jsx';

jest.mock('./App.jsx', () => ({
  App: ({ headerActions }) => <div>Application route {headerActions}</div>,
}));

jest.mock('../features/auth/AuthGate.jsx', () => ({
  AuthGate: ({ children }) => <div data-testid="auth-gate">{children}</div>,
}));

jest.mock('../features/auth/UserMenu.jsx', () => ({
  UserMenu: () => <span>User menu</span>,
}));

describe('Router', () => {
  it('renders the application behind the authentication gate with the user menu', () => {
    render(<Router />);

    expect(screen.getByTestId('auth-gate')).toHaveTextContent('Application route');
    expect(screen.getByText('User menu')).toBeInTheDocument();
  });
});
