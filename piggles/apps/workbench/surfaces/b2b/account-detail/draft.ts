import { type AccountDetail, type AccountStatus, type PaymentTerms } from '../accounts-data';

export interface Draft {
  companyName: string;
  taxId: string;
  website: string;
  tierId: string;
  /** Whole currency units while editing (MoneyInput works in dollars). */
  creditLimit: number;
  /** `''` is a real answer — nothing was agreed — and not the same as a
   *  day count of zero. See lib/payment-terms.ts. */
  paymentTerms: PaymentTerms;
  discountPercent: number;
  status: AccountStatus;
  notes: string;
  fleetSize: string;
  /** The extra details THIS business tracks on a company (docs/144 §3). */
  customProperties: Record<string, unknown>;
}

export function emptyDraft(): Draft {
  return {
    companyName: '',
    taxId: '',
    website: '',
    tierId: '',
    creditLimit: 0,
    paymentTerms: '',
    discountPercent: 0,
    status: 'active',
    notes: '',
    fleetSize: '',
    customProperties: {},
  };
}

export function toDraft(account: AccountDetail): Draft {
  return {
    companyName: account.companyName,
    taxId: account.taxId ?? '',
    website: account.website ?? '',
    tierId: account.pricingTierId ?? '',
    creditLimit: account.creditLimitCents / 100,
    paymentTerms: account.paymentTerms ?? '',
    discountPercent: account.discountPercent,
    status: account.status,
    notes: account.notes ?? '',
    fleetSize: account.fleetSize != null ? String(account.fleetSize) : '',
    customProperties: account.customProperties ?? {},
  };
}

/** A website a person typed without a scheme still has to satisfy the server's
 *  URL check — so "acme.com" becomes "https://acme.com" on the way out. */
function normalizeWebsite(value: string): string | null {
  const trimmed = value.trim();
  if (trimmed === '') return null;
  if (/^https?:\/\//i.test(trimmed)) return trimmed;
  return `https://${trimmed}`;
}

type SetField = <K extends keyof Draft>(key: K, value: Draft[K]) => void;

export function draftChecks(draft: Draft) {
  const nameError = draft.companyName.trim() === '' ? 'Give this customer a company name.' : null;
  const discountError =
    draft.discountPercent < 0 || draft.discountPercent > 100
      ? 'The discount has to be between 0% and 100%.'
      : null;
  const fleetError =
    draft.fleetSize !== '' && (Number.isNaN(Number(draft.fleetSize)) || Number(draft.fleetSize) < 0)
      ? 'The fleet size has to be a whole number, or left blank.'
      : null;
  const blocking = nameError ?? discountError ?? fleetError;
  return { nameError, discountError, fleetError, blocking };
}

export function isDraftDirty(draft: Draft, saved: Draft, isNew: boolean): boolean {
  return isNew
    ? draft.companyName.trim() !== '' ||
        draft.taxId.trim() !== '' ||
        draft.website.trim() !== '' ||
        draft.tierId !== '' ||
        draft.creditLimit !== 0 ||
        draft.paymentTerms !== '' ||
        draft.discountPercent !== 0 ||
        draft.status !== 'active' ||
        draft.notes.trim() !== ''
    : draft.companyName !== saved.companyName ||
        draft.taxId !== saved.taxId ||
        draft.website !== saved.website ||
        draft.tierId !== saved.tierId ||
        draft.creditLimit !== saved.creditLimit ||
        draft.paymentTerms !== saved.paymentTerms ||
        draft.discountPercent !== saved.discountPercent ||
        draft.status !== saved.status ||
        draft.notes !== saved.notes ||
        draft.fleetSize !== saved.fleetSize;
}

export function identityFrom(draft: Draft) {
  return {
    companyName: draft.companyName.trim(),
    taxId: draft.taxId.trim() === '' ? null : draft.taxId.trim(),
    website: normalizeWebsite(draft.website),
    creditLimit: draft.creditLimit,
    paymentTerms: draft.paymentTerms === '' ? null : draft.paymentTerms,
    discountPercent: draft.discountPercent,
    status: draft.status,
    notes: draft.notes.trim() === '' ? null : draft.notes.trim(),
  };
}

export type Identity = ReturnType<typeof identityFrom>;

export interface FieldProps {
  draft: Draft;
  set: SetField;
}
