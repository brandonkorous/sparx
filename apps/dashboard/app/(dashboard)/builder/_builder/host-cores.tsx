'use client';

// The studio-canvas preview for a pinned functional core (docs/122 Phase 2). silica's
// `renderHostNode` hook asks the host to draw a `kind:"host"` node ON THE CANVAS; the
// real interactive component (cart, checkout, search…) only exists on the storefront,
// so here we render a non-interactive, branded SKELETON that shows the author WHAT sits
// in that pinned region and how much room it takes — never the live widget (it has no
// cart/session/Stripe context in the editor, and `ctx.preview` asks for a static state).
//
// Keyed by the SAME `HOST_KEYS` the storefront registry uses (@sparx/silica-catalog is
// the single source of truth); a key with no case here falls through to a generic
// labeled frame, so a newly-registered core is always at least legible on the canvas.

import type { BuilderHost } from '@wizeworks/silicaui-builder/react';
import { HOST_COMPONENTS, HOST_KEYS } from '@sparx/silica-catalog';

// `HostRenderCtx` isn't re-exported by the builder, so derive the exact hook signature
// (node + ctx) from `BuilderHost` — one source of truth, no drift if it changes.
type RenderHostNode = NonNullable<BuilderHost['renderHostNode']>;

/** A shimmer bar — a neutral placeholder line, sized by width class. */
function Bar({ w = 'w-full' }: { w?: string }) {
  return <div className={`bg-base-content/10 h-3 rounded ${w}`} />;
}

/** The frame every skeleton sits in: a labeled, dashed-border card that reads as
 *  "a live region your customers see here" without pretending to be interactive. */
function CoreFrame({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="border-base-content/25 bg-base-100 rounded-lg border border-dashed p-6">
      <div className="text-base-content/50 mb-4 flex items-center gap-2 text-xs font-medium">
        <span className="bg-primary inline-block h-2 w-2 rounded-full" />
        {label} · live region
      </div>
      {children}
    </div>
  );
}

/** The cart skeleton — a couple of line-item rows, a totals block, a checkout button
 *  shape. Enough for an author to see the cart's footprint and style around it. */
function CartSkeleton() {
  return (
    <div className="grid gap-8 md:grid-cols-[1fr_20rem]">
      <div className="space-y-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="border-base-content/10 flex items-center gap-4 border-b pb-4">
            <div className="bg-base-content/10 h-16 w-16 shrink-0 rounded" />
            <div className="flex-1 space-y-2">
              <Bar w="w-1/2" />
              <Bar w="w-1/4" />
            </div>
            <Bar w="w-14" />
          </div>
        ))}
      </div>
      <div className="bg-base-200 space-y-3 rounded-lg p-5">
        <Bar w="w-1/3" />
        <Bar w="w-full" />
        <Bar w="w-2/3" />
        <div className="bg-primary/70 mt-4 h-10 rounded" />
      </div>
    </div>
  );
}

/** The search skeleton — a query field, a facet sidebar, and a result grid, so an
 *  author sees the two-column search layout to style around. */
function SearchSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-base-200 h-11 max-w-md rounded-lg" />
      <div className="grid gap-6 md:grid-cols-[14rem_1fr]">
        <div className="space-y-3">
          {[0, 1, 2, 3].map((i) => (
            <Bar key={i} w={i % 2 === 0 ? 'w-full' : 'w-2/3'} />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="space-y-2">
              <div className="bg-base-content/10 aspect-square rounded" />
              <Bar w="w-3/4" />
              <Bar w="w-1/3" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/** A service-list skeleton — the booking index footprint: a stack of service cards,
 *  each a name/description block with a duration·price meta row. */
function ServiceListSkeleton() {
  return (
    <div className="space-y-3">
      {[0, 1, 2].map((i) => (
        <div key={i} className="border-base-content/10 space-y-3 rounded-lg border p-5">
          <Bar w="w-1/3" />
          <Bar w="w-2/3" />
          <div className="flex gap-4">
            <Bar w="w-16" />
            <Bar w="w-12" />
          </div>
        </div>
      ))}
    </div>
  );
}

/** A category-detail skeleton — a hero header band, a subcategory row, and the product
 *  rollup grid: the browse-node footprint an author styles around. */
function CategoryDetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="bg-base-content/10 h-40 rounded-lg" />
      <div className="grid grid-cols-3 gap-4">
        {[0, 1, 2].map((i) => (
          <div key={i} className="bg-base-content/10 h-10 rounded" />
        ))}
      </div>
      <div className="grid grid-cols-2 gap-5 sm:grid-cols-4">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="space-y-2">
            <div className="bg-base-content/10 aspect-square rounded-lg" />
            <Bar w="w-2/3" />
            <Bar w="w-1/3" />
          </div>
        ))}
      </div>
    </div>
  );
}

/** A booking-widget skeleton — a service header, a month calendar block, and a column of
 *  time-slot pills: the time-picker footprint an author styles around. */
function BookingWidgetSkeleton() {
  return (
    <div className="space-y-5">
      <div className="space-y-2">
        <Bar w="w-1/3" />
        <Bar w="w-1/4" />
      </div>
      <div className="grid gap-6 md:grid-cols-[1fr_14rem]">
        <div className="bg-base-200 grid grid-cols-7 gap-2 rounded-lg p-4">
          {Array.from({ length: 28 }).map((_, i) => (
            <div key={i} className="bg-base-content/10 aspect-square rounded" />
          ))}
        </div>
        <div className="space-y-2">
          {[0, 1, 2, 3, 4].map((i) => (
            <div key={i} className="border-base-content/15 h-9 rounded border" />
          ))}
        </div>
      </div>
    </div>
  );
}

/** A card-grid skeleton — the collection index footprint (image tiles + labels). */
function CardGridSkeleton() {
  return (
    <div className="grid grid-cols-2 gap-5 sm:grid-cols-3">
      {[0, 1, 2, 3, 4, 5].map((i) => (
        <div key={i} className="space-y-2">
          <div className="bg-base-content/10 aspect-[4/3] rounded-lg" />
          <Bar w="w-2/3" />
        </div>
      ))}
    </div>
  );
}

/** The studio's `renderHostNode`: draw the skeleton for a pinned core, keyed by the
 *  node's `component`. A registered-but-unhandled key still renders a labeled frame. */
export const renderHostSkeleton: RenderHostNode = (node, _ctx) => {
  const meta = HOST_COMPONENTS.find((c) => c.key === node.component);
  const label = meta?.label ?? node.component;
  switch (node.component) {
    case HOST_KEYS.commerceCart:
      return (
        <CoreFrame label={label}>
          <CartSkeleton />
        </CoreFrame>
      );
    case HOST_KEYS.commerceSearch:
    case HOST_KEYS.commercePlp:
      // Both are a facet sidebar + result grid — the same two-column footprint.
      return (
        <CoreFrame label={label}>
          <SearchSkeleton />
        </CoreFrame>
      );
    case HOST_KEYS.commerceCollections:
    case HOST_KEYS.commerceCategories:
      return (
        <CoreFrame label={label}>
          <CardGridSkeleton />
        </CoreFrame>
      );
    case HOST_KEYS.schedulingServices:
      return (
        <CoreFrame label={label}>
          <ServiceListSkeleton />
        </CoreFrame>
      );
    case HOST_KEYS.commerceCategoryDetail:
      return (
        <CoreFrame label={label}>
          <CategoryDetailSkeleton />
        </CoreFrame>
      );
    case HOST_KEYS.schedulingServiceDetail:
      return (
        <CoreFrame label={label}>
          <BookingWidgetSkeleton />
        </CoreFrame>
      );
    default:
      return (
        <CoreFrame label={label}>
          <div className="space-y-3">
            <Bar w="w-1/2" />
            <Bar w="w-full" />
            <Bar w="w-3/4" />
          </div>
        </CoreFrame>
      );
  }
};
