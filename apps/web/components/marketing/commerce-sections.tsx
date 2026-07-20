import type { ReactNode } from 'react';
import { Dot, getModuleColor, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The two markup-heavy structural devices for the /commerce page, split out of
 * commerce-page.tsx so each file stays cohesive:
 *
 *  - CommerceJourney — the order pipeline (catalog → cart → checkout →
 *    fulfilled), a connected 4-stage rail that traces one order end to end.
 *  - CommerceCheckout — an annotated real single-page sparx checkout frame
 *    with A/B/C/D callout pins keyed to each conversion feature.
 *
 * Grounded in docs/09 (e-commerce PRD). Commerce orange is a signal, not fill.
 */

const C = getModuleColor('commerce');

// ── ORDER JOURNEY (pipeline) ────────────────────────────────────────────────
export function CommerceJourney() {
  // `surface` names WHERE the order is at this stage; `title` is the state it
  // reaches there. The old `01 ·`…`04 ·` counters were RULE #2 step markers and
  // are gone — the rail's left-to-right order and its arrows carry the sequence.
  const stages = [
    {
      surface: 'catalog',
      title: 'Added to cart',
      body: 'Products, variants, and collections — the matrix of color, size, and SKU. Price and stock are read live, never cached stale.',
    },
    {
      surface: 'cart',
      title: 'Validated',
      body: 'Inventory re-checked, discounts re-validated, B2B account pricing applied. Abandoned carts fire an email automation.',
    },
    {
      surface: 'checkout',
      title: 'Paid',
      body: 'Single-page checkout, live tax and shipping, a Stripe payment intent confirmed on submit. Inventory decrements atomically.',
    },
    {
      surface: 'fulfillment',
      title: 'Shipped',
      body: 'Pick, pack, add tracking — partial shipments allowed. Tracking triggers the shipping email; refunds restock and return via Stripe.',
    },
  ];
  return (
    <Section id="journey" surface="surface" padding="lg">
      <SectionHeader
        accent={C.color}
        headline="One order, catalog to fulfilled"
        lede="Every order travels the same path on one database — no webhooks trading state at 3am, no sync to drift. Stock, pricing, and customer history are all re-checked as it moves."
      />
      <div className="mkt-pipeline bg-base-100 mt-13">
        {stages.map((s, i) => (
          <div
            key={s.surface}
            className="mkt-pipe-cell relative flex min-h-[184px] flex-col gap-3 px-6 pt-6 pb-7"
          >
            <h3 className="text-lede m-0 flex items-center gap-2 font-sans font-medium tracking-[-0.01em]">
              <Dot color={C.color} size={8} />
              {s.title}
            </h3>
            <p className="text-ink-muted text-caption m-0 font-sans">{s.body}</p>
            <span className="text-ink-subtle text-micro mt-auto pt-2 font-mono tracking-[0.06em] uppercase">
              {s.surface}
            </span>
            {i < stages.length - 1 ? (
              <span
                className="mkt-hide-on-tablet border-base-300 bg-base-100 absolute top-[38px] -right-[11px] z-2 flex size-[22px] items-center justify-center rounded-full border"
                // Module hue as a VALUE for the inline SVG's currentColor.
                style={{ color: C.color }}
              >
                <ArrowRight size={13} />
              </span>
            ) : null}
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── ANNOTATED CHECKOUT FRAME ────────────────────────────────────────────────
export function CommerceCheckout() {
  const pins = [
    {
      n: 'A',
      title: 'Address autocomplete',
      body: 'Suggestions as they type — fewer failed deliveries, fewer typos, faster fills.',
    },
    {
      n: 'B',
      title: 'Wallets & one-click',
      body: 'Apple Pay, Google Pay, and Link — Stripe’s one-click checkout — for buyers in a hurry.',
    },
    {
      n: 'C',
      title: 'Saved payment methods',
      body: 'Returning customers skip the card form entirely. 3D Secure and SCA handled automatically.',
    },
    {
      n: 'D',
      title: 'Live tax & shipping',
      body: 'TaxJar or Avalara for tax; carrier rates via EasyPost. Totals update before they pay.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={C.color}
        headline="A checkout built to convert"
        lede="One page, not a five-screen funnel. Address autocomplete, saved payment methods, and the wallets your customers already use — all wired in, all conversion-tuned out of the box."
      />
      <div className="mkt-frame-grid mt-13">
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <CheckoutBrowser key={b.domain} business={b} />
          ))}
        />
        <div className="flex flex-col gap-3.5">
          {pins.map((p) => (
            <div
              key={p.n}
              // The module hue rides the soft wash, NOT a 3px left stripe — the
              // stripe is a retired brand device (and the most recognizable
              // generated-UI tell). Same treatment as every other module card.
              className={`${C.bg} bg-soft border-base-300 flex gap-3 rounded-xl border px-5 py-4`}
            >
              {/* A/B/C/D is an annotation KEY, not a step marker — the same
                  letters mark the matching spots in the checkout frame. */}
              <span className={`${C.ink} text-mini shrink-0 pt-px font-mono`}>{p.n}</span>
              <div>
                <h4 className="text-small mt-0 mb-1 font-sans font-medium">{p.title}</h4>
                <p className="text-ink-muted text-caption m-0 font-sans">{p.body}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </Section>
  );
}

function CheckoutBrowser({ business }: { business: ExampleBusiness }) {
  return (
    <div className="border-base-300 bg-base-100 overflow-hidden rounded-xl border shadow-lg">
      <div className="border-base-300 bg-base-200 flex items-center gap-2 border-b px-4 py-3">
        <span className="flex gap-1.5">
          {[0, 1, 2].map((d) => (
            <span key={d} className="bg-base-300 size-2.5 rounded-full" />
          ))}
        </span>
        <span className="text-ink-subtle text-mini border-base-300 bg-base-100 ml-2 flex-1 rounded-md border px-3 py-1 font-mono">
          {business.domain}/checkout
        </span>
      </div>
      <div className="mkt-checkout">
        <CheckoutForm business={business} />
        <CheckoutSummary business={business} />
      </div>
    </div>
  );
}

function CheckoutForm({ business }: { business: ExampleBusiness }) {
  const field = (children: ReactNode, key?: string) => (
    <div
      key={key}
      className="border-base-300 bg-base-100 text-caption flex items-center justify-between rounded-lg border px-3 py-2.5 font-sans"
    >
      {children}
    </div>
  );
  // Section labels INSIDE the mockup — legitimate checkout-UI mimicry, not a
  // marketing eyebrow (RULE #2 governs headings on the page, not the device).
  const step = (label: string) => (
    <span className={`${C.ink} text-micro font-mono tracking-[0.05em] uppercase`}>{label}</span>
  );
  return (
    <div className="flex flex-col gap-4 px-7 py-6">
      {step('Contact & shipping')}
      {field(<span className="text-base-content">{business.customer.email}</span>)}
      {field(
        <>
          <span className="text-base-content">
            {business.customer.address}
            <span className="text-ink-subtle"> · suggested</span>
          </span>
          <Dot color={C.color} size={7} />
        </>
      )}
      <div className="grid grid-cols-2 gap-2.5">
        {field(<span className="text-ink-subtle">City</span>, 'city')}
        {field(<span className="text-ink-subtle">ZIP</span>, 'zip')}
      </div>
      {step('Payment')}
      <div className="grid grid-cols-2 gap-2.5">
        {['Apple Pay', 'Link'].map((w) => (
          <span
            key={w}
            className="border-base-300 bg-base-100 text-ink-muted text-caption rounded-lg border p-3 text-center font-sans font-medium"
          >
            {w}
          </span>
        ))}
      </div>
      {field(
        <>
          <span className="text-ink-subtle">Card ending 4242</span>
          <span className="text-ink-subtle text-micro font-mono">saved</span>
        </>
      )}
      {/* The mockup's pay button: silica's solid module fill supplies its own
          paired ink, so there is no hand-picked white on the orange. */}
      <span
        className={`${C.bg} text-module-commerce-content text-body-sm flex items-center justify-center gap-2 rounded-[10px] p-3.5 font-sans font-medium`}
      >
        Pay {business.order.total}
        <Check size={15} color="currentColor" />
      </span>
    </div>
  );
}

function CheckoutSummary({ business }: { business: ExampleBusiness }) {
  const items = business.order.products.map((p): [string, string] => [
    `${p.name} ×${p.qty}`,
    p.price,
  ]);
  return (
    <div className="bg-base-200 border-base-300 flex flex-col gap-3.5 border-l px-6 py-6">
      <span className="text-ink-muted text-caption font-sans font-medium">Order summary</span>
      {items.map(([t, amt]) => (
        <div key={t} className="text-ink-muted text-caption flex items-center gap-3 font-sans">
          <span className="bg-base-300 size-8 shrink-0 rounded-md" />
          <span>{t}</span>
          <span className="text-base-content ml-auto">{amt}</span>
        </div>
      ))}
      <div className="border-base-300 text-ink-muted text-caption flex justify-between border-t pt-3 font-sans">
        <span>Shipping</span>
        <span>{business.order.shipping.value}</span>
      </div>
      <div className="text-ink-muted text-caption flex justify-between font-sans">
        <span>Tax</span>
        <span>{business.order.tax.value}</span>
      </div>
      <div className="border-base-300 flex items-baseline justify-between border-t pt-3 font-sans font-medium">
        <span>Total</span>
        <span className="text-h4 tracking-[-0.02em]">{business.order.total}</span>
      </div>
    </div>
  );
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

function Check({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
