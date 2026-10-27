import { createContext, useContext, useEffect, useMemo, useState } from 'react';
import { isVerifiedStatus, loadDomains } from './domains.js';

const OrganizationContext = createContext(null);

export function OrganizationProvider({ children }) {
  const [status, setStatus] = useState('loading');
  const [organizations, setOrganizations] = useState([]);
  const [organizationId, setOrganizationId] = useState('');
  const [name, setName] = useState('');
  const [targets, setTargets] = useState([]);
  const [selectedTargetId, setSelectedTargetId] = useState('');
  const [error, setError] = useState('');

  async function load() {
    setStatus('loading');
    setError('');
    try {
      const result = await loadDomains();
      if (!result.active) {
        throw new Error('No organizations found. Run pnpm db:seed on the backend.');
      }
      setOrganizations(result.organizations);
      setTargets(result.targets);
      setOrganizationId(result.active.id);
      setName(result.active.name || result.active.id);
      const orgTargets = result.targets.filter((target) => target.organizationId === result.active.id);
      const preferred =
        orgTargets.find((target) => isVerifiedStatus(target.verificationStatus)) || orgTargets[0] || null;
      setSelectedTargetId(preferred?.id || '');
      setStatus('ready');
    } catch (err) {
      setOrganizations([]);
      setTargets([]);
      setOrganizationId('');
      setName('');
      setSelectedTargetId('');
      setError(err.message || 'Could not load organization');
      setStatus('error');
    }
  }

  function selectOrganization(id) {
    const org = organizations.find((item) => item.id === id);
    if (!org) return;
    setOrganizationId(org.id);
    setName(org.name || org.id);
    const orgTargets = targets.filter((target) => target.organizationId === org.id);
    const preferred =
      orgTargets.find((target) => isVerifiedStatus(target.verificationStatus)) || orgTargets[0] || null;
    setSelectedTargetId(preferred?.id || '');
  }

  useEffect(() => {
    load();
  }, []);

  const value = useMemo(
    () => ({
      status,
      organizations,
      organizationId,
      name,
      targets,
      selectedTargetId,
      selectedTarget: targets.find((target) => target.id === selectedTargetId) || null,
      error,
      reload: load,
      selectOrganization,
      selectTarget: setSelectedTargetId,
    }),
    [status, organizations, organizationId, name, targets, selectedTargetId, error],
  );

  return <OrganizationContext.Provider value={value}>{children}</OrganizationContext.Provider>;
}

export function useOrganization() {
  const ctx = useContext(OrganizationContext);
  if (!ctx) throw new Error('useOrganization must be used within OrganizationProvider');
  return ctx;
}
