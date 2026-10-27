import { useEffect, useState } from 'react';
import { api } from '../api.js';
import { loadDomains } from '../layout/domains.js';
import DiscoveryPanel from './DiscoveryPanel.jsx';
import TargetCard from './TargetCard.jsx';
import CopyField from './CopyField.jsx';

const IN_PROGRESS = new Set(['PENDING', 'FAILED', 'UNVERIFIED']);

function challengeFromApi(data) {
  if (!data?.txt?.value) return null;
  return {
    dnsTxt: {
      host: data.txt.host,
      type: data.txt.type || 'TXT',
      value: data.txt.value,
    },
    file: data.file || null,
    metaTag: data.metaTag || null,
  };
}

export default function Dashboard({ onLog }) {
  const [organizationId, setOrganizationId] = useState('');
  const [orgName, setOrgName] = useState('');
  const [targets, setTargets] = useState([]);
  const [domain, setDomain] = useState('');
  const [busy, setBusy] = useState(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [challengeById, setChallengeById] = useState({});
  const [activeTargetId, setActiveTargetId] = useState(null);
  const [detailsTargetId, setDetailsTargetId] = useState(null);

  async function loadTargets() {
    const result = await loadDomains();
    if (!result.active) {
      throw new Error('No organizations found. Run pnpm db:seed on the backend.');
    }
    setOrganizationId(result.active.id);
    setOrgName(result.active.name);
    setTargets(result.targets);
    return result.targets;
  }

  async function bootstrap() {
    setLoading(true);
    setError('');
    try {
      const list = await loadTargets();
      onLog('Loaded', { targets: list.length });
    } catch (err) {
      setError(err.message);
      onLog('Load failed', err.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    bootstrap();
  }, []);

  function showError(err) {
    const found = err.details?.found;
    const extra = Array.isArray(found) && found.length ? ` Records seen: ${found.join(' | ')}` : '';
    setNotice('');
    setError(`${err.message}${extra}`);
  }

  function showNotice(message) {
    setError('');
    setNotice(message);
  }

  async function handleSeed(e) {
    e.preventDefault();
    if (!organizationId) {
      setError('Organization not loaded yet. Click Refresh.');
      return;
    }

    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api('/targets', {
        method: 'POST',
        body: JSON.stringify({
          organizationId,
          domain,
          tags: ['seeded'],
        }),
      });

      const targetId = result.data.id;
      const challenge = challengeFromApi(result.data);
      if (targetId && challenge) {
        setChallengeById((prev) => ({ ...prev, [targetId]: challenge }));
        setActiveTargetId(targetId);
      }
      onLog('Domain registered', {
        domain: result.data.domain,
        status: result.data.verificationStatus,
        token: result.data.txt?.value,
      });
      showNotice(result.message || `${result.data.domain} added. Verification status is PENDING.`);
      setDomain('');
      await loadTargets();
    } catch (err) {
      showError(err);
      onLog('Add domain failed', err.details ? { message: err.message, details: err.details } : err.message);
    } finally {
      setBusy(false);
    }
  }

  async function fetchChallenge(targetId) {
    const result = await api(`/targets/${targetId}/challenge`);
    const challenge = challengeFromApi(result.data);
    if (!challenge?.dnsTxt?.value) {
      throw new Error('API did not return verification details');
    }
    setChallengeById((prev) => ({ ...prev, [targetId]: challenge }));
    setActiveTargetId(targetId);
    onLog('Challenge', {
      host: challenge.dnsTxt.host,
      value: challenge.dnsTxt.value,
      file: challenge.file?.path,
      meta: challenge.metaTag?.html,
    });
    return challenge;
  }

  async function handleChallenge(targetId) {
    setBusy(true);
    setError('');
    try {
      await fetchChallenge(targetId);
      await loadTargets();
      requestAnimationFrame(() => {
        document.getElementById('txt-challenge')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      });
    } catch (err) {
      showError(err);
      onLog('Show challenge failed', err.message);
    } finally {
      setBusy(false);
    }
  }

  async function handleVerify(targetId, method) {
    setBusy(true);
    setError('');
    try {
      if (!challengeById[targetId]?.dnsTxt?.value && !targets.find((t) => t.id === targetId)?.verificationToken) {
        await fetchChallenge(targetId);
      }
      const result = await api(`/targets/${targetId}/verify`, {
        method: 'POST',
        body: JSON.stringify({ method }),
      });
      onLog(`Verified via ${method}`, result.data);
      showNotice(result.message || `${result.data.domain} is Verified.`);
      setChallengeById((prev) => {
        const next = { ...prev };
        delete next[targetId];
        return next;
      });
      if (activeTargetId === targetId) setActiveTargetId(null);
      await loadTargets();
    } catch (err) {
      showError(err);
      onLog(`Verify ${method} failed`, err.details ? { message: err.message, details: err.details } : err.message);
      await loadTargets().catch(() => {});
    } finally {
      setBusy(false);
    }
  }

  async function handleRegenerate(targetId) {
    const current = targets.find((target) => target.id === targetId);
    if (current?.verificationStatus === 'VERIFIED') {
      const confirmed = window.confirm(
        'Regenerating the token resets this domain to PENDING until you verify again. Continue?',
      );
      if (!confirmed) return;
    }

    setBusy(true);
    setError('');
    try {
      const result = await api(`/targets/${targetId}/challenge/regenerate`, { method: 'POST' });
      const challenge = challengeFromApi(result.data);
      if (challenge) {
        setChallengeById((prev) => ({ ...prev, [targetId]: challenge }));
        setActiveTargetId(targetId);
      }
      showNotice(result.message);
      onLog('Token regenerated', {
        domain: result.data.domain,
        status: result.data.verificationStatus,
      });
      await loadTargets();
    } catch (err) {
      showError(err);
      onLog('Regenerate token failed', err.message);
    } finally {
      setBusy(false);
    }
  }

  const inProgress = targets.filter((t) => IN_PROGRESS.has(t.verificationStatus));
  const verified = targets.filter((t) => t.verificationStatus === 'VERIFIED' || t.verificationStatus === 'MANUALLY_APPROVED');
  const detailsTarget = targets.find((target) => target.id === detailsTargetId) || null;

  function openDetails(targetId) {
    setDetailsTargetId(targetId);
    requestAnimationFrame(() => {
      document.getElementById('domain-details')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }
  const activeChallenge = activeTargetId ? challengeById[activeTargetId] : null;
  const activeDomain =
    targets.find((t) => t.id === activeTargetId)?.domain ||
    targets.find((t) => t.id === activeTargetId)?.value ||
    '';
  const activeHost = activeChallenge?.dnsTxt?.host || '';
  const activeName =
    activeDomain && activeHost.endsWith(`.${activeDomain}`)
      ? activeHost.slice(0, -(`.${activeDomain}`).length)
      : '_qvoyant-verify';

  return (
    <>
      <section className="panel">
        <div className="row">
          <div>
            <h2>Add domain</h2>
            <p className="muted">
              {loading
                ? 'Loading organization…'
                : orgName
                  ? `Org: ${orgName}`
                  : 'Organization not ready'}
            </p>
          </div>
          <button type="button" className="secondary" onClick={bootstrap} disabled={loading}>
            Refresh
          </button>
        </div>

        {error ? <p className="error">{error}</p> : null}
        {notice ? <p className="notice">{notice}</p> : null}

        <form onSubmit={handleSeed}>
          <label>
            Domain
            <input
              value={domain}
              onChange={(e) => setDomain(e.target.value)}
              placeholder="example.com"
              required
            />
          </label>
          <button type="submit" disabled={busy || loading || !organizationId}>
            {busy ? 'Creating…' : loading ? 'Loading…' : 'Get verification token'}
          </button>
        </form>
      </section>

      {detailsTarget ? <DiscoveryPanel target={detailsTarget} onLog={onLog} /> : null}

      {activeChallenge ? (
        <section className="panel challenge" id="txt-challenge">
          <h2>Ownership verification</h2>
          <p className="muted">Use any one method below, then click the matching Verify button.</p>

          <h3>1. DNS TXT</h3>
          <div className="inline-token">
            <CopyField label="Name / Host (key)" value={activeName} />
            <CopyField label="Full host" value={activeChallenge.dnsTxt.host} />
            <CopyField label="Value" value={activeChallenge.dnsTxt.value} />
            <CopyField label="Type" value="TXT" />
          </div>

          {activeChallenge.file ? (
            <>
              <h3>2. File upload</h3>
              <div className="inline-token">
                <CopyField label="File path" value={activeChallenge.file.path} />
                <CopyField label="File URL" value={activeChallenge.file.url} />
                <CopyField label="File contents" value={activeChallenge.file.value} />
              </div>
            </>
          ) : null}

          {activeChallenge.metaTag ? (
            <>
              <h3>3. Meta tag</h3>
              <div className="inline-token">
                <CopyField label="Meta name" value={activeChallenge.metaTag.name} />
                <CopyField label="Meta content" value={activeChallenge.metaTag.content} />
                <CopyField label="HTML snippet" value={activeChallenge.metaTag.html} />
              </div>
            </>
          ) : null}

          {activeTargetId ? (
            <div className="actions">
              <button type="button" disabled={busy} onClick={() => handleVerify(activeTargetId, 'DNS_TXT')}>
                Verify DNS TXT
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => handleVerify(activeTargetId, 'FILE')}
              >
                Verify file
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => handleVerify(activeTargetId, 'META_TAG')}
              >
                Verify meta tag
              </button>
              <button
                type="button"
                className="secondary"
                disabled={busy}
                onClick={() => handleRegenerate(activeTargetId)}
              >
                Regenerate token
              </button>
            </div>
          ) : null}
        </section>
      ) : null}

      <section className="panel">
        <h2>In progress ({inProgress.length})</h2>
        <p className="muted">PENDING / FAILED / UNVERIFIED — show challenge, then verify.</p>
        <div className="targets">
          {loading ? (
            <p className="muted">Loading domains…</p>
          ) : inProgress.length === 0 ? (
            <p className="muted">No domains in progress.</p>
          ) : (
            inProgress.map((target) => (
              <TargetCard
                key={target.id}
                target={target}
                challenge={challengeById[target.id]}
                busy={busy}
                onChallenge={() => handleChallenge(target.id)}
                onVerify={(method) => handleVerify(target.id, method)}
                onRegenerate={() => handleRegenerate(target.id)}
                onOpenDetails={() => openDetails(target.id)}
              />
            ))
          )}
        </div>
      </section>

      {verified.length ? (
        <section className="panel">
          <h2>Verified ({verified.length})</h2>
          <div className="targets">
            {verified.map((target) => (
              <TargetCard
                key={target.id}
                target={target}
                challenge={challengeById[target.id]}
                busy={busy}
                onChallenge={() => handleChallenge(target.id)}
                onVerify={(method) => handleVerify(target.id, method)}
                onRegenerate={() => handleRegenerate(target.id)}
                onOpenDetails={() => openDetails(target.id)}
              />
            ))}
          </div>
        </section>
      ) : null}
    </>
  );
}
