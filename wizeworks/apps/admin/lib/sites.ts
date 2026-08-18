// Site (Property) presentation for the operator console (user & site management).
// Site status + domain status map to semantic Badge tones + human labels here so
// every site surface reads the same way.

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

/** Property.status — active | paused | archived. */
export function siteStatusTone(status: string): Tone {
  if (status === 'active') return 'success';
  if (status === 'paused') return 'warning';
  if (status === 'archived') return 'neutral';
  return 'neutral';
}

export function siteStatusLabel(status: string): string {
  const LABELS: Record<string, string> = {
    active: 'Active',
    paused: 'Paused',
    archived: 'Archived',
  };
  return LABELS[status] ?? status;
}

/** Domain.status — pending | verifying | verified | active | failed. */
export function domainStatusTone(status: string): Tone {
  if (status === 'active' || status === 'verified') return 'success';
  if (status === 'failed') return 'danger';
  if (status === 'pending' || status === 'verifying') return 'warning';
  return 'neutral';
}

const DOMAIN_TYPE_LABELS: Record<string, string> = {
  subdomain: 'Subdomain',
  custom: 'Custom',
  purchased: 'Purchased',
};
export function domainTypeLabel(type: string): string {
  return DOMAIN_TYPE_LABELS[type] ?? type;
}
