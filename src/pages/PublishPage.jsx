import { Show, SignInButton, SignUpButton, useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';

const initialForm = {
  title: '',
  author: '',
  summary: '',
  description: '',
  tool: 'KiCad',
  license: 'CERN-OHL-S',
  tags: '',
  category: 'General',
};

function PublishPage({ onPublishProject, isSupabaseConfigured }) {
  const navigate = useNavigate();
  const { user } = useUser();
  const [formState, setFormState] = useState(initialForm);
  const [archiveFile, setArchiveFile] = useState(null);
  const [savedMessage, setSavedMessage] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      author:
        user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || '',
    }));
  }, [user]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setSavedMessage('');
    setSaving(true);

    try {
      await onPublishProject(formState, archiveFile);
      setSavedMessage('Project saved to Supabase. Redirecting to dashboard...');
      setTimeout(() => navigate('/dashboard'), 700);
    } catch (error) {
      setErrorMessage(error.message || 'Could not publish this project.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="section">
      <div className="container publish-layout">
        <div className="section-heading compact-heading publish-copy">
          <span className="eyebrow">Publish</span>
          <h1>Create a public project page for your PCB</h1>
          <p>
            This form now targets Supabase for project metadata and can upload a design
            archive to storage.
          </p>
          <div className="callout-card">
            <strong>Supabase requirements</strong>
            <p>
              Run the included SQL file, create the <code>project-archives</code> bucket,
              and finish the Clerk-to-Supabase auth integration before publishing.
            </p>
          </div>

          {!isSupabaseConfigured ? (
            <div className="status-banner status-banner-warning">
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> to <code>.env.local</code> before publishing.
            </div>
          ) : null}

          <Show when="signed-out">
            <div className="callout-card auth-callout">
              <strong>Sign in before publishing</strong>
              <p>
                This page uses Clerk auth. Sign in or create an account, then come back to
                publish your design.
              </p>
              <div className="form-actions stacked-actions">
                <SignInButton />
                <SignUpButton />
              </div>
            </div>
          </Show>
        </div>

        <Show when="signed-in">
          <form className="publish-form" onSubmit={handleSubmit}>
            <div className="form-grid">
              <label>
                <span>Project title</span>
                <input
                  required
                  name="title"
                  value={formState.title}
                  onChange={handleChange}
                  placeholder="BurnVinyl RFID Reader Baseboard"
                />
              </label>

              <label>
                <span>Author</span>
                <input
                  required
                  name="author"
                  value={formState.author}
                  onChange={handleChange}
                  placeholder="Your name or lab"
                />
              </label>

              <label>
                <span>EDA tool</span>
                <select name="tool" value={formState.tool} onChange={handleChange}>
                  <option>KiCad</option>
                  <option>Altium</option>
                </select>
              </label>

              <label>
                <span>License</span>
                <select name="license" value={formState.license} onChange={handleChange}>
                  <option>CERN-OHL-S</option>
                  <option>CERN-OHL-W</option>
                  <option>MIT</option>
                  <option>Apache-2.0</option>
                  <option>GPL-3.0</option>
                </select>
              </label>
            </div>

            <label>
              <span>Short summary</span>
              <textarea
                required
                name="summary"
                value={formState.summary}
                onChange={handleChange}
                rows="3"
                placeholder="What does this board do, and why is it useful?"
              />
            </label>

            <label>
              <span>Detailed description</span>
              <textarea
                name="description"
                value={formState.description}
                onChange={handleChange}
                rows="5"
                placeholder="Blocks, intended use, stack-up, power sections, RF considerations, notes for remixers..."
              />
            </label>

            <div className="form-grid">
              <label>
                <span>Tags</span>
                <input
                  name="tags"
                  value={formState.tags}
                  onChange={handleChange}
                  placeholder="RFID, 915 MHz, Linux SBC, Audio"
                />
              </label>
              <label>
                <span>Category</span>
                <input
                  name="category"
                  value={formState.category}
                  onChange={handleChange}
                  placeholder="RF, Audio, Power..."
                />
              </label>
            </div>

            <label>
              <span>Project archive (zip, Gerbers, or design bundle)</span>
              <input
                type="file"
                accept=".zip,.kicad_pro,.kicad_pcb,.kicad_sch,.sch,.pcbdoc,.prjpcb,.rar,.7z,.pdf"
                onChange={(event) => setArchiveFile(event.target.files?.[0] || null)}
              />
            </label>

            {errorMessage ? <div className="status-banner status-banner-error">{errorMessage}</div> : null}
            {savedMessage ? <div className="status-banner status-banner-success">{savedMessage}</div> : null}

            <div className="form-actions">
              <button className="button button-primary" type="submit" disabled={!isSupabaseConfigured || saving}>
                {saving ? 'Publishing…' : 'Publish project'}
              </button>
              {archiveFile ? <span className="saved-message">{archiveFile.name}</span> : null}
            </div>
          </form>
        </Show>
      </div>
    </section>
  );
}

export default PublishPage;
