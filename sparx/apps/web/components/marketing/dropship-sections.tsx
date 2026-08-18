import { Text } from '@wizeworks/silicaui-react';
import { Dot, getModuleColor, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * Two structural devices for the /dropship page, split out of dropship-page.tsx:
 *
 *  - DropshipConnect ..... supplier connect + catalog sync: the real vendor
 *    picker rail (Printify, Printful, DSers, Spocket, CSV) beside the imported,
 *    synced-and-priced product the connection just pulled in.
 *  - DropshipMargin ...... the markup math: supplier cost → pricing rule →
 *    sell price → margin, as a ledger row per store.
 *
 * The synced product + the margin ledger crossfade through EXAMPLE_BUSINESSES so
 * neither anchors on one vertical. Grounded in docs/14 (Dropship PRD) +
 * @wizeworks/dropship (the vendor catalog, the percentage_markup / multiplier /
 * flat_markup / fixed_margin pricing rules). Dropship emerald is a signal, not
 * fill. (The hero + routed-order card live in dropship-hero.tsx; the routing
 * rail, inventory, and tracking devices live in dropship-devices.tsx.)
 */

const M = getModuleColor('dropship');

// The real selectable vendors from @wizeworks/dropship VENDOR_CATALOG (docs/14 §3).
const VENDORS: { name: string; tag: string; mode: string }[] = [
  { name: 'Printify', tag: 'print-on-demand', mode: 'API' },
  { name: 'Printful', tag: 'print-on-demand', mode: 'API' },
  { name: 'DSers', tag: 'general · AliExpress', mode: 'API' },
  { name: 'Spocket', tag: 'general · US/EU', mode: 'API' },
  { name: 'CSV feed', tag: 'any supplier', mode: 'manual' },
];

// ── SUPPLIER CONNECT + CATALOG SYNC ─────────────────────────────────────────
export function DropshipConnect() {
  return (
    <Section id="suppliers" surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Connect a supplier, import the catalog"
        lede="Pick a supplier from the catalog, paste a token, and sparx validates the connection before it saves. Its products, costs, images, and stock sync in — then you import the ones you want, priced automatically. Only suppliers with a real, self-serve API are offered; the rest are honestly left off."
      />
      <div className="mkt-ds-split mt-13">
        <VendorPicker />
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <SyncedProductPanel key={b.domain} business={b} />
          ))}
        />
      </div>
    </Section>
  );
}

/** Left rail: the real vendor picker — one card per selectable supplier. */
function VendorPicker() {
  return (
    <div className={`${M.bg} bg-soft border-base-300 overflow-hidden rounded-[14px] border`}>
      {/* Panel chrome inside a device mockup — a picker's column header, not an
          eyebrow introducing a marketing heading. */}
      <div className={`${M.ink} border-base-300 border-b px-5 py-4 font-mono text-sm`}>
        choose a supplier
      </div>
      {VENDORS.map((v, i) => (
        <div
          key={v.name}
          className={`flex items-center gap-3 px-5 py-3.5 ${
            i === 0 ? `${M.bg} bg-soft` : 'border-base-200 border-t bg-transparent'
          }`}
        >
          <span
            className={`border-base-300 flex h-[34px] w-[34px] shrink-0 items-center justify-center rounded-lg border ${
              i === 0 ? 'bg-base-100' : 'bg-base-200'
            }`}
          >
            <Dot color={i === 0 ? M.color : 'var(--color-ink-subtle)'} size={8} />
          </span>
          <span className="min-w-0">
            <Text as="span" className="block text-sm font-medium">
              {v.name}
            </Text>
            <Text as="span" className="font-mono text-sm">
              {v.tag}
            </Text>
          </span>
          <Text
            as="span"
            className={`ml-auto shrink-0 font-mono text-sm ${v.mode === 'API' ? M.ink : ''}`}
          >
            {v.mode}
          </Text>
        </div>
      ))}
    </div>
  );
}

/** Right panel: a product imported from the connection — cost, sell, stock. */
function SyncedProductPanel({ business }: { business: ExampleBusiness }) {
  const { dropship: d } = business;
  const rows: [string, string][] = [
    ['Supplier', `${d.supplier} · ${d.connection}`],
    ['Supplier cost', d.pricing.cost],
    ['Pricing rule', d.rule],
    ['Your sell price', d.pricing.sell],
    ['Stock synced', d.stock],
  ];
  return (
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-[14px] border">
      <div className="border-base-300 flex items-center gap-3 border-b px-[22px] py-[18px]">
        <span className="bg-base-200 border-base-300 h-10 w-10 shrink-0 rounded-[9px] border" />
        <span className="min-w-0">
          <Text as="span" className="text-md block font-medium">
            {d.pricing.item}
          </Text>
          <Text as="span" className="font-mono text-sm">
            {d.pricing.sku} · imported draft
          </Text>
        </span>
        <span
          className={`${M.bg} bg-soft ${M.ink} ml-auto inline-flex shrink-0 items-center rounded-full px-3 py-[5px] text-sm font-medium`}
        >
          synced
        </span>
      </div>
      <div className="px-[22px] pt-2 pb-4">
        {rows.map(([l, v]) => (
          <div
            key={l}
            className="border-base-200 flex items-center justify-between border-b py-3 text-sm"
          >
            <span>{l}</span>
            <span className="font-medium">{v}</span>
          </div>
        ))}
        <div className="flex items-center gap-2.5 pt-3.5">
          <Dot color={M.color} size={6} />
          <Text as="span" className="font-mono text-sm">
            review &amp; publish — price tracks the supplier&rsquo;s cost
          </Text>
        </div>
      </div>
    </div>
  );
}

// ── MARGIN / MARKUP LEDGER ──────────────────────────────────────────────────
export function DropshipMargin() {
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Cost in, margin out — automatically"
        lede="Set a pricing rule per supplier — a percentage markup, a multiplier, a flat markup, or a target margin — and every imported product prices itself off the supplier cost. When the supplier raises a cost on sync, your sell price and margin recompute. The dashboard reports profit and margin per product, per supplier, and per order."
      />
      <div className="bg-base-100 border-base-300 mt-13 overflow-hidden rounded-[14px] border">
        {/* Ledger column headers — table chrome, sentence case. */}
        <div className="mkt-margin-head border-base-300 bg-base-200 border-b">
          {['Imported product', 'Pricing rule', 'Your price', 'Margin'].map((h) => (
            <span key={h} className="font-mono text-sm">
              {h}
            </span>
          ))}
        </div>
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <MarginRow key={b.domain} business={b} />
          ))}
        />
      </div>
    </Section>
  );
}

function MarginRow({ business }: { business: ExampleBusiness }) {
  const { dropship: d } = business;
  return (
    <div className="mkt-margin-row">
      <span className="mkt-margin-item flex items-center gap-3">
        <span className="bg-base-200 border-base-300 h-[34px] w-[34px] shrink-0 rounded-lg border" />
        <span className="min-w-0">
          <Text as="span" className="block text-sm font-medium">
            {d.pricing.item}
          </Text>
          <Text as="span" className="font-mono text-sm">
            {d.supplier} · cost {d.pricing.cost}
          </Text>
        </span>
      </span>
      <span className="mkt-margin-cell text-sm">{d.rule}</span>
      <span className="mkt-margin-cell text-md font-medium">{d.pricing.sell}</span>
      <span className="mkt-margin-cell">
        <span className={`text-sm font-medium ${M.ink}`}>{d.pricing.margin}</span>
        <span className="ml-2 font-mono text-sm">{d.pricing.marginPct}</span>
      </span>
    </div>
  );
}
