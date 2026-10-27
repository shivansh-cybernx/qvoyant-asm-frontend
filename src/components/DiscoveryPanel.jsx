import { useEffect, useState } from 'react';
import { api } from '../api.js';

const DEFAULT_PORTS = '22, 25, 53, 80, 443, 8080, 8443';
const TERMINAL = new Set(['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED']);
const ELIGIBLE = new Set(['VERIFIED', 'MANUALLY_APPROVED']);

function formatDuration(ms) {
  if (ms == null || Number.isNaN(ms)) return '—';
  const seconds = Math.max(0, Math.round(ms / 1000));
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes > 0 ? `${minutes}m ${rest}s` : `${rest}s`;
}

function formatWhen(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleString();
}

export default function DiscoveryPanel({ target, onLog }) {
  const [ports, setPorts] = useState(DEFAULT_PORTS);
  const [subdomainDiscovery, setSubdomainDiscovery] = useState(true);
  const [dnsResolution, setDnsResolution] = useState(true);
  const [publicIpDiscovery, setPublicIpDiscovery] = useState(true);
  const [portDiscovery, setPortDiscovery] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [scan, setScan] = useState(null);
  const [inventory, setInventory] = useState(null);
  const [now, setNow] = useState(Date.now());

  const eligible = ELIGIBLE.has(target.verificationStatus);
  const running = scan && !TERMINAL.has(scan.status);

  useEffect(() => {
    let ignore = false;
    setScan(null);
    setInventory(null);
    setError('');
    api(`/targets/${target.id}/inventory`)
      .then((result) => {
        if (!ignore) setInventory(result.data);
      })
      .catch(() => {
        if (!ignore) setInventory(null);
      });
    api(`/targets/${target.id}/discovery-scans`)
      .then((result) => {
        if (ignore) return;
        const latest = Array.isArray(result.data) ? result.data[0] : null;
        setScan(latest || null);
      })
      .catch(() => {
        if (!ignore) setScan(null);
      });
    return () => {
      ignore = true;
    };
  }, [target.id]);

  useEffect(() => {
    if (!running) return undefined;
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, [running]);

  useEffect(() => {
    if (!scan?.scanId || TERMINAL.has(scan.status)) return undefined;
    let stop = false;
    const timer = setInterval(async () => {
      try {
        const result = await api(`/scans/${scan.scanId}`);
        if (stop) return;
        setScan(result.data);
        if (TERMINAL.has(result.data.status)) {
          const tree = await api(`/targets/${target.id}/inventory`);
          if (!stop) setInventory(tree.data);
        }
      } catch (err) {
        if (!stop) setError(err.message);
      }
    }, 2000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [scan?.scanId, scan?.status, target.id]);

  async function handleStart(event) {
    event.preventDefault();
    setBusy(true);
    setError('');
    const parsedPorts = ports
      .split(',')
      .map((part) => Number(part.trim()))
      .filter((port) => Number.isInteger(port) && port >= 1 && port <= 65535);

    try {
      const result = await api(`/targets/${target.id}/discovery-scans`, {
        method: 'POST',
        timeoutMs: 20000,
        body: JSON.stringify({
          profile: 'BASIC',
          subdomainDiscovery,
          passiveDiscovery: true,
          activeDnsChecks: true,
          dnsResolution,
          publicIpDiscovery,
          portDiscovery,
          ports: parsedPorts,
          schedule: 'MANUAL',
        }),
      });
      const created = result.data;
      onLog('Discovery scan', created);
      if (created.status === 'FAILED') {
        setError(created.error || result.message);
      }
      const loaded = await api(`/scans/${created.scanId}`);
      setScan(loaded.data);
    } catch (err) {
      setError(err.message);
      onLog('Discovery scan failed', err.details ? { message: err.message, details: err.details } : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleCancel() {
    if (!scan?.scanId) return;
    setBusy(true);
    setError('');
    try {
      const result = await api(`/scans/${scan.scanId}/cancel`, { method: 'POST' });
      setScan(result.data);
      onLog('Discovery cancel', result.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setBusy(false);
    }
  }

  const elapsed = scan?.finishedAt
    ? scan.elapsedMs
    : scan?.startedAt
      ? now - new Date(scan.startedAt).getTime()
      : scan?.elapsedMs;
  const summary = scan?.summary || {};
  const observed = (inventory?.subdomains || []).filter((row) => row.reconciliation !== 'NOT_OBSERVED');
  const missing = (inventory?.subdomains || []).filter((row) => row.reconciliation === 'NOT_OBSERVED');

  return (
    <section className="panel" id="domain-details">
      <div className="row">
        <div>
          <h2>Domain details</h2>
          <p className="muted">
            {target.domain || target.value} · {target.verificationStatus}
          </p>
        </div>
      </div>

      {error ? <p className="error">{error}</p> : null}

      <form onSubmit={handleStart}>
        <label>
          Target root domain
          <input value={target.domain || target.value} readOnly />
        </label>
        <label>
          Scan profile
          <input value="Basic Discovery" readOnly />
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={subdomainDiscovery}
            onChange={(e) => setSubdomainDiscovery(e.target.checked)}
          />
          Subdomain discovery
        </label>
        <label className="check">
          <input type="checkbox" checked={dnsResolution} onChange={(e) => setDnsResolution(e.target.checked)} />
          DNS resolution
        </label>
        <label className="check">
          <input
            type="checkbox"
            checked={publicIpDiscovery}
            onChange={(e) => setPublicIpDiscovery(e.target.checked)}
          />
          Public IP discovery
        </label>
        <label className="check">
          <input type="checkbox" checked={portDiscovery} onChange={(e) => setPortDiscovery(e.target.checked)} />
          Port discovery
        </label>
        <label>
          Port list
          <input value={ports} onChange={(e) => setPorts(e.target.value)} disabled={!portDiscovery} />
        </label>
        <label>
          Scan schedule
          <input value="Manual" readOnly />
        </label>
        <div className="actions">
          <button type="submit" disabled={busy || !eligible || running}>
            {busy ? 'Starting…' : 'Run Discovery Scan'}
          </button>
          {running ? (
            <button type="button" className="secondary" disabled={busy} onClick={handleCancel}>
              Cancel scan
            </button>
          ) : null}
        </div>
        {!eligible ? (
          <p className="muted">
            A Discovery Scan starts only when this domain is Verified or Manually Approved, active, and not archived.
          </p>
        ) : null}
      </form>

      {scan ? (
        <div className="scan-status">
          <h3>Scan status</h3>
          <p>
            <span className={`badge ${scan.status}`}>{scan.status}</span>
          </p>
          <ul className="facts">
            <li>Stage: {scan.stage || scan.currentStage || '—'}</li>
            <li>Started: {formatWhen(scan.startedAt)}</li>
            <li>Elapsed: {formatDuration(elapsed)}</li>
            <li>Subdomains: {summary.totalSubdomains ?? 0}</li>
            <li>New: {summary.newSubdomains ?? 0}</li>
            <li>Resolving: {summary.resolvingSubdomains ?? 0}</li>
            <li>Not resolving: {summary.nonResolvingSubdomains ?? 0}</li>
            <li>Public IPs: {summary.publicIps ?? 0}</li>
            <li>Approved targets scanned: {summary.approvedIpsScanned ?? 0}</li>
            <li>Open ports: {summary.openPorts ?? 0}</li>
            <li>Last successful scan: {formatWhen(summary.lastSuccessfulScanAt || inventory?.lastSuccessfulScanAt)}</li>
          </ul>
          {scan.interruptedReason ? <p className="error">{scan.interruptedReason}</p> : null}
          {scan.errorMessage ? <p className="muted">{scan.errorMessage}</p> : null}
          {Array.isArray(scan.stageErrors) && scan.stageErrors.length ? (
            <ul className="facts">
              {scan.stageErrors.map((item, index) => (
                <li key={`${item.stage}-${item.source}-${index}`}>
                  {item.stage} / {item.source}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
          {Array.isArray(summary.failedOrSkippedStages) && summary.failedOrSkippedStages.length ? (
            <p className="muted">
              Failed or skipped:{' '}
              {summary.failedOrSkippedStages.map((item) => `${item.stage} (${item.status})`).join(', ')}
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="inventory">
        <h3>Assets</h3>
        <p className="muted">Root domain → subdomain → DNS record → IP address → open port → service</p>
        {!inventory ? (
          <p className="muted">No inventory yet.</p>
        ) : (
          <article className="card">
            <strong>{inventory.rootDomain.domain}</strong>
            <div className="tree">
              {observed.length === 0 ? <p className="muted">No subdomains observed yet.</p> : null}
              {observed.map((row) => (
                <HostBranch key={row.hostname} row={row} />
              ))}
            </div>
            {missing.length ? (
              <div className="missing">
                <h3>Not observed in the latest scan</h3>
                <p className="muted">These names were kept. They were not confirmed as removed.</p>
                {missing.map((row) => (
                  <HostBranch key={row.hostname} row={row} />
                ))}
              </div>
            ) : null}
          </article>
        )}
      </div>
    </section>
  );
}

function HostBranch({ row }) {
  return (
    <details open={row.reconciliation !== 'NOT_OBSERVED'}>
      <summary>
        {row.hostname}{' '}
        <span className={`badge ${row.reconciliation}`}>{row.reconciliation.replaceAll('_', ' ')}</span>
        <span className="muted">
          {' '}
          {row.resolves === true ? 'resolving' : row.resolves === false ? 'not resolving' : 'resolution unknown'}
        </span>
      </summary>
      <div className="tree">
        <p className="muted">
          First seen {formatWhen(row.firstSeenAt)} · last seen {formatWhen(row.lastSeenAt)} · sources{' '}
          {(row.sources || []).join(', ') || '—'}
        </p>
        {(row.dnsRecords || []).length ? (
          <ul className="facts">
            {row.dnsRecords.map((record, index) => (
              <li key={`${record.type}-${record.value}-${index}`}>
                DNS {record.type} {record.value || '—'} ({record.status})
              </li>
            ))}
          </ul>
        ) : (
          <p className="muted">No DNS observations stored for the last scan of this name.</p>
        )}
        {(row.ips || []).map((ip) => (
          <div key={ip.ip} className="card">
            <strong>{ip.ip}</strong> <span className="muted">IPv{ip.version} · {ip.scopeDecision}</span>
            <ul className="facts">
              {(ip.ports || []).map((port) => (
                <li key={`${port.port}-${port.protocol}`}>
                  Port {port.port}/{port.protocol} {port.result}
                  {port.service ? ` · service ${port.service}` : ''}
                </li>
              ))}
            </ul>
            {(ip.services || []).length ? (
              <p className="muted">Services: {ip.services.map((service) => service.service).join(', ')}</p>
            ) : null}
          </div>
        ))}
        {(row.ports || []).map((port) => (
          <p key={`${port.port}-${port.protocol}`}>
            Port {port.port}/{port.protocol} {port.result}
            {port.service ? ` · service ${port.service}` : ''}
          </p>
        ))}
      </div>
    </details>
  );
}
