import { useEffect, useMemo, useState } from 'react';
import { AsmLink as Link } from '../asmHref.jsx';
import { api } from '../api.js';
import { isVerifiedStatus } from '../layout/domains.js';
import { useOrganization } from '../layout/OrganizationContext.jsx';
import { DataTable, OrgHint, PageState, StatusBadge, formatCell } from './ui.jsx';

const TERMINAL = new Set(['COMPLETED', 'PARTIALLY_COMPLETED', 'FAILED', 'CANCELLED']);

/** Tools the user can enable for a subdomain scan (inventory source removed). */
const ENUM_TOOLS = [
  { id: 'crtsh', label: 'crt.sh', group: 'Passive APIs' },
  { id: 'certspotter', label: 'Cert Spotter', group: 'Passive APIs' },
  { id: 'hackertarget', label: 'HackerTarget', group: 'Passive APIs' },
  { id: 'anubis', label: 'Anubis', group: 'Passive APIs' },
  { id: 'otx', label: 'OTX', group: 'Passive APIs' },
  { id: 'wayback', label: 'Wayback CDX', group: 'Passive APIs' },
  { id: 'urlscan', label: 'URLScan', group: 'Passive APIs' },
  { id: 'openssl', label: 'TLS SANs (openssl)', group: 'Passive APIs' },
  { id: 'subfinder', label: 'subfinder', group: 'CLI tools' },
  { id: 'assetfinder', label: 'assetfinder', group: 'CLI tools' },
  { id: 'amass', label: 'amass', group: 'CLI tools' },
  { id: 'gau', label: 'gau', group: 'CLI tools' },
  { id: 'waybackurls', label: 'waybackurls', group: 'CLI tools' },
  { id: 'shosubgo', label: 'shosubgo', group: 'CLI tools' },
  { id: 'cero', label: 'cero', group: 'CLI tools' },
  { id: 'github-subdomains', label: 'github-subdomains', group: 'CLI tools' },
  { id: 'gitlab-subdomains', label: 'gitlab-subdomains', group: 'CLI tools' },
  { id: 'findomain', label: 'findomain', group: 'CLI tools' },
  { id: 'crobat', label: 'crobat', group: 'CLI tools' },
  { id: 'wordlist', label: 'wordlist (active)', group: 'Active / DNS' },
  { id: 'dnsgen', label: 'dnsgen', group: 'Active / DNS' },
  { id: 'massdns', label: 'massdns', group: 'Active / DNS' },
  { id: 'puredns', label: 'puredns', group: 'Active / DNS' },
  { id: 'dnsx', label: 'dnsx', group: 'Active / DNS' },
  { id: 'httpx', label: 'httpx', group: 'Active / DNS' },
];

const DEFAULT_SELECTED = ['crtsh', 'subfinder', 'assetfinder', 'gau', 'waybackurls', 'cero', 'massdns', 'puredns'];

function resolvesLabel(value) {
  if (value === true) return 'Yes';
  if (value === false) return 'No';
  return 'Pending';
}

function toRows(subdomains) {
  return (Array.isArray(subdomains) ? subdomains : []).map((row) => ({
    id: row.hostname,
    hostname: row.hostname,
    resolves: resolvesLabel(row.resolves),
    sourcesList: Array.isArray(row.sources) ? row.sources : [],
    sources: Array.isArray(row.sources) ? row.sources.join(', ') : '',
    ips: Array.isArray(row.ips) && row.ips.length ? row.ips.join(', ') : '—',
  }));
}

/** Per-tool hit counts so you can compare which enum tool found which names. */
function buildToolAccuracy(rows) {
  const totals = new Map();
  const unique = new Map();
  for (const row of rows) {
    const sources = row.sourcesList || [];
    for (const source of sources) {
      totals.set(source, (totals.get(source) || 0) + 1);
      if (sources.length === 1) {
        unique.set(source, (unique.get(source) || 0) + 1);
      }
    }
  }
  return [...totals.entries()]
    .map(([tool, found]) => ({
      id: tool,
      tool,
      found,
      uniqueOnly: unique.get(tool) || 0,
    }))
    .sort((a, b) => b.found - a.found || a.tool.localeCompare(b.tool));
}

function liveEnumEvents(events) {
  return (Array.isArray(events) ? events : [])
    .filter((item) => item.stage === 'SUBDOMAIN_DISCOVERY' || /:\s*(found|skipped)/i.test(item.message || ''))
    .slice(0, 25);
}

const RESOLVES_RANK = {
  'yes-first': { Yes: 0, Pending: 1, No: 2 },
  'no-first': { No: 0, Pending: 1, Yes: 2 },
};

function arrangeByResolves(rows, view) {
  if (view === 'yes' || view === 'no' || view === 'pending') {
    const label = view === 'yes' ? 'Yes' : view === 'no' ? 'No' : 'Pending';
    return rows.filter((row) => row.resolves === label);
  }
  const rank = RESOLVES_RANK[view] || RESOLVES_RANK['yes-first'];
  return [...rows].sort(
    (a, b) => (rank[a.resolves] ?? 3) - (rank[b.resolves] ?? 3) || a.hostname.localeCompare(b.hostname),
  );
}

export default function SubdomainScanPage() {
  const org = useOrganization();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');
  const [scans, setScans] = useState([]);
  const [scan, setScan] = useState(null);
  const [rows, setRows] = useState([]);
  const [resolvesView, setResolvesView] = useState('yes-first');
  const [sourceFilter, setSourceFilter] = useState('all');
  const [selectedTools, setSelectedTools] = useState(() => new Set(DEFAULT_SELECTED));
  const [toolStatus, setToolStatus] = useState({ loading: true, reachable: false, byId: {}, ready: 0, total: 0, error: '', catalog: [] });
  const [toolConfig, setToolConfig] = useState(null);
  const [configError, setConfigError] = useState('');
  const [configBusy, setConfigBusy] = useState(false);
  const toolAccuracy = useMemo(() => buildToolAccuracy(rows), [rows]);
  const toolsWithStatus = useMemo(() => {
    const catalog = toolStatus.catalog.length ? toolStatus.catalog : ENUM_TOOLS;
    return catalog.map((tool) => {
      const status = toolStatus.byId[tool.id];
      if (toolStatus.loading) {
        return { ...tool, ready: null, detail: 'checking…' };
      }
      if (!toolStatus.reachable) {
        return { ...tool, ready: false, detail: toolStatus.error || 'scanner offline' };
      }
      return {
        ...tool,
        label: status?.label || tool.label,
        group: status?.group || tool.group,
        ready: Boolean(status?.ready),
        detail: status?.detail || (status ? '' : 'not reported by scanner'),
      };
    });
  }, [toolStatus]);
  const readyToolIds = useMemo(() => toolsWithStatus.filter((tool) => tool.ready).map((tool) => tool.id), [toolsWithStatus]);
  const toolGroups = useMemo(() => {
    const groups = [];
    for (const tool of toolsWithStatus) {
      let bucket = groups.find((item) => item.name === tool.group);
      if (!bucket) {
        bucket = { name: tool.group, tools: [] };
        groups.push(bucket);
      }
      bucket.tools.push(tool);
    }
    return groups;
  }, [toolsWithStatus]);
  const enumEvents = useMemo(() => liveEnumEvents(scan?.events), [scan?.events]);
  const visibleRows = useMemo(() => {
    const filtered =
      sourceFilter === 'all'
        ? rows
        : rows.filter((row) => (row.sourcesList || []).includes(sourceFilter));
    return arrangeByResolves(filtered, resolvesView).map((row, index) => ({ ...row, serial: index + 1 }));
  }, [rows, resolvesView, sourceFilter]);

  const verified = (org.targets || []).filter((target) => isVerifiedStatus(target.verificationStatus));
  const chosen = (org.targets || []).find((target) => target.id === org.selectedTargetId) || null;
  const selected = verified.find((target) => target.id === org.selectedTargetId) || null;
  const running = scan && !TERMINAL.has(scan.status);

  useEffect(() => {
    let ignore = false;
    async function loadTools() {
      setToolStatus((current) => ({ ...current, loading: true, error: '' }));
      try {
        const result = await api('/discovery/tools');
        const rows = Array.isArray(result.data?.tools) ? result.data.tools : [];
        const byId = {};
        for (const row of rows) {
          byId[row.id] = row;
        }
        if (ignore) return;
        setToolStatus({
          loading: false,
          reachable: Boolean(result.data?.reachable),
          byId,
          catalog: rows.map((row) => ({
            id: row.id,
            label: row.label || row.id,
            group: row.group || 'Tools',
          })),
          ready: Number(result.data?.ready) || 0,
          total: Number(result.data?.total) || rows.length,
          error: result.data?.error || '',
        });
        const readyIds = new Set(rows.filter((row) => row.ready).map((row) => row.id));
        setSelectedTools((current) => {
          const next = new Set([...current].filter((id) => readyIds.has(id)));
          if (next.size === 0) {
            for (const id of DEFAULT_SELECTED) {
              if (readyIds.has(id)) next.add(id);
            }
          }
          return next;
        });
      } catch (err) {
        if (ignore) return;
        setToolStatus({
          loading: false,
          reachable: false,
          byId: {},
          catalog: [],
          ready: 0,
          total: 0,
          error: err.message || 'Could not load tool status',
        });
      }
    }
    loadTools();
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    let ignore = false;
    api('/discovery/tools/config')
      .then((result) => {
        if (!ignore) {
          setToolConfig(result.data || null);
          setConfigError('');
        }
      })
      .catch((err) => {
        if (!ignore) setConfigError(err.message || 'Could not load tool configuration');
      });
    return () => {
      ignore = true;
    };
  }, []);

  useEffect(() => {
    if (!selected?.id) return undefined;
    let ignore = false;
    setScans([]);
    setScan(null);
    setRows([]);
    setError('');

    api(`/targets/${selected.id}/discovery-scans`)
      .then(async (scansResult) => {
        if (ignore) return;
        const list = (Array.isArray(scansResult.data) ? scansResult.data : []).filter(
          (item) => item.mode === 'SUBDOMAIN' || item.mode === 'DNS',
        );
        setScans(list);
        if (!list[0]?.scanId) return;
        const detail = await api(`/scans/${list[0].scanId}`);
        if (ignore) return;
        setScan(detail.data);
        setRows(toRows(detail.data?.subdomains));
      })
      .catch((err) => {
        if (!ignore) setError(err.message || 'Could not load subdomain scans');
      });

    return () => {
      ignore = true;
    };
  }, [selected]);

  useEffect(() => {
    if (!scan?.scanId || !selected || TERMINAL.has(scan.status)) return undefined;
    let stop = false;
    const timer = setInterval(async () => {
      try {
        const result = await api(`/scans/${scan.scanId}`);
        if (stop) return;
        setScan(result.data);
        setRows(toRows(result.data?.subdomains));
        setScans((current) =>
          current.map((item) =>
            item.scanId === result.data?.scanId
              ? {
                  ...item,
                  status: result.data.status,
                  progress: result.data.progress,
                  currentStage: result.data.currentStage,
                  summary: result.data.summary,
                }
              : item,
          ),
        );
      } catch (err) {
        if (!stop) setError(err.message || 'Could not refresh the scan');
      }
    }, 2000);
    return () => {
      stop = true;
      clearInterval(timer);
    };
  }, [scan?.scanId, scan?.status, selected]);

  async function openScan(scanId) {
    setError('');
    const detail = await api(`/scans/${scanId}`);
    setScan(detail.data);
    setRows(toRows(detail.data?.subdomains));
  }

  function toggleTool(id) {
    const meta = toolsWithStatus.find((tool) => tool.id === id);
    if (meta && meta.ready === false) return;
    setSelectedTools((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function selectAllTools() {
    setSelectedTools(new Set(readyToolIds));
  }

  function clearTools() {
    setSelectedTools(new Set());
  }

  function selectRecommended() {
    setSelectedTools(new Set(DEFAULT_SELECTED.filter((id) => readyToolIds.includes(id))));
  }

  function updateConfigTool(id, patch) {
    setToolConfig((current) => {
      if (!current?.tools) return current;
      return {
        ...current,
        tools: current.tools.map((tool) => (tool.id === id ? { ...tool, ...patch } : tool)),
      };
    });
  }

  async function loadToolConfig() {
    try {
      const result = await api('/discovery/tools/config');
      setToolConfig(result.data || null);
      setConfigError('');
    } catch (err) {
      setToolConfig(null);
      setConfigError(err.message || 'Could not load tool configuration');
    }
  }

  async function saveToolConfig() {
    if (!toolConfig) return;
    setConfigBusy(true);
    setConfigError('');
    try {
      const body = {
        ...(toolConfig.wordlistPath ? { wordlistPath: toolConfig.wordlistPath } : {}),
        tools: (toolConfig.tools || [])
          .filter((tool) => tool.ui !== false)
          .map((tool) => ({
            id: tool.id,
            enabled: Boolean(tool.enabled),
            path: tool.path || '',
            timeoutSec: Number(tool.timeoutSec) || 60,
            ...(tool.argsEditable ? { args: Array.isArray(tool.args) ? tool.args : [] } : {}),
            ...(tool.id === 'amass' ? { engineUrl: tool.engineUrl || '' } : {}),
          })),
      };
      const result = await api('/discovery/tools/config', {
        method: 'PUT',
        body: JSON.stringify(body),
      });
      setToolConfig(result.data || toolConfig);
      setNotice('Tool configuration saved');
      await refreshToolStatus();
    } catch (err) {
      setConfigError(err.message || 'Could not save tool configuration');
    } finally {
      setConfigBusy(false);
    }
  }

  async function refreshToolStatus() {
    setToolStatus((current) => ({ ...current, loading: true, error: '' }));
    try {
      const result = await api('/discovery/tools');
      const rows = Array.isArray(result.data?.tools) ? result.data.tools : [];
      const byId = {};
      for (const row of rows) byId[row.id] = row;
      setToolStatus({
        loading: false,
        reachable: Boolean(result.data?.reachable),
        byId,
        catalog: rows.map((row) => ({
          id: row.id,
          label: row.label || row.id,
          group: row.group || 'Tools',
        })),
        ready: Number(result.data?.ready) || 0,
        total: Number(result.data?.total) || rows.length,
        error: result.data?.error || '',
      });
      const readyIds = new Set(rows.filter((row) => row.ready).map((row) => row.id));
      setSelectedTools((current) => new Set([...current].filter((id) => readyIds.has(id))));
    } catch (err) {
      setToolStatus({
        loading: false,
        reachable: false,
        byId: {},
        catalog: [],
        ready: 0,
        total: 0,
        error: err.message || 'Could not load tool status',
      });
    }
  }

  async function queueScan(path, fallbackNotice, body = {}) {
    if (!selected) return;
    setBusy(true);
    setError('');
    setNotice('');
    try {
      const result = await api(`/targets/${selected.id}/${path}`, {
        method: 'POST',
        body: JSON.stringify(body),
      });
      const created = result.data;
      if (created.status === 'FAILED') {
        setError(created.error || result.message);
      } else {
        setNotice(result.message || fallbackNotice);
      }
      const loaded = await api(`/scans/${created.scanId}`);
      setScan(loaded.data);
      setRows(toRows(loaded.data?.subdomains));
      setScans((current) => [loaded.data, ...current.filter((item) => item.scanId !== loaded.data.scanId)]);
    } catch (err) {
      setError(err.message || 'Could not start the scan');
    } finally {
      setBusy(false);
    }
  }

  async function startScan() {
    const sources = [...selectedTools];
    if (sources.length === 0) {
      setError('Select at least one tool before starting the subdomain scan.');
      return;
    }
    await queueScan('subdomain-scans', `Subdomain scan queued for ${selected?.domain || 'domain'} (${sources.length} tools)`, {
      sources,
    });
  }

  async function startDnsResolution() {
    await queueScan(
      'dns-scans',
      `DNS resolution queued for ${selected?.domain || 'domain'} (massdns / puredns on known hostnames)`,
    );
  }

  return (
    <>
      <section className="panel">
        <OrgHint />
        <p className="muted">
          Each row below is a hostname the Go scanner reported for the selected scan. Verify a domain on{' '}
          <Link to="/seed-asset">Seed Asset</Link> before starting.
        </p>
        {notice ? <p className="notice">{notice}</p> : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <PageState loading={org.status === 'loading'} error={org.status === 'error' ? org.error : ''}>
        <section className="panel">
          <div className="row">
            <h2>Subdomain scan</h2>
            <button type="button" className="secondary" onClick={org.reload} disabled={org.status === 'loading'}>
              Refresh
            </button>
          </div>
          {verified.length === 0 ? (
            <p className="muted">No verified domains yet.</p>
          ) : (
            <>
              <label>
                Verified domain
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
                  {chosen.domain || chosen.value} is the domain selected in the header, and it is not verified yet.
                  Verify it on <Link to="/seed-asset">Seed Asset</Link> before scanning. Asset Inventory follows this same domain.
                </p>
              ) : null}
              <div className="tool-picker">
                <div className="row">
                  <h3>
                    Choose tools ({selectedTools.size} selected
                    {!toolStatus.loading ? ` · ${toolStatus.ready}/${toolStatus.total || ENUM_TOOLS.length} ready` : ''})
                  </h3>
                  <div className="actions">
                    <button type="button" className="secondary" disabled={busy || running || toolStatus.loading} onClick={refreshToolStatus}>
                      Refresh status
                    </button>
                    <button type="button" className="secondary" disabled={busy || running} onClick={selectRecommended}>
                      Recommended
                    </button>
                    <button type="button" className="secondary" disabled={busy || running} onClick={selectAllTools}>
                      Select ready
                    </button>
                    <button type="button" className="secondary" disabled={busy || running} onClick={clearTools}>
                      Clear
                    </button>
                  </div>
                </div>
                <p className="muted">
                  <span className="tool-legend tool-legend-ready">Green = ready</span>
                  {' · '}
                  <span className="tool-legend tool-legend-off">Gray = missing / not configured (disabled)</span>
                  {toolStatus.error ? ` · ${toolStatus.error}` : ''}
                </p>
                {toolGroups.map((group) => (
                  <div key={group.name} className="tool-group">
                    <h4>
                      {group.name}
                      <span className="tool-group-count">{group.tools.length}</span>
                    </h4>
                    <div className="tool-grid">
                      {group.tools.map((tool) => {
                        const offline = tool.ready === false;
                        const pending = tool.ready === null;
                        return (
                          <label
                            key={tool.id}
                            className={`tool-check ${offline ? 'tool-off' : ''} ${tool.ready ? 'tool-ready' : ''} ${pending ? 'tool-pending' : ''}`}
                            title={tool.detail || tool.label}
                          >
                            <input
                              type="checkbox"
                              checked={selectedTools.has(tool.id) && !offline}
                              disabled={busy || running || offline || pending}
                              onChange={() => toggleTool(tool.id)}
                            />
                            <span className="tool-copy">
                              <span className="tool-label">{tool.label}</span>
                              <span className="tool-state">
                                <span className={`tool-dot ${tool.ready ? 'on' : offline ? 'off' : 'wait'}`} aria-hidden />
                                {pending ? 'Checking' : offline ? 'Not configured' : 'Ready'}
                              </span>
                            </span>
                          </label>
                        );
                      })}
                    </div>
                  </div>
                ))}
                <details className="tool-config">
                  <summary>Tool configuration</summary>
                  <p className="muted">
                    Enable or disable approved tools, set an absolute binary path, and adjust the timeout.
                    Arguments can be changed only for tools whose command is a simple template. The scanner
                    rejects any path that is not the approved binary.
                  </p>
                  {configError ? <p className="muted">{configError}</p> : null}
                  {toolConfig?.wordlistPath ? (
                    <label>
                      Wordlist file
                      <input
                        value={toolConfig.wordlistPath}
                        onChange={(event) =>
                          setToolConfig((current) => ({ ...current, wordlistPath: event.target.value }))
                        }
                      />
                    </label>
                  ) : null}
                  {(toolConfig?.tools || [])
                    .filter((tool) => tool.ui !== false)
                    .map((tool) => (
                      <div key={tool.id} className="tool-config-row">
                        <label>
                          <input
                            type="checkbox"
                            checked={Boolean(tool.enabled)}
                            onChange={(event) => updateConfigTool(tool.id, { enabled: event.target.checked })}
                          />
                          {tool.label || tool.id}
                        </label>
                        {tool.binary ? (
                          <label>
                            Path
                            <input
                              value={tool.path || ''}
                              placeholder="Leave empty to use ASM_TOOLS_DIR or PATH"
                              onChange={(event) => updateConfigTool(tool.id, { path: event.target.value })}
                            />
                          </label>
                        ) : null}
                        <label>
                          Timeout (seconds)
                          <input
                            type="number"
                            min="1"
                            max="600"
                            value={tool.timeoutSec || 60}
                            onChange={(event) =>
                              updateConfigTool(tool.id, { timeoutSec: Number(event.target.value) })
                            }
                          />
                        </label>
                        {tool.argsEditable ? (
                          <label>
                            Arguments
                            <input
                              value={(tool.args || []).join(' ')}
                              onChange={(event) =>
                                updateConfigTool(tool.id, {
                                  args: event.target.value.split(/\s+/).filter(Boolean),
                                })
                              }
                            />
                          </label>
                        ) : null}
                        {tool.id === 'amass' ? (
                          <label>
                            Engine URL
                            <input
                              value={tool.engineUrl || ''}
                              placeholder="http://127.0.0.1:4001"
                              onChange={(event) => updateConfigTool(tool.id, { engineUrl: event.target.value })}
                            />
                          </label>
                        ) : null}
                      </div>
                    ))}
                  <div className="actions">
                    <button type="button" className="secondary" disabled={configBusy || !toolConfig} onClick={saveToolConfig}>
                      {configBusy ? 'Saving…' : 'Save tool configuration'}
                    </button>
                  </div>
                </details>
              </div>
              <div className="actions">
                <button type="button" disabled={busy || running || !selected || selectedTools.size === 0} onClick={startScan}>
                  {running ? 'Scan running' : `Run subdomain scan (${selectedTools.size} tools)`}
                </button>
                <button
                  type="button"
                  className="secondary"
                  disabled={busy || running || !selected}
                  onClick={startDnsResolution}
                  title="Resolve already-known hostnames with massdns / puredns (skips subdomain enum)"
                >
                  Start DNS resolution
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
                        setRows(toRows(result.data?.subdomains));
                      } catch (err) {
                        setError(err.message || 'Could not cancel the scan');
                      } finally {
                        setBusy(false);
                      }
                    }}
                  >
                    Cancel
                  </button>
                ) : null}
              </div>
              <p className="muted">
                DNS-only validation (from DB, no enum): <Link to="/dns-live">DNS Live Validation</Link>.
              </p>
            </>
          )}
        </section>

        <section className="panel">
          <h2>
            Scans{selected ? ` for ${selected.domain}` : ''}
            {` · ${scans.length}`}
          </h2>
          <DataTable
            rows={scans.map((item) => ({
              id: item.scanId,
              name: item.name || (item.mode === 'DNS' ? 'DNS resolution' : 'Subdomain scan'),
              mode: item.mode === 'DNS' ? 'DNS' : 'Subdomain',
              status: item.status,
              progress: `${item.progress ?? 0}%`,
              stage: item.currentStage || item.stage || '—',
              startedAt: item.startedAt,
              names: item.summary?.totalSubdomains ?? 0,
            }))}
            empty="No subdomain / DNS scans yet."
            columns={[
              { key: 'name', label: 'Scan' },
              { key: 'mode', label: 'Mode' },
              { key: 'status', label: 'Status', render: (row) => <StatusBadge value={row.status} /> },
              { key: 'progress', label: 'Progress' },
              { key: 'stage', label: 'Stage' },
              { key: 'names', label: 'Subdomains' },
              { key: 'startedAt', label: 'Started', render: (row) => formatCell(row.startedAt) },
              {
                key: 'open',
                label: '',
                render: (row) => (
                  <button type="button" className="secondary" onClick={() => openScan(row.id).catch((err) => setError(err.message))}>
                    {scan?.scanId === row.id ? 'Showing' : 'View names'}
                  </button>
                ),
              },
            ]}
          />
        </section>

        <section className="panel">
          <h2>Tool accuracy (live)</h2>
          <p className="muted">
            Counts update as each Go enum tool finishes. <strong>Unique only</strong> means this tool alone found the
            name — useful for comparing coverage vs overlap.
          </p>
          <DataTable
            rows={toolAccuracy}
            empty="No tool hits yet. Start a scan and watch this table fill as sources report."
            columns={[
              { key: 'tool', label: 'Tool / source' },
              { key: 'found', label: 'Hostnames found' },
              { key: 'uniqueOnly', label: 'Unique only' },
            ]}
          />
          {enumEvents.length ? (
            <>
              <h3>Live source feed</h3>
              <ul className="muted">
                {enumEvents.map((item, index) => (
                  <li key={`${item.id || item.createdAt || index}-${item.message}`}>
                    {formatCell(item.createdAt)} · {item.message}
                  </li>
                ))}
              </ul>
            </>
          ) : null}
        </section>

        <section className="panel">
          <h2>
            Subdomains from the Go scanner
            {scan ? ` · ${scan.summary?.totalSubdomains ?? rows.length}` : ''}
          </h2>
          {scan ? (
            <p className="muted">
              {scan.name || 'Subdomain scan'} · <StatusBadge value={scan.status} /> · {scan.progress ?? 0}% ·{' '}
              {scan.currentStage || 'queued'}
              {' · '}
              {scan.summary?.resolvingSubdomains ?? 0} resolving · {scan.summary?.nonResolvingSubdomains ?? 0} not resolving
            </p>
          ) : null}
          <div className="row">
            <label>
              Resolves
              <select value={resolvesView} onChange={(event) => setResolvesView(event.target.value)}>
                <option value="yes-first">All, Yes first</option>
                <option value="no-first">All, No first</option>
                <option value="yes">Yes only</option>
                <option value="no">No only</option>
                <option value="pending">Pending only</option>
              </select>
            </label>
            <label>
              Source tool
              <select value={sourceFilter} onChange={(event) => setSourceFilter(event.target.value)}>
                <option value="all">All sources</option>
                {toolAccuracy.map((row) => (
                  <option key={row.tool} value={row.tool}>
                    {row.tool} ({row.found})
                  </option>
                ))}
              </select>
            </label>
          </div>
          {Array.isArray(scan?.stageErrors) && scan.stageErrors.length ? (
            <ul className="muted">
              {scan.stageErrors.map((item, index) => (
                <li key={`${item.source || item.stage}-${index}`}>
                  {item.source || item.stage}: {item.message}
                </li>
              ))}
            </ul>
          ) : null}
          <DataTable
            rows={visibleRows}
            empty={
              rows.length
                ? 'No subdomains match these filters.'
                : 'No subdomains yet. Names appear here as the Go scanner reports them.'
            }
            columns={[
              { key: 'serial', label: '#' },
              { key: 'hostname', label: 'Hostname' },
              { key: 'resolves', label: 'Resolves' },
              { key: 'ips', label: 'Addresses' },
              { key: 'sources', label: 'Sources' },
            ]}
          />
        </section>
      </PageState>
    </>
  );
}
