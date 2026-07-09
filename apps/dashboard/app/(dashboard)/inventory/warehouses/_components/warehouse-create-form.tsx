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
  NativeSelect,
} from '@wizeworks/silicaui-react';
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { createWarehouseAction } from '../../_lib/inventory-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { ViewSwitcher } from '../../../_components/detail-panel';
import { CREATE_SENTINEL } from '../../../_shell/detail-registry';

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

// Server validation errors arrive keyed by the API's dotted path (address.line1);
// map them onto the flat client state keys the Fields are bound to.
const SERVER_FIELD_MAP: Record<string, 'name' | 'code' | 'line1' | 'city' | 'country'> = {
  name: 'name',
  code: 'code',
  'address.line1': 'line1',
  'address.city': 'city',
  'address.country': 'country',
};

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

  const values = { name, code, line1, city, country };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    code: rule.required('Code is required.'),
    line1: rule.required('Address line 1 is required.'),
    city: rule.required('City is required.'),
    country: rule.required('Country is required.'),
  });

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
    if (!v.validate()) return;
    const trimmed = (val: string) => val.trim();
    const optional = (val: string) => (trimmed(val) ? trimmed(val) : undefined);
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
        const map: Partial<Record<keyof typeof values, string>> = {};
        for (const d of result.error.details ?? []) {
          const key = SERVER_FIELD_MAP[d.field];
          if (key) map[key] = d.message;
        }
        v.setServerErrors(map);
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
        backLabel="Warehouses"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="warehouse" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
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
                      {...v.control('code')}
                    />
                    <FieldDescription>
                      A-Z, 0-9, _, -. Used as the SKU prefix. Examples: MAIN, EAST, 3PL-NYC.
                    </FieldDescription>
                  </Field>
                  <Field>
                    <FieldLabel>Type</FieldLabel>
                    <FieldControl
                      render={
                        <NativeSelect>
                          {TYPES.map((t) => (
                            <option key={t} value={t}>
                              {t}
                            </option>
                          ))}
                        </NativeSelect>
                      }
                      value={type}
                      onChange={(e) => setType(e.target.value)}
                    />
                    <FieldDescription>
                      `dropship` warehouses are populated by supplier feeds; `virtual` is a
                      placeholder for digital-only catalogs.
                    </FieldDescription>
                  </Field>
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
                  <Field {...v.field('line1')}>
                    <FieldLabel required>Line 1</FieldLabel>
                    <FieldControl
                      name="line1"
                      value={line1}
                      onChange={(e) => setLine1(e.target.value)}
                      {...v.control('line1')}
                    />
                  </Field>
                  <Field>
                    <FieldLabel>Line 2</FieldLabel>
                    <FieldControl
                      name="line2"
                      value={line2}
                      onChange={(e) => setLine2(e.target.value)}
                    />
                  </Field>
                  <div className="flex flex-row flex-wrap gap-3">
                    <Field className="flex-1" {...v.field('city')}>
                      <FieldLabel required>City</FieldLabel>
                      <FieldControl
                        name="city"
                        value={city}
                        onChange={(e) => setCity(e.target.value)}
                        {...v.control('city')}
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
                    <Field className="flex-1" {...v.field('country')}>
                      <FieldLabel required>Country</FieldLabel>
                      <FieldControl
                        name="country"
                        value={country}
                        onChange={(e) => setCountry(e.target.value)}
                        maxLength={2}
                        placeholder="US"
                        {...v.control('country')}
                      />
                    </Field>
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
            <FieldStatus
              status="error"
              attached={false}
              role="alert"
              aria-live="polite"
              className="mt-4"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
