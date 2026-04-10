import { useState } from 'react';
import { Show, useUser } from '@clerk/react';
import { Link, useParams } from 'react-router-dom';

function ProjectPage({ projects, onForkProject, isSupabaseConfigured }) {
  const { user } = useUser();
  const { projectId } = useParams();
  const project = projects.find((item) => item.id === projectId);
  const [forkMessage, setForkMessage] = useState('');
  const [forkError, setForkError] = useState('');
  const [forking, setForking] = useState(false);

  if (!project) {
    return (
      <section className="section">
        <div className="container empty-state">
          <h1>Project not found</h1>
          <p>This project is not in the current public catalog.</p>
          <Link className="button button-primary" to="/explore">Back to explore</Link>
        </div>
      </section>
    );
  }

  async function handleFork() {
    setForkError('');
    setForkMessage('');
    setForking(true);

    try {
      await onForkProject(project);
      setForkMessage('Fork saved to your dashboard.');
    } catch (error) {
      setForkError(error.message || 'Unable to fork this project right now.');
    } finally {
      setForking(false);
    }
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
              {project.tags.map((tag) => <span key={tag} className="tag">{tag}</span>)}
            </div>

            <div className="project-stats detail-stats">
              <span>★ {project.stars}</span>
              <span>Forks {project.forks}</span>
              <span>{project.category}</span>
            </div>

            <div className="form-actions">
              {project.archiveUrl ? (
                <a className="button button-primary" href={project.archiveUrl} target="_blank" rel="noreferrer">Download files</a>
              ) : null}
              <Show when="signed-in">
                <button className="button button-secondary" type="button" onClick={handleFork} disabled={!isSupabaseConfigured || forking}>
                  {forking ? 'Forking…' : 'Fork project'}
                </button>
              </Show>
            </div>

            {forkMessage ? <div className="status-banner status-banner-success">{forkMessage}</div> : null}
            {forkError ? <div className="status-banner status-banner-error">{forkError}</div> : null}
          </div>
        </div>

        <aside className="project-sidebar">
          <div className="sidebar-card">
            <span className="eyebrow">Files</span>
            <h3>Available assets</h3>
            <div className="file-list">
              {project.files.map((file) => <span key={file} className="file-row">{file}</span>)}
            </div>
          </div>

          <div className="sidebar-card">
            <span className="eyebrow">Build notes</span>
            <h3>Before you fabricate this board</h3>
            <p>
              Review stack-up, tolerances, and assembly assumptions with your preferred manufacturer.
              OpenPCB provides project documentation and downloadable production files.
            </p>
            <ul>
              <li>Open the source design and run your own DRC/ERC checks.</li>
              <li>Validate drill sizes, copper weight, and finish requirements.</li>
              <li>Confirm BOM substitutions and assembly constraints.</li>
              <li>Attach your own procurement workflow outside this project page.</li>
            </ul>
            {!isSupabaseConfigured ? (
              <div className="status-banner status-banner-warning">
                Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to enable saving forks and edits.
              </div>
            ) : null}
          </div>

          <div className="sidebar-card">
            <span className="eyebrow">Owner</span>
            <h3>Collaboration</h3>
            <p>
              Signed in as <strong>{user?.fullName || user?.username || 'guest'}</strong>. Fork this project to keep your own revision trail.
            </p>
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ProjectPage;
