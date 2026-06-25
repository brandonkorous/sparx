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
  Stack,
  Text,
  Textarea,
  SurfaceFrame,
  SurfaceStep,
  type SurfaceStepDef,
} from '@sparx/ui';

import { createCategoryAction } from '../../category-actions';

// New-category form, on the standard create surface (docs/86 F layout). The SAME
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
// Categories form a tree, so the parent picker is seeded from the existing nodes
// (flattened, indented by depth). Categories have no standalone detail view: the
// tree editor on the list page owns rename / reparent / reorder / delete, so on
// success we close the overlay (or return to the list) and refresh the tree.

export interface CategoryParentOption {
  id: string;
  name: string;
  depth: number;
  /** Materialized tree path — lets the edit form exclude self + descendants. */
  path: string;
  /** Sort priority among siblings — used by the edit form's sibling context. */
  position?: number;
}

interface CategoryCreateFormProps {
  surface: 'page' | 'overlay';
  parents: CategoryParentOption[];
}

const STEPS: SurfaceStepDef[] = [{ key: 'basics', label: 'Basics' }];

export function CategoryCreateForm({ surface, parents }: CategoryCreateFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});

  const [name, setName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [parentId, setParentId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [featured, setFeatured] = React.useState(false);

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the list.
  const cancel = React.useCallback(() => {
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/categories');
    }
  }, [surface, pathname, searchParams, router]);

  // After create: categories have no detail view, so close the overlay (or leave
  // the /new page) and refresh — the tree on the list page picks up the new node.
  function afterCreate() {
    if (surface === 'overlay') {
      cancel();
    } else {
      router.push('/commerce/categories');
    }
    router.refresh();
  }

  function submit() {
    setError(null);
    setFieldErrors({});
    if (!name.trim()) {
      setFieldErrors({ name: 'Name is required.' });
      return;
    }
    const payload = {
      name: name.trim(),
      ...(handle.trim() ? { handle: handle.trim() } : {}),
      ...(description.trim() ? { description: description.trim() } : {}),
      ...(parentId ? { parentId } : {}),
      featured,
    };
    startTransition(async () => {
      const result = await createCategoryAction(payload);
      if (!result.ok) {
        if (result.error.code === 'VALIDATION_ERROR' && result.error.details?.length) {
          const fe: Record<string, string> = {};
          for (const d of result.error.details) fe[d.field] = d.message;
          setFieldErrors(fe);
        }
        setError(result.error.message);
        return;
      }
      afterCreate();
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title="New category"
        steps={STEPS}
        current={0}
        onCancel={cancel}
      >
        <SurfaceStep
          header={{
            title: 'Category basics',
            supporting:
              'Categories are the organizational tree shoppers browse. Pick a parent to nest, or leave it top-level — position and reparenting can change later from the tree.',
          }}
          actions={{
            onNext: submit,
            nextLabel: 'Create category',
            nextLoading: pending,
            nextDisabled: pending,
          }}
        >
          <Card variant="module">
            <CardContent className="py-6">
              <Stack gap={4}>
                <Text size="xs" variant="muted">
                  The handle is the category&apos;s URL-safe slug — unique across your catalog and
                  auto-derived from the name if you leave it blank. You can change it later.
                </Text>
                <Stack direction="row" gap={3} wrap>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="cat-name">Name</Label>
                    <Input
                      id="cat-name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Engine parts"
                    />
                    {fieldErrors.name && (
                      <Text size="xs" variant="danger">
                        {fieldErrors.name}
                      </Text>
                    )}
                  </Stack>
                  <Stack gap={2} className="flex-1">
                    <Label htmlFor="cat-handle">Handle (optional)</Label>
                    <Input
                      id="cat-handle"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="auto-derived from name"
                    />
                    {fieldErrors.handle && (
                      <Text size="xs" variant="danger">
                        {fieldErrors.handle}
                      </Text>
                    )}
                  </Stack>
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="cat-parent">Parent</Label>
                  <NativeSelect
                    id="cat-parent"
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                  >
                    <option value="">— Top level —</option>
                    {parents.map((p) => (
                      <option key={p.id} value={p.id}>
                        {indent(p.depth)}
                        {p.name}
                      </option>
                    ))}
                  </NativeSelect>
                  <Text size="xs" variant="muted">
                    Leave top-level for a root category, or nest it under an existing one.
                  </Text>
                </Stack>
                <Stack gap={2}>
                  <Label htmlFor="cat-description">Description</Label>
                  <Textarea
                    id="cat-description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    rows={3}
                  />
                </Stack>
                <Stack direction="row" align="center" gap={2}>
                  <Checkbox
                    id="cat-featured"
                    color="module"
                    checked={featured}
                    onCheckedChange={(v) => setFeatured(v === true)}
                  />
                  <Label htmlFor="cat-featured">Featured</Label>
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

function indent(depth: number): string {
  return depth === 0 ? '' : `${'  '.repeat(depth)}↳ `;
}
