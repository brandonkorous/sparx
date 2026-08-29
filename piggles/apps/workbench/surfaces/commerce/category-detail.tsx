'use client';

// One category — create it, then everything about it.
//
// Create and manage are the same surface because a category is the same object
// at two ages: `{ id: 'new' }` builds it, `{ id }` manages it. Splitting them is
// how a field ends up owned by two components. The whole form applies to both
// states — a category is filed, pictured and search-tuned from the moment it
// exists — so there is no smaller "add" branch here beyond skipping the reads.
//
// ── What a category IS, in the owner's words ───────────────────────────────
//
// A category is the part of the website MENU a product sits in — like an aisle
// in a shop. It nests: "Outdoor › Camping › Cookware". That is the one thing the
// copy on this surface has to keep making obvious, because "category" and
// "collection" are a step apart and the difference is not self-evident.

import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { Card } from '@wizeworks/silicaui-react';
import { PANE_SHELL } from '../../components/pane-toolbar';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { useCategory } from './categories-data';
import { CategoryEditor } from './category-editor';

/* ── The surface ────────────────────────────────────────────────────────── */

export function CategoryDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? (
    <CategoryEditor ctx={ctx} id="new" />
  ) : (
    <CategoryLoader ctx={ctx} id={id} />
  );
}

/** Fetches the category first so a failed load REPLACES the form rather than
 *  rendering an empty one beside a dead Save. */
function CategoryLoader({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const {
    data: category,
    isPending,
    isError,
    error,
    isFetching,
    dataUpdatedAt,
    refetch,
  } = useCategory(id);

  if (isError) {
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            error={error}
            noun="category"
            title="Could not load this category"
            description="This is a problem reaching the server. The category itself is unaffected — nothing has been lost."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !category) {
    return <PaneWaiting />;
  }

  return (
    <CategoryEditor
      ctx={ctx}
      id={id}
      category={category}
      isFetching={isFetching}
      updatedAt={category ? dataUpdatedAt : undefined}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}
