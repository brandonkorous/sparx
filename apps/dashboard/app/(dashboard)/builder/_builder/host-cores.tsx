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
import type { HostNode } from '@wizeworks/silicaui-html';
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
      <div className="text-base-content mb-4 flex items-center gap-2 text-xs font-medium">
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

/** An auth-form skeleton — a centered card with a title, a couple of labelled fields, and a
 *  submit button: the sign-in / create-account footprint an author styles around. */
function AuthFormSkeleton() {
  return (
    <div className="border-base-content/15 mx-auto max-w-md space-y-5 rounded-lg border p-6">
      <Bar w="w-1/3" />
      {[0, 1].map((i) => (
        <div key={i} className="space-y-2">
          <Bar w="w-1/4" />
          <div className="bg-base-200 h-10 rounded" />
        </div>
      ))}
      <div className="bg-primary/70 h-10 rounded" />
      <Bar w="w-1/2" />
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

/** An article-body skeleton — the shape of written prose: a couple of paragraph
 *  blocks, a subheading, and a short list. Deliberately ragged (the last line of each
 *  block runs short) so it reads as text rather than as a loading state. */
function ArticleBodySkeleton() {
  return (
    <div className="space-y-6">
      {[0, 1].map((block) => (
        <div key={block} className="space-y-2.5">
          <Bar />
          <Bar />
          <Bar w="w-4/5" />
        </div>
      ))}
      <div className="space-y-2.5 pt-2">
        <div className="bg-base-content/20 h-4 w-1/3 rounded" />
        <Bar />
        <Bar w="w-3/4" />
      </div>
    </div>
  );
}

/** The tenant's real brand mark on the canvas — logo and/or name, exactly as the
 *  storefront's `site.brand` core renders it.
 *
 *  NOT a skeleton, deliberately. A grey chip would be worse than useless here: the whole
 *  point of the core is "your logo shows up automatically", and an author who sees a
 *  placeholder can't tell whether it worked. The data is already in the canvas resolver
 *  root (`buildPreviewData` merges `getSitePreviewData`'s `site.identity`), so drawing
 *  the truth costs nothing. Every other core stays a skeleton because it is a live
 *  transaction that can't run on a canvas; a brand mark is just a logo and a word. */
function BrandMark({ root, node }: { root: unknown; node: HostNode }) {
  const identity = (root as { site?: { identity?: { name?: unknown; logo?: unknown } } })?.site
    ?.identity;
  const name = typeof identity?.name === 'string' && identity.name ? identity.name : 'Your site';
  const logo = identity?.logo as { url?: unknown } | null | undefined;
  const logoUrl = typeof logo?.url === 'string' ? logo.url : null;
  const show =
    node.props?.show === 'logo' || node.props?.show === 'name' ? node.props.show : 'both';
  // Mirror the storefront's degradation: "logo only" with no logo set would render an
  // empty box, so fall back to the name.
  const mode = show === 'logo' && !logoUrl ? 'name' : show;

  return (
    <span className="inline-flex items-center gap-2.5">
      {logoUrl && (mode === 'logo' || mode === 'both') ? (
        // A raw <img>, not next/image: an arbitrary tenant media URL, usually an SVG.
        <img src={logoUrl} alt="" className="h-8 w-auto object-contain" />
      ) : null}
      {mode === 'name' || mode === 'both' ? (
        <span className="text-base-content font-semibold">{name}</span>
      ) : null}
    </span>
  );
}

/** Build the studio's `renderHostNode`, closing over the canvas resolver root so the
 *  brand core can draw the tenant's real mark. Every other core draws a skeleton, keyed
 *  by the node's `component`; a registered-but-unhandled key still renders a labeled
 *  frame. */
export function makeRenderHostNode(root: unknown): RenderHostNode {
  return (node, _ctx) => renderHostNodeInner(node, root);
}

function renderHostNodeInner(node: HostNode, root: unknown): React.ReactNode {
  const meta = HOST_COMPONENTS.find((c) => c.key === node.component);
  const label = meta?.label ?? node.component;
  switch (node.component) {
    case HOST_KEYS.siteBrand:
      // No CoreFrame: the brand sits inline in the navbar, and wrapping it in a labeled
      // dashed box would misrepresent its real footprint in the chrome.
      return <BrandMark root={root} node={node} />;
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
    case HOST_KEYS.commerceCollectionDetail:
      // Both are a header band over a faceted product grid — the same canvas footprint
      // (the collection detail simply omits the subcategory strip at render time).
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
    case HOST_KEYS.commerceAuth:
      return (
        <CoreFrame label={label}>
          <AuthFormSkeleton />
        </CoreFrame>
      );
    case HOST_KEYS.cmsArticleBody:
      return (
        <CoreFrame label={label}>
          <ArticleBodySkeleton />
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
}
