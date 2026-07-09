'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardBody,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Textarea,
} from '@wizeworks/silicaui-react';

import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { createShippingZoneAction } from '../../../../shipping-actions';
import { useUnsavedGuard } from '../../../../../_components/unsaved-guard';

// New shipping-zone form, on the standard create surface (docs/86 F layout). The
// SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
//
// Zones have a detail view, so create flows INTO it: the overlay swaps the token
// to the new record (preserving drawer vs modal); the page navigates to it.

interface NewZoneFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function NewZoneForm({ surface }: NewZoneFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [priority, setPriority] = React.useState('0');
  const [countriesRaw, setCountriesRaw] = React.useState('');
  const [regionsRaw, setRegionsRaw] = React.useState('');

  const values = { name, priority, countriesRaw, regionsRaw };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    priority: (val) => {
      const raw = String(val).trim();
      const n = Number(raw);
      if (raw === '' || !Number.isFinite(n)) return 'Enter a priority.';
      if (n < 0) return 'Priority cannot be negative.';
      return null;
    },
  });

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped.
  const dirty =
    name.trim() !== '' ||
    priority !== '0' ||
    countriesRaw.trim() !== '' ||
    regionsRaw.trim() !== '';

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'shipping zone' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path (a created zone isn't a discard) and,
  // through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/shipping');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // After create: in an overlay, transition the token to the new record's detail
  // (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `shipping-zone:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/shipping/zones/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    if (!v.validate()) return;
    const priorityValue = Number(priority);
    const countries = countriesRaw
      .split(/[,\s]+/)
      .map((c) => c.trim().toUpperCase())
      .filter(Boolean);
    const regions = regionsRaw
      .split(/[,\s]+/)
      .map((r) => r.trim().toUpperCase())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createShippingZoneAction({
        name: name.trim(),
        priority: Number.isFinite(priorityValue) ? priorityValue : 0,
        targeting: { countries, regions, postalCodeRanges: [] },
      });
      if (!result.ok) {
        const known = (result.error.details ?? []).filter((d) => d.field in values);
        if (known.length) {
          v.setServerErrors(Object.fromEntries(known.map((d) => [d.field, d.message])));
        } else {
          setError(result.error.message);
        }
        return;
      }
      onCreated(result.data.id);
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New shipping zone"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'New shipping zone',
            supporting:
              'Zones are evaluated highest-priority first. A zone with no countries matches any address (low-priority catch-all).',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create zone',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-col gap-4">
                <Field {...v.field('name')}>
                  <FieldLabel required>Name</FieldLabel>
                  <FieldControl
                    name="name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Domestic US"
                    {...v.control('name')}
                  />
                </Field>
                <Field {...v.field('priority')}>
                  <FieldLabel>Priority</FieldLabel>
                  <FieldControl
                    name="priority"
                    type="number"
                    min="0"
                    value={priority}
                    onChange={(e) => setPriority(e.target.value)}
                    {...v.control('priority')}
                  />
                  <FieldDescription>
                    Higher numbers evaluate first. Use catch-all zones at priority 0.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Countries</FieldLabel>
                  <FieldControl
                    render={<Textarea rows={2} className="font-mono text-xs" />}
                    value={countriesRaw}
                    onChange={(e) => setCountriesRaw(e.target.value)}
                    placeholder="US, CA"
                  />
                  <FieldDescription>
                    ISO 3166-1 alpha-2 codes. Leave empty to match any country.
                  </FieldDescription>
                </Field>
                <Field>
                  <FieldLabel>Regions (optional)</FieldLabel>
                  <FieldControl
                    render={<Textarea rows={2} className="font-mono text-xs" />}
                    value={regionsRaw}
                    onChange={(e) => setRegionsRaw(e.target.value)}
                    placeholder="US-CA, US-OR"
                  />
                  <FieldDescription>
                    ISO 3166-2 subdivision codes for narrower targeting.
                  </FieldDescription>
                </Field>
              </div>
            </CardBody>
          </Card>
          {error && (
            <FieldStatus
              status="error"
              attached={false}
              className="mt-4"
              role="alert"
              aria-live="polite"
            >
              {error}
            </FieldStatus>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
