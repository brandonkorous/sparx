'use client';

// The Variants tab: the versions you sell and their prices. With choices the set is
// DERIVED from the Options lattice, so an empty slot gets "set a price", never "add a
// version". Edits share ONE toolbar Save; retire, restore and "shown first" commit now.

import { Button, Text } from '@wizeworks/silicaui-react';
import { faPlus } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

import { FormSection } from '../../components/form-section';
import { InlineWaiting } from '../../components/inline-waiting';
import { PaneLoadError } from '../../components/pane-load-error';
import { FindAPlace } from './product-variants/find-a-place';
import { GroupedGrid } from './product-variants/grouped-grid';
import { NoPriceYet } from './product-variants/no-price-yet';
import { RestingSection } from './product-variants/resting-section';
import { VariantRow } from './product-variants/variant-row';
import { useVariantsTab } from './product-variants/use-variants-tab';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import type { Product } from './products-data';
import { SaveFailure } from '@/components/save-failure';

type Tab = ReturnType<typeof useVariantsTab>;

function VariantsLoadError({ tab }: { tab: Tab }) {
  const { options, variants } = tab;
  // A failed load REPLACES the grid. An empty table beside a dead Save invites
  // someone to type a price into nothing.
  return (
    <PaneLoadError
      title="Could not load this product's prices"
      description="This is a problem reaching the server. Nothing about the product has changed. Its versions just could not be read just now."
      error={options.error ?? variants.error}
      noun="product"
      onRetry={() => {
        void options.refetch();
        void variants.refetch();
      }}
    />
  );
}

function VersionsGrid({ tab }: { tab: Tab }) {
  const { live, axes, slots, stem, taken } = tab;
  if (axes.length > 0) {
    return (
      <GroupedGrid
        slots={slots}
        axes={axes}
        rowProps={tab.rowProps}
        stem={stem}
        taken={taken}
        create={tab.create}
        restoring={tab.restoring}
        onRestore={tab.onRestore}
      />
    );
  }
  if (live.length === 0) return null;
  return (
    <FormSection
      title="How this product is sold"
      description="There is one version of this product. Shoppers do not choose anything. They just buy it."
    >
      {live.map((variant) => (
        <VariantRow key={variant.id} variant={variant} label={variant.sku} {...tab.rowProps} />
      ))}
    </FormSection>
  );
}

function FillTheRest({ tab }: { tab: Tab }) {
  const { axes, empty } = tab;
  if (axes.length === 0 || empty.length === 0) return null;
  return (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <Text>
        {empty.length === 1
          ? '1 combination has no price, so nobody can buy it.'
          : `${String(empty.length)} combinations have no price, so nobody can buy them.`}
      </Text>
      <Button
        size="sm"
        variant="outline"
        color="module"
        loading={tab.create.isPending}
        onClick={() => {
          void tab.fillTheRest(empty);
        }}
      >
        <Icon glyph={faPlus} className="size-4" aria-hidden />
        Give them all the same price
      </Button>
    </div>
  );
}

/** The one place the constraint is spelled out, for whoever looks for "add a version". */
function WhereVersionsComeFrom({ hasChoices }: { hasChoices: boolean }) {
  return hasChoices ? (
    <Text>
      Every version above comes from the choices on the Options tab. To sell another one, add what a
      shopper can pick there and it appears here ready to price.
    </Text>
  ) : (
    <Text>
      Selling this in more than one size, color or length? Set those choices up on the Options tab
      and each combination gets its own price here.
    </Text>
  );
}

export function ProductVariantsTab({ product }: { ctx: SurfaceContext; product: Product }) {
  const tab = useVariantsTab(product);
  const { options, variants, live, retired, homeless, axes, slots, stem, stranded } = tab;

  if (options.isError || variants.isError) return <VariantsLoadError tab={tab} />;
  if (options.isPending || variants.isPending) return <InlineWaiting center />;

  return (
    <div className="flex flex-col gap-4">
      {/* No Save here: the pane toolbar owns it, and the tab strip's dot says
          which tab the unsaved work is on. See product-tab-save.tsx. */}
      {tab.pending.length > 0 ? (
        <Text>
          {tab.pending.length === 1
            ? '1 version has unsaved changes.'
            : `${String(tab.pending.length)} versions have unsaved changes.`}
        </Text>
      ) : null}
      {/* ONE message: the server's own sentence names the exact code that clashed. */}
      <SaveFailure title="That version was not saved" message={tab.saveError} />
      {live.length === 0 && retired.length === 0 ? (
        <NoPriceYet axes={axes} slots={slots} stem={stem} onCreated={tab.create} />
      ) : null}
      <VersionsGrid tab={tab} />
      <FindAPlace
        stranded={stranded}
        homeless={homeless}
        free={tab.free}
        placingId={tab.placingId}
        onPlace={tab.onPlace}
      />
      <FillTheRest tab={tab} />
      <RestingSection resting={tab.resting} />
      <WhereVersionsComeFrom hasChoices={axes.length > 0} />
    </div>
  );
}
