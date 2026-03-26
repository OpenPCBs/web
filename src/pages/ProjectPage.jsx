import { useState } from 'react';
import { Show } from '@clerk/react';
import { Link, useParams } from 'react-router-dom';

function ProjectPage({ projects, onForkProject, isSupabaseConfigured }) {
  const { projectId } = useParams();
  const project = projects.find((item) => item.id === projectId);
  const [forkMessage, setForkMessage] = useState('');
  const [forkError, setForkError] = useState('');
  const [forking, setForking] = useState(false);

  async function handleFork() {
    setForkError('');
    setForkMessage('');
    setForking(true);

    try {
      await onForkProject(project);
      setForkMessage('Fork saved to your dashboard in Supabase.');
    } catch (error) {
      setForkError(error.message || 'Unable to fork this project right now.');
    } finally {
      setForking(false);
    }
  }

  if (!project) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Project not found</h1>
          <p>That design does not exist in this MVP.</p>
          <Link className="button button-primary" to="/explore">
            Back to explore
          </Link>
        </div>
      </section>
    );
  }

  return (
    <section className="section">
      <div className="container project-detail-grid">
        <div className="project-main-panel">
          <div className="project-hero-card">
            <div className="project-badge-row">
              <span className="chip chip-muted">{project.tool}</span>
              <span className="chip">{project.license}</span>
              <span className="chip chip-muted">Updated {project.updatedAt}</span>
            </div>
            <h1>{project.title}</h1>
            <p className="project-meta">By {project.author}</p>
            <p className="project-description">{project.description}</p>

            <div className="tag-row">
              {project.tags.map((tag) => (
                <span key={tag} className="tag">
                  {tag}
                </span>
              ))}
            </div>

            {!isSupabaseConfigured ? (
              <div className="status-banner status-banner-warning">
                Forking is disabled until Supabase environment variables are added.
              </div>
            ) : null}

            {forkError ? <div className="status-banner status-banner-error">{forkError}</div> : null}
            {forkMessage ? <div className="status-banner status-banner-success">{forkMessage}</div> : null}

            <div className="cta-row">
              <Show when="signed-in">
                <button
                  className="button button-primary"
                  onClick={handleFork}
                  disabled={!isSupabaseConfigured || forking}
                >
                  {forking ? 'Forking…' : 'Fork project'}
                </button>
              </Show>
              <Show when="signed-out">
                <Link className="button button-primary" to="/login">
                  Sign in to fork
                </Link>
              </Show>
              <Link className="button button-secondary" to="/publish">
                Publish your own
              </Link>
              {project.archiveUrl ? (
                <a className="button button-secondary" href={project.archiveUrl} target="_blank" rel="noreferrer">
                  Download archive
                </a>
              ) : null}
            </div>
          </div>

          <div className="detail-block-grid">
            <div className="detail-card">
              <h3>Included files</h3>
              <ul>
                {project.files.map((file) => (
                  <li key={file}>{file}</li>
                ))}
              </ul>
            </div>
            <div className="detail-card">
              <h3>Project summary</h3>
              <p>{project.summary}</p>
              <p>
                Projects loaded from Supabase can include a design archive path, which this
                page exposes as a download button when a public archive exists.
              </p>
            </div>
          </div>
        </div>

        <aside className="project-side-panel">
          <div className="sidebar-card">
            <h3>Quick stats</h3>
            <div className="sidebar-stat">
              <span>Stars</span>
              <strong>{project.stars}</strong>
            </div>
            <div className="sidebar-stat">
              <span>Forks</span>
              <strong>{project.forks}</strong>
            </div>
            <div className="sidebar-stat">
              <span>Difficulty</span>
              <strong>{project.difficulty}</strong>
            </div>
            <div className="sidebar-stat">
              <span>Category</span>
              <strong>{project.category}</strong>
            </div>
          </div>

          <div className="sidebar-card">
            <h3>Backend notes</h3>
            <ul>
              <li>Clerk signs the user in</li>
              <li>Supabase stores project records</li>
              <li>Storage bucket can hold board archives</li>
              <li>RLS policies can restrict ownership</li>
            </ul>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ProjectPage;
