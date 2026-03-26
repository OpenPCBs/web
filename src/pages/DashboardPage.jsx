import { Show, SignInButton, SignUpButton, useUser } from '@clerk/react';
import { Link } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';

function DashboardPage({ userProjects, isSupabaseConfigured, projectsLoading, projectsError }) {
  const { user } = useUser();
  const displayName = user?.fullName || user?.username || 'OpenPCB user';

  return (
    <section className="section">
      <div className="container">
        <div className="dashboard-header">
          <div>
            <span className="eyebrow">Dashboard</span>
            <Show when="signed-in">
              <h1>{displayName}&apos;s workspace</h1>
            </Show>
            <Show when="signed-out">
              <h1>Sign in to view your workspace</h1>
            </Show>
            <p>
              Published and forked projects are now expected to live in Supabase, filtered by
              the current Clerk user.
            </p>
          </div>
          <Link className="button button-primary" to="/publish">
            Publish new project
          </Link>
        </div>

        {!isSupabaseConfigured ? (
          <div className="status-banner status-banner-warning">
            Supabase environment variables are missing, so the dashboard cannot load saved projects yet.
          </div>
        ) : null}

        {projectsError ? <div className="status-banner status-banner-error">{projectsError}</div> : null}

        <Show when="signed-out">
          <div className="empty-state">
            <h2>No account session yet</h2>
            <p>Use Clerk to sign in, then your personal dashboard will be available here.</p>
            <div className="form-actions stacked-actions centered-actions">
              <SignInButton />
              <SignUpButton />
            </div>
          </div>
        </Show>

        <Show when="signed-in">
          {projectsLoading ? (
            <div className="empty-state">
              <h2>Loading your projects</h2>
              <p>Checking Supabase for boards you published or forked.</p>
            </div>
          ) : userProjects.length === 0 ? (
            <div className="empty-state">
              <h2>No projects yet</h2>
              <p>Publish a board or fork one from the explore page to populate the dashboard.</p>
            </div>
          ) : (
            <div className="project-grid">
              {userProjects.map((project) => (
                <ProjectCard key={project.id} project={project} />
              ))}
            </div>
          )}
        </Show>
      </div>
    </section>
  );
}

export default DashboardPage;
