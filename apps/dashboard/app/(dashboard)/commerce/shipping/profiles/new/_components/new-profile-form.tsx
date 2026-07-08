'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import { Card, CardBody, Checkbox, Input, Label, Textarea } from 'silicaui-react';

import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';

import { createShippingProfileAction } from '../../../../shipping-actions';
import { useUnsavedGuard } from '../../../../../_components/unsaved-guard';

// New shipping-profile form, on the standard create surface (docs/86 F layout).
// The SAME component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
//
// Profiles have a detail view, so create flows INTO it: the overlay swaps the
// token to the new record (preserving drawer vs modal); the page navigates to it.

const HAZMAT_CLASSES = [
  'none',
  'class_1_explosive',
  'class_2_gas',
  'class_3_flammable_liquid',
  'class_4_flammable_solid',
  'class_5_oxidizer',
  'class_6_toxic',
  'class_7_radioactive',
  'class_8_corrosive',
  'class_9_misc',
] as const;

interface NewProfileFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function NewProfileForm({ surface }: NewProfileFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [carriersRaw, setCarriersRaw] = React.useState('');
  const [hazmat, setHazmat] = React.useState<Set<string>>(new Set(['none']));
  const [requiresSignature, setRequiresSignature] = React.useState(false);
  const [requiresFreight, setRequiresFreight] = React.useState(false);

  function toggleHazmat(cls: string) {
    setHazmat((prev) => {
      const next = new Set(prev);
      if (next.has(cls)) next.delete(cls);
      else next.add(cls);
      if (next.size === 0) next.add('none');
      return next;
    });
  }

  // Unsaved-changes guard. A create form starts empty (bar the default hazmat
  // 'none'), so "dirty" is "the user has changed anything" — guard a Cancel /
  // Close / Switch / backdrop so typed work isn't silently dropped.
  const dirty =
    name.trim() !== '' ||
    description.trim() !== '' ||
    carriersRaw.trim() !== '' ||
    !(hazmat.size === 1 && hazmat.has('none')) ||
    requiresSignature ||
    requiresFreight;

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'shipping profile' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path (a created profile isn't a discard) and,
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
      next.set(mode, `shipping-profile:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/shipping/profiles/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    const trimmedDescription = description.trim();
    const carriers = carriersRaw
      .split(/[,\s]+/)
      .map((c) => c.trim().toLowerCase())
      .filter(Boolean);

    startTransition(async () => {
      const result = await createShippingProfileAction({
        name: name.trim(),
        ...(trimmedDescription ? { description: trimmedDescription } : {}),
        allowedCarrierServices: carriers,
        hazmatClassesAllowed: Array.from(hazmat) as (typeof HAZMAT_CLASSES)[number][],
        requiresSignature,
        requiresFreight,
      });
      if (!result.ok) {
        setError(result.error.message);
        return;
      }
      onCreated(result.data.id);
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New shipping profile"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'New shipping profile',
            supporting: 'Profiles gate which carriers and hazmat classes a product may ship with.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create profile',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-col gap-1">
                  <Label htmlFor="profile-name">Name *</Label>
                  <Input
                    id="profile-name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="General goods"
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="profile-description">Description</Label>
                  <Input
                    id="profile-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                  />
                </div>
                <div className="flex flex-col gap-1">
                  <Label htmlFor="profile-carriers">Allowed carrier services</Label>
                  <Textarea
                    id="profile-carriers"
                    rows={2}
                    value={carriersRaw}
                    onChange={(e) => setCarriersRaw(e.target.value)}
                    placeholder="usps_priority, ups_ground"
                    className="font-mono text-xs"
                  />
                  <p className="text-base-content/70 text-xs">
                    Carrier service slugs separated by commas. Leave empty to allow any.
                  </p>
                </div>
                <div className="flex flex-col gap-2">
                  <Label>Hazmat classes allowed</Label>
                  <div className="flex flex-row flex-wrap gap-2">
                    {HAZMAT_CLASSES.map((cls) => (
                      <label key={cls} className="flex items-center gap-1.5">
                        <Checkbox
                          color="module"
                          checked={hazmat.has(cls)}
                          onChange={() => toggleHazmat(cls)}
                        />
                        <span className="text-xs">{cls}</span>
                      </label>
                    ))}
                  </div>
                </div>
                <div className="flex flex-row gap-4">
                  <label className="flex items-center gap-2">
                    <Checkbox
                      color="module"
                      checked={requiresSignature}
                      onChange={(e) => setRequiresSignature(e.target.checked)}
                    />
                    <span className="text-sm">Requires signature</span>
                  </label>
                  <label className="flex items-center gap-2">
                    <Checkbox
                      color="module"
                      checked={requiresFreight}
                      onChange={(e) => setRequiresFreight(e.target.checked)}
                    />
                    <span className="text-sm">Freight only</span>
                  </label>
                </div>
              </div>
            </CardBody>
          </Card>
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
