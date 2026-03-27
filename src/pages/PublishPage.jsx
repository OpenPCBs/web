import { Show, SignInButton, SignUpButton, useUser } from '@clerk/react';
import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import FilePreview from '../components/FilePreview';
import { buildFilePreview } from '../lib/filePreview';

const initialFormState = {
  title: '',
  author: '',
  tool: 'KiCad',
  license: 'CERN-OHL-S',
  summary: '',
  description: '',
  tags: '',
  category: '',
};

function PublishPage({ onPublishProject, isSupabaseConfigured }) {
  const { user } = useUser();
  const navigate = useNavigate();
  const [formState, setFormState] = useState(initialFormState);
  const [archiveFile, setArchiveFile] = useState(null);
  const [preview, setPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [savedMessage, setSavedMessage] = useState('');

  useEffect(() => {
    setFormState((current) => ({
      ...current,
      author: user?.fullName || user?.username || user?.primaryEmailAddress?.emailAddress || '',
    }));
  }, [user]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormState((current) => ({ ...current, [name]: value }));
  }

  async function handleFileChange(event) {
    const file = event.target.files?.[0] || null;
    setArchiveFile(file);
    setPreview(file ? await buildFilePreview(file) : null);
  }

  async function handleSubmit(event) {
    event.preventDefault();
    setErrorMessage('');
    setSavedMessage('');
    setSaving(true);

    try {
      await onPublishProject(formState, archiveFile);
      setSavedMessage('Project published successfully. Redirecting to dashboard…');
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
          <h1>Create a public project page</h1>
          <p>Upload a real board file, preview it before publishing, and store project metadata in Supabase.</p>

          <div className="callout-card">
            <strong>Preview support</strong>
            <p>Images and PDFs embed directly. Individual Gerber, drill, KiCad schematic, and KiCad board files get an in-browser preview. Zip bundles still upload normally.</p>
          </div>

          {!isSupabaseConfigured ? (
            <div className="status-banner status-banner-warning">
              Add <code>VITE_SUPABASE_URL</code> and <code>VITE_SUPABASE_PUBLISHABLE_KEY</code> before publishing.
            </div>
          ) : null}

          <Show when="signed-out">
            <div className="callout-card auth-callout">
              <strong>Sign in before publishing</strong>
              <p>This page requires a signed-in Clerk session so the project can be linked to its owner.</p>
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
                <input required name="title" value={formState.title} onChange={handleChange} placeholder="BurnVinyl RFID Reader Baseboard" />
              </label>
              <label>
                <span>Author</span>
                <input required name="author" value={formState.author} onChange={handleChange} placeholder="Your name or team" />
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
              <textarea required name="summary" value={formState.summary} onChange={handleChange} rows="3" placeholder="What the board does and why someone would want to reuse it." />
            </label>

            <label>
              <span>Detailed description</span>
              <textarea name="description" value={formState.description} onChange={handleChange} rows="5" placeholder="Architecture, power rails, interfaces, stack-up, assembly notes, known constraints..." />
            </label>

            <div className="form-grid">
              <label>
                <span>Tags</span>
                <input name="tags" value={formState.tags} onChange={handleChange} placeholder="RFID, audio, Linux SBC" />
              </label>
              <label>
                <span>Category</span>
                <input name="category" value={formState.category} onChange={handleChange} placeholder="RF, Audio, Power" />
              </label>
            </div>

            <label>
              <span>Project file or archive</span>
              <input type="file" accept=".zip,.gbr,.gtl,.gbl,.gto,.gbo,.drl,.txt,.kicad_pcb,.kicad_sch,.sch,.pcbdoc,.prjpcb,.pdf,.png,.jpg,.jpeg,.webp,.svg" onChange={handleFileChange} />
            </label>

            {preview ? <FilePreview preview={preview} /> : null}
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
