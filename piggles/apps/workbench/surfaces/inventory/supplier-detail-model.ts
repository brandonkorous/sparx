// The supplier form as typed: an empty one for a new supplier, one filled in
// from a saved record, and the rule a short code has to follow.

import type { SupplierFormFields } from './supplier-input';
import type { SupplierDetail } from './suppliers-data';

export const CODE_PATTERN = /^[A-Za-z0-9_-]+$/;

export type SetSupplierField = (key: keyof SupplierFormFields, value: string) => void;

export const EMPTY_FORM: SupplierFormFields = {
  name: '',
  code: '',
  contactName: '',
  email: '',
  phone: '',
  website: '',
  line1: '',
  line2: '',
  city: '',
  region: '',
  postalCode: '',
  country: '',
  paymentTerms: '',
  leadTimeDays: '',
  currency: 'USD',
  notes: '',
};

export function formFrom(supplier: SupplierDetail): SupplierFormFields {
  return {
    name: supplier.name,
    code: supplier.code,
    contactName: supplier.contactName ?? '',
    email: supplier.email ?? '',
    phone: supplier.phone ?? '',
    website: supplier.website ?? '',
    line1: supplier.line1 ?? '',
    line2: supplier.line2 ?? '',
    city: supplier.city ?? '',
    region: supplier.region ?? '',
    postalCode: supplier.postalCode ?? '',
    country: supplier.country ?? '',
    paymentTerms: supplier.paymentTerms ?? '',
    leadTimeDays: supplier.leadTimeDays === null ? '' : String(supplier.leadTimeDays),
    currency: supplier.currency,
    notes: supplier.notes ?? '',
  };
}
