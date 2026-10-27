import { useAuth } from './AuthContext.jsx';
import { useIsHostShell } from './ShellContext.jsx';
import LoginPage from './LoginPage.jsx';
import { HOST_ASM_PATH } from './config.js';

/**
 * Standalone-only gate. When mounted inside @qvoyant/host, the host already
 * enforces login + ASM:read via ProtectedRoute — never show a second login.
 */
export default function RequireAuth({ children }) {
  const isHostShell = useIsHostShell();
  const { status } = useAuth();

  if (isHostShell) {
    return children;
  }

  if (status === 'loading') {
    return (
      <main className="shell">
        <p className="brand">QVoyant ASM</p>
        <p className="muted">Checking session…</p>
      </main>
    );
  }

  if (status !== 'authenticated') {
    return <LoginPage />;
  }

  return children;
}

/** Soft banner when host session cookie is missing for ASM API (host still signed in). */
export function HostSessionHint() {
  const isHostShell = useIsHostShell();
  const { status } = useAuth();

  if (!isHostShell || status === 'authenticated' || status === 'loading') {
    return null;
  }

  return (
    <p className="notice host-session-hint">
      Host shell is signed in, but ASM API session probe failed. Prefer{' '}
      <a href={HOST_ASM_PATH}>{HOST_ASM_PATH}</a> after host login; API calls still
      send the auth-server cookie when present.
    </p>
  );
}
