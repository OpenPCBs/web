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
        <h1>OpenPCB needs environment variables to start</h1>
        <pre>{`VITE_CLERK_PUBLISHABLE_KEY=pk_...
VITE_API_BASE_URL=https://your-api.example.com
VITE_POCKETBASE_URL=https://your-pocketbase.example.com`}</pre>
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
