import { NavLink, Outlet } from 'react-router-dom';

const navItems = [
  { to: '/explore', label: 'Explore' },
  { to: '/publish', label: 'Publish' },
  { to: '/dashboard', label: 'Dashboard' },
];

function Layout() {
  return (
    <div className="app-shell">
      <header className="site-header">
        <div className="container header-row">
          <NavLink to="/" className="brand-mark">
            <span className="brand-icon">⌁</span>
            <span>
              <strong>OpenPCB</strong>
              <small>Open hardware, forkable by default</small>
            </span>
          </NavLink>

          <nav className="nav-links" aria-label="Primary">
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

          <div className="header-actions">
            <NavLink to="/login" className="button button-ghost">
              Sign in
            </NavLink>
            <NavLink to="/publish" className="button button-primary">
              Publish a PCB
            </NavLink>
          </div>
        </div>
      </header>

      <main>
        <Outlet />
      </main>

      <footer className="site-footer">
        <div className="container footer-grid">
          <div>
            <h3>OpenPCB</h3>
            <p>
              A React MVP for publishing open-source PCB designs, browsing reusable
              boards, and making hardware more forkable.
            </p>
          </div>
          <div>
            <h4>Core ideas</h4>
            <ul>
              <li>Public project pages</li>
              <li>Build-ready files</li>
              <li>Version history</li>
              <li>KiCad / Altium integrations</li>
            </ul>
          </div>
          <div>
            <h4>Suggested backend</h4>
            <ul>
              <li>React + Vite frontend</li>
              <li>Supabase auth + storage</li>
              <li>Postgres project metadata</li>
              <li>Edge functions for file parsing</li>
            </ul>
          </div>
        </div>
      </footer>
    </div>
  );
}

export default Layout;
