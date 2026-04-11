import React from 'react';
import ReactDOM from 'react-dom/client';
import { ClerkProvider } from '@clerk/clerk-react';
import { HashRouter } from 'react-router-dom';
import App from './App';
import './styles.css';

const clerkPublishableKey = import.meta.env.VITE_CLERK_PUBLISHABLE_KEY;

function ConfigErrorScreen() {
  return (
    <div className="config-shell">
      <div className="config-card">
        <h1>OpenPCB needs configuration to start</h1>
        <p className="hero-copy">Add the required frontend configuration values, rebuild the site, and reload the page.</p>
      </div>
    </div>
  );
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    {clerkPublishableKey ? (
      <ClerkProvider publishableKey={clerkPublishableKey} afterSignOutUrl="/">
        <HashRouter>
          <App />
        </HashRouter>
      </ClerkProvider>
    ) : <ConfigErrorScreen />}
  </React.StrictMode>,
);
