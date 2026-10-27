import { HOST_ASM_PATH } from './auth/config.js';

/**
 * Standalone landing when opening the remote origin directly (:5174).
 * Product UI is loaded by the host shell via Module Federation.
 */
export default function RemoteLanding() {
  return (
    <main className="shell" style={{ maxWidth: 640, margin: '4rem auto' }}>
      <p className="brand">QVoyant ASM</p>
      <h1>ASM remote</h1>
      <p className="muted">
        This origin only serves Module Federation <code>remoteEntry.js</code>.
        Sign in and use ASM inside the host shell — not here.
      </p>
      <p style={{ marginTop: '1.5rem' }}>
        <a className="btn primary" href={HOST_ASM_PATH} style={{ display: 'inline-block', textDecoration: 'none' }}>
          Open host shell → ASM
        </a>
      </p>
      <ul className="muted" style={{ marginTop: '1.5rem', lineHeight: 1.8 }}>
        <li>
          Host login: <code>http://localhost:5173/</code>
        </li>
        <li>
          ASM route: <code>/dashboard/module/asm</code>
        </li>
        <li>
          remoteEntry: <code>http://localhost:5174/remoteEntry.js</code>
        </li>
        <li>
          expose: <code>asmApp/AsmApp</code>
        </li>
        <li>
          host env: <code>VITE_REMOTE_ASM=http://localhost:5174/remoteEntry.js</code>
        </li>
      </ul>
    </main>
  );
}
