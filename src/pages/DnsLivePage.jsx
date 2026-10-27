import { useEffect, useMemo, useState } from 'react';
import { AsmLink as Link } from '../asmHref.jsx';
import { api } from '../api.js';
import { isVerifiedStatus } from '../layout/domains.js';
import { useOrganization } from '../layout/OrganizationContext.jsx';
import { DataTable, OrgHint, PageState, StatusBadge, formatCell } from './ui.jsx';

const TERMINAL = new Set(['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED']);

const PIPELINE_STEPS = [
  {
    id: 1,
    title: 'Load from database',
    body: 'We read every hostname already stored for this domain (from earlier subdomain scans). No manual file upload.',
  },
  {
    id: 2,
    title: 'DNS resolution (massdns / puredns)',
    body: 'The Go scanner asks public DNS: “Does this name have an IP?” Dead names get no address. Live names get A/AAAA records.',
  },
  {
    id: 3,
    title: 'Mark live vs not live',
    body: 'Results are written back to the database. Resolves = Yes means DNS answered with an IP. No means it did not resolve.',
  },
  {
    id: 4,
    title: 'Review in this page',
    body: 'Use the tables below to show stakeholders only live assets (hostname + IP), or filter to not-resolving names.',
  },
];

function resolveLabel(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Pending';
}

function inventoryRows(inventory) {
  const list = Array.isArray(inventory?.subdomains) ? inventory.subdomains : [];
  return list.map((row) => {
    const ips = (row.ips || []).map((item) => item.ip).filter(Boolean);
    const dnsIps = (row.dnsRecords || [])
      .filter((record) => (record.type === 'A' || record.type === 'AAAA') && record.status === 'SUCCESS' && record.value)
      .map((record) => record.value);
    const allIps = [...new Set([...ips, ...dnsIps])];
    return {
      id: row.hostname,
      hostname: row.hostname,
      resolves: resolveLabel(row.resolves),
      resolvesRaw: row.resolves,
      ips: allIps.length ? allIps.join(', ') : '—',
      sources: Array.isArray(row.sources) ? row.sources.join(', ') : '—',
      lastSeenAt: row.lastSeenAt,
    };
  });
}

function activeStep(scan) {
  if (!scan) return 1;
  if (TERMINAL.has(scan.status)) return 4;
  const stage = String(scan.currentStage || scan.stage || '').toUpperCase();
  if (stage.includes('DNS') || stage.includes('IP')) return 2;
  if (stage.includes('NORMALIZE') || stage.includes('LOAD') || stage.includes('QUEUED')) return 1;
  if (stage.includes('SUBDOMAIN')) return 1;
  return 3;
}

export default function DnsLivePage() {
  const org = useOrganization();
  const [inventory, setInventory] = useState(null);
  const [scan, setScan] = useState(null);
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [filter, setFilter] = useState('all');

  const verified = (org.targets || []).filter((target) => isVerifiedStatus(target.verificationStatus));
  const chosen = (org.targets || []).find((target) => target.id === org.selectedTargetId) || null;
  const selected = verified.find((target) => target.id === org.selectedTargetId) || null;
  const rows = useMemo(() => inventoryRows(inventory), [inventory]);
  const running = scan && !TERMINAL.has(scan.status);
  const stepNow = activeStep(scan);

  const stats = useMemo(() => {
    const live = rows.filter((row) => row.resolvesRaw === true).length;
    const dead = rows.filter((row) => row.resolvesRaw === false).length;
    const pending = rows.filter((row) => row.resolvesRaw !== true && row.resolvesRaw !== false).length;
    return { total: rows.length, live, dead, pending };
  }, [rows]);

  const visible = useMemo(() => {
    let list = rows;
    if (filter === 'live') list = rows.filter((row) => row.resolvesRaw === true);
    if (filter === 'dead') list = rows.filter((row) => row.resolvesRaw === false);
    if (filter === 'pending') list = rows.filter((row) => row.resolvesRaw !== true && row.resolvesRaw !== false);
    return list.map((row, index) => ({ ...row, serial: index + 1 }));
  }, [rows, filter]);

  async function loadInventory(targetId) {
    const result = await api(`/targets/${targetId}/inventory`);
    setInventory(result.data || null);
  }

  async function loadLatestDnsScan(targetId) {
    const scansResult = await api(`/targets/${targetId}/discovery-scans`);
    const list = (Array.isArray(scansResult.data) ? scansResult.data : []).filter((item) => item.mode === 'DNS');
    if (!list[0]?.scanId) {
      setScan(null);
      return;
    }
    const detail = await api(`/scans/${list[0].scanId}`);
    setScan(detail.data);
  }

  useEffect(() => {
    if (!selected?.id) return undefined;
    let ignore = false;
    setLoading(true);
    setError('');
    setNotice('');
    Promise.all([loadInventory(selected.id), loadLatestDnsScan(selected.id)])
      .catch((err) => {
        if (!ignore) setError(err.message || 'Could not load hostnames from the database');
      })
      .finally(() => {
        if (!ignore) setLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [selected?.id]);

  useEffect(() => {
    if (!scan?.scanId || !selected?.id || TERMINAL.has(scan.status)) return undefined;
    let stop = false;
    const timer = setInterval(async () => {
      try {
        const detail = await api(`/scans/${scan.scanId}`);
        if (stop) return;
        setScan(detail.data);
        const inv = await api(`/targets/${selected.id}/inventory`);
        if (!stop) setInventory(inv.data || null);
      } catch (err) {
        if (!stop) setError(err.message || 'Could not refresh DNS status');
      }
    }, 2500);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [scan?.scanId, scan?.status, selected?.id]);

  async function startDnsValidation() {
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api(`/targets/${selected.id}/dns-scans`, {
        method: 'POST',
        body: JSON.stringify({}),
      });
      const created = result.data;
      if (created.status === 'FAILED') {
        setError(created.error || result.message);
      } else {
        setNotice(
          result.message ||
            `DNS validation started for ${selected.domain}. Hostnames were loaded from the database.`,
        );
      }
      const detail = await api(`/scans/${created.scanId}`);
      setScan(detail.data);
    } catch (err) {
      setError(err.message || 'Could not start DNS validation');
    } finally {
      setBusy(false);
    }
  }

  async function refreshAll() {
    if (!selected?.id) return;
    setLoading(true);
    setError('');
    try {
      await Promise.all([loadInventory(selected.id), loadLatestDnsScan(selected.id)]);
      setNotice('Refreshed hostnames from the database.');
    } catch (err) {
      setError(err.message || 'Refresh failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <section className="panel">
        <OrgHint />
        <h2>DNS live validation</h2>
        <p className="muted">
          This page takes subdomains <strong>already saved in the database</strong> and checks which ones are live on
          DNS (have an IP). Use it to explain the flow to others: find names → store in DB → validate DNS → show live
          assets. Discover new names first on{' '}
          <Link to="/subdomain-scan">Subdomain Scan</Link>.
        </p>
        {notice ? <p className="notice">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <PageState loading={org.status === 'loading'} error={org.status === 'error' ? org.error : ''}>
        <section className="panel">
          <div className="row">
            <h2>1 · Choose domain</h2>
            <button type="button" className="secondary" onClick={refreshAll} disabled={loading || !selected}>
              Refresh from DB
            </button>
          </div>
          {verified.length === 0 ? (
            <p className="muted">
              No verified domains. Verify one on <Link to="/seed-asset">Seed Asset</Link> first.
            </p>
          ) : (
            <>
              <label>
                Verified domain (database)
                <select value={selected?.id || ''} onChange={(event) => org.selectTarget(event.target.value)}>
                  {chosen && !selected ? <option value="">Choose a verified domain</option> : null}
                  {verified.map((target) => (
                    <option key={target.id} value={target.id}>
                      {target.domain}
                    </option>
                  ))}
                </select>
              </label>
              {chosen && !selected ? (
                <p className="muted">
                  {chosen.domain || chosen.value} is selected in the header and is not verified yet.
                  Verify it on <Link to="/seed-asset">Seed Asset</Link> before DNS validation.
                </p>
              ) : null}
              <div className="stat-strip">
                <div className="stat-card">
                  <span className="stat-label">In database</span>
                  <strong className="stat-value">{stats.total}</strong>
                </div>
                <div className="stat-card ok">
                  <span className="stat-label">DNS live (Yes)</span>
                  <strong className="stat-value">{stats.live}</strong>
                </div>
                <div className="stat-card bad">
                  <span className="stat-label">Not resolving</span>
                  <strong className="stat-value">{stats.dead}</strong>
                </div>
                <div className="stat-card warn">
                  <span className="stat-label">Pending</span>
                  <strong className="stat-value">{stats.pending}</strong>
                </div>
              </div>
            </>
          )}
        </section>

        <section className="panel">
          <h2>2 · How it works (explain this to others)</h2>
          <ol className="pipeline-steps">
            {PIPELINE_STEPS.map((step) => (
              <li key={step.id} className={stepNow === step.id ? 'pipeline-step active' : 'pipeline-step'}>
                <div className="pipeline-num">{step.id}</div>
                <div>
                  <strong>{step.title}</strong>
                  <p className="muted">{step.body}</p>
                </div>
              </li>
            ))}
          </ol>
          <div className="actions">
            <button type="button" disabled={busy || running || !selected || stats.total === 0} onClick={startDnsValidation}>
              {running ? 'DNS validation running…' : 'Start DNS validation from DB'}
            </button>
            {running ? (
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  try {
                    const result = await api(`/scans/${scan.scanId}/cancel`, { method: 'POST' });
                    setScan(result.data);
                  } catch (err) {
                    setError(err.message || 'Could not cancel');
                  } finally {
                    setBusy(false);
                  }
                }}
              >
                Cancel
              </button>
            ) : null}
          </div>
          {stats.total === 0 ? (
            <p className="muted">
              Database has no hostnames for this domain yet. Run a <Link to="/subdomain-scan">Subdomain Scan</Link>{' '}
              first, then come back here.
            </p>
          ) : (
            <p className="muted">
              Will validate <strong>{stats.total}</strong> hostname(s) from inventory using <strong>massdns / puredns</strong>.
              Subdomain discovery tools are not run again.
            </p>
          )}
          {scan ? (
            <p className="muted">
              Latest DNS job: {scan.name || 'DNS resolution'} · <StatusBadge value={scan.status} /> ·{' '}
              {scan.progress ?? 0}% · {scan.currentStage || 'queued'}
            </p>
          ) : null}
        </section>

        <section className="panel">
          <div className="row">
            <h2>3 · Results from database</h2>
            <label className="inline-filter">
              Show
              <select value={filter} onChange={(event) => setFilter(event.target.value)}>
                <option value="all">All</option>
                <option value="live">Live only (Yes)</option>
                <option value="dead">Not resolving</option>
                <option value="pending">Pending</option>
              </select>
            </label>
          </div>
          <p className="muted">
            These rows come from <code>hostname_inventory</code> in the database (plus DNS/IP observations). After a
            DNS run finishes, refresh or wait — live IPs appear here automatically.
          </p>
          <DataTable
            rows={visible}
            empty={
              loading
                ? 'Loading from database…'
                : rows.length
                  ? 'No rows match this filter.'
                  : 'No hostnames in the database for this domain yet.'
            }
            columns={[
              { key: 'serial', label: '#' },
              { key: 'hostname', label: 'Hostname' },
              {
                key: 'resolves',
                label: 'DNS live?',
                render: (row) => <StatusBadge value={row.resolves === 'Yes' ? 'LIVE' : row.resolves === 'No' ? 'DEAD' : 'PENDING'} />,
              },
              { key: 'ips', label: 'IP addresses' },
              { key: 'sources', label: 'Found by' },
              { key: 'lastSeenAt', label: 'Last seen', render: (row) => formatCell(row.lastSeenAt) },
            ]}
          />
        </section>

        <section className="panel">
          <h2>Talking points (for demos)</h2>
          <ul className="talking-points">
            <li>
              <strong>Find</strong> — Subdomain Scan discovers names (subfinder, crt.sh, …) and saves them to the DB.
            </li>
            <li>
              <strong>Validate</strong> — This page only asks DNS: which of those DB names are real/live?
            </li>
            <li>
              <strong>Live</strong> — Resolves = Yes + IP means the name exists on the internet today.
            </li>
            <li>
              <strong>Not live</strong> — Still in inventory for history, but not answering DNS right now.
            </li>
          </ul>
        </section>
      </PageState>
    </>
  );
}
