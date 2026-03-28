import { Show, SignInButton, SignUpButton } from '@clerk/react';
import { Link } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import FeatureCard from '../components/FeatureCard';
import StatCard from '../components/StatCard';

const features = [
  {
    eyebrow: 'Publish',
    title: 'Upload real design files',
    body: 'Publish project metadata to Supabase, attach archives or source files, and give people enough context to reuse your board quickly.',
  },
  {
    eyebrow: 'Preview',
    title: 'See what you are uploading before you publish',
    body: 'Gerber layers, KiCad text files, images, and PDFs can be inspected in-browser before they go live.',
  },
  {
    eyebrow: 'Workflow',
    title: 'Reuse-ready project handoff',
    body: 'Project pages focus on complete documentation, downloadable assets, and clear collaboration paths for teams building on your design.',
  },
];

function HomePage({ projectCount, recentProjects, isSupabaseConfigured, projectsLoading }) {
  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow hero-eyebrow">Open hardware publishing for production work</span>
            <h1>OpenPCB</h1>
            <p className="hero-copy">
              Publish boards, share manufacturing files, preview uploads before they go live,
              and keep reusable hardware projects discoverable for your team and the community.
            </p>
            <div className="hero-actions">
              <Link to="/publish" className="button button-primary">Publish a project</Link>
              <Link to="/explore" className="button button-secondary">Browse projects</Link>
            </div>
            <div className="hero-auth-row">
              <Show when="signed-out">
                <SignInButton />
                <SignUpButton />
              </Show>
            </div>
          </div>

          <div className="hero-panel">
            <div className="pcb-artboard">
              <div className="pcb-layer pcb-layer-top" />
              <div className="pcb-layer pcb-layer-middle" />
              <div className="pcb-layer pcb-layer-bottom" />
              <div className="pcb-chip chip-a" />
              <div className="pcb-chip chip-b" />
              <div className="pcb-chip chip-c" />
              <div className="trace trace-1" />
              <div className="trace trace-2" />
              <div className="trace trace-3" />
            </div>
            <div className="hero-panel-copy">
              <strong>Deployment status</strong>
              <p>
                {isSupabaseConfigured
                  ? 'The app is pointed at Supabase. Published projects, dashboard state, and archive uploads can be live once the database and bucket are ready.'
                  : 'Add your Supabase environment variables before launch so publishing, dashboards, and file storage work in production.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container stats-grid">
          <StatCard value={projectsLoading ? '…' : String(projectCount)} label="Public projects" />
          <StatCard value="Live previews" label="Upload inspection" />
          <StatCard value="Structured docs" label="Build handoff" />
          <StatCard value="Team forks" label="Collaboration" />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Why OpenPCB</span>
            <h2>Built for files people actually want to manufacture</h2>
            <p>
              The goal is not just to host projects. It is to make design handoff, reuse,
              and collaboration feel like one workflow.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => <FeatureCard key={feature.title} {...feature} />)}
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Recent projects</span>
            <h2>{recentProjects.length ? 'Latest published boards' : 'No public projects yet'}</h2>
            <p>
              {recentProjects.length
                ? 'These are the most recently published projects in the current database.'
                : 'Once projects are published, they will appear here automatically. There is no seeded demo content in production mode.'}
            </p>
          </div>
          {recentProjects.length ? (
            <div className="project-grid">
              {recentProjects.map((project) => <ProjectCard key={project.id} project={project} />)}
            </div>
          ) : (
            <div className="empty-state compact-empty-state">
              <h3>Ready for the first upload</h3>
              <p>Publish a real design to populate the homepage.</p>
              <Link className="button button-primary" to="/publish">Publish project</Link>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

export default HomePage;
