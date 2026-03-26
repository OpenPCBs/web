import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/react';
import { NavLink, Link } from 'react-router-dom';

const navItems = [
  { to: '/', label: 'Home' },
  { to: '/explore', label: 'Explore' },
  { to: '/publish', label: 'Publish' },
  { to: '/dashboard', label: 'Dashboard' },
  { to: '/login', label: 'Account' },
];

function Navbar() {
  const { user } = useUser();

  return (
    <header className="site-header">
      <div className="container nav-shell">
        <Link to="/" className="brand-mark" aria-label="OpenPCB home">
          <span className="brand-icon">◫</span>
          <div>
            <strong>OpenPCB</strong>
            <span>Open source hardware, made reusable</span>
          </div>
        </Link>

        <nav className="nav-links">
          {navItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                isActive ? 'nav-link nav-link-active' : 'nav-link'
              }
            >
              {item.label}
            </NavLink>
          ))}
        </nav>

        <div className="nav-auth-area">
          <div className="nav-user-chip">
            <Show when="signed-out">
              <span>Guest mode</span>
            </Show>
            <Show when="signed-in">
              <>
                <span className="status-dot" />
                <span>{user?.fullName || user?.username || 'Signed in'}</span>
              </>
            </Show>
          </div>

          <div className="auth-inline-actions">
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <UserButton />
            </Show>
          </div>
        </div>
      </div>
    </header>
  );
}

export default Navbar;
