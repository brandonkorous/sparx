// Partner-program presentation for the operator console (Slice 9). Tiers,
// application/partner/commission/referral statuses, and bootcamp formats map to
// semantic Badge tones + human labels here, so every partner surface reads the
// same way. Tones are the shared semantic set (`statusTone`'s vocabulary); these
// cover the partner-specific values that the curated dictionary doesn't.

export type Tone = 'primary' | 'success' | 'warning' | 'danger' | 'info' | 'neutral';

const TIER_LABELS: Record<string, string> = {
  informal: 'Informal',
  registered: 'Registered',
  certified: 'Certified',
};
export function tierLabel(tier: string): string {
  return TIER_LABELS[tier] ?? tier;
}
export function tierTone(tier: string): Tone {
  if (tier === 'certified') return 'success';
  if (tier === 'registered') return 'primary';
  return 'neutral';
}

export function partnerStatusTone(status: string): Tone {
  if (status === 'active') return 'success';
  if (status === 'suspended') return 'danger';
  return 'neutral';
}

export function applicationStatusTone(status: string): Tone {
  if (status === 'approved') return 'success';
  if (status === 'rejected') return 'danger';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

export function commissionStatusTone(status: string): Tone {
  if (status === 'paid') return 'success';
  if (status === 'approved') return 'info';
  if (status === 'pending') return 'warning';
  return 'neutral'; // forfeited
}

export function referralStatusTone(status: string): Tone {
  if (status === 'active') return 'success';
  if (status === 'pending') return 'warning';
  return 'neutral';
}

const KIND_LABELS: Record<string, string> = {
  freelance: 'Freelancer',
  agency: 'Agency',
  educator: 'Educator',
  reseller: 'Reseller',
};
export function partnerKindLabel(kind: string): string {
  return KIND_LABELS[kind] ?? kind;
}

const FORMAT_LABELS: Record<string, string> = {
  in_person: 'In person',
  virtual: 'Virtual',
  hybrid: 'Hybrid',
  async: 'Self-paced',
};
export function bootcampFormatLabel(format: string): string {
  return FORMAT_LABELS[format] ?? format;
}

/** A bootcamp's location line, or a format-appropriate fallback. */
export function bootcampLocation(city: string | null, state: string | null): string | null {
  const parts = [city, state].filter((v): v is string => Boolean(v?.trim()));
  return parts.length > 0 ? parts.join(', ') : null;
}
