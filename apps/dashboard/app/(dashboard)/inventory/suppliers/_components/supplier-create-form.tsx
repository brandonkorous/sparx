'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
  Checkbox,
  Input,
  Label,
  ModuleProvider,
  Stack,
  Text,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

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
//
// The fields stay an uncontrolled native form (read via FormData on submit); the
// frame's toolbar primary lives outside the <form>, so it bridges to the form via
// requestSubmit() rather than being a native submit button.

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

interface SupplierCreateFormProps {
  surface: 'page' | 'overlay';
}

export function SupplierCreateForm({ surface }: SupplierCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
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
            onNext: () => formRef.current?.requestSubmit(),
            nextLabel: 'Create supplier',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <form
            ref={formRef}
            onSubmit={onSubmit}
            onInput={recomputeDirty}
            onChange={recomputeDirty}
            className="contents"
          >
            <Stack gap={6}>
              <Card>
                <CardHeader>
                  <Stack gap={1}>
                    <CardTitle>Basics</CardTitle>
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

              <Card>
                <CardHeader>
                  <CardTitle>Contact</CardTitle>
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

              <Card>
                <CardHeader>
                  <CardTitle>Address</CardTitle>
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

              <Card>
                <CardHeader>
                  <Stack gap={1}>
                    <CardTitle>Terms</CardTitle>
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

                    {error && (
                      <Text size="sm" variant="danger" role="alert" aria-live="polite">
                        {error}
                      </Text>
                    )}
                  </Stack>
                </CardContent>
              </Card>
            </Stack>
          </form>
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
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
        <Text size="xs" variant="danger">
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
