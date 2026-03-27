import { Show, SignInButton, SignUpButton, UserButton, useUser } from '@clerk/react';
import { Link } from 'react-router-dom';

function LoginPage() {
  const { user } = useUser();

  return (
    <section className="section">
      <div className="container auth-shell">
        <div className="auth-card">
          <span className="eyebrow">Account</span>
          <h1>Access your OpenPCB workspace</h1>
          <p>Use Clerk to sign in, publish projects, manage your dashboard, and start fabrication orders from your project pages.</p>

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
                  <p className="auth-subcopy">Your account is ready to publish and manage projects.</p>
                </div>
              </div>
              <Link className="button button-primary" to="/dashboard">Go to dashboard</Link>
            </Show>
          </div>
        </div>
      </div>
    </section>
  );
}

export default LoginPage;
