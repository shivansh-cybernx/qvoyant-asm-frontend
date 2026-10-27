import { useState } from 'react';
import { API } from './api.js';
import { useAuth } from './auth/AuthContext.jsx';
import { HostSessionHint } from './auth/RequireAuth.jsx';
import { useIsHostShell } from './auth/ShellContext.jsx';
import Dashboard from './components/Dashboard.jsx';

export default function App() {
  const { user, organizationId, logout } = useAuth();
  const isHostShell = useIsHostShell();
  const [logs, setLogs] = useState([`API\n${API}`]);
  const [signingOut, setSigningOut] = useState(false);

  function log(title, payload) {
    const line = typeof payload === 'string' ? payload : JSON.stringify(payload, null, 2);
    setLogs((prev) => [`${title}\n${line}`, ...prev].slice(0, 20));
  }

  async function onLogout() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  return (
    <main className="shell">
      <header className="top">
        <div>
          <p className="brand">QVoyant ASM</p>
          <h1>Domain verification</h1>
          <p className="muted">Add a domain · get TXT token · verify ownership</p>
        </div>
        {!isHostShell ? (
          <div className="session">
            <div className="session-meta">
              <span className="muted">{user?.email || 'Signed in'}</span>
              {organizationId ? (
                <span className="hint session-org">org {organizationId}</span>
              ) : null}
            </div>
            <button type="button" className="secondary" onClick={onLogout} disabled={signingOut}>
              {signingOut ? 'Signing out…' : 'Sign out'}
            </button>
          </div>
        ) : null}
      </header>

      <HostSessionHint />

      <Dashboard onLog={log} />

      <pre className="log">{logs.join('\n\n')}</pre>
    </main>
  );
}
