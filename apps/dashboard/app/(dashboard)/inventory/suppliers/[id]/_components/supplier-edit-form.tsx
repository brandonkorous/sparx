'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardBody,
  CardActions,
  Checkbox,
  Field,
  FieldControl,
  FieldLabel,
  FieldStatus,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { updateSupplierAction } from '../../../_lib/supplier-actions';
import { useUnsavedGuard } from '../../../../_components/unsaved-guard';

export interface SupplierDetail {
  id: string;
  name: string;
  code: string;
  contactName: string | null;
  email: string | null;
  phone: string | null;
  website: string | null;
  line1: string | null;
  line2: string | null;
  city: string | null;
  region: string | null;
  postalCode: string | null;
  country: string | null;
  paymentTerms: string | null;
  leadTimeDays: number | null;
  currency: string;
  notes: string | null;
  isActive: boolean;
}

// Optional-email rule: blank is fine, but a typed value must be a real address.
const optionalEmail = (value: unknown): string | null => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (s === '') return null;
  return rule.email()(s);
};

// Optional non-negative integer (lead time in days).
const optionalLeadTime = (value: unknown): string | null => {
  const s = typeof value === 'string' ? value.trim() : '';
  if (s === '') return null;
  const n = Number(s);
  if (!Number.isFinite(n)) return 'Enter a number of days.';
  if (n < 0) return 'Lead time cannot be negative.';
  return null;
};

export function SupplierEditForm({ supplier }: { supplier: SupplierDetail }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const [name, setName] = React.useState(supplier.name);
  const [code, setCode] = React.useState(supplier.code);
  const [contactName, setContactName] = React.useState(supplier.contactName ?? '');
  const [email, setEmail] = React.useState(supplier.email ?? '');
  const [phone, setPhone] = React.useState(supplier.phone ?? '');
  const [website, setWebsite] = React.useState(supplier.website ?? '');
  const [line1, setLine1] = React.useState(supplier.line1 ?? '');
  const [line2, setLine2] = React.useState(supplier.line2 ?? '');
  const [city, setCity] = React.useState(supplier.city ?? '');
  const [region, setRegion] = React.useState(supplier.region ?? '');
  const [postalCode, setPostalCode] = React.useState(supplier.postalCode ?? '');
  const [country, setCountry] = React.useState(supplier.country ?? '');
  const [paymentTerms, setPaymentTerms] = React.useState(supplier.paymentTerms ?? '');
  const [leadTimeDays, setLeadTimeDays] = React.useState(
    supplier.leadTimeDays !== null ? String(supplier.leadTimeDays) : ''
  );
  const [currency, setCurrency] = React.useState(supplier.currency);
  const [notes, setNotes] = React.useState(supplier.notes ?? '');
  const [isActive, setIsActive] = React.useState(supplier.isActive);

  const values = { name, code, email, leadTimeDays };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    code: rule.required('Code is required.'),
    email: optionalEmail,
    leadTimeDays: optionalLeadTime,
  });

  // Dirtiness compares live state to the passed-in supplier baseline.
  const dirty =
    name.trim() !== supplier.name ||
    code.trim() !== supplier.code ||
    contactName.trim() !== (supplier.contactName ?? '') ||
    email.trim() !== (supplier.email ?? '') ||
    phone.trim() !== (supplier.phone ?? '') ||
    website.trim() !== (supplier.website ?? '') ||
    line1.trim() !== (supplier.line1 ?? '') ||
    line2.trim() !== (supplier.line2 ?? '') ||
    city.trim() !== (supplier.city ?? '') ||
    region.trim() !== (supplier.region ?? '') ||
    postalCode.trim() !== (supplier.postalCode ?? '') ||
    country.trim() !== (supplier.country ?? '') ||
    paymentTerms.trim() !== (supplier.paymentTerms ?? '') ||
    leadTimeDays.trim() !== (supplier.leadTimeDays !== null ? String(supplier.leadTimeDays) : '') ||
    currency.trim() !== supplier.currency ||
    notes.trim() !== (supplier.notes ?? '') ||
    isActive !== supplier.isActive;

  useUnsavedGuard(dirty, { kind: 'edit', noun: 'supplier' });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);
    if (!v.validate()) return;

    const opt = (val: string) => (val.trim() ? val.trim() : null);
    const lead = leadTimeDays.trim();
    const input = {
      name: name.trim(),
      code: code.trim().toUpperCase(),
      contactName: opt(contactName),
      email: opt(email),
      phone: opt(phone),
      website: opt(website),
      line1: opt(line1),
      line2: opt(line2),
      city: opt(city),
      region: opt(region),
      postalCode: opt(postalCode),
      country: opt(country)?.toUpperCase() ?? null,
      paymentTerms: opt(paymentTerms),
      leadTimeDays: lead ? Number(lead) : null,
      currency: (currency.trim() || supplier.currency).toUpperCase(),
      notes: opt(notes),
      isActive,
    };

    startTransition(async () => {
      const result = await updateSupplierAction(supplier.id, input);
      if (!result.ok) {
        setError(result.error.message);
        const map: Partial<Record<keyof typeof values, string>> = {};
        for (const d of result.error.details ?? []) {
          if (d.field === 'name' || d.field === 'code' || d.field === 'email') {
            map[d.field] = d.message;
          }
        }
        v.setServerErrors(map);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <form onSubmit={onSubmit}>
      <Card>
        <CardBody>
          <div className="flex flex-col gap-1">
            <h3 className="text-xl font-semibold">Details</h3>
            <p className="opacity-70">Contact, address, and default purchasing terms.</p>
          </div>
          <div className="flex flex-col gap-4">
            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[12rem] flex-1" {...v.field('name')}>
                <FieldLabel required>Name</FieldLabel>
                <FieldControl
                  name="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  {...v.control('name')}
                />
              </Field>
              <Field className="min-w-[12rem] flex-1" {...v.field('code')}>
                <FieldLabel required>Code</FieldLabel>
                <FieldControl
                  name="code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  pattern="[A-Za-z0-9_-]+"
                  {...v.control('code')}
                />
              </Field>
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Contact name</FieldLabel>
                <FieldControl
                  name="contactName"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                />
              </Field>
              <Field className="min-w-[12rem] flex-1" {...v.field('email')}>
                <FieldLabel>Email</FieldLabel>
                <FieldControl
                  name="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  {...v.control('email')}
                />
              </Field>
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Phone</FieldLabel>
                <FieldControl
                  name="phone"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                />
              </Field>
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Website</FieldLabel>
                <FieldControl
                  name="website"
                  value={website}
                  onChange={(e) => setWebsite(e.target.value)}
                />
              </Field>
            </div>
            <Field className="min-w-[12rem] flex-1">
              <FieldLabel>Address line 1</FieldLabel>
              <FieldControl name="line1" value={line1} onChange={(e) => setLine1(e.target.value)} />
            </Field>
            <Field className="min-w-[12rem] flex-1">
              <FieldLabel>Address line 2</FieldLabel>
              <FieldControl name="line2" value={line2} onChange={(e) => setLine2(e.target.value)} />
            </Field>
            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>City</FieldLabel>
                <FieldControl name="city" value={city} onChange={(e) => setCity(e.target.value)} />
              </Field>
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Region</FieldLabel>
                <FieldControl
                  name="region"
                  value={region}
                  onChange={(e) => setRegion(e.target.value)}
                />
              </Field>
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Postal code</FieldLabel>
                <FieldControl
                  name="postalCode"
                  value={postalCode}
                  onChange={(e) => setPostalCode(e.target.value)}
                />
              </Field>
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Country</FieldLabel>
                <FieldControl
                  name="country"
                  value={country}
                  onChange={(e) => setCountry(e.target.value)}
                  maxLength={2}
                />
              </Field>
            </div>
            <div className="flex flex-row flex-wrap gap-3">
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Payment terms</FieldLabel>
                <FieldControl
                  name="paymentTerms"
                  value={paymentTerms}
                  onChange={(e) => setPaymentTerms(e.target.value)}
                />
              </Field>
              <Field className="min-w-[12rem] flex-1" {...v.field('leadTimeDays')}>
                <FieldLabel>Lead time (days)</FieldLabel>
                <FieldControl
                  name="leadTimeDays"
                  type="number"
                  min="0"
                  value={leadTimeDays}
                  onChange={(e) => setLeadTimeDays(e.target.value)}
                  {...v.control('leadTimeDays')}
                />
              </Field>
              <Field className="min-w-[12rem] flex-1">
                <FieldLabel>Currency</FieldLabel>
                <FieldControl
                  name="currency"
                  value={currency}
                  onChange={(e) => setCurrency(e.target.value)}
                  maxLength={3}
                />
              </Field>
            </div>
            <Field>
              <FieldLabel>Notes</FieldLabel>
              <FieldControl
                render={<Textarea rows={3} />}
                name="notes"
                value={notes}
                onChange={(e) => setNotes(e.target.value)}
              />
            </Field>
            <label className="flex items-center gap-2">
              <Checkbox
                color="module"
                checked={isActive}
                onChange={(e) => setIsActive(e.target.checked)}
              />
              <p className="text-sm">Active</p>
            </label>
          </div>
        </CardBody>
        <CardActions>
          <div className="flex w-full flex-row items-center justify-between gap-2">
            {error && (
              <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                {error}
              </FieldStatus>
            )}
            {savedAt && !error && <p className="text-base-content/70 text-xs">Saved {savedAt}</p>}
            <Button color="module" type="submit" disabled={pending} className="ml-auto">
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </div>
        </CardActions>
      </Card>
    </form>
  );
}
