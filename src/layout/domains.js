import { api } from '../api.js';

const VERIFIED = new Set(['VERIFIED', 'MANUALLY_APPROVED']);

export function isVerifiedStatus(status) {
  return VERIFIED.has(status);
}

/** Domains from every organization this session can read, with the owning org attached. */
export async function loadDomains() {
  const { data } = await api('/organizations');
  const organizations = Array.isArray(data) ? data : [];

  const groups = await Promise.all(
    organizations.map(async (org) => {
      const result = await api(`/targets?organizationId=${encodeURIComponent(org.id)}`);
      const rows = Array.isArray(result.data) ? result.data : [];
      return rows.map((target) => ({
        ...target,
        organizationId: target.organizationId || org.id,
        organizationName: org.name || org.slug || org.id,
      }));
    }),
  );

  const targets = groups.flat();
  const active =
    organizations.find((org) =>
      targets.some(
        (target) => target.organizationId === org.id && isVerifiedStatus(target.verificationStatus),
      ),
    ) ||
    organizations[0] ||
    null;

  return { organizations, targets, active };
}
