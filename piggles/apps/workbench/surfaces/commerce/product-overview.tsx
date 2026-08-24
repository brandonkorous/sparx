'use client';

// The Overview tab — what the thing IS.
//
// Overview owns the fields that describe the product itself and belong to no
// other tab: its name, what it says, its web address, how it is filed, which
// sites show it, and the two rare lifecycle acts at the end. Price lives on
// Variants, images on Media, search wording on SEO. If a field has a tab of its
// own, it does not appear here as well — a field owned by two tabs is a field
// that gets saved twice with different values.
//
// ── Where Save lives, and why not here ───────────────────────────────────
//
// A tab OWNS its draft but does NOT render its own Save. It hands `dirty`,
// `saving` and a `save` up to the pane toolbar via `useTabSave`, and the toolbar
// renders the one button for the whole surface.
//
// This tab used to render its own, on the reasoning that a pane-level Save would
// mean something different depending on which tab was showing. That reasoning
// was sound and still lost: it put the surface's primary action mid-panel, in
// open space between the status callout and the first form card, anchored to
// nothing — and it could not be found. The ambiguity it avoided was
// hypothetical; the one it created was immediate.
//
// Scope is now carried by the DIRTY DOT on the tab strip rather than by
// placement, which communicates it better than placement ever could: a dot on
// Pricing says Pricing has unsaved work while you are standing on Media. The
// pane-level leave guard also moved to the shell, since it covers all six tabs
// at once. Full contract and rules in product-tab-save.tsx.

import { useEffect, useMemo, useState } from 'react';
import { useToast } from '@wizeworks/silicaui-react';
import { useConfirm } from '../../lib/confirm';
import { afterPaneChange } from '../../lib/defer';
import { useTabSave } from './product-tab-save';
import { ProductFilingSections } from './product-filing';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import {
  productErrorMessage,
  useArchiveProduct,
  useDeleteProduct,
  useUpdateProduct,
  type Product,
} from './products-data';
import { buildPatch, toDraft, type Draft } from './product-overview-draft';
import { ProductFields } from './product-overview-fields';
import { ProductMadeToOrder } from './product-made-to-order';
import { ProductSites } from './product-overview-sites';
import { ProductRareMoves } from './product-overview-rare';

export function ProductOverviewTab({ ctx, product }: { ctx: SurfaceContext; product: Product }) {
  const toast = useToast();
  const confirm = useConfirm();

  const update = useUpdateProduct(product.id);
  const archive = useArchiveProduct(product.id);
  const remove = useDeleteProduct(product.id);

  const saved = useMemo(() => toDraft(product), [product]);
  const [draft, setDraft] = useState<Draft>(saved);
  // Track the server's copy when it changes underneath a CLEAN form — a refetch
  // after someone else edited must land. A dirty form is never overwritten.
  const [touched, setTouched] = useState(false);
  useEffect(() => {
    if (!touched) setDraft(saved);
  }, [saved, touched]);

  const patch = buildPatch(draft, saved);
  const dirty = Object.keys(patch).length > 0;

  const retired = product.status === 'archived';

  const set = <K extends keyof Draft>(key: K, value: Draft[K]) => {
    setTouched(true);
    setDraft((current) => ({ ...current, [key]: value }));
  };

  // Handed to the toolbar, which owns the button and reports the outcome. This
  // REJECTS on failure rather than catching: the toolbar is what claimed the
  // save, so it has to be the thing that finds out it did not happen. Swallowing
  // the error here would leave the toolbar announcing a write that failed.
  useTabSave({
    dirty,
    saving: update.isPending,
    save: async () => {
      const next = await update.mutateAsync(patch);
      setTouched(false);
      setDraft(toDraft(next));
    },
  });

  const toggleRetired = async () => {
    if (!retired) {
      const ok = await confirm({
        title: `Retire ${product.title}?`,
        description:
          'It comes off your website and out of your working catalog, but nothing is deleted — past orders keep their record of it and you can bring it back at any time.',
        confirmLabel: 'Retire it',
        cancelLabel: 'Keep it',
        color: 'warning',
      });
      if (!ok) return;
    }
    archive.mutate(!retired, {
      onSuccess: () => {
        toast.add({
          title: retired ? `${product.title} is back` : `${product.title} retired`,
          type: 'success',
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not change that',
          description: productErrorMessage(error, 'Nothing was changed.'),
          type: 'error',
        });
      },
    });
  };

  const onDelete = async () => {
    const ok = await confirm({
      title: `Delete ${product.title}?`,
      description:
        'Its price, codes, description and every version of it go with it, and it disappears from your website immediately. Orders that already contain it keep their record of what was bought. This cannot be undone — retire it instead if you might sell it again.',
      confirmLabel: 'Delete this product',
      cancelLabel: 'Keep it',
      color: 'danger',
    });
    if (!ok) return;
    remove.mutate(undefined, {
      onSuccess: () => {
        ctx.close();
        afterPaneChange(() => {
          toast.add({ title: `${product.title} deleted`, type: 'success' });
        });
      },
      onError: (error) => {
        toast.add({
          title: 'Could not delete this product',
          description: productErrorMessage(error, 'Nothing was removed.'),
          type: 'error',
        });
      },
    });
  };

  return (
    <div className="flex flex-col gap-4">
      <ProductFields draft={draft} set={set} />

      {/* Directly after "How you file it" because it is the same act continued:
          that section is the words YOU use to find things later, this one is the
          groups SHOPPERS browse. Both are filing; only one of them is public,
          which is why they are two sections and not one. */}
      <ProductFilingSections
        ctx={ctx}
        categoryIds={draft.categoryIds}
        manualCollectionIds={draft.manualCollectionIds}
        memberships={product.collectionMemberships}
        onCategoriesChange={(next) => {
          set('categoryIds', next);
        }}
        onCollectionsChange={(next) => {
          set('manualCollectionIds', next);
        }}
      />

      {/* After filing and before the sites, because it belongs with what the
          thing IS rather than with where it is shown. A cake that needs five
          days and a deposit is describing itself (issue 026). */}
      <ProductMadeToOrder
        value={{
          orderAheadDays: draft.orderAheadDays,
          deposit: draft.deposit,
          dailyLimit: draft.dailyLimit,
        }}
        onChange={(next) => {
          setTouched(true);
          setDraft((current) => ({ ...current, ...next }));
        }}
      />

      <ProductSites draft={draft} set={set} />

      <ProductRareMoves
        retired={retired}
        retiring={archive.isPending}
        deleting={remove.isPending}
        onToggleRetired={() => {
          void toggleRetired();
        }}
        onDelete={() => {
          void onDelete();
        }}
      />
    </div>
  );
}
