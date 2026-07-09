'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardBody,
  CardTitle,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Textarea,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { createSupplierAction } from '../../_lib/supplier-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// New-supplier form on the standard create surface (docs/86 F layout, WS2). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// Single-step form grouped into Basics / Contact / Address / Terms sections.
// Suppliers have no @detail drawer (their detail is a wide full-page surface with
// per-variant purchasing links), so on success we navigate to the supplier's
// detail — the natural next step (add cost/part-number links there).

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

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

interface SupplierCreateFormProps {
  surface: 'page' | 'overlay';
}

export function SupplierCreateForm({ surface }: SupplierCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [contactName, setContactName] = React.useState('');
  const [email, setEmail] = React.useState('');
  const [phone, setPhone] = React.useState('');
  const [website, setWebsite] = React.useState('');
  const [line1, setLine1] = React.useState('');
  const [line2, setLine2] = React.useState('');
  const [city, setCity] = React.useState('');
  const [region, setRegion] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [paymentTerms, setPaymentTerms] = React.useState('');
  const [leadTimeDays, setLeadTimeDays] = React.useState('');
  const [currency, setCurrency] = React.useState('');
  const [notes, setNotes] = React.useState('');
  const [isActive, setIsActive] = React.useState(true);

  const values = { name, code, email, leadTimeDays };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    code: rule.required('Code is required.'),
    email: optionalEmail,
    leadTimeDays: optionalLeadTime,
  });

  // A create form starts empty, so "dirty" is "any field has been entered" OR the
  // Active toggle differs from its default (checked).
  const dirty =
    [
      name,
      code,
      contactName,
      email,
      phone,
      website,
      line1,
      line2,
      city,
      region,
      postalCode,
      country,
      paymentTerms,
      leadTimeDays,
      currency,
      notes,
    ].some((s) => s.trim() !== '') || !isActive;

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'supplier' });

  // Leave WITHOUT the guard (the success path + the guarded Cancel route here).
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/inventory/suppliers');
    }
  }, [surface, pathname, searchParams, router]);

  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  function submit() {
    setError(null);
    if (!v.validate()) return;

    const opt = (val: string) => (val.trim() ? val.trim() : undefined);
    const lead = opt(leadTimeDays);
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
      country: opt(country)?.toUpperCase(),
      paymentTerms: opt(paymentTerms),
      leadTimeDays: lead !== undefined ? Number(lead) : undefined,
      currency: (currency.trim() || 'USD').toUpperCase(),
      notes: opt(notes),
      isActive,
    };

    startTransition(async () => {
      const result = await createSupplierAction(input);
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
      // No @detail drawer — navigate to the supplier's full-page detail (clears the
      // overlay token), where per-variant purchasing links are added.
      router.push(`/inventory/suppliers/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <ModuleProvider module="inventory" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New supplier"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Supplier details',
            supporting:
              'Record a vendor you purchase stock from. Per-variant cost + part numbers are added on the supplier’s page once it exists.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create supplier',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <div className="flex flex-col gap-6">
            <Card>
              <CardBody>
                <div className="flex flex-col gap-1">
                  <CardTitle>Basics</CardTitle>
                  <p className="opacity-70">
                    Name shows in the dashboard; code is a short unique handle.
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <Field {...v.field('name')}>
                    <FieldLabel required>Name</FieldLabel>
                    <FieldControl
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      {...v.control('name')}
                    />
                  </Field>
                  <Field {...v.field('code')}>
                    <FieldLabel required>Code</FieldLabel>
                    <FieldControl
                      name="code"
                      value={code}
                      onChange={(e) => setCode(e.target.value)}
                      pattern="[A-Za-z0-9_-]+"
                      {...v.control('code')}
                    />
                    <FieldDescription>
                      Letters, numbers, hyphen, underscore. Examples: ACME, BOSCH, 3PL-WEST.
                    </FieldDescription>
                  </Field>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <CardTitle>Contact</CardTitle>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-row flex-wrap gap-3">
                    <Field className="flex-1">
                      <FieldLabel>Contact name</FieldLabel>
                      <FieldControl
                        name="contactName"
                        value={contactName}
                        onChange={(e) => setContactName(e.target.value)}
                      />
                    </Field>
                    <Field className="flex-1" {...v.field('email')}>
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
                    <Field className="flex-1">
                      <FieldLabel>Phone</FieldLabel>
                      <FieldControl
                        name="phone"
                        value={phone}
                        onChange={(e) => setPhone(e.target.value)}
                      />
                    </Field>
                    <Field className="flex-1">
                      <FieldLabel>Website</FieldLabel>
                      <FieldControl
                        name="website"
                        value={website}
                        onChange={(e) => setWebsite(e.target.value)}
                        placeholder="https://"
                      />
                    </Field>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <CardTitle>Address</CardTitle>
                <div className="flex flex-col gap-4">
                  <Field className="flex-1">
                    <FieldLabel>Line 1</FieldLabel>
                    <FieldControl
                      name="line1"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                    />
                  </Field>
                  <Field className="flex-1">
                    <FieldLabel>Line 2</FieldLabel>
                    <FieldControl
                      name="line2"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-row flex-wrap gap-3">
                    <Field className="flex-1">
                      <FieldLabel>City</FieldLabel>
                      <FieldControl
                        name="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                      />
                    </Field>
                    <Field className="flex-1">
                      <FieldLabel>Region / State</FieldLabel>
                      <FieldControl
                        name="region"
                        value={region}
                        onChange={(e) => setRegion(e.target.value)}
                      />
                    </Field>
                    <Field className="flex-1">
                      <FieldLabel>Postal code</FieldLabel>
                      <FieldControl
                        name="postalCode"
                        value={postalCode}
                        onChange={(e) => setPostalCode(e.target.value)}
                      />
                    </Field>
                    <Field className="flex-1">
                      <FieldLabel>Country</FieldLabel>
                      <FieldControl
                        name="country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        maxLength={2}
                        placeholder="US"
                      />
                    </Field>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <div className="flex flex-col gap-1">
                  <CardTitle>Terms</CardTitle>
                  <p className="opacity-70">
                    Defaults applied to purchase orders for this supplier; overridable per PO.
                  </p>
                </div>
                <div className="flex flex-col gap-4">
                  <div className="flex flex-row flex-wrap gap-3">
                    <Field className="flex-1">
                      <FieldLabel>Payment terms</FieldLabel>
                      <FieldControl
                        name="paymentTerms"
                        value={paymentTerms}
                        onChange={(e) => setPaymentTerms(e.target.value)}
                        placeholder="net30"
                      />
                    </Field>
                    <Field className="flex-1" {...v.field('leadTimeDays')}>
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
                    <Field className="flex-1">
                      <FieldLabel>Currency</FieldLabel>
                      <FieldControl
                        name="currency"
                        value={currency}
                        onChange={(e) => setCurrency(e.target.value)}
                        maxLength={3}
                        placeholder="USD"
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

                  {error && (
                    <FieldStatus status="error" attached={false} role="alert" aria-live="polite">
                      {error}
                    </FieldStatus>
                  )}
                </div>
              </CardBody>
            </Card>
          </div>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
