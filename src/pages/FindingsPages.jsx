import { DataTable, OrgHint, PageState, StatusBadge, formatCell, useOrgQuery } from './ui.jsx';

export function FindingsPage({ empty }) {
  const query = useOrgQuery(
    (organizationId) => `/findings?organizationId=${encodeURIComponent(organizationId)}`,
  );

  return (
    <section className="panel">
      <OrgHint />
      <PageState loading={query.loading} error={query.error}>
        <DataTable
          rows={query.rows}
          empty={empty}
          columns={[
            { key: 'title', label: 'Title' },
            { key: 'severity', label: 'Severity', render: (row) => <StatusBadge value={row.severity} /> },
            { key: 'category', label: 'Category' },
            { key: 'source', label: 'Source' },
            {
              key: 'asset',
              label: 'Asset',
              render: (row) => row.asset?.value || row.scan?.target || '—',
            },
            { key: 'createdAt', label: 'Seen', render: (row) => formatCell(row.createdAt) },
          ]}
        />
      </PageState>
    </section>
  );
}

export function VulnerabilitiesPage() {
  return <FindingsPage empty="No vulnerabilities recorded for this organization." />;
}

export function RecentActivityPage() {
  return <FindingsPage empty="No recent activity yet." />;
}
