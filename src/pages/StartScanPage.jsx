import { useState } from 'react';
import { AsmLink as Link } from '../asmHref.jsx';
import { api } from '../api.js';
import { isVerifiedStatus } from '../layout/domains.js';
import { useOrganization } from '../layout/OrganizationContext.jsx';
import { DataTable, OrgHint, PageState, StatusBadge, formatCell } from './ui.jsx';

function isVerified(target) {
  return isVerifiedStatus(target.verificationStatus);
}

export default function StartScanPage() {
  const org = useOrganization();
  const [actionError, setActionError] = useState('');
  const [notice, setNotice] = useState('');
  const [busyId, setBusyId] = useState('');
  const [profile, setProfile] = useState('STANDARD');
  const [openId, setOpenId] = useState('');
  const [found, setFound] = useState(null);

  const targets = org.targets || [];

  const verified = targets.filter(isVerified);
  const pending = targets.filter((target) => !isVerified(target));

  async function startScan(target) {
    if (!isVerified(target)) return;
    org.selectTarget(target.id);
    setBusyId(target.id);
    setNotice('');
    setActionError('');
    try {
      const result = await api('/scans', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: target.organizationId,
          target: target.domain,
          profile,
          name: `Scan ${target.domain}`,
        }),
      });
      setNotice(result.message || `Scan queued for ${target.domain}`);
    } catch (err) {
      setActionError(err.message || 'Could not start scan');
    } finally {
      setBusyId('');
    }
  }

  async function startDiscovery(target) {
    if (!isVerified(target)) return;
    org.selectTarget(target.id);
    setBusyId(target.id);
    setNotice('');
    setActionError('');
    try {
      const result = await api(`/targets/${target.id}/discovery-scans`, {
        method: 'POST',
        body: JSON.stringify({
          profile: 'BASIC',
          subdomainDiscovery: true,
          passiveDiscovery: true,
          activeDnsChecks: true,
          dnsResolution: true,
          publicIpDiscovery: true,
          portDiscovery: true,
          schedule: 'MANUAL',
        }),
      });
      setNotice(result.message || `Discovery scan queued for ${target.domain}`);
      await showAssociated(target);
    } catch (err) {
      setActionError(err.message || 'Could not start discovery scan');
    } finally {
      setBusyId('');
    }
  }

  async function showAssociated(target) {
    if (!isVerified(target)) return;
    org.selectTarget(target.id);
    setBusyId(target.id);
    setActionError('');
    setOpenId(target.id);
    try {
      const [inventoryResult, scansResult] = await Promise.all([
        api(`/targets/${target.id}/inventory`),
        api(`/targets/${target.id}/discovery-scans`),
      ]);
      const inventory = inventoryResult.data || {};
      const subdomains = Array.isArray(inventory.subdomains) ? inventory.subdomains : [];
      const scans = Array.isArray(scansResult.data) ? scansResult.data : [];
      setFound({
        domain: target.domain,
        root: inventory.rootDomain || null,
        rows: subdomains.map((row) => ({
          id: `${target.id}-${row.hostname}`,
          hostname: row.hostname,
          resolves: row.resolves ? 'Yes' : 'No',
          reconciliation: row.reconciliation,
          sources: Array.isArray(row.sources) ? row.sources.join(', ') : '',
          lastSeenAt: row.lastSeenAt,
        })),
        scans,
      });
    } catch (err) {
      setFound(null);
      setActionError(err.message || 'Could not load associated domains');
    } finally {
      setBusyId('');
    }
  }

  return (
    <>
      <section className="panel">
        <OrgHint />
        <p className="muted">
          Only a verified domain can start a scan. Pending domains stay listed so you can finish verification on{' '}
          <Link to="/seed-asset">Seed Asset</Link>.
        </p>
        <label>
          Start-scan profile
          <select value={profile} onChange={(e) => setProfile(e.target.value)}>
            <option value="QUICK">QUICK</option>
            <option value="STANDARD">STANDARD</option>
            <option value="DEEP">DEEP</option>
          </select>
        </label>
        {notice ? <p className="notice">{notice}</p> : null}
        {actionError ? <p className="error">{actionError}</p> : null}
      </section>

      <PageState loading={org.status === 'loading'} error={org.status === 'error' ? org.error : ''}>
        <section className="panel">
          <div className="row">
            <h2>Verified ({verified.length})</h2>
            <button type="button" className="secondary" onClick={org.reload} disabled={org.status === 'loading'}>
              Refresh
            </button>
          </div>
          {verified.length === 0 ? (
            <p className="muted">No verified domains yet. Verify one before scanning.</p>
          ) : (
            <div className="targets">
              {verified.map((target) => (
                <article key={target.id} className={`card${target.id === org.selectedTargetId ? ' is-selected' : ''}`}>
                  <div>
                    <strong>{target.domain}</strong>{' '}
                    <StatusBadge value={target.verificationStatus} />
                    {target.id === org.selectedTargetId ? <span className="nx-selected-pill">Selected</span> : null}
                  </div>
                  <p className="muted">
                    {target.organizationName} · verified {formatCell(target.verifiedAt)}
                  </p>
                  <div className="actions">
                    <button type="button" disabled={busyId === target.id} onClick={() => startScan(target)}>
                      Start scan
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyId === target.id}
                      onClick={() => startDiscovery(target)}
                    >
                      Discovery scan
                    </button>
                    <button
                      type="button"
                      className="secondary"
                      disabled={busyId === target.id}
                      onClick={() => showAssociated(target)}
                    >
                      Associated domains
                    </button>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        <section className="panel">
          <h2>Pending ({pending.length})</h2>
          <p className="muted">These domains cannot be scanned until ownership is verified.</p>
          {pending.length === 0 ? (
            <p className="muted">No pending domains.</p>
          ) : (
            <div className="targets">
              {pending.map((target) => (
                <article key={target.id} className="card">
                  <div>
                    <strong>{target.domain}</strong>{' '}
                    <StatusBadge value={target.verificationStatus} />
                  </div>
                  <p className="muted">
                    {target.organizationName} · scan is closed until this copy is verified.
                  </p>
                  <div className="actions">
                    <Link className="text-btn" to="/seed-asset">
                      Verify on Seed Asset
                    </Link>
                  </div>
                </article>
              ))}
            </div>
          )}
        </section>

        {openId && found ? (
          <section className="panel">
            <h2>Domains found for {found.domain}</h2>
            <p className="muted">
              Associated hostnames already stored for this verified domain. A discovery scan fills this list. No new
              scanner is added in this step.
            </p>
            <DataTable
              rows={found.rows}
              empty="No associated domains found yet."
              columns={[
                { key: 'hostname', label: 'Hostname' },
                { key: 'resolves', label: 'Resolves' },
                {
                  key: 'reconciliation',
                  label: 'State',
                  render: (row) => <StatusBadge value={row.reconciliation} />,
                },
                { key: 'sources', label: 'Sources' },
                { key: 'lastSeenAt', label: 'Last seen', render: (row) => formatCell(row.lastSeenAt) },
              ]}
            />
            <h3>Discovery scans</h3>
            <DataTable
              rows={found.scans}
              empty="No discovery scans for this domain yet."
              columns={[
                { key: 'scanId', label: 'Scan', render: (row) => row.scanId || row.id },
                { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
                { key: 'progress', label: 'Progress', render: (row) => `${row.progress ?? 0}%` },
                { key: 'currentStage', label: 'Stage' },
                {
                  key: 'subdomains',
                  label: 'Subdomains',
                  render: (row) => row.summary?.totalSubdomains ?? 0,
                },
              ]}
            />
          </section>
        ) : null}
      </PageState>
    </>
  );
}
