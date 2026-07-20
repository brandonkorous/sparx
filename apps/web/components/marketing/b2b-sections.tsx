import { Dot, getModuleColor, Section, SectionHeader, Text } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * Two structural devices for the /b2b page, split out of b2b-page.tsx:
 *
 *  - B2bPriceList .... account-specific pricing: the account card beside a
 *    same-SKU "list price vs account price" panel — proves login decides price.
 *  - B2bRfq .......... the RFQ → quote → order flow as a connected 4-stage rail.
 *
 * Both crossfade through EXAMPLE_BUSINESSES so neither anchors on one vertical.
 * Grounded in docs/10 (B2B PRD) + the real dashboard B2B surfaces (pricing tiers
 * "% off list", account overrides, the quote lifecycle). B2B slate is a signal,
 * not fill. (The hero + account card live in b2b-hero.tsx.)
 */

const M = getModuleColor('b2b');

// ── ACCOUNT PRICE LIST (same SKU, account-specific price) ───────────────────
export function B2bPriceList() {
  return (
    <Section id="price-list" surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Login decides the price"
        lede="Build pricing tiers — a percentage off list, a fixed price, or a per-product price list — and assign them to accounts. When a buyer signs in, the catalog and checkout already show their negotiated price. No manual quoting for everyday orders."
      />
      <div className="mkt-b2b-split mt-12">
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <PriceTierCard key={b.domain} business={b} />
          ))}
        />
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <PriceListPanel key={b.domain} business={b} />
          ))}
        />
      </div>
    </Section>
  );
}

/** Left card: who the account is and which tier resolves their price. */
function PriceTierCard({ business }: { business: ExampleBusiness }) {
  const { b2b } = business;
  const rows: [string, string][] = [
    ['Pricing tier', b2b.tier],
    ['Tier discount', b2b.tierDiscount],
    ['Payment terms', b2b.terms],
  ];
  return (
    <div
      className={`${M.bg} border-base-300 bg-soft flex h-full flex-col gap-4 rounded-xl border p-6`}
    >
      {/* Field label inside the device card — UI mimicry, not an eyebrow. */}
      <Text as="span" size={11} mono tone="none" className={`${M.ink} tracking-[0.05em] uppercase`}>
        logged-in account
      </Text>
      <div>
        <Text as="div" size={20} tone="default" weight={500} className="tracking-[-0.01em]">
          {b2b.account}
        </Text>
        <Text as="div" size={13} tone="subtle" className="mt-1">
          {b2b.buyer}
        </Text>
      </div>
      <div className="mt-1 flex flex-col gap-2.5">
        {rows.map(([l, v]) => (
          <div
            key={l}
            className="border-base-200 text-caption flex items-center justify-between border-b pb-2.5 font-sans"
          >
            <span className="text-ink-muted">{l}</span>
            <span className="text-base-content font-medium">{v}</span>
          </div>
        ))}
      </div>
      <div className="mt-auto flex items-center gap-2">
        <Dot color={M.color} size={7} />
        <Text as="span" size={12} mono tone="subtle">
          resolves automatically at checkout
        </Text>
      </div>
    </div>
  );
}

/** Right panel: the SAME catalog SKU shown at list price vs the account price. */
function PriceListPanel({ business }: { business: ExampleBusiness }) {
  const { b2b } = business;
  const save = formatSaving(b2b.priceList.list, b2b.priceList.account);
  return (
    <div className="bg-base-100 border-base-300 overflow-hidden rounded-xl border">
      <div className="mkt-pricerow-head border-base-300 bg-base-200 border-b">
        {/* Table column headers inside the device — UI mimicry, not eyebrows. */}
        {['Catalog item', 'List price', `${b2b.tier} price`, 'You save'].map((h) => (
          <Text
            key={h}
            as="span"
            size={11}
            mono
            tone="subtle"
            className="tracking-[0.05em] uppercase"
          >
            {h}
          </Text>
        ))}
      </div>
      <div className="mkt-pricerow border-base-200 border-b">
        <span className="mkt-pricerow-item flex items-center gap-3">
          <span className="bg-base-200 border-base-300 size-[34px] shrink-0 rounded-lg border" />
          <span className="min-w-0">
            <Text as="span" size={14} tone="default" weight={500} className="block">
              {b2b.priceList.item}
            </Text>
            <Text as="span" size={11} mono tone="subtle">
              {b2b.priceList.sku}
            </Text>
          </span>
        </span>
        <Text as="span" size={14} tone="subtle" className="mkt-pricerow-cell line-through">
          {b2b.priceList.list}
        </Text>
        <Text as="span" size={15} tone="default" weight={500} className="mkt-pricerow-cell">
          {b2b.priceList.account}
        </Text>
        <Text as="span" size={13} tone="none" weight={500} className={`mkt-pricerow-cell ${M.ink}`}>
          {save}
        </Text>
      </div>
      <div className="bg-base-200 flex items-center gap-2 px-6 py-3.5">
        <Dot color={M.color} size={6} />
        <Text as="span" size={12} mono tone="subtle">
          same SKU as retail · account override + tier resolve the price
        </Text>
      </div>
    </div>
  );
}

// ── RFQ → QUOTE → ORDER FLOW ────────────────────────────────────────────────
export function B2bRfq() {
  const stages = [
    {
      title: 'Buyer submits an RFQ',
      body: 'From the catalog, the buyer builds a request — quantities, delivery needs, notes — and submits it. It lands in your dashboard, separate from the cart.',
    },
    {
      title: 'You price it',
      body: 'Open the quote, set line-item pricing (markup rules help), add notes and an expiry date. Margin shows as you price, off the cost basis.',
    },
    {
      title: 'Sent back',
      body: 'The buyer gets a branded quote PDF, valid until the expiry. The lifecycle is tracked: submitted, under review, quoted — nothing lost in email.',
    },
    {
      title: 'Accepted → converted',
      body: 'On accept, the quote converts straight to an order at the quoted prices — through the same checkout, inventory, and fulfillment as every other order.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Request, quote, order — one flow"
        lede="Not every wholesale order is a fixed-price reorder. When a buyer needs a custom quote, the RFQ runs end to end inside sparx — request to priced quote to a real order — with the lifecycle tracked the whole way."
      />
      <div className="mkt-pipeline bg-base-100 mt-12">
        {stages.map((s, i) => (
          <div
            key={s.title}
            className="mkt-pipe-cell relative flex min-h-[196px] flex-col gap-3 px-6 pt-6 pb-7"
          >
            <h3 className="text-lede text-base-content m-0 flex items-center gap-2 font-sans font-medium tracking-[-0.01em]">
              <Dot color={M.color} size={8} />
              {s.title}
            </h3>
            <Text size={13} className="m-0">
              {s.body}
            </Text>
            {i < stages.length - 1 ? (
              <span className="mkt-hide-on-tablet bg-base-100 border-base-300 text-module-b2b absolute top-[38px] -right-[11px] z-[2] flex size-[22px] items-center justify-center rounded-full border">
                <ArrowRight size={13} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

/** Parse two formatted USD prices and return a "$X.XX" saving. Used only on the
 *  fixture data, which is always well-formed "$1,234.56" — no NaN path needed. */
function formatSaving(list: string, account: string): string {
  const toNum = (s: string) => Number(s.replace(/[$,]/g, ''));
  const diff = toNum(list) - toNum(account);
  return `$${diff.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
}

function ArrowRight({ size }: { size: number }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <line x1="5" y1="12" x2="19" y2="12" />
      <polyline points="12 5 19 12 12 19" />
    </svg>
  );
}
