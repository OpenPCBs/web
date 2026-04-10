import React from 'react';
import ReactDOM from 'react-dom/client';
import { HashRouter } from 'react-router-dom';
import { ClerkProvider } from '@clerk/react';
import App from './App';
import './styles.css';

function ConfigErrorScreen() {
  return (
    <div style={{ minHeight: '100vh', display: 'grid', placeItems: 'center', padding: '2rem', background: '#f4f8f5', color: '#183127', fontFamily: 'Inter, system-ui, sans-serif' }}>
      <div style={{ maxWidth: '700px', background: '#ffffff', border: '1px solid #d8e6db', borderRadius: '20px', padding: '1.5rem' }}>
        <h1 style={{ marginTop: 0, fontSize: '1.6rem' }}>OpenPCB needs environment variables to start</h1>
        <p>Add these in your GitHub Pages build environment, then rebuild:</p>
        <pre style={{ overflowX: 'auto', padding: '1rem', borderRadius: '12px', background: '#eef5f0' }}>
{`VITE_CLERK_PUBLISHABLE_KEY=your_clerk_key
VITE_SUPABASE_URL=your_supabase_url
VITE_SUPABASE_PUBLISHABLE_KEY=your_supabase_publishable_key`}
        </pre>
        <p style={{ marginBottom: 0 }}>This project now uses <strong>HashRouter</strong> and a relative Vite base so it can run correctly on GitHub Pages.</p>
      </div>
    </div>
  );
}

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider afterSignOutUrl="/">
        <HashRouter>
          <App />
        </HashRouter>
      </ClerkProvider>
    ) : (
      <ConfigErrorScreen />
    )}
  </React.StrictMode>,
);
