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
import {
  ModuleProvider,
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  type SurfaceStepDef,
} from '@sparx/ui';
import { rule, useFieldValidation } from '@sparx/forms';

import { reparentCategoryAction, updateCategoryAction } from '../../category-actions';
import { useUnsavedGuard } from '../../../_components/unsaved-guard';
import { ViewSwitcher } from '../../../_components/detail-panel';
import { CategoryDeleteButton } from './category-delete-button';
import type { CategoryParentOption } from './category-create-form';

// Category edit form — the body of the category detail view (docs/86 edit
// surface-type rule: a detail view that IS a single edit form renders on the
// SAME SurfaceFrame as its create sibling, so create + edit are symmetric). The
// ONE component renders in both presentations, picked by the host:
//   - `surface="page"`    → SurfaceFrame `embedded` at /commerce/categories/[id]
//   - `surface="overlay"` → SurfaceFrame `inline` inside the @detail drawer/modal
//
// The frame owns the chrome (title + window controls from the host, pinned floor
// toolbar) and the module-tinted field card; the record's read-only facts (handle,
// product count, timestamps) live in the live summary aside, with the destructive
// Delete pinned to the summary footer — away from the primary Save.
//
// Name / handle / description / featured go through `updateCategoryAction`;
// parent + position changes route through `reparentCategoryAction` (its own
// endpoint because path rewriting is non-trivial) and only fire when something
// actually changed.

export interface CategoryEditData {
  id: string;
  name: string;
  handle: string;
  description: string | null;
  parentId: string | null;
  path: string;
  position: number;
  featured: boolean;
}

export interface CategoryEditMeta {
  productCount: number;
  createdAt: string;
  updatedAt: string;
}

interface CategoryEditFormProps {
  surface: 'page' | 'overlay';
  category: CategoryEditData;
  parents: CategoryParentOption[];
  meta?: CategoryEditMeta;
}

const STEPS: SurfaceStepDef[] = [{ key: 'details', label: 'Details' }];

export function CategoryEditForm({ surface, category, parents, meta }: CategoryEditFormProps) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [pending, startTransition] = React.useTransition();
  const [error, setError] = React.useState<string | null>(null);
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const [name, setName] = React.useState(category.name);
  const [handle, setHandle] = React.useState(category.handle);
  const [position, setPosition] = React.useState(String(category.position));
  const [parentId, setParentId] = React.useState(category.parentId ?? '');
  const [description, setDescription] = React.useState(category.description ?? '');
  const [featured, setFeatured] = React.useState(category.featured);

  // Field validation. `handle` carries no client rule but is validated-tracked so
  // a server-side handle error maps onto its field; `position` (priority) must be
  // a non-negative integer.
  const values = { name, handle, position };
  const v = useFieldValidation(values, {
    name: rule.required('Name is required.'),
    position: (val) => {
      const n = Number.parseInt(String(val), 10);
      return Number.isFinite(n) && n >= 0 ? null : 'Priority must be a non-negative integer.';
    },
  });

  // Exclude self + descendants so a merchant can't reparent a node under its own
  // subtree (the server enforces cycle prevention too — this keeps the picker
  // honest).
  const parentOptions = parents.filter(
    (p) => p.id !== category.id && !p.path.startsWith(`${category.path}.`)
  );
  // Read-only context derived from the already-loaded tree (no extra fetch): the
  // ancestor trail (breadcrumb) and how many direct children this node has.
  const { ancestors, childCount } = deriveRelated(category, parents);

  // Unsaved-changes guard. `dirty` compares live state to the loaded record; the
  // guard confirms a discard before any leave path runs — the frame-owned Cancel
  // (below) AND the drawer/modal host's Close/Switch/backdrop (via the registered
  // guard). One confirm, one source of truth.
  const dirty =
    name !== category.name ||
    handle !== category.handle ||
    position !== String(category.position) ||
    parentId !== (category.parentId ?? '') ||
    description !== (category.description ?? '') ||
    featured !== category.featured;

  // Clear the stale "Saved" badge the moment the user edits again.
  React.useEffect(() => {
    if (dirty) setSavedAt(null);
  }, [dirty]);

  // The handle is the category's URL-safe slug; flag when it's actually changing
  // so we can surface the reslug note.
  const handleChanged = handle.trim().length > 0 && handle.trim() !== category.handle;

  // Sibling context for the Priority field: peers under this category's saved
  // parent, with their priorities, so the number isn't a blind guess.
  const livePosition = Number.parseInt(position, 10);
  const siblings = React.useMemo(() => {
    const lastDot = category.path.lastIndexOf('.');
    const parentPrefix = lastDot >= 0 ? category.path.slice(0, lastDot) : null;
    return parents
      .filter((p) => {
        if (p.id === category.id) return false;
        const d = p.path.lastIndexOf('.');
        const pp = d >= 0 ? p.path.slice(0, d) : null;
        return pp === parentPrefix;
      })
      .map((p) => ({ id: p.id, name: p.name, position: p.position }));
  }, [parents, category.id, category.path]);

  const guardLeave = useUnsavedGuard(dirty, { kind: 'edit', noun: 'category' });

  // Where "leave the form" goes. In the overlay it clears the detail token so the
  // drawer/modal closes in place; the page route returns to the list. Guarded so a
  // mis-clicked Cancel can't silently drop edits.
  const cancel = React.useCallback(async () => {
    if (!(await guardLeave())) return;
    if (surface === 'overlay') {
      const next = new URLSearchParams(searchParams ?? '');
      next.delete('drawer');
      next.delete('modal');
      const qs = next.toString();
      router.replace(qs ? `${pathname ?? '/'}?${qs}` : (pathname ?? '/'));
    } else {
      router.push('/commerce/categories');
    }
  }, [guardLeave, surface, pathname, searchParams, router]);

  function submit() {
    setError(null);
    setSavedAt(null);
    if (!v.validate()) return;

    const trimmedName = name.trim();
    const parsedPosition = Number.parseInt(position, 10);
    const trimmedHandle = handle.trim();
    const trimmedDescription = description.trim();

    startTransition(async () => {
      const updateResult = await updateCategoryAction(category.id, {
        name: trimmedName,
        featured,
        ...(trimmedHandle && trimmedHandle !== category.handle ? { handle: trimmedHandle } : {}),
        description: trimmedDescription.length > 0 ? trimmedDescription : null,
      });
      if (!updateResult.ok) {
        if (updateResult.error.code === 'VALIDATION_ERROR' && updateResult.error.details?.length) {
          v.setServerErrors(
            Object.fromEntries(updateResult.error.details.map((d) => [d.field, d.message]))
          );
        } else {
          setError(updateResult.error.message);
        }
        return;
      }

      const parentChanged = (parentId || null) !== category.parentId;
      const positionChanged = parsedPosition !== category.position;
      if (parentChanged || positionChanged) {
        const reparentResult = await reparentCategoryAction({
          categoryId: category.id,
          newParentId: parentId.length > 0 ? parentId : null,
          newPosition: parsedPosition,
        });
        if (!reparentResult.ok) {
          setError(reparentResult.error.message);
          return;
        }
      }

      setSavedAt(new Date().toLocaleTimeString());
      router.refresh();
    });
  }

  return (
    <ModuleProvider module="commerce" className="h-full">
      <SurfaceFrame
        variant={surface === 'overlay' ? 'inline' : 'embedded'}
        title={category.name}
        backLabel="Categories"
        // Full-page only: the embedded title strip has no host chrome, so it
        // carries the drawer/modal presentation switch for parity with the overlay
        // (the overlay's DetailHeader already supplies switch + close).
        headerActions={
          surface === 'page' ? (
            <ViewSwitcher typeId="category" entityId={category.id} current="page" />
          ) : undefined
        }
        steps={STEPS}
        current={0}
        onCancel={cancel}
        summary={
          <CategorySummary
            category={category}
            meta={meta}
            ancestors={ancestors}
            childCount={childCount}
            siblings={siblings}
            livePosition={livePosition}
          />
        }
      >
        <SurfaceStep
          header={{
            title: 'Category details',
            supporting:
              'Rename, reslug, reparent, or reorder. The handle is the category’s URL-safe slug.',
          }}
          actions={{
            nextForm: 'category-edit-form',
            nextLabel: 'Save changes',
            nextLoading: pending,
            nextDisabled: pending || !dirty,
            destructive: <CategoryDeleteButton categoryId={category.id} name={category.name} />,
            extra:
              savedAt && !error ? (
                <p className="text-success text-xs">Saved {savedAt}</p>
              ) : undefined,
          }}
        >
          <form
            id="category-edit-form"
            onSubmit={(e) => {
              e.preventDefault();
              if (pending || !dirty) return;
              submit();
            }}
          >
            <Card>
              <CardBody className="py-6">
                <div className="flex flex-col gap-4">
                  <div className="flex flex-row flex-wrap gap-3">
                    <Field {...v.field('name')} className="min-w-[12rem] flex-1">
                      <FieldLabel required>Name</FieldLabel>
                      <FieldControl
                        name="name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        {...v.control('name')}
                      />
                    </Field>
                    <Field {...v.field('handle')} className="min-w-[12rem] flex-1">
                      <FieldLabel>Handle</FieldLabel>
                      <FieldControl
                        name="handle"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        {...v.control('handle')}
                      />
                    </Field>
                    <Field {...v.field('position')} className="w-24">
                      <FieldLabel>Priority</FieldLabel>
                      <FieldControl
                        name="position"
                        type="number"
                        min={0}
                        step={1}
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        {...v.control('position')}
                      />
                    </Field>
                  </div>

                  {/* The handle is the category's URL-safe slug. Categories have no
                    standalone storefront route today — they're surfaced through the
                    builder, bound by id — so a reslug breaks nothing live; just note
                    the change. */}
                  {handleChanged && (
                    <p className="text-base-content/70 text-xs">
                      Changing the handle reslugs this category from <code>{category.handle}</code>{' '}
                      to <code>{handle.trim()}</code>. Categories don’t have a standalone storefront
                      page yet, so this won’t break any links today.
                    </p>
                  )}

                  <Field>
                    <FieldLabel>Parent</FieldLabel>
                    <FieldControl
                      name="parentId"
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                      render={
                        <NativeSelect>
                          <option value="">— Top level —</option>
                          {parentOptions.map((p) => (
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
                      Priority orders this category among its siblings — lower numbers sort first
                      (priority 1 is first).
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
                  <div className="flex flex-col gap-1">
                    <div className="flex flex-row items-center gap-2">
                      <Checkbox
                        id="cat-featured"
                        color="module"
                        checked={featured}
                        onChange={(e) => setFeatured(e.target.checked)}
                      />
                      <Label htmlFor="cat-featured">Featured</Label>
                    </div>
                    <p className="text-base-content/70 text-xs">
                      Highlights this category in storefront navigation and featured collections.
                    </p>
                  </div>
                </div>
              </CardBody>
            </Card>
          </form>
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

// The read-only summary aside — the record's facts + tree context, no actions
// (Delete lives in the toolbar's destructive slot). A separate presentational
// unit from the editable form.
function CategorySummary({
  category,
  meta,
  ancestors,
  childCount,
  siblings,
  livePosition,
}: {
  category: CategoryEditData;
  meta?: CategoryEditMeta;
  ancestors: string[];
  childCount: number;
  siblings: { id: string; name: string; position?: number }[];
  livePosition: number;
}) {
  return (
    <SurfaceSummary title="Category">
      <SurfaceSummaryRow label="Handle" value={category.handle} />
      <SurfaceSummaryRow
        label="Nested under"
        value={ancestors.length > 0 ? ancestors.join(' › ') : 'Top level'}
      />
      <SurfaceSummaryRow
        label="Subcategories"
        value={`${childCount} ${childCount === 1 ? 'child' : 'children'}`}
      />
      {meta && (
        <SurfaceSummaryRow
          label="Products"
          value={`${meta.productCount} product${meta.productCount === 1 ? '' : 's'}`}
        />
      )}
      {siblings.length > 0 && (
        <>
          <SurfaceSummaryDivider />
          <p className="text-base-content/70 mb-1 text-sm">Siblings by priority</p>
          {siblings
            .slice()
            .sort((a, b) => (a.position ?? Infinity) - (b.position ?? Infinity))
            .map((s) => (
              <SurfaceSummaryRow key={s.id} label={s.name} value={s.position ?? '—'} />
            ))}
          <SurfaceSummaryRow
            label={`${category.name} (this)`}
            value={Number.isFinite(livePosition) ? livePosition : '—'}
            strong
          />
        </>
      )}
      {meta && (
        <>
          <SurfaceSummaryDivider />
          <SurfaceSummaryRow label="Created" value={formatDate(meta.createdAt)} />
          <SurfaceSummaryRow label="Updated" value={formatDate(meta.updatedAt)} />
        </>
      )}
    </SurfaceSummary>
  );
}

// Read-only tree context for the summary, derived from the flattened parent list
// (materialized dot-paths) — no extra fetch. Ancestors = nodes whose path is a
// strict prefix of this one (the breadcrumb trail, root → parent). Direct
// children = nodes one level deeper whose path sits under this one.
function deriveRelated(
  category: CategoryEditData,
  parents: CategoryParentOption[]
): { ancestors: string[]; childCount: number } {
  const selfDepth =
    parents.find((p) => p.id === category.id)?.depth ?? category.path.split('.').length - 1;
  const ancestors = parents
    .filter((p) => category.path.startsWith(`${p.path}.`))
    .sort((a, b) => a.depth - b.depth)
    .map((p) => p.name);
  const childCount = parents.filter(
    (p) => p.path.startsWith(`${category.path}.`) && p.depth === selfDepth + 1
  ).length;
  return { ancestors, childCount };
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  return Number.isNaN(d.getTime())
    ? '—'
    : d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' });
}
