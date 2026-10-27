export const NAV_SECTIONS = [
  {
    id: 'overview',
    label: 'Overview',
    items: [{ path: '/', label: 'Dashboard', end: true }],
  },
  {
    id: 'assets',
    label: 'Assets',
    items: [
      { path: '/seed-asset', label: 'Seed Asset' },
      { path: '/asset-inventory', label: 'Asset Inventory' },
      { path: '/discovered-assets', label: 'Discovered Assets' },
    ],
  },
  {
    id: 'scan',
    label: 'Scan',
    items: [
      { path: '/start-scan', label: 'Start Scan' },
      { path: '/subdomain-scan', label: 'Subdomain Scan' },
      { path: '/dns-live', label: 'DNS Live Validation' },
      { path: '/scan-log', label: 'Scan Log' },
      { path: '/schedule-jobs', label: 'Schedule Jobs', soon: true },
    ],
  },
  {
    id: 'security',
    label: 'Security',
    items: [
      { path: '/vulnerabilities', label: 'Vulnerabilities' },
      { path: '/port-intelligence', label: 'Port Intelligence' },
      { path: '/dns-security', label: 'DNS Security' },
      { path: '/certificate-security', label: 'Certificate Security', soon: true },
      { path: '/technology', label: 'Technology' },
    ],
  },
  {
    id: 'reporting',
    label: 'Reporting',
    items: [
      { path: '/reports', label: 'Reports' },
      { path: '/recent-activity', label: 'Recent Activity' },
      { path: '/asm-map', label: 'ASM Map', soon: true },
    ],
  },
];

export const NAV_ITEMS = NAV_SECTIONS.flatMap((section) => section.items);

export function navItemForPath(pathname) {
  const match = NAV_ITEMS.find((item) =>
    item.end ? pathname === item.path : pathname === item.path || pathname.startsWith(`${item.path}/`),
  );
  return match || NAV_ITEMS[0];
}
