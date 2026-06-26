'use client';

import * as React from 'react';
import { useRouter } from 'next/navigation';

import {
  Button,
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  Checkbox,
  Heading,
  Input,
  Label,
  Stack,
  Text,
} from '@sparx/ui';

import { createSupplierAction } from '../../_lib/supplier-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// New-supplier form (page surface). Collects the supplier's basics + default
// purchasing terms; per-variant cost/SKU links are added on the detail page once
// the supplier exists. On success, navigate to the new supplier's detail.

export function SupplierCreateForm() {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // The fields are an uncontrolled native form (read via FormData on submit), so
  // dirtiness is derived from the live form on every input. A create form starts
  // empty, so "dirty" is "any text field has been entered" OR the Active checkbox
  // differs from its default (defaultChecked → 'on').
  const formRef = React.useRef<HTMLFormElement>(null);
  const [dirty, setDirty] = React.useState(false);
  const recomputeDirty = React.useCallback(() => {
    const form = formRef.current;
    if (!form) return;
    const data = new FormData(form);
    const str = (k: string) => {
      const v = data.get(k);
      return typeof v === 'string' ? v.trim() : '';
    };
    const next =
      str('name') !== '' ||
      str('code') !== '' ||
      str('contactName') !== '' ||
      str('email') !== '' ||
      str('phone') !== '' ||
      str('website') !== '' ||
      str('line1') !== '' ||
      str('line2') !== '' ||
      str('city') !== '' ||
      str('region') !== '' ||
      str('postalCode') !== '' ||
      str('country') !== '' ||
      str('paymentTerms') !== '' ||
      str('leadTimeDays') !== '' ||
      str('currency') !== '' ||
      str('notes') !== '' ||
      data.get('isActive') !== 'on';
    setDirty(next);
  }, []);

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'supplier' });

  // Guarded leave for the Cancel control: confirm a discard before dropping
  // entered work, then return to the supplier list.
  const cancel = React.useCallback(() => {
    void Promise.resolve(guardLeave()).then((ok) => {
      if (ok) router.push('/inventory/suppliers');
    });
  }, [guardLeave, router]);

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const lead = nonEmpty(form.get('leadTimeDays'));
    const input = {
      name: stringField(form.get('name'), ''),
      code: stringField(form.get('code'), '').toUpperCase(),
      contactName: nonEmpty(form.get('contactName')),
      email: nonEmpty(form.get('email')),
      phone: nonEmpty(form.get('phone')),
      website: nonEmpty(form.get('website')),
      line1: nonEmpty(form.get('line1')),
      line2: nonEmpty(form.get('line2')),
      city: nonEmpty(form.get('city')),
      region: nonEmpty(form.get('region')),
      postalCode: nonEmpty(form.get('postalCode')),
      country: nonEmpty(form.get('country'))?.toUpperCase(),
      paymentTerms: nonEmpty(form.get('paymentTerms')),
      leadTimeDays: lead !== undefined ? Number(lead) : undefined,
      currency: stringField(form.get('currency'), 'USD').toUpperCase(),
      notes: nonEmpty(form.get('notes')),
      isActive: form.get('isActive') === 'on',
    };

    startTransition(async () => {
      const result = await createSupplierAction(input);
      if (!result.ok) {
        setError(result.error.message);
        const map: Record<string, string> = {};
        for (const d of result.error.details ?? []) map[d.field] = d.message;
        setFieldErrors(map);
        return;
      }
      router.push(`/inventory/suppliers/${result.data.id}`);
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} onInput={recomputeDirty} onChange={recomputeDirty}>
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Basics</Heading>
            <CardDescription>
              Name shows in the dashboard; code is a short unique handle.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Field label="Name" name="name" required error={fieldErrors.name} />
            <Field
              label="Code"
              name="code"
              required
              hint="Letters, numbers, hyphen, underscore. Examples: ACME, BOSCH, 3PL-WEST."
              pattern="[A-Za-z0-9_-]+"
              error={fieldErrors.code}
            />
          </Stack>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <Heading level={3}>Contact</Heading>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" gap={3} wrap>
              <Field label="Contact name" name="contactName" />
              <Field label="Email" name="email" type="email" error={fieldErrors.email} />
            </Stack>
            <Stack direction="row" gap={3} wrap>
              <Field label="Phone" name="phone" />
              <Field label="Website" name="website" placeholder="https://" />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <Heading level={3}>Address</Heading>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Field label="Line 1" name="line1" />
            <Field label="Line 2" name="line2" />
            <Stack direction="row" gap={3} wrap>
              <Field label="City" name="city" />
              <Field label="Region / State" name="region" />
              <Field label="Postal code" name="postalCode" />
              <Field label="Country" name="country" maxLength={2} placeholder="US" />
            </Stack>
          </Stack>
        </CardContent>
      </Card>

      <Card className="mt-6">
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Terms</Heading>
            <CardDescription>
              Defaults applied to purchase orders for this supplier; overridable per PO.
            </CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" gap={3} wrap>
              <Field label="Payment terms" name="paymentTerms" placeholder="net30" />
              <Field label="Lead time (days)" name="leadTimeDays" type="number" />
              <Field label="Currency" name="currency" maxLength={3} placeholder="USD" />
            </Stack>
            <Stack gap={1}>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm"
              />
            </Stack>
            <label className="flex items-center gap-2">
              <Checkbox color="module" name="isActive" defaultChecked />
              <Text size="sm">Active</Text>
            </label>
          </Stack>
        </CardContent>
        <CardFooter>
          <Stack direction="row" gap={2} justify="between" align="center" className="w-full">
            {error && (
              <Text size="sm" className="text-[var(--color-danger)]">
                {error}
              </Text>
            )}
            <Stack direction="row" gap={2} className="ml-auto">
              <Button type="button" variant="ghost" onClick={cancel}>
                Cancel
              </Button>
              <Button color="module" type="submit" disabled={pending}>
                {pending ? 'Saving…' : 'Create supplier'}
              </Button>
            </Stack>
          </Stack>
        </CardFooter>
      </Card>
    </form>
  );
}

function Field({
  label,
  name,
  required,
  hint,
  error,
  pattern,
  maxLength,
  placeholder,
  type,
}: {
  label: string;
  name: string;
  required?: boolean;
  hint?: string;
  error?: string;
  pattern?: string;
  maxLength?: number;
  placeholder?: string;
  type?: string;
}) {
  return (
    <Stack gap={1} className="flex-1">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-[var(--color-danger)]">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        required={required}
        pattern={pattern}
        maxLength={maxLength}
        placeholder={placeholder}
      />
      {hint && (
        <Text size="xs" variant="muted">
          {hint}
        </Text>
      )}
      {error && (
        <Text size="xs" className="text-[var(--color-danger)]">
          {error}
        </Text>
      )}
    </Stack>
  );
}

function nonEmpty(value: FormDataEntryValue | null): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  return trimmed.length === 0 ? undefined : trimmed;
}

function stringField(value: FormDataEntryValue | null, fallback: string): string {
  return typeof value === 'string' ? value.trim() : fallback;
}
