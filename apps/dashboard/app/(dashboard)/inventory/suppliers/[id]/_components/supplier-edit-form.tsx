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

export function SupplierEditForm({ supplier }: { supplier: SupplierDetail }) {
  const router = useRouter();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  // The fields are an uncontrolled native form (read via FormData on submit), so
  // dirtiness is derived from the live form on every input — true when any field
  // differs from the passed-in supplier baseline (the same values seeded into the
  // inputs' defaultValue / defaultChecked).
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
      str('name') !== supplier.name ||
      str('code') !== supplier.code ||
      str('contactName') !== (supplier.contactName ?? '') ||
      str('email') !== (supplier.email ?? '') ||
      str('phone') !== (supplier.phone ?? '') ||
      str('website') !== (supplier.website ?? '') ||
      str('line1') !== (supplier.line1 ?? '') ||
      str('line2') !== (supplier.line2 ?? '') ||
      str('city') !== (supplier.city ?? '') ||
      str('region') !== (supplier.region ?? '') ||
      str('postalCode') !== (supplier.postalCode ?? '') ||
      str('country') !== (supplier.country ?? '') ||
      str('paymentTerms') !== (supplier.paymentTerms ?? '') ||
      str('leadTimeDays') !==
        (supplier.leadTimeDays !== null ? String(supplier.leadTimeDays) : '') ||
      str('currency') !== supplier.currency ||
      str('notes') !== (supplier.notes ?? '') ||
      (data.get('isActive') === 'on') !== supplier.isActive;
    setDirty(next);
  }, [supplier]);

  useUnsavedGuard(dirty, { kind: 'edit', noun: 'supplier' });

  function onSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setError(null);
    setSavedAt(null);
    setFieldErrors({});

    const form = new FormData(e.currentTarget);
    const lead = nonEmpty(form.get('leadTimeDays'));
    const input = {
      name: stringField(form.get('name'), supplier.name),
      code: stringField(form.get('code'), supplier.code).toUpperCase(),
      contactName: nonEmpty(form.get('contactName')) ?? null,
      email: nonEmpty(form.get('email')) ?? null,
      phone: nonEmpty(form.get('phone')) ?? null,
      website: nonEmpty(form.get('website')) ?? null,
      line1: nonEmpty(form.get('line1')) ?? null,
      line2: nonEmpty(form.get('line2')) ?? null,
      city: nonEmpty(form.get('city')) ?? null,
      region: nonEmpty(form.get('region')) ?? null,
      postalCode: nonEmpty(form.get('postalCode')) ?? null,
      country: nonEmpty(form.get('country'))?.toUpperCase() ?? null,
      paymentTerms: nonEmpty(form.get('paymentTerms')) ?? null,
      leadTimeDays: lead !== undefined ? Number(lead) : null,
      currency: stringField(form.get('currency'), supplier.currency).toUpperCase(),
      notes: nonEmpty(form.get('notes')) ?? null,
      isActive: form.get('isActive') === 'on',
    };

    startTransition(async () => {
      const result = await updateSupplierAction(supplier.id, input);
      if (!result.ok) {
        setError(result.error.message);
        const map: Record<string, string> = {};
        for (const d of result.error.details ?? []) map[d.field] = d.message;
        setFieldErrors(map);
        return;
      }
      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <form ref={formRef} onSubmit={onSubmit} onInput={recomputeDirty} onChange={recomputeDirty}>
      <Card>
        <CardHeader>
          <Stack gap={1}>
            <Heading level={3}>Details</Heading>
            <CardDescription>Contact, address, and default purchasing terms.</CardDescription>
          </Stack>
        </CardHeader>
        <CardContent>
          <Stack gap={4}>
            <Stack direction="row" gap={3} wrap>
              <Field label="Name" name="name" defaultValue={supplier.name} required />
              <Field
                label="Code"
                name="code"
                defaultValue={supplier.code}
                required
                pattern="[A-Za-z0-9_-]+"
                error={fieldErrors.code}
              />
            </Stack>
            <Stack direction="row" gap={3} wrap>
              <Field
                label="Contact name"
                name="contactName"
                defaultValue={supplier.contactName ?? ''}
              />
              <Field
                label="Email"
                name="email"
                type="email"
                defaultValue={supplier.email ?? ''}
                error={fieldErrors.email}
              />
            </Stack>
            <Stack direction="row" gap={3} wrap>
              <Field label="Phone" name="phone" defaultValue={supplier.phone ?? ''} />
              <Field label="Website" name="website" defaultValue={supplier.website ?? ''} />
            </Stack>
            <Field label="Address line 1" name="line1" defaultValue={supplier.line1 ?? ''} />
            <Field label="Address line 2" name="line2" defaultValue={supplier.line2 ?? ''} />
            <Stack direction="row" gap={3} wrap>
              <Field label="City" name="city" defaultValue={supplier.city ?? ''} />
              <Field label="Region" name="region" defaultValue={supplier.region ?? ''} />
              <Field
                label="Postal code"
                name="postalCode"
                defaultValue={supplier.postalCode ?? ''}
              />
              <Field
                label="Country"
                name="country"
                defaultValue={supplier.country ?? ''}
                maxLength={2}
              />
            </Stack>
            <Stack direction="row" gap={3} wrap>
              <Field
                label="Payment terms"
                name="paymentTerms"
                defaultValue={supplier.paymentTerms ?? ''}
              />
              <Field
                label="Lead time (days)"
                name="leadTimeDays"
                type="number"
                defaultValue={supplier.leadTimeDays !== null ? String(supplier.leadTimeDays) : ''}
              />
              <Field
                label="Currency"
                name="currency"
                defaultValue={supplier.currency}
                maxLength={3}
              />
            </Stack>
            <Stack gap={1}>
              <Label htmlFor="notes">Notes</Label>
              <textarea
                id="notes"
                name="notes"
                rows={3}
                defaultValue={supplier.notes ?? ''}
                className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-surface)] px-3 py-2 text-sm"
              />
            </Stack>
            <label className="flex items-center gap-2">
              <Checkbox color="module" name="isActive" defaultChecked={supplier.isActive} />
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
            {savedAt && !error && (
              <Text size="xs" variant="muted">
                Saved {savedAt}
              </Text>
            )}
            <Button color="module" type="submit" disabled={pending} className="ml-auto">
              {pending ? 'Saving…' : 'Save'}
            </Button>
          </Stack>
        </CardFooter>
      </Card>
    </form>
  );
}

function Field({
  label,
  name,
  defaultValue,
  required,
  error,
  pattern,
  maxLength,
  type,
}: {
  label: string;
  name: string;
  defaultValue?: string;
  required?: boolean;
  error?: string;
  pattern?: string;
  maxLength?: number;
  type?: string;
}) {
  return (
    <Stack gap={1} className="min-w-[12rem] flex-1">
      <Label htmlFor={name}>
        {label}
        {required && <span className="text-[var(--color-danger)]">*</span>}
      </Label>
      <Input
        id={name}
        name={name}
        type={type}
        defaultValue={defaultValue}
        required={required}
        pattern={pattern}
        maxLength={maxLength}
      />
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
