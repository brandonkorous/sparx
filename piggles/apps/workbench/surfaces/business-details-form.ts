// The shape of the business record, and the two conversions at its boundaries.
//
// Split out of business-details.tsx, which owns the SURFACE — the query, the
// save, the layout. What a business record is made of is a separate question and
// the one the invoicing and scheduling sides also need to reason about.

export interface BusinessDetails {
  businessName: string | null;
  entityType: string | null;
  registrationNumber: string | null;
  taxId: string | null;
  taxRegistered: boolean;
  phone: string | null;
  supportEmail: string | null;
  addressLine1: string | null;
  addressLine2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  timezone: string | null;
  defaultCurrency: string | null;
}

/** The form's own shape: every text field is a string, never null, because a
 *  controlled input cannot hold null without React complaining. Converted back
 *  at the boundary — see `toPayload`. */
export type FormState = Record<Exclude<keyof BusinessDetails, 'taxRegistered'>, string> & {
  taxRegistered: boolean;
};

export const EMPTY: FormState = {
  businessName: '',
  entityType: '',
  registrationNumber: '',
  taxId: '',
  taxRegistered: false,
  phone: '',
  supportEmail: '',
  addressLine1: '',
  addressLine2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  timezone: '',
  defaultCurrency: '',
};

/** How the business is constituted. An open set on the server (jurisdictions
 *  differ), but these cover the common cases without making someone type. */
export const ENTITY_TYPES = [
  { value: '', label: 'Not set' },
  { value: 'sole_trader', label: 'Sole trader / sole proprietor' },
  { value: 'partnership', label: 'Partnership' },
  { value: 'llc', label: 'LLC' },
  { value: 'corporation', label: 'Corporation' },
  { value: 'nonprofit', label: 'Non-profit' },
  { value: 'other', label: 'Other' },
];

export function toForm(data: BusinessDetails): FormState {
  return {
    businessName: data.businessName ?? '',
    entityType: data.entityType ?? '',
    registrationNumber: data.registrationNumber ?? '',
    taxId: data.taxId ?? '',
    taxRegistered: data.taxRegistered,
    phone: data.phone ?? '',
    supportEmail: data.supportEmail ?? '',
    addressLine1: data.addressLine1 ?? '',
    addressLine2: data.addressLine2 ?? '',
    city: data.city ?? '',
    region: data.region ?? '',
    postalCode: data.postalCode ?? '',
    country: data.country ?? '',
    timezone: data.timezone ?? '',
    defaultCurrency: data.defaultCurrency ?? '',
  };
}

/** Empty string means "cleared", which the API models as null — the server
 *  trims and nulls too, but sending null makes the intent explicit rather than
 *  relying on a coercion at the far end. */
export function toPayload(form: FormState): Record<string, string | boolean | null> {
  const out: Record<string, string | boolean | null> = { taxRegistered: form.taxRegistered };
  for (const [key, value] of Object.entries(form)) {
    if (key === 'taxRegistered') continue;
    out[key] = typeof value === 'string' && value.trim() === '' ? null : value;
  }
  return out;
}

/** FORMAT only. Whether an address actually receives mail is not knowable from
 *  here, and refusing to save over a deliverability guess would be worse than
 *  the typo. This catches "hello@" and "hello.com" — the mistakes that make a
 *  support address silently unreachable. */
export function emailIsMalformed(supportEmail: string): boolean {
  const value = supportEmail.trim();
  return value !== '' && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}
