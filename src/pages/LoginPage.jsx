import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/react';
import { Link } from 'react-router-dom';

function LoginPage() {
  const { user } = useUser();

  return (
    <section className="section">
      <div className="container auth-shell">
        <div className="auth-card">
          <span className="eyebrow">Account</span>
          <h1>Use Clerk to access your OpenPCB workspace</h1>
          <p>
            This React + Vite app expects Clerk to provide authentication and Supabase to
            store project data. Add both sets of environment variables in <code>.env.local</code>,
            then use the buttons below.
          </p>

          <div className="form-actions stacked-actions auth-actions-block">
            <Show when="signed-out">
              <SignInButton />
              <SignUpButton />
            </Show>
            <Show when="signed-in">
              <div className="signed-in-panel">
                <UserButton />
                <div>
                  <strong>{user?.fullName || user?.username || 'Signed in'}</strong>
                  <p className="auth-subcopy">
                    You can now publish projects to Supabase and keep a per-user dashboard.
                  </p>
                </div>
              </div>
              <Link className="button button-primary" to="/dashboard">
                Go to dashboard
              </Link>
            </Show>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
