import { useState } from 'react';
import { api } from '../api.js';
import { useOrganization } from '../layout/OrganizationContext.jsx';
import { DataTable, OrgHint, PageState, StatusBadge, formatCell, useOrgQuery } from './ui.jsx';

export default function ScanLogPage() {
  const query = useOrgQuery(
    (organizationId) => `/scans?organizationId=${encodeURIComponent(organizationId)}`,
  );
  const [busyId, setBusyId] = useState('');
  const [notice, setNotice] = useState('');
  const [actionError, setActionError] = useState('');

  async function act(id, action) {
    setBusyId(id);
    setNotice('');
    setActionError('');
    try {
      const result = await api(`/scans/${id}/${action}`, { method: 'POST' });
      setNotice(result.message || `Scan ${action} requested`);
      await query.reload();
    } catch (err) {
      setActionError(err.message);
    } finally {
      setBusyId('');
    }
  }

  return (
    <section className="panel">
      <OrgHint />
      {notice ? <p className="notice">{notice}</p> : null}
      {actionError ? <p className="error">{actionError}</p> : null}
      <PageState loading={query.loading} error={query.error}>
        <DataTable
          rows={query.rows}
          empty="No scans yet."
          columns={[
            { key: 'name', label: 'Name' },
            { key: 'target', label: 'Target' },
            { key: 'profile', label: 'Profile' },
            { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
            { key: 'progress', label: 'Progress', render: (row) => `${row.progress ?? 0}%` },
            {
              key: 'subdomains',
              label: 'Subdomains',
              render: (row) => (typeof row.summary?.totalSubdomains === 'number' ? row.summary.totalSubdomains : '—'),
            },
            { key: 'createdAt', label: 'Created', render: (row) => formatCell(row.createdAt) },
            {
              key: 'actions',
              label: 'Actions',
              render: (row) => (
                <div className="row-actions">
                  {['pause', 'resume', 'cancel'].map((action) => (
                    <button
                      key={action}
                      type="button"
                      className="secondary"
                      disabled={busyId === row.id}
                      onClick={() => act(row.id, action)}
                    >
                      {action}
                    </button>
                  ))}
                </div>
              ),
            },
          ]}
        />
      </PageState>
    </section>
  );
}
