'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  ModuleProvider,
  RadioGroup,
  RadioGroupItem,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';
import {
  Card,
  CardBody,
  Checkbox,
  Field,
  FieldControl,
  FieldDescription,
  FieldLabel,
  FieldStatus,
  Label,
  NativeSelect,
  Textarea,
} from '@wizeworks/silicaui-react';
import { rule, useFieldValidation } from '@sparx/forms';

import { createCollectionAction } from '../../collection-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';

// New-collection form, on the standard create surface (docs/86 F layout). The SAME
// component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at the /new route (contained sheet)
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// It's a SINGLE-STEP form, so it's a one-step wizard: the frame supplies the
// title + window controls + the pinned floor toolbar (ghost Cancel + module
// primary) and hides the MiniProgress; the fields sit in a module-tinted Card.
// No bespoke card-footer toolbar, no repeated page title — that drift is what
// docs/86 standardizes away.
//
// Collections DO have a standalone detail view: on success the overlay swaps the
// detail token to the new record's id (create flows into view) and the page
// navigates to /commerce/collections/:id.

interface CollectionCreateFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function CollectionCreateForm({ surface }: CollectionCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [featured, setFeatured] = React.useState(false);
  const [type, setType] = React.useState<'manual' | 'rules'>('manual');
  const [match, setMatch] = React.useState('all');
  const [seedTag, setSeedTag] = React.useState('');

  // Field validation drives silica's FieldStatus treatment. `handle` carries no
  // client rule but is validated-tracked so a server-side handle error maps onto
  // its field; `seedTag` is required only when the collection is rules-driven.
  const values = { name, handle, seedTag, type };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    seedTag: (val, all) =>
      all.type === 'rules' && String(val).trim().length === 0
        ? 'Provide at least one tag to seed the rule.'
        : null,
  });

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped.
  const dirty =
    name.trim() !== '' ||
    handle.trim() !== '' ||
    description.trim() !== '' ||
    featured ||
    type !== 'manual' ||
    match !== 'all' ||
    seedTag.trim() !== '';

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'collection' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path (a created collection isn't a discard) and,
  // through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/collections');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // After create: collections have a detail view, so transition into it.
  // Overlay: swap the detail token to the new record (preserving drawer vs modal).
  // Page: navigate to the record.
  function onCreated(id: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `collection:${id}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/commerce/collections/${id}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    if (!v.validate()) return;

    const payload: Record<string, unknown> = {
      name: name.trim(),
      ...(handle.trim() ? { handle: handle.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      type,
      featured,
    };

    if (type === 'rules') {
      payload.ruleSet = {
        match,
        predicates: [{ field: 'tag', op: 'equals', value: seedTag.trim() }],
      };
    }

    startTransition(async () => {
      const result = await createCollectionAction(payload);
      if (!result.ok) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.length) {
          v.setServerErrors(
            Object.fromEntries(result.error.details.map((d) => [d.field, d.message]))
          );
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
        title="New collection"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Collection basics',
            supporting:
              'Start with a name and a type. Manual collections let you hand-pick products; rules collections re-project membership when products or their tags change.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create collection',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-col gap-4">
                <div className="flex flex-row flex-wrap gap-3">
                  <Field {...v.field('name')} className="flex-1">
                    <FieldLabel required>Name</FieldLabel>
                    <FieldControl
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Featured, New for Spring, Best sellers…"
                      {...v.control('name')}
                    />
                  </Field>
                  <Field {...v.field('handle')} className="flex-1">
                    <FieldLabel>Handle (optional)</FieldLabel>
                    <FieldControl
                      name="handle"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="auto-derived from the name"
                      {...v.control('handle')}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Description</FieldLabel>
                  <FieldControl
                    name="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    render={<Textarea rows={3} />}
                  />
                </Field>
                <div className="flex flex-row items-center gap-2">
                  <Checkbox
                    id="col-featured"
                    color="module"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                  />
                  <Label htmlFor="col-featured">Featured</Label>
                </div>
                <div className="flex flex-col gap-3">
                  <RadioGroup
                    value={type}
                    onValueChange={(val) => setType(val as 'manual' | 'rules')}
                    className="gap-3"
                  >
                    <div className="flex flex-row items-center gap-2">
                      <RadioGroupItem color="module" value="manual" id="col-type-manual" />
                      <div className="flex flex-col gap-0">
                        <Label htmlFor="col-type-manual">Manual</Label>
                        <p className="text-base-content/70 text-xs">
                          Add products by hand on the detail page.
                        </p>
                      </div>
                    </div>
                    <div className="flex flex-row items-center gap-2">
                      <RadioGroupItem color="module" value="rules" id="col-type-rules" />
                      <div className="flex flex-col gap-0">
                        <Label htmlFor="col-type-rules">Rules-driven</Label>
                        <p className="text-base-content/70 text-xs">
                          Membership re-projected on the next index flush.
                        </p>
                      </div>
                    </div>
                  </RadioGroup>
                  {type === 'rules' && (
                    <div className="border-base-300 bg-base-200 flex flex-col gap-3 rounded border p-3">
                      <Field>
                        <FieldLabel>Match mode</FieldLabel>
                        <FieldControl
                          name="match"
                          value={match}
                          onChange={(e) => setMatch(e.target.value)}
                          render={
                            <NativeSelect>
                              <option value="all">Match all (AND)</option>
                              <option value="any">Match any (OR)</option>
                            </NativeSelect>
                          }
                        />
                      </Field>
                      <Field {...v.field('seedTag')}>
                        <FieldLabel required>Seed predicate — tag equals</FieldLabel>
                        <FieldControl
                          name="seedTag"
                          value={seedTag}
                          onChange={(e) => setSeedTag(e.target.value)}
                          placeholder="bestseller"
                          {...v.control('seedTag')}
                        />
                        <FieldDescription>
                          Phase 1.3 seeds a single tag predicate. The full rule editor lands on the
                          detail page in Phase 1.5 (vendor / product_type / price / fitment).
                        </FieldDescription>
                      </Field>
                    </div>
                  )}
                </div>
              </div>
            </CardBody>
          </Card>
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
