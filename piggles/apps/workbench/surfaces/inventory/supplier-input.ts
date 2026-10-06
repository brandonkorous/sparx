// A supplier's form, as the API takes it.
//
// A blank box is sent as null, which the API reads as "take this off". It used
// to be left out, which the API reads as "leave it alone", so a supplier's
// email, phone or address could be changed but never removed: clearing the
// email and saving said "Alliant Power saved" over the address still on file,
// and every order went on offering to email it (sparx persona issue 073).

import type { SupplierInput } from './suppliers-data';

export interface SupplierFormFields {
  name: string;
  code: string;
  contactName: string;
  email: string;
  phone: string;
  website: string;
  line1: string;
  line2: string;
  city: string;
  region: string;
  postalCode: string;
  country: string;
  paymentTerms: string;
  leadTimeDays: string;
  currency: string;
  notes: string;
}

export function supplierInputFrom(form: SupplierFormFields): SupplierInput {
  const text = (value: string) => (value.trim() === '' ? null : value.trim());
  const lead = form.leadTimeDays.trim();
  const leadDays = Number.parseInt(lead, 10);
  const country = form.country.trim();
  return {
    name: form.name.trim(),
    code: form.code.trim(),
    contactName: text(form.contactName),
    email: text(form.email),
    phone: text(form.phone),
    website: text(form.website),
    line1: text(form.line1),
    line2: text(form.line2),
    city: text(form.city),
    region: text(form.region),
    postalCode: text(form.postalCode),
    // Exactly two letters, or cleared. Anything else is left out, so a half
    // typed code never wipes the one on file.
    ...(country === ''
      ? { country: null }
      : country.length === 2
        ? { country: country.toUpperCase() }
        : {}),
    paymentTerms: text(form.paymentTerms),
    // Cleared, or a whole number of days. Text that is not a number is left
    // out rather than read as "no lead time".
    ...(lead === ''
      ? { leadTimeDays: null }
      : Number.isFinite(leadDays) && leadDays >= 0
        ? { leadTimeDays: leadDays }
        : {}),
    currency: form.currency.trim() === '' ? 'USD' : form.currency.trim().toUpperCase(),
    notes: text(form.notes),
  };
}
