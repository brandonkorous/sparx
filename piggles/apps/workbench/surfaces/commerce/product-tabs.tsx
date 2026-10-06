'use client';

// The seven sections of a product: the strip you switch with, and the ONE place a
// panel is built, kept mounted so a tab you left keeps its draft (issue 188). Pills
// in `module`, because SurfaceMount scopes the hue to whatever module owns the pane.

import type { ReactNode } from 'react';
import { TabsList, TabsPanel, TabsTab } from '@wizeworks/silicaui-react';
import type { SurfaceContext } from '../../lib/surfaces/registry';
import { TabValueProvider } from './product-tab-save';
import { ProductOverviewTab } from './product-overview';
import { ProductOptionsTab } from './product-options';
import { CoreChoiceNotice } from './product-options-core-notice';
import { ProductVariantsTab } from './product-variants';
import { ProductMediaTab } from './product-media';
import { ProductPricingTab } from './product-pricing';
import { ProductAttributesTab } from './product-attributes';
import { ProductSeoTab } from './product-seo';
import type { Product } from './products-data';

/** The seven tabs, in order. Options (the axes, a structural edit) and Versions
 *  (routine prices and codes) stay apart so one is never done meaning the other.
 *  "Versions", because every sentence around it already says version. */
export const PRODUCT_TABS: { value: string; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'options', label: 'Options' },
  { value: 'variants', label: 'Versions' },
  { value: 'media', label: 'Media' },
  { value: 'attributes', label: 'Details' },
  { value: 'pricing', label: 'Pricing' },
  { value: 'seo', label: 'SEO' },
];

/** One tab's panel: mounts on first visit and stays mounted. `before` renders
 *  above the body and OUTSIDE the save scope: it belongs to the pane. */
function ProductTabPanel({
  value,
  visited,
  className,
  before,
  children,
}: {
  value: string;
  visited: ReadonlySet<string>;
  className?: string;
  before?: ReactNode;
  children: ReactNode;
}) {
  return (
    <TabsPanel value={value} keepMounted className={className}>
      {visited.has(value) ? (
        <>
          {before}
          <TabValueProvider value={value}>{children}</TabValueProvider>
        </>
      ) : null}
    </TabsPanel>
  );
}

interface PanelsProps {
  ctx: SurfaceContext;
  product: Product;
  visited: ReadonlySet<string>;
  statusAlert: ReactNode;
}

/** All seven panels. `statusAlert` sits above Overview, outside its save scope. */
export function ProductTabPanels({ ctx, product, visited, statusAlert }: PanelsProps) {
  return (
    <>
      <ProductTabPanel
        value="overview"
        visited={visited}
        className="flex flex-col gap-4"
        before={statusAlert}
      >
        <ProductOverviewTab ctx={ctx} product={product} />
      </ProductTabPanel>

      <ProductTabPanel
        value="options"
        visited={visited}
        className="flex flex-col gap-4"
        before={<CoreChoiceNotice ctx={ctx} product={product} />}
      >
        <ProductOptionsTab ctx={ctx} product={product} />
      </ProductTabPanel>

      <ProductTabPanel value="variants" visited={visited}>
        <ProductVariantsTab ctx={ctx} product={product} />
      </ProductTabPanel>

      <ProductTabPanel value="media" visited={visited}>
        <ProductMediaTab ctx={ctx} product={product} />
      </ProductTabPanel>

      <ProductTabPanel value="attributes" visited={visited}>
        <ProductAttributesTab ctx={ctx} product={product} />
      </ProductTabPanel>

      <ProductTabPanel value="pricing" visited={visited}>
        <ProductPricingTab ctx={ctx} product={product} />
      </ProductTabPanel>

      <ProductTabPanel value="seo" visited={visited}>
        <ProductSeoTab ctx={ctx} product={product} />
      </ProductTabPanel>
    </>
  );
}

/** The unsaved dot. On the selected (solid module) pill it wears the pill's own
 *  ink, or it would vanish into the fill. */
function DirtyDot({ selected }: { selected: boolean }) {
  return (
    <>
      <span
        className={
          selected
            ? 'bg-module-content size-1.5 shrink-0 rounded-full'
            : 'bg-module size-1.5 shrink-0 rounded-full'
        }
        aria-hidden
      />
      <span className="sr-only">(unsaved changes)</span>
    </>
  );
}

/** The strip. `dirtyTabs` keeps a toolbar Save honest: it commits the tab you are
 *  on, so something must say another tab still has unsaved work. */
export function ProductTabStrip({
  activeTab,
  dirtyTabs,
}: {
  activeTab: string;
  dirtyTabs: ReadonlySet<string>;
}) {
  return (
    // base-300 so it does not merge into the base-100 toolbar above. The capsule
    // is a NON-scrolling wrapper and only the inner list scrolls: padding on a
    // scroller scrolls away, and the leading pill then flattens on the curve.
    <div className="bg-base-300 shrink-0 rounded-full px-4 py-2">
      <TabsList scrollable>
        {PRODUCT_TABS.map((entry) => (
          <TabsTab key={entry.value} value={entry.value} className="flex items-center gap-1.5">
            {entry.label}
            {dirtyTabs.has(entry.value) ? <DirtyDot selected={entry.value === activeTab} /> : null}
          </TabsTab>
        ))}
      </TabsList>
    </div>
  );
}
