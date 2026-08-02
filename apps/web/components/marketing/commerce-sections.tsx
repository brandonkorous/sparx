import type { ReactNode } from 'react';
import { getModuleColor, Section, SectionHeader } from './primitives';
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
  // The four stages are an order's LIFECYCLE, so they wear the lifecycle ramp
  // rather than four copies of the module hue: neutral while it is still just a
  // cart, info once the system has checked it, success the moment money lands,
  // and success again when it ships. Status is its own color axis (DESIGN.md),
  // and a reader can now follow the rail without reading a word of it — which is
  // the whole point of a pipeline device.
  //
  // `dot` is a fill CLASS, not a value: these are dots, and a hue is a fill.
  const stages = [
    {
      surface: 'catalog',
      title: 'Added to cart',
      dot: 'bg-neutral',
      body: 'Every product, in every size and color you sell. The price and the stock count they see are the real ones, read fresh.',
    },
    {
      surface: 'cart',
      title: 'Validated',
      dot: 'bg-info',
      body: 'Stock is checked again, the discount code is checked again, and trade customers get their own pricing. Walk away and they get a reminder email.',
    },
    {
      surface: 'checkout',
      title: 'Paid',
      dot: 'bg-success',
      body: 'One page. Tax and shipping calculate before they pay, the card clears, and the stock count comes down the same instant.',
    },
    {
      surface: 'fulfillment',
      title: 'Shipped',
      dot: 'bg-success',
      body: 'Pick, pack, add tracking — send part of the order now and the rest later. Tracking sends the shipping email; a refund puts the stock back.',
    },
  ];
  return (
    <Section id="journey" surface="surface" padding="lg">
      <SectionHeader
        accent={C.color}
        headline="One order, catalog to fulfilled"
        lede="Every order takes the same path, and everything it touches lives in one place — so there is no second system to keep in step and nothing to reconcile on Monday. Stock, pricing, and what this customer has bought before are all re-checked as it moves."
      />
      <div className="mkt-pipeline bg-base-100 mt-13">
        {stages.map((s, i) => (
          <div
            key={s.surface}
            className="mkt-pipe-cell relative flex min-h-[184px] flex-col gap-3 px-6 pt-6 pb-7"
          >
            {/* The stage's state, drawn as a filled bar the width of the cell
                rather than an 8px dot beside the title. Four dots at four hues
                was information nobody could see: at that size the lifecycle ramp
                (grey → blue → green → green) is invisible, so the rail read as
                four boxes and the color did nothing.

                As a full-width rule it is the first thing the eye gets, and the
                four stages resolve left-to-right before a word is read — which
                is the only reason to draw a pipeline instead of a list. */}
            <span aria-hidden className={`h-1 w-full rounded-full ${s.dot}`} />
            <h3 className="m-0 font-sans text-lg font-medium tracking-[-0.01em]">{s.title}</h3>
            {/* 16px, not 14px. This is body copy someone is meant to READ, and
                the floor for that is 16 — 14 is for captions. Every card body on
                this page was `text-sm`, which is what made the page feel small
                and dense no matter what color went on it. */}
            <p className="text-md m-0 font-sans">{s.body}</p>
            {/* Still 14px, and legitimately so: this is a caption naming the
                stage, not something read as a sentence. */}
            <span className="mt-auto pt-2 font-mono text-sm">{s.surface}</span>
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
      body: 'Anyone who has bought before never sees the card form again. The bank’s extra verification step is handled for you.',
    },
    {
      n: 'D',
      title: 'Live tax & shipping',
      body: 'Real sales tax and real carrier rates, worked out and shown before they pay — not a guess they discover on the receipt.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={C.color}
        headline="A checkout built to convert"
        lede="One page, not a five-screen funnel. The address finishes itself, returning customers never see the card form again, and the wallet already on their phone is right there."
      />
      {/* A DARK STAGE, and this is the fix for a section that read as "a picture
          next to four boxes."

          Three things were wrong. (1) A white frame on the grey page background
          has almost no separation — the product shot, which is the entire point
          of the section, had no ground to stand on and its hairline border
          dissolved. (2) The four pins were four more bordered white cards, so
          they read as a fifth column of the same material rather than as a
          legend. (3) Worst: the A/B/C/D key pointed at NOTHING. The frame had no
          markers on it at all, so the section called itself annotated while the
          letters were decoration.

          A `data-theme` plate rather than a dark BAND: the page already opens
          and closes on full-bleed dark, and a fourth would flatten the rhythm
          (DESIGN.md §2.4). A recessed stage inside a grey section is its own
          device — it says "exhibit" — and it gives the white frame maximum
          contrast without spending a band on it. The legend rides the same
          plate, which is what ties it to the frame; on dark it needs no card of
          its own, so those four boxes are gone. */}
      <div data-theme="dark" className="bg-base-100 mt-13 rounded-3xl p-6 sm:p-10">
        <div className="mkt-frame-grid">
          {/* Back to LIGHT for the frame itself. A checkout mockup has to look
              like a real storefront, and inside the dark scope `bg-base-100`
              resolves to near-black. The radius is on the themed div because a
              `data-theme` scope PAINTS its own base surface — left square it
              wraps the frame's own corners in a hard-edged white rectangle. */}
          <div data-theme="light" className="min-w-0 rounded-xl">
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <CheckoutBrowser key={b.domain} business={b} />
              ))}
            />
          </div>
          <div className="flex flex-col gap-5">
            {pins.map((p) => (
              <div key={p.n} className="flex gap-3">
                {/* A/B/C/D is an annotation KEY, not a step marker — and now the
                    same chip really does sit on the matching spot in the frame,
                    which is what makes this a legend instead of a list. A filled
                    chip with its paired ink, because that is the legible way to
                    show a module hue. */}
                <span
                  className={`${C.bg} ${C.content} flex size-6 shrink-0 items-center justify-center rounded-md font-mono text-sm`}
                >
                  {p.n}
                </span>
                <div>
                  <h4 className="text-md mt-0 mb-1 font-sans font-medium">{p.title}</h4>
                  <p className="text-md m-0 font-sans">{p.body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </Section>
  );
}

/** The A/B/C/D marker as it appears ON the checkout frame — the other half of
 *  the legend above. Absolutely positioned against the field it annotates, so it
 *  reads as a callout pinned to the interface rather than another inline chip.
 *  Same fill + paired ink as the legend chip; identical by construction, because
 *  a key that doesn't match its marker is worse than no key. */
function PinMark({ n }: { n: string }) {
  return (
    <span
      aria-hidden
      className={`${C.bg} ${C.content} absolute -top-2 -left-2 z-1 flex size-5 items-center justify-center rounded-md font-mono text-sm`}
    >
      {n}
    </span>
  );
}

function CheckoutBrowser({ business }: { business: ExampleBusiness }) {
  return (
    // No `shadow-lg`. Shadows are banned as a visual device — surfaces separate
    // with an edge, a base-tone shift, or radius, all three of which this frame
    // already has. It was one of twelve on the page.
    <div className="border-base-300 bg-base-100 overflow-hidden rounded-xl border">
      <div className="border-base-300 bg-base-200 flex items-center gap-2 border-b px-4 py-3">
        <span className="flex gap-1.5">
          {[0, 1, 2].map((d) => (
            <span key={d} className="bg-base-300 size-2.5 rounded-full" />
          ))}
        </span>
        <span className="border-base-300 bg-base-100 ml-2 flex-1 rounded-md border px-3 py-1 font-mono text-sm">
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
      className="border-base-300 bg-base-100 flex items-center justify-between rounded-lg border px-3 py-2.5 font-sans text-sm"
    >
      {children}
    </div>
  );
  // Step labels INSIDE the checkout mockup. They keep their slot (they name
  // the step below them) but not the micro-cap treatment — that is banned as a
  // LOOK, not only as a slot, so the device drops it too.
  // No module ink. These name the steps of a real checkout mockup and are meant
  // to be READ; `${C.ink}` put them in the raw Commerce hue on a white frame at
  // 2.80:1. A module hue is a fill — see the annotation key above for the shape
  // treatment. Here nothing needs distinguishing, so the label just inherits.
  const step = (label: string) => <span className="font-mono text-sm font-medium">{label}</span>;
  return (
    <div className="flex flex-col gap-4 px-7 py-6">
      {step('Contact & shipping')}
      {field(<span>{business.customer.email}</span>)}
      {/* A — the address field. The marker replaces the bare orange dot that
          used to sit here: the dot signalled "something happened" without
          saying what, while the pin ties the field to the legend entry that
          explains it. */}
      <div className="relative">
        <PinMark n="A" />
        {field(
          <span>
            {business.customer.address}
            <span> · suggested</span>
          </span>
        )}
      </div>
      <div className="grid grid-cols-2 gap-2.5">
        {field(<span>City</span>, 'city')}
        {field(<span>ZIP</span>, 'zip')}
      </div>
      {step('Payment')}
      {/* B — the wallet row. */}
      <div className="relative grid grid-cols-2 gap-2.5">
        <PinMark n="B" />
        {['Apple Pay', 'Link'].map((w) => (
          <span
            key={w}
            className="border-base-300 bg-base-100 rounded-lg border p-3 text-center font-sans text-sm font-medium"
          >
            {w}
          </span>
        ))}
      </div>
      {/* C — the saved card. */}
      <div className="relative">
        <PinMark n="C" />
        {field(
          <>
            <span>Card ending 4242</span>
            <span className="font-mono text-sm">saved</span>
          </>
        )}
      </div>
      {/* The mockup's pay button: silica's solid module fill supplies its own
          paired ink, so there is no hand-picked white on the orange. */}
      <span
        className={`${C.bg} text-module-commerce-content text-md flex items-center justify-center gap-2 rounded-[10px] p-3.5 font-sans font-medium`}
      >
        Pay {business.order.total}
        <Check size={15} color="currentColor" />
      </span>
    </div>
  );
}

function CheckoutSummary({ business }: { business: ExampleBusiness }) {
  const items = business.order.products.map((p): [string, string, string] => [
    `${p.name} ×${p.qty}`,
    p.price,
    p.image,
  ]);
  return (
    <div className="bg-base-200 border-base-300 flex flex-col gap-3.5 border-l px-6 py-6">
      <span className="font-sans text-sm font-medium">Order summary</span>
      {items.map(([t, amt, img]) => (
        <div key={t} className="flex items-center gap-3 font-sans text-sm">
          {/* The real product, not a grey square — same reasoning as the receipt
              on /commerce. Decorative inside a mockup, and the product name is
              the text right beside it, so `alt=""` + aria-hidden. */}
          <img
            src={img}
            alt=""
            aria-hidden
            width={32}
            height={32}
            loading="lazy"
            decoding="async"
            className="border-base-300 size-8 shrink-0 rounded-md border object-cover"
          />
          <span>{t}</span>
          <span className="ml-auto">{amt}</span>
        </div>
      ))}
      {/* D — the live tax + shipping lines, pinned as one pair since the legend
          entry covers both.

          These render the example's own LABEL, not the bare words "Shipping"
          and "Tax". The labels were already in the data and were being thrown
          away, which broke the pin: the farm stand's order is legitimately
          `Shipping · Local pickup $0.00` and `Tax · exempt (grocery) $0.00`, but
          stripped to "Shipping $0.00 / Tax $0.00" it read as though nothing had
          been calculated — directly under a callout claiming real rates. With
          the label restored the zero IS the proof, because it says why. */}
      <div className="relative">
        <PinMark n="D" />
        <div className="border-base-300 flex justify-between gap-4 border-t pt-3 font-sans text-sm">
          <span>{business.order.shipping.label}</span>
          <span className="shrink-0">{business.order.shipping.value}</span>
        </div>
        <div className="mt-3.5 flex justify-between gap-4 font-sans text-sm">
          <span>{business.order.tax.label}</span>
          <span className="shrink-0">{business.order.tax.value}</span>
        </div>
      </div>
      <div className="border-base-300 flex items-baseline justify-between border-t pt-3 font-sans font-medium">
        <span>Total</span>
        <span className="text-xl tracking-[-0.02em]">{business.order.total}</span>
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
