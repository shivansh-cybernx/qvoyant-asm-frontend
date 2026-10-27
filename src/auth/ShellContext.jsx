import { createContext, useContext } from 'react';

/** `host` = Module Federation inside @qvoyant/host; `standalone` = remote origin only */
const ShellContext = createContext('standalone');

export function ShellProvider({ mode = 'standalone', children }) {
  return (
    <ShellContext.Provider value={mode === 'host' ? 'host' : 'standalone'}>
      {children}
    </ShellContext.Provider>
  );
}

export function useShellMode() {
  return useContext(ShellContext);
}

export function useIsHostShell() {
  return useShellMode() === 'host';
}
