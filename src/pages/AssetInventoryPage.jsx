import { useEffect, useMemo, useState } from 'react';
import { partitionByColumn, SlideIdFilter } from '@qvoyant/ui/asm/SlideIdFilter.jsx';
import { api } from '../api.js';
import { Icon } from '../layout/icons.jsx';
import { isVerifiedStatus } from '../layout/domains.js';
import { useOrganization } from '../layout/OrganizationContext.jsx';

const TABS = [
  { id: 'all', label: 'All Assets' },
  { id: 'domains', label: 'Domains' },
  { id: 'subdomains', label: 'Subdomains' },
];

const INVENTORY_COLUMNS = [
  { id: 'id', label: 'Id' },
  { id: 'name', label: 'Asset' },
  { id: 'ips', label: 'IP Addresses' },
  { id: 'technologies', label: 'Technologies' },
  { id: 'risk', label: 'Risk Level' },
  { id: 'ssl', label: 'SSL Certificate' },
  { id: 'status', label: 'Status' },
];

export default function AssetInventoryPage() {
  const org = useOrganization();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');
  const [tab, setTab] = useState('all');
  const [search, setSearch] = useState('');
  const [filterOpen, setFilterOpen] = useState(false);
  const [sortField, setSortField] = useState('name');
  const [sortDirection, setSortDirection] = useState('asc');
  const [statusFilter, setStatusFilter] = useState('all');
  const [idFilterOpen, setIdFilterOpen] = useState(false);
  const [idColumn, setIdColumn] = useState('id');
  const [idQuery, setIdQuery] = useState('');
  const [selected, setSelected] = useState(null);
  const [reloadKey, setReloadKey] = useState(0);

  useEffect(() => {
    function onPointer(event) {
      const node = event.target;
      if (node instanceof Element && node.closest('.nx-filter')) return;
      setFilterOpen(false);
    }
    document.addEventListener('pointerdown', onPointer);
    return () => document.removeEventListener('pointerdown', onPointer);
  }, []);

  useEffect(() => {
    if (org.status === 'loading') return;
    if (!org.organizationId) {
      setLoading(false);
      setRows([]);
      setError('');
      return;
    }

    let cancelled = false;
    setLoading(true);
    setError('');
    loadRows(org.organizationId, org.selectedTarget)
      .then((next) => {
        if (!cancelled) setRows(next);
      })
      .catch((err) => {
        if (!cancelled) {
          setRows([]);
          setError(err.message || 'Could not load assets');
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [org.status, org.organizationId, org.selectedTarget, org.error, reloadKey]);

  const counts = useMemo(
    () => ({
      all: rows.length,
      domains: rows.filter((row) => row.kind === 'domain').length,
      subdomains: rows.filter((row) => row.kind === 'subdomain').length,
    }),
    [rows],
  );

  const visible = useMemo(() => {
    const query = search.trim().toLowerCase();
    return rows
      .filter((row) => (tab === 'all' ? true : row.kind === (tab === 'domains' ? 'domain' : 'subdomain')))
      .filter((row) => (query ? row.name.toLowerCase().includes(query) : true))
      .filter((row) => (statusFilter === 'all' ? true : row.status === statusFilter))
      .slice()
      .sort((left, right) => {
        const dir = sortDirection === 'asc' ? 1 : -1;
        if (sortField === 'discovered') {
          return (Date.parse(left.discoveredAt || 0) - Date.parse(right.discoveredAt || 0)) * dir;
        }
        if (sortField === 'status') return left.status.localeCompare(right.status) * dir;
        return left.name.localeCompare(right.name) * dir;
      })
      .map((row, index) => ({ ...row, serial: index + 1 }));
  }, [rows, tab, search, statusFilter, sortField, sortDirection]);

  const idSplit = useMemo(
    () => partitionByColumn(visible, idColumn, idQuery, (row, id) => {
      const value = row[id];
      if (Array.isArray(value)) return value.join(' ');
      return value ?? '';
    }),
    [visible, idColumn, idQuery],
  );

  const domainLabel = org.selectedTarget?.domain || org.selectedTarget?.value || '';

  const statuses = useMemo(
    () => [...new Set(rows.map((row) => row.status).filter(Boolean))].sort(),
    [rows],
  );

  async function onRefresh() {
    setRefreshing(true);
    const started = Date.now();
    setReloadKey((value) => value + 1);
    window.setTimeout(() => setRefreshing(false), Math.max(0, 600 - (Date.now() - started)));
  }

  if (org.status === 'error') return null;

  return (
    <section className="nx-inventory">
      <div className="nx-inventory-head">
        <div>
          <h1>Asset Inventory</h1>
          <p className="nx-domain-context">
            {domainLabel ? (
              <>
                Showing <strong>{domainLabel}</strong>
                {' · '}
                {counts.domains} {counts.domains === 1 ? 'domain' : 'domains'}
                {' · '}
                {counts.subdomains} {counts.subdomains === 1 ? 'subdomain' : 'subdomains'}
              </>
            ) : (
              'Choose a domain in the header. This list follows that domain.'
            )}
          </p>
        </div>
        <button type="button" className="nx-outline-btn" onClick={onRefresh} disabled={loading || refreshing}>
          <span className={loading || refreshing ? 'nx-spin' : ''}>
            <Icon name="refresh" size={14} />
          </span>
          Refresh
        </button>
      </div>

      <div className="nx-card">
        <div className="nx-segments" role="tablist">
          {TABS.map((item) => (
            <button
              key={item.id}
              type="button"
              role="tab"
              aria-selected={tab === item.id}
              className={tab === item.id ? 'active' : ''}
              onClick={() => setTab(item.id)}
            >
              {item.label}
              <span className="nx-count">{counts[item.id]}</span>
            </button>
          ))}
        </div>

        <div className="nx-inventory-tools">
          <label className="nx-search">
            <Icon name="search" size={16} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search domains..."
            />
          </label>
          <button type="button" className="nx-outline-btn" onClick={() => setIdFilterOpen(true)}>
            <Icon name="filter" size={14} />
            Filter by id
          </button>
          <SlideIdFilter
            columns={INVENTORY_COLUMNS}
            columnId={idColumn}
            query={idQuery}
            onColumnId={setIdColumn}
            onQuery={setIdQuery}
            open={idFilterOpen}
            onClose={() => setIdFilterOpen(false)}
            matchCount={idSplit.active ? idSplit.matches.length : visible.length}
            otherCount={idSplit.active ? idSplit.others.length : 0}
          />
          <div className="nx-filter">
            <button
              type="button"
              className="nx-outline-btn"
              aria-expanded={filterOpen}
              onClick={() => setFilterOpen((open) => !open)}
            >
              <Icon name="filter" size={14} />
              Filter & Sort
            </button>
            {filterOpen ? (
              <div className="nx-popover nx-filter-panel">
                <label>
                  Sort by
                  <select value={sortField} onChange={(event) => setSortField(event.target.value)}>
                    <option value="name">Asset</option>
                    <option value="discovered">Discovered</option>
                    <option value="status">Status</option>
                  </select>
                </label>
                <label>
                  Direction
                  <select value={sortDirection} onChange={(event) => setSortDirection(event.target.value)}>
                    <option value="asc">Ascending</option>
                    <option value="desc">Descending</option>
                  </select>
                </label>
                <label>
                  Status
                  <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
                    <option value="all">All statuses</option>
                    {statuses.map((status) => (
                      <option key={status} value={status}>
                        {statusLabel(status)}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
            ) : null}
          </div>
        </div>

        {error ? <p className="nx-error">{error}</p> : null}
        {loading ? <p className="nx-muted nx-inventory-state">Loading assets...</p> : null}

        {!loading && !error ? (
          <div className="nx-table-wrap">
            <table className="nx-table">
              <thead>
                <tr>
                  <th className="nx-serial">#</th>
                  <th>Asset</th>
                  <th>IP Addresses</th>
                  <th>Technologies</th>
                  <th>Risk Level</th>
                  <th>SSL Certificate</th>
                  <th>Status</th>
                  <th>Discovered</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {visible.length === 0 ? (
                  <tr>
                    <td colSpan={9} className="nx-table-empty">
                      {domainLabel ? 'No assets found matching your criteria.' : 'Select a domain to load its assets.'}
                    </td>
                  </tr>
                ) : (
                  (idSplit.active
                    ? [
                        { id: 'match', label: 'Matches this column', rows: idSplit.matches },
                        { id: 'miss', label: 'Does not match', rows: idSplit.others },
                      ]
                    : [{ id: 'all', label: '', rows: visible }]
                  ).flatMap((group) => [
                    group.label ? (
                      <tr key={`${group.id}-label`} className={group.id === 'miss' ? 'nx-split-miss' : 'nx-split-match'}>
                        <td colSpan={9}>{group.label} · {group.rows.length}</td>
                      </tr>
                    ) : null,
                    ...group.rows.map((row) => (
                    <tr key={row.id}>
                      <td className="nx-serial">{row.serial}</td>
                      <td>
                        <div className="nx-asset-name">
                          <Icon name="globe" size={15} />
                          <span>{row.name}</span>
                          <span className={`nx-kind ${row.kind}`}>{row.kind === 'domain' ? 'Domain' : 'Subdomain'}</span>
                        </div>
                      </td>
                      <td><ChipList values={row.ips} /></td>
                      <td><ChipList values={row.technologies} /></td>
                      <td><RiskBadge value={row.risk} /></td>
                      <td><span className="nx-ssl">{row.ssl}</span></td>
                      <td><StatusPill value={row.status} /></td>
                      <td>{formatDiscovered(row.discoveredAt)}</td>
                      <td>
                        <button
                          type="button"
                          className="nx-icon-btn"
                          aria-label={`View ${row.name}`}
                          onClick={() => setSelected(row)}
                        >
                          <Icon name="eye" size={16} />
                        </button>
                      </td>
                    </tr>
                    )),
                  ])
                )}
              </tbody>
            </table>
          </div>
        ) : null}
      </div>

      {selected ? <AssetDialog row={selected} onClose={() => setSelected(null)} /> : null}
    </section>
  );
}

async function loadRows(organizationId, selectedTarget) {
  if (!selectedTarget) return [];
  const { data } = await api(`/assets?organizationId=${encodeURIComponent(organizationId)}`);
  const assets = (Array.isArray(data) ? data : []).filter((asset) => asset.isActive !== false);
  const domainAssets = assets.filter((asset) => asset.type === 'DOMAIN');
  const scopedDomains = selectedTarget
    ? domainAssets.filter((asset) => asset.id === selectedTarget.id || asset.value === selectedTarget.value)
    : domainAssets;

  const inventories = await Promise.all(
    scopedDomains
      .filter((asset) => isVerifiedStatus(asset.verificationStatus))
      .map(async (asset) => {
        try {
          const result = await api(`/targets/${asset.id}/inventory`);
          return { asset, inventory: result.data };
        } catch {
          return { asset, inventory: null };
        }
      }),
  );
  const inventoryByDomain = new Map(inventories.map((entry) => [entry.asset.id, entry.inventory]));

  const domainRows = scopedDomains.map((asset) => {
    const inventory = inventoryByDomain.get(asset.id);
    const rootHost = (inventory?.subdomains || []).find(
      (host) => host.hostname?.toLowerCase() === asset.value.toLowerCase(),
    );
    return toRow({
      id: asset.id,
      name: asset.value,
      kind: 'domain',
      ips: ipsOf(rootHost),
      technologies: techsOf(rootHost),
      risk: asset.metadata?.riskLevel || null,
      ssl: asset.metadata?.sslStatus || 'No SSL',
      status: asset.verificationStatus || 'UNVERIFIED',
      discoveredAt: asset.firstSeenAt || asset.createdAt,
    });
  });

  const seen = new Set(domainRows.map((row) => row.name.toLowerCase()));
  const subdomainRows = [];

  for (const asset of scopedDomains) {
    const hosts = inventoryByDomain.get(asset.id)?.subdomains || [];
    for (const host of hosts) {
      const name = String(host.hostname || '').trim();
      if (!name || seen.has(name.toLowerCase())) continue;
      seen.add(name.toLowerCase());
      subdomainRows.push(
        toRow({
          id: `${asset.id}:${name}`,
          name,
          kind: 'subdomain',
          ips: ipsOf(host),
          technologies: techsOf(host),
          risk: null,
          ssl: 'No SSL',
          status: host.resolves === false ? 'UNRESOLVED' : host.reconciliation || 'UNKNOWN',
          discoveredAt: host.firstSeenAt || host.lastSeenAt,
        }),
      );
    }
  }

  for (const asset of assets.filter((item) => item.type === 'SUBDOMAIN')) {
    const name = asset.value;
    if (seen.has(name.toLowerCase())) continue;
    if (selectedTarget && !belongsToDomain(name, selectedTarget.value)) continue;
    seen.add(name.toLowerCase());
    subdomainRows.push(
      toRow({
        id: asset.id,
        name,
        kind: 'subdomain',
        ips: [],
        technologies: [],
        risk: asset.metadata?.riskLevel || null,
        ssl: asset.metadata?.sslStatus || 'No SSL',
        status: asset.verificationStatus || 'UNVERIFIED',
        discoveredAt: asset.firstSeenAt || asset.createdAt,
      }),
    );
  }

  return [...domainRows, ...subdomainRows];
}

function toRow(row) {
  return { ...row, ips: unique(row.ips), technologies: unique(row.technologies) };
}

function ipsOf(host) {
  if (!host) return [];
  return (host.ips || []).map((ip) => ip.ip).filter(Boolean);
}

function techsOf(host) {
  if (!host) return [];
  const fromIps = (host.ips || []).flatMap((ip) => (ip.services || []).map((service) => service.service));
  const direct = (host.services || []).map((service) => service.service);
  return [...fromIps, ...direct].filter(Boolean);
}

function unique(values) {
  return [...new Set(values)];
}

function belongsToDomain(hostname, domain) {
  const host = hostname.toLowerCase();
  const root = String(domain || '').toLowerCase();
  return host === root || host.endsWith(`.${root}`);
}

function formatDiscovered(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
}

function statusLabel(value) {
  return String(value || 'Unknown')
    .toLowerCase()
    .replaceAll('_', ' ')
    .replace(/^\w/, (letter) => letter.toUpperCase());
}

function ChipList({ values }) {
  if (!values.length) return <span className="nx-muted">None</span>;
  const shown = values.slice(0, 2);
  const extra = values.length - shown.length;
  return (
    <span className="nx-chips">
      {shown.map((value) => (
        <span key={value} className="nx-chip">{value}</span>
      ))}
      {extra > 0 ? <span className="nx-chip">+{extra} more</span> : null}
    </span>
  );
}

function RiskBadge({ value }) {
  const risk = String(value || 'UNKNOWN').toUpperCase();
  return <span className={`nx-risk ${risk}`}>{statusLabel(risk === 'UNKNOWN' ? 'Unknown' : risk)}</span>;
}

function StatusPill({ value }) {
  return <span className={`nx-status ${String(value || 'UNKNOWN').toUpperCase()}`}>{statusLabel(value)}</span>;
}

function AssetDialog({ row, onClose }) {
  return (
    <div className="nx-dialog-backdrop" onClick={onClose}>
      <div className="nx-dialog" role="dialog" aria-modal="true" aria-label={row.name} onClick={(event) => event.stopPropagation()}>
        <div className="nx-dialog-head">
          <h2>{row.name}</h2>
          <button type="button" className="nx-outline-btn" onClick={onClose}>Close</button>
        </div>
        <dl>
          <div><dt>Type</dt><dd>{row.kind === 'domain' ? 'Domain' : 'Subdomain'}</dd></div>
          <div><dt>IP addresses</dt><dd>{row.ips.join(', ') || 'None'}</dd></div>
          <div><dt>Technologies</dt><dd>{row.technologies.join(', ') || 'None'}</dd></div>
          <div><dt>Risk level</dt><dd>{statusLabel(row.risk || 'Unknown')}</dd></div>
          <div><dt>SSL certificate</dt><dd>{row.ssl}</dd></div>
          <div><dt>Status</dt><dd>{statusLabel(row.status)}</dd></div>
          <div><dt>Discovered</dt><dd>{formatDiscovered(row.discoveredAt)}</dd></div>
        </dl>
      </div>
    </div>
  );
}
