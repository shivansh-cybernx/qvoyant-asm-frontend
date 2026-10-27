import { Link } from 'react-router-dom';
import { useIsHostShell } from './auth/ShellContext.jsx';

/** ASM paths are `/seed-asset` standalone and `/dashboard/module/asm/seed-asset` in the host. */
export function asmHref(to, isHostShell) {
  const path = !to || to === '/' ? '/' : to.startsWith('/') ? to : `/${to}`;
  if (!isHostShell) return path;
  if (path === '/') return '/dashboard/module/asm';
  return `/dashboard/module/asm${path}`;
}

export function AsmLink({ to, ...props }) {
  const isHostShell = useIsHostShell();
  return <Link to={asmHref(to, isHostShell)} {...props} />;
}
