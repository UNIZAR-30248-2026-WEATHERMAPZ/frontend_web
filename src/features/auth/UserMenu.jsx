import { useAuth } from './AuthProvider.jsx';

export function UserMenu() {
  const { user, logout } = useAuth();

  return (
    <div className="user-menu">
      <span className="user-menu-name" title={user.email}>
        {user.name}
      </span>
      <button className="user-menu-logout" onClick={logout} type="button">
        Cerrar sesión
      </button>
    </div>
  );
}
