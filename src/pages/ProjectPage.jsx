import { useMemo, useState } from 'react';
import { Show, useUser } from '@clerk/react';
import { Link, useParams } from 'react-router-dom';
import { createStripeCheckout, fetchFabricationQuote } from '../services/orders';
import { hasServerIntegrations } from '../lib/env';

const initialQuoteForm = {
  boardWidthMm: '100',
  boardHeightMm: '80',
  layers: '4',
  quantity: '5',
  thicknessMm: '1.6',
  assembly: false,
};

function ProjectPage({ projects, onForkProject, isSupabaseConfigured }) {
  const { user } = useUser();
  const { projectId } = useParams();
  const project = projects.find((item) => item.id === projectId);
  const [forkMessage, setForkMessage] = useState('');
  const [forkError, setForkError] = useState('');
  const [forking, setForking] = useState(false);
  const [quoteForm, setQuoteForm] = useState(initialQuoteForm);
  const [quoteState, setQuoteState] = useState({ loading: false, error: '', provider: '', quote: null });
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const quotePayload = useMemo(() => ({
    projectId: project?.dbId || project?.id,
    projectTitle: project?.title,
    archiveUrl: project?.archiveUrl || null,
    quote: {
      boardWidthMm: Number(quoteForm.boardWidthMm),
      boardHeightMm: Number(quoteForm.boardHeightMm),
      layers: Number(quoteForm.layers),
      quantity: Number(quoteForm.quantity),
      thicknessMm: Number(quoteForm.thicknessMm),
      assembly: Boolean(quoteForm.assembly),
    },
  }), [project, quoteForm]);

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

  async function handleQuote(provider) {
    setQuoteState({ loading: true, error: '', provider, quote: null });
    try {
      const quote = await fetchFabricationQuote(provider, quotePayload);
      setQuoteState({ loading: false, error: '', provider, quote });
    } catch (error) {
      setQuoteState({ loading: false, error: error.message || 'Could not fetch a quote.', provider, quote: null });
    }
  }

  async function handleCheckout() {
    if (!quoteState.quote) return;
    setCheckoutLoading(true);
    try {
      await createStripeCheckout({
        projectId: project.id,
        projectTitle: project.title,
        provider: quoteState.provider,
        quote: quoteState.quote,
        customerEmail: user?.primaryEmailAddress?.emailAddress || undefined,
      });
    } catch (error) {
      setQuoteState((current) => ({ ...current, error: error.message || 'Could not start checkout.' }));
      setCheckoutLoading(false);
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
            <span className="eyebrow">Fabrication</span>
            <h3>Get a manufacturing quote</h3>
            <p>Use the project page to request a JLCPCB or PCBWay quote, then launch a Stripe checkout for the selected order.</p>

            {!hasServerIntegrations() ? (
              <div className="status-banner status-banner-warning">
                Add <code>VITE_SUPABASE_FUNCTIONS_URL</code> and deploy the included Supabase Edge Functions to enable live quoting and checkout.
              </div>
            ) : null}

            <div className="quote-form-grid">
              <label>
                <span>Width (mm)</span>
                <input value={quoteForm.boardWidthMm} onChange={(e) => setQuoteForm((c) => ({ ...c, boardWidthMm: e.target.value }))} />
              </label>
              <label>
                <span>Height (mm)</span>
                <input value={quoteForm.boardHeightMm} onChange={(e) => setQuoteForm((c) => ({ ...c, boardHeightMm: e.target.value }))} />
              </label>
              <label>
                <span>Layers</span>
                <input value={quoteForm.layers} onChange={(e) => setQuoteForm((c) => ({ ...c, layers: e.target.value }))} />
              </label>
              <label>
                <span>Quantity</span>
                <input value={quoteForm.quantity} onChange={(e) => setQuoteForm((c) => ({ ...c, quantity: e.target.value }))} />
              </label>
              <label>
                <span>Thickness (mm)</span>
                <input value={quoteForm.thicknessMm} onChange={(e) => setQuoteForm((c) => ({ ...c, thicknessMm: e.target.value }))} />
              </label>
              <label className="checkbox-field">
                <span>Assembly</span>
                <input type="checkbox" checked={quoteForm.assembly} onChange={(e) => setQuoteForm((c) => ({ ...c, assembly: e.target.checked }))} />
              </label>
            </div>

            <div className="form-actions">
              <button className="button button-secondary" type="button" onClick={() => handleQuote('jlcpcb')} disabled={quoteState.loading}>JLCPCB quote</button>
              <button className="button button-secondary" type="button" onClick={() => handleQuote('pcbway')} disabled={quoteState.loading}>PCBWay quote</button>
            </div>

            {quoteState.loading ? <div className="status-banner">Fetching {quoteState.provider} quote…</div> : null}
            {quoteState.error ? <div className="status-banner status-banner-error">{quoteState.error}</div> : null}

            {quoteState.quote ? (
              <div className="quote-result-card">
                <p className="quote-provider">{quoteState.provider.toUpperCase()}</p>
                <h4>{quoteState.quote.currency} {quoteState.quote.total}</h4>
                <div className="preview-pill-row">
                  {(quoteState.quote.breakdown || []).map((item) => <span key={item.label + item.amount} className="tag">{item.label}: {item.amount}</span>)}
                </div>
                {quoteState.quote.turnaround ? <p className="project-meta">Estimated turnaround: {quoteState.quote.turnaround}</p> : null}
                <button className="button button-primary" type="button" onClick={handleCheckout} disabled={checkoutLoading}>
                  {checkoutLoading ? 'Opening checkout…' : 'Checkout with Stripe'}
                </button>
              </div>
            ) : null}
          </div>
        </aside>
      </div>
    </section>
  );
}

export default ProjectPage;
