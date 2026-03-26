import { Show, SignInButton, SignUpButton } from '@clerk/react';
import { Link } from 'react-router-dom';
import ProjectCard from '../components/ProjectCard';
import FeatureCard from '../components/FeatureCard';
import StatCard from '../components/StatCard';
import { featuredProjects } from '../data/projects';

const features = [
  {
    eyebrow: 'Publish',
    title: 'Store board metadata and files in Supabase',
    body:
      'Project records now target a real Supabase table instead of local storage, and design archives can be uploaded to a storage bucket.',
  },
  {
    eyebrow: 'Explore',
    title: 'Mix starter content with live projects',
    body:
      'The explore page loads public projects from Supabase and still falls back to seeded demo boards so the UI stays usable while you build out the backend.',
  },
  {
    eyebrow: 'Fork',
    title: 'Use Clerk identity for ownership and RLS',
    body:
      'Clerk remains the sign-in layer while Supabase policies can lock inserts, updates, and private rows to the current signed-in user.',
  },
];

function HomePage({ featuredProjectCount, isSupabaseConfigured }) {
  return (
    <>
      <section className="hero-section">
        <div className="container hero-grid">
          <div>
            <span className="eyebrow hero-eyebrow">Open source PCB publishing, but usable</span>
            <h1>OpenPCB</h1>
            <p className="hero-copy">
              A React MVP for publishing, discovering, and reusing open source PCB
              designs. Clerk handles user sessions, and Supabase can now back project data
              and uploaded design archives.
            </p>
            <div className="hero-actions">
              <Link to="/publish" className="button button-primary">
                Publish a design
              </Link>
              <Link to="/explore" className="button button-secondary">
                Explore projects
              </Link>
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
              <strong>Backend state</strong>
              <p>
                {isSupabaseConfigured
                  ? 'Supabase environment variables are expected, so the app can load public projects and publish new ones once your table and bucket exist.'
                  : 'Clerk UI is wired, but Supabase environment variables still need to be added before the app can persist project data.'}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section className="section">
        <div className="container stats-grid">
          <StatCard value={String(featuredProjectCount)} label="Projects visible in app" />
          <StatCard value="5" label="Main app pages in this MVP" />
          <StatCard value="React + Vite" label="Frontend stack" />
          <StatCard value="Clerk + Supabase" label="Auth and data layers" />
        </div>
      </section>

      <section className="section">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Why OpenPCB</span>
            <h2>Built for the actual workflow of open hardware</h2>
            <p>
              Most sites either host files poorly or showcase projects without making them
              truly reusable. OpenPCB can sit between those worlds.
            </p>
          </div>
          <div className="feature-grid">
            {features.map((feature) => (
              <FeatureCard key={feature.title} {...feature} />
            ))}
          </div>
        </div>
      </section>

      <section className="section section-soft">
        <div className="container">
          <div className="section-heading">
            <span className="eyebrow">Featured designs</span>
            <h2>Starter content for the homepage</h2>
          </div>
          <div className="project-grid">
            {featuredProjects.slice(0, 3).map((project) => (
              <ProjectCard key={project.id} project={project} />
            ))}
          </div>
        </div>
      </section>
    </>
  );
}

export default HomePage;
