import { useEffect, useState } from 'react';
import { BarChart, DonutChart } from '@qvoyant/ui/asm/AsmCharts.jsx';
import { AsmLink as Link } from '../asmHref.jsx';
import { api } from '../api.js';
import { useOrganization } from '../layout/OrganizationContext.jsx';
import { DataTable, PageState, StatusBadge, formatCell } from './ui.jsx';

const SEVERITY = [
  { id: 'CRITICAL', label: 'Critical', color: '#dc2626' },
  { id: 'HIGH', label: 'High', color: '#ea580c' },
  { id: 'MEDIUM', label: 'Medium', color: '#d97706' },
  { id: 'LOW', label: 'Low', color: '#2563eb' },
  { id: 'INFO', label: 'Info', color: '#64748b' },
];

const SCAN_STATUS = [
  { id: 'RUNNING', label: 'Running', color: '#2563eb' },
  { id: 'QUEUED', label: 'Queued', color: '#7c3aed' },
  { id: 'PENDING', label: 'Pending', color: '#64748b' },
  { id: 'PAUSED', label: 'Paused', color: '#d97706' },
  { id: 'COMPLETED', label: 'Completed', color: '#15803d' },
  { id: 'FAILED', label: 'Failed', color: '#dc2626' },
  { id: 'CANCELLED', label: 'Cancelled', color: '#94a3b8' },
];

const ASSET_TYPES = [
  { id: 'DOMAIN', label: 'Domains', color: '#2563eb' },
  { id: 'SUBDOMAIN', label: 'Subdomains', color: '#0f766e' },
  { id: 'IP', label: 'IP addresses', color: '#7c3aed' },
  { id: 'URL', label: 'URLs', color: '#d97706' },
  { id: 'CLOUD', label: 'Cloud', color: '#0369a1' },
  { id: 'OTHER', label: 'Other', color: '#64748b' },
];

export default function OverviewPage() {
  const org = useOrganization();
  const [data, setData] = useState(null);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const domainLabel = org.selectedTarget?.domain || org.selectedTarget?.value || '';

  useEffect(() => {
    if (org.status === 'loading') return;
    if (!org.organizationId) {
      setLoading(false);
      setError(org.error || 'Organization is not ready');
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError('');
    const query = new URLSearchParams({ organizationId: org.organizationId });
    if (domainLabel) query.set('target', domainLabel);
    api(`/dashboard?${query}`)
      .then((body) => {
        if (!cancelled) setData(body.data);
      })
      .catch((err) => {
        if (!cancelled) setError(err.message);
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [org.status, org.organizationId, org.error, domainLabel]);

  const summary = data?.summary || {};
  const scopeName = data?.scope?.domain || domainLabel;
  const scopeNote = scopeName ? `For ${scopeName}` : 'Whole organization';

  return (
    <PageState loading={org.status === 'loading' || loading} error={error}>
      <p className="nx-domain-context">
        {scopeName ? (
          <>
            Showing <strong>{scopeName}</strong>
            {org.name ? ` · ${org.name}` : ''}
          </>
        ) : (
          org.name || 'Choose a domain in the header.'
        )}
      </p>
      <div className="stat-grid">
        <Stat label="Assets" value={summary.assets} to="/asset-inventory" />
        <Stat label="Scans" value={summary.scans} to="/scan-log" />
        <Stat label="Active scans" value={summary.activeScans} to="/start-scan" />
        <Stat label="Findings" value={summary.findings} to="/vulnerabilities" />
      </div>

      <div className="qv-chart-grid">
        <DonutChart
          title="Findings by severity"
          subtitle={scopeNote}
          slices={slicesFrom(SEVERITY, data?.findingsBySeverity)}
          empty="No findings"
        />
        <DonutChart
          title="DNS resolution"
          subtitle={scopeNote}
          slices={[
            { id: 'live', label: 'Live', color: '#15803d', value: data?.dnsResolution?.live || 0 },
            { id: 'unresolved', label: 'Not resolving', color: '#dc2626', value: data?.dnsResolution?.unresolved || 0 },
            { id: 'unknown', label: 'Unknown', color: '#94a3b8', value: data?.dnsResolution?.unknown || 0 },
          ]}
          empty="No hostnames"
        />
        <BarChart
          title="Scan status"
          subtitle={scopeNote}
          rows={slicesFrom(SCAN_STATUS, data?.scansByStatus)}
          empty="No scans for this domain yet."
        />
        <BarChart
          title="Asset mix"
          subtitle={scopeNote}
          rows={slicesFrom(ASSET_TYPES, data?.assetsByType).filter((row) => row.value > 0)}
          empty="No assets for this domain yet."
        />
      </div>

      <section className="panel">
        <h2>Recent scans</h2>
        <DataTable
          rows={data?.recentScans || []}
          empty="No scans yet."
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'target', label: 'Target' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'progress', label: 'Progress', render: (row) => `${row.progress ?? 0}%` },
            {
              key: 'subdomains',
              label: 'Subdomains',
              render: (row) => (typeof row.summary?.totalSubdomains === 'number' ? row.summary.totalSubdomains : '—'),
            },
            { key: 'createdAt', label: 'Created', render: (row) => formatCell(row.createdAt) },
          ]}
        />
      </section>

      <section className="panel">
        <h2>Recent findings</h2>
        <DataTable
          rows={data?.recentFindings || []}
          empty="No findings yet."
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'severity', label: 'Severity', render: (row) => <StatusBadge value={row.severity} /> },
            { key: 'category', label: 'Category' },
            { key: 'createdAt', label: 'Created', render: (row) => formatCell(row.createdAt) },
          ]}
        />
      </section>
    </PageState>
  );
}

function slicesFrom(catalog, counts) {
  const source = counts || {};
  return catalog.map((item) => ({ ...item, value: Number(source[item.id]) || 0 }));
}

function Stat({ label, value, to }) {
  return (
    <Link className="stat-card" to={to}>
      <span className="muted">{label}</span>
      <strong>{value ?? 0}</strong>
    </Link>
  );
}
