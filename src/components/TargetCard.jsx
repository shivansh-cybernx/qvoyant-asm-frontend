import CopyField from './CopyField.jsx';

export default function TargetCard({
  target,
  challenge,
  onChallenge,
  onVerify,
  onRegenerate,
  onOpenDetails,
  busy = false,
}) {
  const domain = target.domain || target.value;
  const canVerify = target.verificationStatus !== 'VERIFIED';
  const token = challenge?.dnsTxt?.value || target.verificationToken;
  const host = challenge?.dnsTxt?.host || `_qvoyant-verify.${domain}`;
  const name = domain && host.endsWith(`.${domain}`)
    ? host.slice(0, -(`.${domain}`).length)
    : '_qvoyant-verify';

  return (
    <article className="card target-card">
      <div>
        <strong>{domain}</strong>{' '}
        <span className={`badge ${target.verificationStatus}`}>
          {target.verificationStatus}
        </span>
      </div>
      <div className="muted">
        {target.organizationName ? `${target.organizationName} · ` : ''}
        method: {target.verificationMethod || '—'} · id: {target.id}
      </div>

      {token ? (
        <div className="inline-token">
          <CopyField label="Name / Host (key)" value={name} />
          <CopyField label="Full host" value={host} />
          <CopyField label="Value" value={token} />
          {challenge?.file?.path ? <CopyField label="File path" value={challenge.file.path} /> : null}
          {challenge?.metaTag?.html ? (
            <CopyField label="Meta tag HTML" value={challenge.metaTag.html} />
          ) : null}
        </div>
      ) : (
        <p className="muted">No token yet — click Show challenge.</p>
      )}

      <div className="actions">
        <button type="button" disabled={busy} onClick={onOpenDetails}>
          Domain details
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={onChallenge}>
          {busy ? 'Loading…' : 'Show challenge'}
        </button>
        <button type="button" className="secondary" disabled={busy} onClick={onRegenerate}>
          Regenerate token
        </button>
        {canVerify ? (
          <>
            <button type="button" disabled={busy} onClick={() => onVerify('DNS_TXT')}>
              Verify DNS TXT
            </button>
            <button type="button" className="secondary" disabled={busy} onClick={() => onVerify('FILE')}>
              Verify file
            </button>
            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => onVerify('META_TAG')}
            >
              Verify meta tag
            </button>
          </>
        ) : null}
      </div>
    </article>
  );
}
