import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { NavLink, Outlet, useLocation } from 'react-router-dom';
import { asmHref } from '../asmHref.jsx';
import { useAuth } from '../auth/AuthContext.jsx';
import { useIsHostShell } from '../auth/ShellContext.jsx';
import { Icon } from './icons.jsx';
import { OrganizationProvider, useOrganization } from './OrganizationContext.jsx';

const RAIL = [
  { id: 'home', label: 'NX Home', icon: 'home' },
  { id: 'tasks', label: 'Tasks', icon: 'tasks' },
  { id: 'hawk', label: 'NXHawk', icon: 'hawk', active: true },
  { id: 'grc', label: 'GRC', icon: 'shield' },
  { id: 'soc', label: 'SOC', icon: 'monitor' },
  { id: 'present', label: 'Present', icon: 'chart' },
  { id: 'admin', label: 'Admin', icon: 'settings' },
  { id: 'docs', label: 'Documentation', icon: 'file' },
];

const SCAN_LINKS = [
  { path: '/start-scan', label: 'Start Scan' },
  { path: '/subdomain-scan', label: 'Subdomain Scan' },
  { path: '/dns-live', label: 'DNS Live Validation' },
  { path: '/scan-log', label: 'Scan Log' },
];

const MORE_LINKS = [
  { path: '/dns-security', label: 'DNS Security' },
  { path: '/port-intelligence', label: 'Port Intelligence' },
  { path: '/discovered-assets', label: 'Discovered Assets' },
  { path: '/reports', label: 'Reports' },
  { path: '/recent-activity', label: 'Activities' },
  { path: '/certificate-security', label: 'Certificate Security' },
  { path: '/schedule-jobs', label: 'Schedule Jobs' },
  { path: '/asm-map', label: 'ASM Map' },
];

/** Path under `/` standalone or `/dashboard/module/asm` in the host. */
function asmTail(pathname) {
  const marker = '/dashboard/module/asm';
  const at = pathname.toLowerCase().indexOf(marker);
  if (at === -1) return pathname || '/';
  const tail = pathname.slice(at + marker.length);
  return tail === '' ? '/' : tail;
}

function matchesTail(pathname, path) {
  const tail = asmTail(pathname);
  return tail === path || tail.startsWith(`${path}/`);
}

export default function AppShell() {
  return (
    <OrganizationProvider>
      <ShellFrame />
    </OrganizationProvider>
  );
}

function ShellFrame() {
  const { user, logout } = useAuth();
  const org = useOrganization();
  const location = useLocation();
  const isHostShell = useIsHostShell();
  const [menu, setMenu] = useState('');
  const [signingOut, setSigningOut] = useState(false);
  const [userOpen, setUserOpen] = useState(false);

  const scanActive = SCAN_LINKS.some((item) => matchesTail(location.pathname, item.path));
  const moreActive = MORE_LINKS.some((item) => matchesTail(location.pathname, item.path));
  const showPageTitle = !matchesTail(location.pathname, '/asset-inventory');
  const pageTitle = titleForPath(location.pathname);
  const orgTargets = org.targets.filter((target) => target.organizationId === org.organizationId);

  useEffect(() => {
    function onPointer(event) {
      const node = event.target;
      if (node instanceof Element && node.closest('.nx-picker, .nx-tab-menu, .nx-user, .nx-link-menu')) return;
      setMenu('');
      setUserOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, []);

  async function onLogout() {
    setSigningOut(true);
    try {
      await logout();
    } finally {
      setSigningOut(false);
    }
  }

  const href = (path) => asmHref(path, isHostShell);

  const customerPicker = (
    <Picker
      label="Customer"
      placeholder="Select customer"
      value={org.organizationId}
      options={org.organizations.map((item) => ({
        id: item.id,
        label: item.name || item.slug || item.id,
      }))}
      open={menu === 'customer'}
      onToggle={() => {
        setUserOpen(false);
        setMenu((current) => (current === 'customer' ? '' : 'customer'));
      }}
      onSelect={(id) => {
        org.selectOrganization(id);
        setMenu('');
      }}
    />
  );

  return (
    <div className={isHostShell ? 'nx-app nx-embedded' : 'nx-app'}>
      {isHostShell ? null : (
      <header className="nx-header">
        <div className="nx-brand">
          <span className="nx-mark" aria-hidden="true">
            <Icon name="hawk" size={16} />
          </span>
          <span>NXHAWK</span>
        </div>
        <div className="nx-header-center">
          <span className="nx-asm-pill">ASM</span>
        </div>
        <div className="nx-header-actions">
          {customerPicker}
          <div className="nx-user">
            <button
              type="button"
              className="nx-icon-btn"
              aria-label="Account"
              aria-expanded={userOpen}
              onClick={() => {
                setMenu('');
                setUserOpen((open) => !open);
              }}
            >
              <Icon name="user" size={18} />
            </button>
            {userOpen ? (
              <div className="nx-popover nx-user-menu">
                <p className="nx-user-email">{user?.email || 'Signed in'}</p>
                <button type="button" onClick={onLogout} disabled={signingOut}>
                  {signingOut ? 'Signing out…' : 'Sign out'}
                </button>
              </div>
            ) : null}
          </div>
        </div>
      </header>
      )}

      <div className="nx-body">
        {isHostShell ? null : (
        <aside className="nx-rail" aria-label="Products">
          {RAIL.map((item) => (
            <span
              key={item.id}
              className={`nx-rail-btn${item.active ? ' active' : ''}`}
              title={item.active ? item.label : `${item.label} stays in the NXHawk host`}
            >
              <Icon name={item.icon} />
            </span>
          ))}
        </aside>
        )}

        <div className="nx-workspace">
          <div className="nx-tabbar">
            <nav className="nx-tabs" aria-label="ASM">
              <NavLink to={href('/')} end className={({ isActive }) => `nx-tab${isActive ? ' active' : ''}`}>
                <Icon name="dashboard" size={16} />
                Dashboard
              </NavLink>
              <NavLink to={href('/seed-asset')} className={({ isActive }) => `nx-tab${isActive ? ' active' : ''}`}>
                <Icon name="package" size={16} />
                Seed Asset
              </NavLink>
              <TabMenu
                label="Scan"
                icon="scan"
                active={scanActive}
                open={menu === 'scan'}
                items={SCAN_LINKS}
                href={href}
                onToggle={() => {
                  setUserOpen(false);
                  setMenu((current) => (current === 'scan' ? '' : 'scan'));
                }}
                onPick={() => setMenu('')}
              />
              <NavLink to={href('/asset-inventory')} className={({ isActive }) => `nx-tab${isActive ? ' active' : ''}`}>
                <Icon name="boxes" size={16} />
                Asset Inventory
              </NavLink>
              <NavLink to={href('/technology')} className={({ isActive }) => `nx-tab${isActive ? ' active' : ''}`}>
                <Icon name="layers" size={16} />
                Technology
              </NavLink>
              <NavLink to={href('/vulnerabilities')} className={({ isActive }) => `nx-tab${isActive ? ' active' : ''}`}>
                <Icon name="alert" size={16} />
                Vulnerabilities
              </NavLink>
              <TabMenu
                label="More"
                icon="more"
                active={moreActive}
                open={menu === 'more'}
                items={MORE_LINKS}
                href={href}
                onToggle={() => {
                  setUserOpen(false);
                  setMenu((current) => (current === 'more' ? '' : 'more'));
                }}
                onPick={() => setMenu('')}
              />
            </nav>
            {isHostShell ? customerPicker : null}
            <Picker
              label="Domain"
              placeholder="Select domain"
              value={org.selectedTargetId}
              options={orgTargets.map((target) => ({ id: target.id, label: target.value }))}
              open={menu === 'domain'}
              onToggle={() => {
                setUserOpen(false);
                setMenu((current) => (current === 'domain' ? '' : 'domain'));
              }}
              onSelect={(id) => {
                org.selectTarget(id);
                setMenu('');
              }}
            />
          </div>

          <main className="nx-content">
            {showPageTitle ? <h1 className="nx-page-title">{pageTitle}</h1> : null}
            {org.error ? <p className="nx-error">{org.error}</p> : null}
            <Outlet />
          </main>
        </div>
      </div>
    </div>
  );
}

function titleForPath(pathname) {
  const tail = asmTail(pathname);
  const titles = [
    ['/seed-asset', 'Seed Asset'],
    ['/start-scan', 'Start Scan'],
    ['/subdomain-scan', 'Subdomain Scan'],
    ['/dns-live', 'DNS Live Validation'],
    ['/scan-log', 'Scan Log'],
    ['/technology', 'Technology'],
    ['/vulnerabilities', 'Vulnerabilities'],
    ['/dns-security', 'DNS Security'],
    ['/port-intelligence', 'Port Intelligence'],
    ['/discovered-assets', 'Discovered Assets'],
    ['/reports', 'Reports'],
    ['/recent-activity', 'Activities'],
    ['/certificate-security', 'Certificate Security'],
    ['/schedule-jobs', 'Schedule Jobs'],
    ['/asm-map', 'ASM Map'],
  ];
  return titles.find(([path]) => tail === path || tail.startsWith(`${path}/`))?.[1] || 'Dashboard';
}

function TabMenu({ label, icon, active, open, items, href, onToggle, onPick }) {
  const buttonRef = useRef(null);
  return (
    <div className="nx-tab-menu">
      <button
        ref={buttonRef}
        type="button"
        className={`nx-tab${active ? ' active' : ''}`}
        aria-expanded={open}
        onClick={onToggle}
      >
        <Icon name={icon} size={16} />
        {label}
        <Icon name="chevron" size={14} />
      </button>
      {open ? <LinkMenu items={items} href={href} onPick={onPick} anchorRef={buttonRef} /> : null}
    </div>
  );
}

function LinkMenu({ items, href, onPick, anchorRef }) {
  const [box, setBox] = useState(null);

  useLayoutEffect(() => {
    function place() {
      const node = anchorRef.current;
      if (!node) return;
      const rect = node.getBoundingClientRect();
      setBox({ top: rect.bottom + 6, left: rect.left });
    }
    place();
    window.addEventListener('resize', place);
    window.addEventListener('scroll', place, true);
    return () => {
      window.removeEventListener('resize', place);
      window.removeEventListener('scroll', place, true);
    };
  }, [anchorRef]);

  if (!box) return null;

  return createPortal(
    <div className="nx-popover nx-link-menu" style={{ position: 'fixed', top: box.top, left: box.left }}>
      {items.map((item) => (
        <NavLink key={item.path} to={href(item.path)} onClick={onPick}>
          {item.label}
        </NavLink>
      ))}
    </div>,
    document.body,
  );
}

function Picker({ label, placeholder, value, options, open, onToggle, onSelect }) {
  const current = options.find((option) => option.id === value);
  return (
    <div className="nx-picker">
      <button type="button" className="nx-picker-btn" aria-label={label} aria-expanded={open} onClick={onToggle}>
        <span>{current?.label || placeholder}</span>
        <Icon name="chevron" size={14} />
      </button>
      {open ? (
        <div className="nx-popover" role="listbox" aria-label={label}>
          {options.length === 0 ? <p className="nx-empty-option">Nothing to select</p> : null}
          {options.map((option) => (
            <button
              key={option.id}
              type="button"
              role="option"
              aria-selected={option.id === value}
              className={option.id === value ? 'selected' : ''}
              onClick={() => onSelect(option.id)}
            >
              {option.label}
            </button>
          ))}
        </div>
      ) : null}
    </div>
  );
}
