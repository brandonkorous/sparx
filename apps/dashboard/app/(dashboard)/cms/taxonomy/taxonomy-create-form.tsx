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
  Stack,
  Text,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createTaxonomy } from './actions';
import { useUnsavedGuard } from '../../_components/unsaved-guard';

// New-taxonomy form, on the standard create surface (docs/86 F layout). The SAME
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
// `createTaxonomy` returns no id, but the submitted `key` IS the stable
// identifier and the detail view is keyed by it — so on success the overlay
// swaps to `taxonomy:<key>` (create flows into view) and the page pushes to the
// new record.

interface TaxonomyCreateFormProps {
  surface: 'page' | 'overlay';
}

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function TaxonomyCreateForm({ surface }: TaxonomyCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [key, setKey] = React.useState('');
  const [name, setName] = React.useState('');
  const [pluralName, setPluralName] = React.useState('');
  const [hierarchical, setHierarchical] = React.useState(false);

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped.
  const dirty = key.trim() !== '' || name.trim() !== '' || pluralName.trim() !== '' || hierarchical;

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'taxonomy' });

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
      router.push('/cms/taxonomy');
    }
  }, [surface, pathname, searchParams, router]);

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (await guardLeave()) close();
  }, [guardLeave, close]);

  // After create: in an overlay, transition the token to the new record's detail
  // (preserving drawer vs modal); on a page, navigate to it.
  function onCreated(createdKey: string) {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      const mode = next.has('modal') ? 'modal' : 'drawer';
      next.delete('drawer');
      next.delete('modal');
      next.set(mode, `taxonomy:${createdKey}`);
      router.replace(`${pathname ?? '/'}?${next.toString()}`);
      router.refresh();
      return;
    }
    router.push(`/cms/taxonomy/${encodeURIComponent(createdKey)}`);
    router.refresh();
  }

  function submit() {
    setError(null);
    const trimmedKey = key.trim();
    const trimmedName = name.trim();
    const trimmedPlural = pluralName.trim();
    if (!trimmedKey || !trimmedName || !trimmedPlural) {
      setError('Key, name, and plural are required.');
      return;
    }
    // <Checkbox> writes to React state, not native FormData. Build the payload
    // explicitly with the same keys the server action reads.
    const data = new FormData();
    data.set('key', trimmedKey);
    data.set('name', trimmedName);
    data.set('plural_name', trimmedPlural);
    if (hierarchical) data.set('hierarchical', 'on');
    startTransition(async () => {
      const result = await createTaxonomy(data);
      if (!result.ok) {
        setError(result.error ?? 'Could not create taxonomy.');
        return;
      }
      onCreated(trimmedKey);
    });
  }

  return (
    <ModuleProvider module="cms" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New taxonomy"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Taxonomy basics',
            supporting: 'The key is the stable identifier the API uses (e.g. blog_category).',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Add taxonomy',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="module">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Stack direction="row" gap={3} wrap>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="tax-key" required>
                      Key
                    </Label>
                    <Input
                      id="tax-key"
                      value={key}
                      onChange={(e) => setKey(e.target.value)}
                      placeholder="blog_category"
                    />
                  </Stack>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="tax-name" required>
                      Name
                    </Label>
                    <Input
                      id="tax-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Category"
                    />
                  </Stack>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="tax-plural" required>
                      Plural
                    </Label>
                    <Input
                      id="tax-plural"
                      value={pluralName}
                      onChange={(e) => setPluralName(e.target.value)}
                      placeholder="Categories"
                    />
                  </Stack>
                </Stack>
                <Stack direction="row" align="center" gap={2}>
                  <Checkbox
                    id="tax-hierarchical"
                    checked={hierarchical}
                    onCheckedChange={(next) => setHierarchical(next === true)}
                  />
                  <Label htmlFor="tax-hierarchical">Allow parent / child term nesting</Label>
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
