'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

import {
  Card,
  CardContent,
  Checkbox,
  Input,
  Label,
  ModuleProvider,
  NativeSelect,
  RadioGroup,
  RadioGroupItem,
  Stack,
  Text,
  Textarea,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

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
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [featured, setFeatured] = React.useState(false);
  const [type, setType] = React.useState<'manual' | 'rules'>('manual');
  const [match, setMatch] = React.useState('all');
  const [seedTag, setSeedTag] = React.useState('');

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
    setFieldErrors({});

    if (!name.trim()) {
      setFieldErrors({ name: 'Name is required.' });
      return;
    }

    if (type === 'rules' && !seedTag.trim()) {
      setFieldErrors({ seedTag: 'Provide at least one tag to seed the rule.' });
      return;
    }

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
          const fe: Record<string, string> = {};
          for (const d of result.error.details) fe[d.field] = d.message;
          setFieldErrors(fe);
        }
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
          <Card variant="default">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Stack direction="row" gap={3} wrap>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="col-name">Name</Label>
                    <Input
                      id="col-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Featured, New for Spring, Best sellers…"
                    />
                    {fieldErrors.name && (
                      <Text size="xs" variant="danger">
                        {fieldErrors.name}
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="col-handle">Handle (optional)</Label>
                    <Input
                      id="col-handle"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="auto-derived from the name"
                    />
                    {fieldErrors.handle && (
                      <Text size="xs" variant="danger">
                        {fieldErrors.handle}
                      </Text>
                    )}
                  </Stack>
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="col-description">Description</Label>
                  <Textarea
                    id="col-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </Stack>
                <Stack direction="row" align="center" gap={2}>
                  <Checkbox
                    id="col-featured"
                    color="module"
                    checked={featured}
                    onCheckedChange={(v) => setFeatured(v === true)}
                  />
                  <Label htmlFor="col-featured">Featured</Label>
                </Stack>
                <Stack gap={3}>
                  <RadioGroup
                    value={type}
                    onValueChange={(v) => setType(v as 'manual' | 'rules')}
                    className="gap-3"
                  >
                    <Stack direction="row" align="center" gap={2}>
                      <RadioGroupItem color="module" value="manual" id="col-type-manual" />
                      <Stack gap={0}>
                        <Label htmlFor="col-type-manual">Manual</Label>
                        <Text size="xs" variant="muted">
                          Add products by hand on the detail page.
                        </Text>
                      </Stack>
                    </Stack>
                    <Stack direction="row" align="center" gap={2}>
                      <RadioGroupItem color="module" value="rules" id="col-type-rules" />
                      <Stack gap={0}>
                        <Label htmlFor="col-type-rules">Rules-driven</Label>
                        <Text size="xs" variant="muted">
                          Membership re-projected on the next index flush.
                        </Text>
                      </Stack>
                    </Stack>
                  </RadioGroup>
                  {type === 'rules' && (
                    <Stack
                      gap={3}
                      className="rounded border border-[var(--color-border-default)] bg-[var(--color-bg-subtle)] p-3"
                    >
                      <Stack gap={2}>
                        <Label htmlFor="col-match">Match mode</Label>
                        <NativeSelect
                          id="col-match"
                          value={match}
                          onChange={(e) => setMatch(e.target.value)}
                        >
                          <option value="all">Match all (AND)</option>
                          <option value="any">Match any (OR)</option>
                        </NativeSelect>
                      </Stack>
                      <Stack gap={2}>
                        <Label htmlFor="col-seed-tag">Seed predicate — tag equals</Label>
                        <Input
                          id="col-seed-tag"
                          value={seedTag}
                          onChange={(e) => setSeedTag(e.target.value)}
                          placeholder="bestseller"
                        />
                        <Text size="xs" variant="muted">
                          Phase 1.3 seeds a single tag predicate. The full rule editor lands on the
                          detail page in Phase 1.5 (vendor / product_type / price / fitment).
                        </Text>
                        {fieldErrors.seedTag && (
                          <Text size="xs" variant="danger">
                            {fieldErrors.seedTag}
                          </Text>
                        )}
                      </Stack>
                    </Stack>
                  )}
                </Stack>
              </Stack>
            </CardContent>
          </Card>
          {error && (
            <Text size="sm" variant="danger" role="alert" aria-live="polite" className="mt-4">
              {error}
            </Text>
          )}
        </SurfaceStep>
      </SurfaceFrame>
    </ModuleProvider>
  );
}
