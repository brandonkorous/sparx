'use client';

// ══════════════════════════════════════════════════════════════════════════
// PLACEHOLDERS — EVERY EXPORT IN THIS FILE IS TEMPORARY SCAFFOLDING.
//
// These exist so the tab shell and the surface registry can be finished and
// wired NOW, and so the panes downstream agents build drop into a structure
// that already works instead of one they have to invent. Each is a real, honest
// screen — it says what will live there and why it is not there yet, rather
// than rendering a blank pane or a spinner that never resolves.
//
// TO THE AGENT PICKING UP A FACET: replace the registry's `component` for your
// surface with your own, and delete nothing else. When the last one is gone,
// delete this file. Do NOT extend a placeholder into the real thing in place —
// the point of the marker is that a half-built pane is never mistaken for a
// finished one.
//
// `FacetPlaceholder` is also the WORKED EXAMPLE of the product-scope
// convention. It is nine lines of real code and it is exactly the shape your
// pane should have; read it before reading product-scope.tsx's essay.
// ══════════════════════════════════════════════════════════════════════════

import { Badge, EmptyState, Heading, Text } from '@wizeworks/silicaui-react';
import { Hammer, type LucideIcon } from 'lucide-react';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { FollowingNotice, ProductScopeFallback, useProductScope } from './product-scope';

/** The one place the "not built yet" wording lives, so twelve placeholders
 *  cannot drift into twelve tones of voice. */
function NotBuiltYet({ what, plan }: { what: string; plan: string }) {
  return (
    <EmptyState
      icon={<Hammer className="size-6" aria-hidden />}
      title={`${what} is being built`}
      description={plan}
    />
  );
}

/* ── Tab placeholders (inside the product detail pane) ──────────────────── */

/**
 * A tab body that does not exist yet.
 *
 * PLACEHOLDER — replace with the real tab. The heading and the `plan` sentence
 * are the brief for whoever builds it; keep the scope they describe.
 */
export function TabPlaceholder({ what, plan }: { what: string; plan: string }) {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <NotBuiltYet what={what} plan={plan} />
    </div>
  );
}

/* ── Facet pane placeholder (a dockable product-scoped surface) ─────────── */

/**
 * A product-scoped pane that does not exist yet — AND the reference
 * implementation of the scope convention.
 *
 * The whole contract is the four lines at the top of the component: resolve the
 * scope, hand every non-ready state to the shared fallback, and render your body
 * only when a product is genuinely in hand. Copy this shape exactly.
 *
 * PLACEHOLDER — replace the body between the toolbar and the closing div.
 */
export function makeFacetPlaceholder(config: {
  /** The operator's word for this pane — "Stock", not "Inventory levels". */
  label: string;
  icon: LucideIcon;
  /** What will live here, in plain words. Shown to the operator meanwhile. */
  plan: string;
}) {
  function FacetPlaceholderSurface({ ctx }: { ctx: SurfaceContext }) {
    // ── THE CONVENTION, IN FULL ──────────────────────────────────────────
    const scope = useProductScope(ctx, { label: config.label });
    if (scope.state !== 'ready') {
      return <ProductScopeFallback ctx={ctx} scope={scope} label={config.label} />;
    }
    // From here `scope.product` is a real product and cannot be null.
    // ─────────────────────────────────────────────────────────────────────

    return (
      <div className={PANE_SHELL}>
        <PaneToolbar label={`${config.label} actions`}>
          <config.icon className="size-4 shrink-0" aria-hidden />
          <Heading level={2} className="min-w-0 truncate text-base font-semibold">
            {scope.product.title}
          </Heading>
          {scope.isFollowing ? (
            <Badge color="info" variant="soft" size="sm">
              Following
            </Badge>
          ) : null}
          {/* Every facet pane ends its toolbar with refresh, exactly like a
              list. Wire it to YOUR facet's query, not the product's. */}
          <RefreshButton className="ml-auto" isFetching={false} onRefresh={scope.retry} />
        </PaneToolbar>

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className="mx-auto flex w-full max-w-3xl flex-col gap-4">
            <FollowingNotice scope={scope} />
            <NotBuiltYet what={config.label} plan={config.plan} />
            {/* Says which mode this pane is actually in. Claiming it is "fixed
                to" a product while the badge above it reads "Following" is the
                kind of small contradiction that makes someone stop trusting the
                rest of the screen. */}
            <Text className="text-sm">
              {scope.isFollowing
                ? `This panel is following along, so it will move to whichever product you open next. Use “Keep it on ${scope.product.title}” above to fix it here.`
                : `This panel is fixed to ${scope.product.title}. You can dock it beside the product itself, or beside another panel, and it keeps its place when you come back.`}
            </Text>
          </div>
        </div>
      </div>
    );
  }

  return FacetPlaceholderSurface;
}
