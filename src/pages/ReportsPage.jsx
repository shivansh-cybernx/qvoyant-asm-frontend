import { useState } from 'react';
import { api } from '../api.js';
import { useOrganization } from '../layout/OrganizationContext.jsx';
import { DataTable, OrgHint, StatusBadge, formatCell } from './ui.jsx';

export default function ReportsPage() {
  const org = useOrganization();
  const [title, setTitle] = useState('');
  const [recipients, setRecipients] = useState('');
  const [lookupId, setLookupId] = useState('');
  const [report, setReport] = useState(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  async function onCreate(e) {
    e.preventDefault();
    if (!org.organizationId) {
      setError(org.error || 'Organization is not ready');
      return;
    }
    const emails = recipients
      .split(',')
      .map((item) => item.trim())
      .filter(Boolean);
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api('/reports', {
        method: 'POST',
        body: JSON.stringify({
          organizationId: org.organizationId,
          title: title.trim(),
          recipients: emails,
        }),
      });
      setReport(result.data);
      setLookupId(result.data?.id || '');
      setNotice(result.message || 'Report queued');
      setTitle('');
    } catch (err) {
      setError(err.message || 'Could not create report');
    } finally {
      setBusy(false);
    }
  }

  async function onLookup(e) {
    e.preventDefault();
    setBusy(true);
    setError('');
    try {
      const result = await api(`/reports/${encodeURIComponent(lookupId.trim())}`);
      setReport(result.data);
    } catch (err) {
      setReport(null);
      setError(err.message || 'Report not found');
    } finally {
      setBusy(false);
    }
  }

  return (
    <>
      <section className="panel">
        <OrgHint />
        <form onSubmit={onCreate}>
          <label>
            Title
            <input value={title} onChange={(e) => setTitle(e.target.value)} required minLength={2} />
          </label>
          <label>
            Recipients
            <input
              value={recipients}
              onChange={(e) => setRecipients(e.target.value)}
              placeholder="security@example.com, ops@example.com"
              required
            />
          </label>
          {error ? <p className="error">{error}</p> : null}
          {notice ? <p className="notice">{notice}</p> : null}
          <button type="submit" disabled={busy || !org.organizationId}>
            {busy ? 'Working…' : 'Queue report'}
          </button>
        </form>
      </section>

      <section className="panel">
        <h2>Look up a report</h2>
        <form onSubmit={onLookup}>
          <label>
            Report id
            <input value={lookupId} onChange={(e) => setLookupId(e.target.value)} required />
          </label>
          <button type="submit" className="secondary" disabled={busy}>
            Load
          </button>
        </form>
        {report ? (
          <DataTable
            rows={[report]}
            empty=""
            columns={[
              { key: 'title', label: 'Title' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'id', label: 'Id' },
              { key: 'createdAt', label: 'Created', render: (row) => formatCell(row.createdAt) },
            ]}
          />
        ) : null}
      </section>
    </>
  );
}
