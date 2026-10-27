import { useEffect, useState } from 'react';
import { AsmLink as Link } from '../asmHref.jsx';
import { api } from '../api.js';
import { useOrganization } from '../layout/OrganizationContext.jsx';
import { DataTable, OrgHint, PageState, StatusBadge, formatCell } from './ui.jsx';

async function loadInventories(organizationId) {
  const { data } = await api(`/targets?organizationId=${encodeURIComponent(organizationId)}`);
  const targets = Array.isArray(data) ? data : [];
  const verified = targets.filter(
    (target) => target.verificationStatus === 'VERIFIED' || target.verificationStatus === 'MANUALLY_APPROVED',
  );
  const inventories = await Promise.all(
    verified.map(async (target) => {
      const result = await api(`/targets/${target.id}/inventory`);
      return result.data;
    }),
  );
  return inventories.filter(Boolean);
}

export function useInventories() {
  const org = useOrganization();
  const [inventories, setInventories] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (org.status === 'loading') return;
    if (!org.organizationId) {
      setLoading(false);
      setError(org.error || 'Organization is not ready');
      return;
    }
    let cancelled = false;
    setLoading(true);
    loadInventories(org.organizationId)
      .then((rows) => {
        if (!cancelled) setInventories(rows);
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
  }, [org.status, org.organizationId, org.error]);

  return { ...org, inventories, loading: org.status === 'loading' || loading, error };
}

function subdomainsOf(inventories) {
  return inventories.flatMap((inventory) =>
    (inventory.subdomains || []).map((row) => ({
      ...row,
      root: inventory.rootDomain?.domain,
    })),
  );
}

export function DiscoveredAssetsPage() {
  const query = useInventories();
  const rows = subdomainsOf(query.inventories);

  return (
    <section className="panel">
      <OrgHint />
      <PageState loading={query.loading} error={query.error}>
        {rows.length === 0 ? (
          <p className="muted">
            No discovered hostnames yet. Verify a domain on <Link to="/seed-asset">Seed Asset</Link>, then run a scan.
          </p>
        ) : (
          <DataTable
            rows={rows}
            empty=""
            columns={[
              { key: 'hostname', label: 'Hostname' },
              { key: 'root', label: 'Root' },
              { key: 'resolves', label: 'Resolves', render: (row) => (row.resolves ? 'Yes' : 'No') },
              {
                key: 'reconciliation',
                label: 'State',
                render: (row) => <StatusBadge value={row.reconciliation} />,
              },
              { key: 'lastSeenAt', label: 'Last seen', render: (row) => formatCell(row.lastSeenAt) },
            ]}
          />
        )}
      </PageState>
    </section>
  );
}

export function PortIntelligencePage() {
  const query = useInventories();
  const rows = subdomainsOf(query.inventories).flatMap((host) => {
    const fromIps = (host.ips || []).flatMap((ip) =>
      (ip.ports || []).map((port) => ({
        id: `${host.hostname}-${ip.ip}-${port.port}`,
        hostname: host.hostname,
        ip: ip.ip,
        ...port,
      })),
    );
    const direct = (host.ports || []).map((port) => ({
      id: `${host.hostname}-direct-${port.port}`,
      hostname: host.hostname,
      ip: port.ip,
      ...port,
    }));
    return [...fromIps, ...direct];
  });

  return (
    <section className="panel">
      <OrgHint />
      <PageState loading={query.loading} error={query.error}>
        <DataTable
          rows={rows}
          empty="No port observations yet. Complete a discovery scan first."
          columns={[
            { key: 'hostname', label: 'Host' },
            { key: 'ip', label: 'IP' },
            { key: 'port', label: 'Port' },
            { key: 'protocol', label: 'Protocol' },
            { key: 'result', label: 'Result', render: (row) => <StatusBadge value={row.result} /> },
            { key: 'service', label: 'Service' },
          ]}
        />
      </PageState>
    </section>
  );
}

export function DnsSecurityPage() {
  const query = useInventories();
  const rows = subdomainsOf(query.inventories).flatMap((host) =>
    (host.dnsRecords || []).map((record, index) => ({
      id: `${host.hostname}-${record.type}-${index}`,
      hostname: host.hostname,
      ...record,
    })),
  );

  return (
    <section className="panel">
      <OrgHint />
      <PageState loading={query.loading} error={query.error}>
        <DataTable
          rows={rows}
          empty="No DNS observations yet."
          columns={[
            { key: 'hostname', label: 'Hostname' },
            { key: 'type', label: 'Type' },
            { key: 'value', label: 'Value' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'observedAt', label: 'Observed', render: (row) => formatCell(row.observedAt) },
          ]}
        />
      </PageState>
    </section>
  );
}

export function TechnologyPage() {
  const query = useInventories();
  const rows = subdomainsOf(query.inventories).flatMap((host) => {
    const fromIps = (host.ips || []).flatMap((ip) => ip.services || []);
    const services = [...fromIps, ...(host.services || [])];
    return services.map((service, index) => ({
      id: `${host.hostname}-${service.port}-${index}`,
      hostname: host.hostname,
      ...service,
    }));
  });

  return (
    <section className="panel">
      <OrgHint />
      <PageState loading={query.loading} error={query.error}>
        <DataTable
          rows={rows}
          empty="No technology fingerprints yet. Open ports with a detected service show up here."
          columns={[
            { key: 'hostname', label: 'Host' },
            { key: 'service', label: 'Technology' },
            { key: 'port', label: 'Port' },
            { key: 'protocol', label: 'Protocol' },
            { key: 'banner', label: 'Banner' },
          ]}
        />
      </PageState>
    </section>
  );
}
