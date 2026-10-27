import { useRoutes } from 'react-router-dom';
import { asmRoutes } from './asmRoutes.jsx';
import { AuthProvider } from './auth/AuthContext.jsx';
import RequireAuth from './auth/RequireAuth.jsx';
import { ShellProvider } from './auth/ShellContext.jsx';
import './styles.css';

/**
 * Federated mount for host (`asmApp/AsmApp`).
 *
 * Host owns login, the product sidebar, and ProtectedRoute for CTEM/ASM read.
 * Pass `embedded` so this remote skips its own login and host chrome.
 *
 * Routes stay relative to `/dashboard/module/asm/*`.
 */
export default function AsmApp({ embedded = false } = {}) {
  const shellMode = embedded ? 'host' : 'standalone';
  const routes = useRoutes(asmRoutes);

  return (
    <div className="asm-root">
      <ShellProvider mode={shellMode}>
        <AuthProvider>
          <RequireAuth>{routes}</RequireAuth>
        </AuthProvider>
      </ShellProvider>
    </div>
  );
}
