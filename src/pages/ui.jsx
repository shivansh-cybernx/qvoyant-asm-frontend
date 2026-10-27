import { useEffect, useMemo, useState } from 'react';
import { partitionByColumn, SlideIdFilter } from '@qvoyant/ui/asm/SlideIdFilter.jsx';
import { AsmLink as Link } from '../asmHref.jsx';
import { api } from '../api.js';
import { useOrganization } from '../layout/OrganizationContext.jsx';

export function PageState({ loading, error, children }) {
  if (loading) return <p className="muted">Loading…</p>;
  if (error) return <p className="error">{error}</p>;
  return children;
}

function cellText(row, column) {
  if (!column) return '';
  const raw = row?.[column.key];
  if (raw == null || raw === '') return '';
  return formatCell(raw) === '—' ? '' : formatCell(raw);
}

export function DataTable({ columns, rows, empty }) {
  const [filterOpen, setFilterOpen] = useState(false);
  const [columnId, setColumnId] = useState(columns[0]?.key || '');
  const [query, setQuery] = useState('');
  const filterColumns = useMemo(
    () => columns.map((column) => ({ id: column.key, label: column.label })),
    [columns],
  );
  const { matches, others, active } = useMemo(
    () => partitionByColumn(rows, columnId, query, (row, id) => cellText(row, columns.find((column) => column.key === id))),
    [rows, columnId, query, columns],
  );
  const groups = active
    ? [
        { id: 'match', label: 'Matches this column', rows: matches },
        { id: 'miss', label: 'Does not match', rows: others },
      ]
    : [{ id: 'all', label: '', rows }];

  return (
    <div className="table-wrap">
      <div className="table-toolbar">
        <p className="table-count">{rows.length} {rows.length === 1 ? 'row' : 'rows'}</p>
        {columns.length ? (
          <button type="button" className="secondary" onClick={() => setFilterOpen(true)}>
            Filter
          </button>
        ) : null}
      </div>
      <SlideIdFilter
        columns={filterColumns}
        columnId={columnId}
        query={query}
        onColumnId={setColumnId}
        onQuery={setQuery}
        open={filterOpen}
        onClose={() => setFilterOpen(false)}
        matchCount={active ? matches.length : rows.length}
        otherCount={active ? others.length : 0}
      />
      {rows.length === 0 ? <p className="muted">{empty}</p> : null}
      {rows.length === 0 ? null : groups.map((group) => (
        <div key={group.id} className={group.id === 'miss' ? 'table-group is-miss' : 'table-group'}>
          {group.label ? <p className="table-group-label">{group.label} · {group.rows.length}</p> : null}
          {group.rows.length === 0 ? <p className="muted">None</p> : (
            <table className="data-table">
              <thead>
                <tr>
                  {columns.map((column) => (
                    <th key={column.key}>{column.label}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {group.rows.map((row, index) => (
                  <tr key={row.id || index}>
                    {columns.map((column) => (
                      <td key={column.key}>{column.render ? column.render(row) : formatCell(row[column.key])}</td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      ))}
    </div>
  );
}

export function formatCell(value) {
  if (value == null || value === '') return '—';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}T/.test(value)) {
    const date = new Date(value);
    if (!Number.isNaN(date.getTime())) return date.toLocaleString();
  }
  if (typeof value === 'object') return JSON.stringify(value);
  return String(value);
}

export function StatusBadge({ value }) {
  const label = value || '—';
  return <span className={`badge ${String(label).toUpperCase()}`}>{label}</span>;
}

export function useOrgQuery(pathBuilder) {
  const org = useOrganization();
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  async function reload() {
    if (org.status === 'loading') return;
    if (!org.organizationId) {
      setLoading(false);
      setError(org.error || 'Organization is not ready');
      setRows([]);
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api(pathBuilder(org.organizationId));
      setRows(Array.isArray(data) ? data : data ? [data] : []);
    } catch (err) {
      setRows([]);
      setError(err.message || 'Request failed');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    reload();
  }, [org.status, org.organizationId]);

  return { ...org, rows, loading: org.status === 'loading' || loading, error, reload };
}

export function OrgHint() {
  const { name, error } = useOrganization();
  if (error) return <p className="error">{error}</p>;
  if (!name) return null;
  return <p className="muted">Organization: {name}</p>;
}

export function EmptyLink({ children, to }) {
  return (
    <p className="muted">
      {children} <Link to={to}>Open it</Link>
    </p>
  );
}
