'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Card, CardBody, CardTitle, Checkbox, Input, Label, NativeSelect } from 'silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';

import { createWarehouseAction } from '../../_lib/inventory-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// New-warehouse form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in module-tinted Cards.
// No bespoke card-footer toolbar, no repeated page title — that drift is what
// docs/86 standardizes away.
//
// Warehouses have a detail view, so create flows INTO it: the overlay swaps the
// token to the new record (preserving drawer vs modal); the page navigates to it.

const CHANNELS = ['storefront', 'b2b_portal', 'admin', 'subscription'] as const;
const TYPES = ['owned', '3pl', 'dropship', 'virtual'] as const;

interface WarehouseCreateFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function WarehouseCreateForm({ surface }: WarehouseCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState('');
  const [code, setCode] = React.useState('');
  const [type, setType] = React.useState<string>('owned');
  const [line1, setLine1] = React.useState('');
  const [line2, setLine2] = React.useState('');
  const [city, setCity] = React.useState('');
  const [region, setRegion] = React.useState('');
  const [postalCode, setPostalCode] = React.useState('');
  const [country, setCountry] = React.useState('');
  const [channels, setChannels] = React.useState<Record<string, boolean>>({});
  const [isActive, setIsActive] = React.useState(true);

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped.
  const dirty =
    name.trim() !== '' ||
    code.trim() !== '' ||
    line1.trim() !== '' ||
    line2.trim() !== '' ||
    city.trim() !== '' ||
    region.trim() !== '' ||
    postalCode.trim() !== '' ||
    country.trim() !== '' ||
    type !== 'owned' ||
    Object.values(channels).some(Boolean) ||
    !isActive;

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'warehouse' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path and, through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/inventory/warehouses');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // After create: in an overlay, transition the token to the new record's
  // detail (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `warehouse:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/inventory/warehouses/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    setFieldErrors({});
    const trimmed = (v: string) => v.trim();
    const optional = (v: string) => (trimmed(v) ? trimmed(v) : undefined);
    const input = {
      name: trimmed(name),
      code: trimmed(code).toUpperCase(),
      type,
      address: {
        line1: trimmed(line1),
        line2: optional(line2),
        city: trimmed(city),
        region: optional(region),
        postalCode: optional(postalCode),
        country: trimmed(country).toUpperCase(),
      },
      defaultForChannel: CHANNELS.filter((c) => channels[c]),
      isActive,
    };

    startTransition(async () => {
      const result = await createWarehouseAction(input);
      if (!result.ok) {
        setError(result.error.message);
        const map: Record<string, string> = {};
        for (const d of result.error.details ?? []) map[d.field] = d.message;
        setFieldErrors(map);
        return;
      }
      onCreated(result.data.id);
    });
  }

  return (
    <ModuleProvider module="inventory" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New warehouse"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Warehouse basics',
            supporting:
              'Set the basics now; reorder defaults + hours of operation can be edited after the warehouse exists.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create warehouse',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <div className="flex flex-col gap-6">
            <Card>
              <CardBody>
                <CardTitle>Basics</CardTitle>
                <p className="opacity-70">Name shows in the dashboard; code is the SKU prefix.</p>
                <div className="flex flex-col gap-4">
                  <Field
                    label="Name"
                    id="name"
                    value={name}
                    onChange={setName}
                    required
                    error={fieldErrors.name}
                  />
                  <Field
                    label="Code"
                    id="code"
                    value={code}
                    onChange={setCode}
                    required
                    hint="A-Z, 0-9, _, -. Used as the SKU prefix. Examples: MAIN, EAST, 3PL-NYC."
                    error={fieldErrors.code}
                  />
                  <div className="flex flex-col gap-1">
                    <Label htmlFor="type">Type</Label>
                    <NativeSelect id="type" value={type} onChange={(e) => setType(e.target.value)}>
                      {TYPES.map((t) => (
                        <option key={t} value={t}>
                          {t}
                        </option>
                      ))}
                    </NativeSelect>
                    <p className="text-base-content/70 text-xs">
                      `dropship` warehouses are populated by supplier feeds; `virtual` is a
                      placeholder for digital-only catalogs.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <CardTitle>Address</CardTitle>
                <p className="opacity-70">
                  Country is required and ISO 3166-1 alpha-2 (US, CA, GB…).
                </p>
                <div className="flex flex-col gap-4">
                  <Field
                    label="Line 1"
                    id="line1"
                    value={line1}
                    onChange={setLine1}
                    required
                    error={fieldErrors['address.line1']}
                  />
                  <Field label="Line 2" id="line2" value={line2} onChange={setLine2} />
                  <div className="flex flex-row flex-wrap gap-3">
                    <Field
                      label="City"
                      id="city"
                      value={city}
                      onChange={setCity}
                      required
                      className="flex-1"
                      error={fieldErrors['address.city']}
                    />
                    <Field
                      label="Region / State"
                      id="region"
                      value={region}
                      onChange={setRegion}
                      className="flex-1"
                    />
                    <Field
                      label="Postal code"
                      id="postalCode"
                      value={postalCode}
                      onChange={setPostalCode}
                      className="flex-1"
                    />
                    <Field
                      label="Country"
                      id="country"
                      value={country}
                      onChange={setCountry}
                      required
                      maxLength={2}
                      placeholder="US"
                      className="flex-1"
                      error={fieldErrors['address.country']}
                    />
                  </div>
                </div>
              </CardBody>
            </Card>

            <Card>
              <CardBody>
                <CardTitle>Default channels</CardTitle>
                <p className="opacity-70">
                  When a cart on the named channel has no explicit warehouse, the picker uses this
                  as a fallback. Optional — leave empty if you want every channel routed the same
                  way.
                </p>
                <div className="flex flex-col gap-2">
                  {CHANNELS.map((c) => (
                    <label key={c} className="flex items-center gap-2">
                      <Checkbox
                        color="module"
                        checked={!!channels[c]}
                        onChange={(e) =>
                          setChannels((prev) => ({ ...prev, [c]: e.target.checked }))
                        }
                      />
                      <p className="text-sm">{c}</p>
                    </label>
                  ))}
                  <label className="flex items-center gap-2 pt-2">
                    <Checkbox
                      color="module"
                      checked={isActive}
                      onChange={(e) => setIsActive(e.target.checked)}
                    />
                    <p className="text-sm">Active</p>
                  </label>
                </div>
              </CardBody>
            </Card>
          </div>
          {error && (
            <p className="text-danger mt-4 text-sm" role="alert" aria-live="polite">
              {error}
            </p>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}

function Field({
  label,
  id,
  value,
  onChange,
  required,
  hint,
  error,
  maxLength,
  placeholder,
  className,
}: {
  label: string;
  id: string;
  value: string;
  onChange: (value: string) => void;
  required?: boolean;
  hint?: string;
  error?: string;
  maxLength?: number;
  placeholder?: string;
  className?: string;
}) {
  return (
    <div className={`flex flex-col gap-1${className ? ` ${className}` : ''}`}>
      <Label htmlFor={id}>
        {label}
        {required && <span className="text-[var(--color-danger)]">*</span>}
      </Label>
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        maxLength={maxLength}
        placeholder={placeholder}
      />
      {hint && <p className="text-base-content/70 text-xs">{hint}</p>}
      {error && <p className="text-danger text-xs">{error}</p>}
    </div>
  );
}
