import AppShell from './layout/AppShell.jsx';
import AssetInventoryPage from './pages/AssetInventoryPage.jsx';
import ComingSoonPage from './pages/ComingSoonPage.jsx';
import { RecentActivityPage, VulnerabilitiesPage } from './pages/FindingsPages.jsx';
import OverviewPage from './pages/OverviewPage.jsx';
import ReportsPage from './pages/ReportsPage.jsx';
import ScanLogPage from './pages/ScanLogPage.jsx';
import SeedAssetPage from './pages/SeedAssetPage.jsx';
import StartScanPage from './pages/StartScanPage.jsx';
import SubdomainScanPage from './pages/SubdomainScanPage.jsx';
import DnsLivePage from './pages/DnsLivePage.jsx';
import {
  DiscoveredAssetsPage,
  DnsSecurityPage,
  PortIntelligencePage,
  TechnologyPage,
} from './pages/SurfacePages.jsx';

/** Relative routes for standalone `/` and host `/dashboard/module/asm`. */
export const asmRoutes = [
  {
    element: <AppShell />,
    children: [
      { index: true, element: <OverviewPage /> },
      { path: 'seed-asset', element: <SeedAssetPage /> },
      { path: 'reports', element: <ReportsPage /> },
      { path: 'recent-activity', element: <RecentActivityPage /> },
      { path: 'asset-inventory', element: <AssetInventoryPage /> },
      { path: 'port-intelligence', element: <PortIntelligencePage /> },
      { path: 'scan-log', element: <ScanLogPage /> },
      { path: 'start-scan', element: <StartScanPage /> },
      { path: 'subdomain-scan', element: <SubdomainScanPage /> },
      { path: 'dns-live', element: <DnsLivePage /> },
      { path: 'discovered-assets', element: <DiscoveredAssetsPage /> },
      { path: 'schedule-jobs', element: <ComingSoonPage title="Schedule Jobs" /> },
      { path: 'vulnerabilities', element: <VulnerabilitiesPage /> },
      { path: 'asm-map', element: <ComingSoonPage title="ASM Map" /> },
      { path: 'dns-security', element: <DnsSecurityPage /> },
      { path: 'certificate-security', element: <ComingSoonPage title="Certificate Security" /> },
      { path: 'technology', element: <TechnologyPage /> },
      { path: '*', element: <OverviewPage /> },
    ],
  },
];
