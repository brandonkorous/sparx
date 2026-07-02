import type { PartnerKind } from '@sparx/partner-schemas';

// Human labels for the partner `kind` enum (the "what best describes you?" field,
// docs/114 §B.1). Shared by the join form + the directory profile editor so the
// options never drift from the schema.

export const PARTNER_KINDS: readonly { value: PartnerKind; label: string }[] = [
  { value: 'freelance', label: 'Freelancer / independent' },
  { value: 'agency', label: 'Agency / studio' },
  { value: 'developer', label: 'Developer / technical partner' },
  { value: 'other', label: 'Something else' },
] as const;

export function partnerKindLabel(kind: string): string {
  return PARTNER_KINDS.find((k) => k.value === kind)?.label ?? 'Partner';
}
