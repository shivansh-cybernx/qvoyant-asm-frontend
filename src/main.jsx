import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import AsmApp from './AsmApp.jsx';
import './styles.css';

/**
 * Standalone ASM demo (:5174).
 * Sign-in uses the auth server. Product navigation lives in this app's shell.
 * Module Federation expose is AsmApp, which this entry mounts outside the host.
 */
createRoot(document.getElementById('root')).render(
  <StrictMode>
    <div className="asm-root asm-standalone">
      <BrowserRouter>
        <AsmApp />
      </BrowserRouter>
    </div>
  </StrictMode>,
);
