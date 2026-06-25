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
  SurfaceFrame,
  SurfaceStep,
  SurfaceSummary,
  SurfaceSummaryDivider,
  SurfaceSummaryRow,
  Text,
  Textarea,
  useConfirm,
  type SurfaceStepDef,
} from '@sparx/ui';

import { reparentCategoryAction, updateCategoryAction } from '../../category-actions';
import { useRegisterLeaveGuard } from '../../../_components/unsaved-guard';
import { DetailPresentationSwitch } from '../../../_components/detail-panel';
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
  const [fieldErrors, setFieldErrors] = React.useState<Record<string, string>>({});
  const [savedAt, setSavedAt] = React.useState<string | null>(null);

  const [name, setName] = React.useState(category.name);
  const [handle, setHandle] = React.useState(category.handle);
  const [position, setPosition] = React.useState(String(category.position));
  const [parentId, setParentId] = React.useState(category.parentId ?? '');
  const [description, setDescription] = React.useState(category.description ?? '');
  const [featured, setFeatured] = React.useState(category.featured);

  const confirm = useConfirm();

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

  const guardLeave = React.useCallback(async (): Promise<boolean> => {
    if (!dirty) return true;
    return confirm({
      title: 'Discard unsaved changes?',
      description: 'Your edits to this category haven’t been saved. Leaving now will discard them.',
      confirmLabel: 'Discard changes',
      tone: 'danger',
    });
  }, [dirty, confirm]);

  useRegisterLeaveGuard(guardLeave);

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
    setFieldErrors({});
    setSavedAt(null);

    const trimmedName = name.trim();
    if (!trimmedName) {
      setFieldErrors({ name: 'Name is required.' });
      return;
    }
    const parsedPosition = Number.parseInt(position, 10);
    if (!Number.isFinite(parsedPosition) || parsedPosition < 0) {
      setFieldErrors({ position: 'Priority must be a non-negative integer.' });
      return;
    }
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
          const fe: Record<string, string> = {};
          for (const d of updateResult.error.details) fe[d.field] = d.message;
          setFieldErrors(fe);
        }
        setError(updateResult.error.message);
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
        // Full-page only: the embedded title strip has no host chrome, so it
        // carries the drawer/modal presentation switch for parity with the overlay
        // (the overlay's DetailHeader already supplies switch + close).
        headerActions={
          surface === 'page' ? (
            <DetailPresentationSwitch typeId="category" entityId={category.id} />
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
                <Text size="xs" variant="success">
                  Saved {savedAt}
                </Text>
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
            <Card variant="module">
              <CardContent className="py-6">
                <Stack gap={4}>
                  <Stack direction="row" gap={3} wrap>
                    <Stack gap={2} className="min-w-[12rem] flex-1">
                      <Label htmlFor="cat-name">Name</Label>
                      <Input
                        id="cat-name"
                        value={name}
                        onChange={(e) => setName(e.target.value)}
                        variant={fieldErrors.name ? 'error' : 'default'}
                        aria-invalid={fieldErrors.name ? true : undefined}
                        aria-describedby={fieldErrors.name ? 'cat-name-error' : undefined}
                      />
                      {fieldErrors.name && (
                        <Text id="cat-name-error" size="xs" variant="danger">
                          {fieldErrors.name}
                        </Text>
                      )}
                    </Stack>
                    <Stack gap={2} className="min-w-[12rem] flex-1">
                      <Label htmlFor="cat-handle">Handle</Label>
                      <Input
                        id="cat-handle"
                        value={handle}
                        onChange={(e) => setHandle(e.target.value)}
                        variant={fieldErrors.handle ? 'error' : 'default'}
                        aria-invalid={fieldErrors.handle ? true : undefined}
                        aria-describedby={fieldErrors.handle ? 'cat-handle-error' : undefined}
                      />
                      {fieldErrors.handle && (
                        <Text id="cat-handle-error" size="xs" variant="danger">
                          {fieldErrors.handle}
                        </Text>
                      )}
                    </Stack>
                    <Stack gap={2} className="w-24">
                      <Label htmlFor="cat-priority">Priority</Label>
                      <Input
                        id="cat-priority"
                        type="number"
                        min={0}
                        step={1}
                        value={position}
                        onChange={(e) => setPosition(e.target.value)}
                        variant={fieldErrors.position ? 'error' : 'default'}
                        aria-invalid={fieldErrors.position ? true : undefined}
                        aria-describedby={fieldErrors.position ? 'cat-priority-error' : undefined}
                      />
                      {fieldErrors.position && (
                        <Text id="cat-priority-error" size="xs" variant="danger">
                          {fieldErrors.position}
                        </Text>
                      )}
                    </Stack>
                  </Stack>

                  {/* The handle is the category's URL-safe slug. Categories have no
                    standalone storefront route today — they're surfaced through the
                    builder, bound by id — so a reslug breaks nothing live; just note
                    the change. */}
                  {handleChanged && (
                    <Text size="xs" variant="muted">
                      Changing the handle reslugs this category from <code>{category.handle}</code>{' '}
                      to <code>{handle.trim()}</code>. Categories don’t have a standalone storefront
                      page yet, so this won’t break any links today.
                    </Text>
                  )}

                  <Stack gap={2}>
                    <Label htmlFor="cat-parent">Parent</Label>
                    <NativeSelect
                      id="cat-parent"
                      value={parentId}
                      onChange={(e) => setParentId(e.target.value)}
                    >
                      <option value="">— Top level —</option>
                      {parentOptions.map((p) => (
                        <option key={p.id} value={p.id}>
                          {indent(p.depth)}
                          {p.name}
                        </option>
                      ))}
                    </NativeSelect>
                    <Text size="xs" variant="muted">
                      Leave top-level for a root category, or nest it under an existing one.
                      Priority orders this category among its siblings — lower numbers sort first
                      (priority 1 is first).
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
                  <Stack gap={1}>
                    <Stack direction="row" align="center" gap={2}>
                      <Checkbox
                        id="cat-featured"
                        color="module"
                        checked={featured}
                        onCheckedChange={(v) => setFeatured(v === true)}
                      />
                      <Label htmlFor="cat-featured">Featured</Label>
                    </Stack>
                    <Text size="xs" variant="muted">
                      Highlights this category in storefront navigation and featured collections.
                    </Text>
                  </Stack>
                </Stack>
              </CardContent>
            </Card>
          </form>
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
          <Text size="sm" variant="muted" className="mb-1">
            Siblings by priority
          </Text>
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
