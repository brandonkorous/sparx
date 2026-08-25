'use client';

// One product — add it, then everything about it, across seven tabs.
//
// Adding and managing are the same surface because they are the same object at
// two ages, and splitting them means writing the same form twice and keeping
// both in sync forever. The `id === 'new'` branch is genuinely smaller: a
// product is created with a name and a price, then described once it exists.
//
// ── What this file owns, and what it deliberately does not ───────────────
//
// This is a SHELL. It owns: the pane's chrome, which tab is showing, the save
// registry, and announcing the product to scoped panes. It owns no field on any
// tab, and it must not grow to — the moment the shell knows what is on the
// Pricing tab, the seven tabs stop being independently buildable.
//
//   • the tabs themselves are data, and a panel is built in ONE place —
//     product-tabs.tsx
//   • each tab hands its save up to the toolbar — product-tab-save.tsx
//   • the secondary actions are their own hook — product-detail-actions.tsx

import { useEffect, useState } from 'react';
import { PaneWaiting } from '../../components/pane-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import {
  Alert,
  AlertContent,
  AlertDescription,
  AlertTitle,
  Badge,
  Button,
  Card,
  Tabs,
  useToast,
} from '@wizeworks/silicaui-react';
import { useDirtySource } from '../../lib/workbench/dirty';
import { PaneToolbar, PANE_SHELL } from '../../components/pane-toolbar';
import { RefreshButton } from '../../components/refresh-button';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { AddProduct } from './product-add';
import { useAnnounceProduct } from './product-scope';
import { useTabSaveRegistry, useVisitedTabs } from './product-tab-save';
import { ProductTabPanels, ProductTabStrip } from './product-tabs';
import { useProductActions } from './product-detail-actions';
import { productErrorMessage, productState, useProduct, type Product } from './products-data';

/** The one column everything in this pane sits in. Centred and capped, because a
 *  pane torn onto a second monitor is otherwise 2000px of dead grey. */
const COLUMN = 'mx-auto flex w-full max-w-3xl flex-col gap-4';

/* ── Managing: the tabbed shell ─────────────────────────────────────────── */

function ManageProduct({ ctx, id }: { ctx: SurfaceContext; id: string }) {
  const { data: product, isPending, isError, isFetching, dataUpdatedAt, refetch } = useProduct(id);

  useEffect(() => {
    if (product) ctx.setTitle(product.title);
  }, [ctx, product]);

  if (isError) {
    // A failed load REPLACES the shell. Rendering empty tabs beside a dead Save
    // invites someone to retype a description over the top of nothing.
    return (
      <div className={`${PANE_SHELL} p-2`}>
        <Card className="min-h-0 flex-1 items-center justify-center">
          <PaneLoadError
            title="Could not load this product"
            description="This is a problem reaching the server. The product itself is unaffected — nothing has been lost."
            onRetry={() => {
              void refetch();
            }}
          />
        </Card>
      </div>
    );
  }

  if (isPending || !product) return <PaneWaiting />;

  return (
    <ProductTabs
      ctx={ctx}
      product={product}
      isFetching={isFetching}
      dataUpdatedAt={dataUpdatedAt}
      onRefresh={() => {
        void refetch();
      }}
    />
  );
}

/** The loaded product. Split from `ManageProduct` so the hooks below never sit
 *  after an early return, and so `product` is non-null for all of them. */
function ProductTabs({
  ctx,
  product,
  isFetching,
  dataUpdatedAt,
  onRefresh,
}: {
  ctx: SurfaceContext;
  product: Product;
  isFetching: boolean;
  dataUpdatedAt: number;
  onRefresh: () => void;
}) {
  const toast = useToast();
  const [tab, setTab] = useState('overview');

  // Save lives in the toolbar and commits the tab you are standing on. Each tab
  // hands its save up via useTabSave; see product-tab-save.tsx for why the
  // button is not inside the tab body.
  const { provider: tabSaveProvider, state: tabSave } = useTabSaveRegistry(tab);
  const visitedTabs = useVisitedTabs(tab);
  const { actions } = useProductActions(ctx, product);

  // Pane-level guard covers EVERY tab, not just the visible one — the whole
  // point of the dots is that Pricing can be dirty while you are on Media, and
  // closing the pane would take both with it.
  useDirtySource(tabSave.anyDirty, 'This product has unsaved changes. Close anyway?');

  // Tells every product-scoped pane (Stock, Fitment, …) what to follow. The
  // shell does this, not the tabs — the PANE is what is "about" the product.
  useAnnounceProduct(product.id, product.title);

  const state = productState(product);

  // The toolbar reports the failure because the toolbar made the claim. A tab's
  // `save` rejects rather than swallowing — see the contract in product-tab-save.
  const saveActiveTab = async () => {
    if (!tabSave.active?.dirty) return;
    try {
      await tabSave.active.save();
      toast.add({ title: 'Saved', type: 'success' });
    } catch (error) {
      toast.add({
        title: 'Could not save',
        description: productErrorMessage(error, 'Your changes are still here — nothing was lost.'),
        type: 'error',
      });
    }
  };

  return tabSaveProvider(
    <div className={PANE_SHELL}>
      <PaneToolbar
        label="Product actions"
        status={
          <Badge color={state.tone} variant="soft" size="sm">
            {state.label}
          </Badge>
        }
        // Save is the surface's commit action, so it is `primary` and nothing
        // else: `controls` relocates into the overflow popover under 672px, and
        // Save sitting behind an extra tap is the whole bug this rule exists
        // for. A tab with nothing to save never registers, and Save is simply
        // absent there rather than present-but-dead, which would be a worse lie.
        // Enforced by scripts/check-toolbar-primary.mjs.
        primary={
          tabSave.active ? (
            <Button
              size="sm"
              color="module"
              loading={tabSave.active.saving}
              disabled={!tabSave.active.dirty}
              onClick={() => {
                void saveActiveTab();
              }}
            >
              Save
            </Button>
          ) : null
        }
        actions={actions}
        refresh={
          <RefreshButton isFetching={isFetching} updatedAt={dataUpdatedAt} onRefresh={onRefresh} />
        }
      />

      <Tabs
        variant="pills"
        color="module"
        value={tab}
        onValueChange={(next) => {
          setTab(next as string);
        }}
        className="flex min-h-0 flex-1 flex-col gap-2 @lg:gap-3"
      >
        <ProductTabStrip activeTab={tab} dirtyTabs={tabSave.dirtyTabs} />

        <div className="min-h-0 flex-1 overflow-y-auto">
          <div className={COLUMN}>
            {/* NO identity header here, deliberately — it used to carry a
                read-only <h1> of the title, the page address in monospace, and a
                dot-separated metadata line, on every tab. Every part of it was
                already somewhere better: the title and the web address are
                EDITABLE FIELDS on Overview, and an entity shows its identity
                ONCE, as the field you change it in. The dock tab already names
                the product; the toolbar already carries status and a View link.
                The metadata belongs where it is actionable — price on Pricing,
                version count on Variants. */}

            <ProductTabPanels
              ctx={ctx}
              product={product}
              visited={visitedTabs}
              // ONE status message, on the tab whose business it is. The toolbar
              // badge carries the same state everywhere else, so repeating the
              // paragraph on all seven would be noise.
              statusAlert={
                <Alert color={state.tone} variant="soft">
                  <AlertContent>
                    <AlertTitle>{state.label}</AlertTitle>
                    <AlertDescription>{state.detail}</AlertDescription>
                  </AlertContent>
                </Alert>
              }
            />
          </div>
        </div>
      </Tabs>
    </div>
  );
}

export function ProductDetailSurface({ ctx }: { ctx: SurfaceContext }) {
  const id = typeof ctx.params.id === 'string' ? ctx.params.id : 'new';
  return id === 'new' ? <AddProduct ctx={ctx} /> : <ManageProduct ctx={ctx} id={id} />;
}
