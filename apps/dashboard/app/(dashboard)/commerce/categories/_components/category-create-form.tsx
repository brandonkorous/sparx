'use client';

import * as React from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';

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
import { ModuleProvider, SurfaceFrame, SurfaceStep, type SurfaceStepDef } from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { createCategoryAction } from '../../category-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { useDetailFooterNode } from '../../../_components/detail-header-slot';
import { CREATE_SENTINEL } from '../../../_shell/detail-registry';
import { ViewSwitcher } from '../../../_components/detail-panel';

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
  // The overlay host (drawer/modal) already renders a footer-slot row for
  // Cancel/Create (docs/86); handing it to SurfaceFrame merges the frame's own
  // toolbar into THAT row instead of stacking a second one underneath it —
  // null until the host mounts.
  const overlayActionsTarget = useDetailFooterNode();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);

  const [name, setName] = React.useState('');
  const [handle, setHandle] = React.useState('');
  const [parentId, setParentId] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [featured, setFeatured] = React.useState(false);

  // Field validation. `handle` carries no client rule but is validated-tracked so
  // a server-side handle error maps onto its field.
  const values = { name, handle };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
  });

  // Unsaved-changes guard. A create form starts empty, so "dirty" is simply
  // "the user has entered anything" — guard a Cancel / Close / Switch / backdrop
  // so typed work isn't silently dropped (the overlay host registers this via the
  // shared channel; the full-page Cancel calls it directly).
  const dirty =
    name.trim() !== '' ||
    handle.trim() !== '' ||
    parentId !== '' ||
    description.trim() !== '' ||
    featured;

  const guardLeave = useUnsavedGuard(dirty, { kind: 'create', noun: 'category' });

  // Where "leave the form" goes, WITHOUT the guard. In the overlay it clears the
  // detail token so the drawer/modal closes in place; the page route returns to
  // the list. Used by the success path (a created category isn't a discard) and,
  // through `cancel`, by the guarded Cancel.
  const close = React.useCallback(() => {
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

  // Guarded leave for the frame-owned Cancel: confirm a discard before dropping
  // entered work.
  const cancel = React.useCallback(async () => {
    if (!(await guardLeave())) return;
    close();
  }, [guardLeave, close]);

  // After create: categories have no detail view, so close the overlay (or leave
  // the /new page) and refresh — the tree on the list page picks up the new node.
  // Routes through the unguarded `close` (a successful create is not a discard).
  function afterCreate() {
    close();
    router.refresh();
  }

  function submit() {
    setError(null);
    if (!v.validate()) return;
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
          v.setServerErrors(
            Object.fromEntries(result.error.details.map((d) => [d.field, d.message]))
          );
        } else {
          setError(result.error.message);
        }
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
        backLabel="Categories"
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="category" entityId={CREATE_SENTINEL} current="page" />
          ) : undefined
        }
        actionsTarget={surface === 'overlay' ? overlayActionsTarget : undefined}
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
          <Card>
            <CardBody className="py-6">
              <div className="flex flex-col gap-4">
                <p className="text-base-content text-xs">
                  The handle is the category&apos;s URL-safe slug — unique across your catalog and
                  auto-derived from the name if you leave it blank. You can change it later.
                </p>
                <div className="flex flex-row flex-wrap gap-3">
                  <Field {...v.field('name')} className="flex-1">
                    <FieldLabel required>Name</FieldLabel>
                    <FieldControl
                      name="name"
                      value={name}
                      onChange={(e) => setName(e.target.value)}
                      placeholder="Engine parts"
                      {...v.control('name')}
                    />
                  </Field>
                  <Field {...v.field('handle')} className="flex-1">
                    <FieldLabel>Handle (optional)</FieldLabel>
                    <FieldControl
                      name="handle"
                      value={handle}
                      onChange={(e) => setHandle(e.target.value)}
                      placeholder="auto-derived from name"
                      {...v.control('handle')}
                    />
                  </Field>
                </div>
                <Field>
                  <FieldLabel>Parent</FieldLabel>
                  <FieldControl
                    name="parentId"
                    value={parentId}
                    onChange={(e) => setParentId(e.target.value)}
                    render={
                      <NativeSelect>
                        <option value="">— Top level —</option>
                        {parents.map((p) => (
                          <option key={p.id} value={p.id}>
                            {indent(p.depth)}
                            {p.name}
                          </option>
                        ))}
                      </NativeSelect>
                    }
                  />
                  <FieldDescription>
                    Leave top-level for a root category, or nest it under an existing one.
                  </FieldDescription>
                </Field>
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
                    id="cat-featured"
                    color="module"
                    checked={featured}
                    onChange={(e) => setFeatured(e.target.checked)}
                  />
                  <Label htmlFor="cat-featured">Featured</Label>
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

function indent(depth: number): string {
  return depth === 0 ? '' : `${'  '.repeat(depth)}↳ `;
}
