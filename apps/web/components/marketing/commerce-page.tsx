import { Fragment, type ReactNode } from 'react';
import {
  BarChart3,
  Boxes,
  CreditCard,
  History,
  Layers,
  Percent,
  ReceiptText,
  Smartphone,
  Undo2,
  Wallet,
  Warehouse,
  Zap,
  type LucideIcon,
} from 'lucide-react';
import { Badge, Button } from '@wizeworks/silicaui-react';
import {
  Container,
  Display,
  Dot,
  getModuleColor,
  Section,
  SectionHeader,
  Spark,
} from './primitives';
import { CommerceCheckout, CommerceJourney } from './commerce-sections';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';
import { Faq, type FaqItem } from './faq';

/**
 * The /commerce marketing page — Commerce is the **transactional core** of
 * sparx. The thesis is a single object told end to end: the ORDER. The page
 * traces one order from catalog → cart → checkout → fulfilled → the ledger, so
 * it reads as momentum (the energy of conversion) without becoming a loud "BUY
 * NOW" billboard. Commerce orange is a *signal* — the order line, the paid
 * badge, the descending fee bars, the spark — never flood fill.
 *
 * Bespoke + full-length, modeled on ai-page.tsx / builder-page.tsx; the
 * markup-heavy device sections (the order pipeline + the annotated checkout
 * frame) live in commerce-sections.tsx so each file stays cohesive.
 *
 * Facts are grounded in docs/09 (e-commerce PRD) + docs/17 (billing). Stripe is
 * the primary processor (no invented PayPal/Klarna); wallets are Apple Pay /
 * Google Pay / Link. Tax = TaxJar / Avalara, carrier rates = EasyPost. Flat
 * $49/mo with Invoicing + Inventory bundled free — no tiers, no "+", no "Pro+".
 *
 * PAYMENT FEE — the source of truth is docs/94 §8, NOT docs/17 §2. This file
 * used to cite a "0.5% → 0.3% → 0% ladder from billing §2"; that model was
 * removed on 2026-07-22 and never shipped. The shipped rule, implemented in
 * `packages/payments/src/fee.ts`, is: sparx Pay 0.5%, every other gateway and
 * every manual payment $0. Nothing about the fee varies with modules or spend.
 */
export function CommercePage() {
  return (
    <>
      <CommerceHero />
      <CommerceJourney />
      <CommerceCheckout />
      <PaymentsRail />
      <FeeLadder />
      <Operations />
      <HeadlessOrHosted />
      <CommerceProof />
      <CommercePricing />
      <Faq
        items={COMMERCE_FAQ}
        id="faq"
        heading={
          <>
            Commerce questions
            <Spark color={C.color} />
          </>
        }
        lede="Pricing, fees, payments, and how it fits your stack — answered straight. Still deciding? Read the commerce docs or start the 14-day trial."
      />
      <CommerceCta />
    </>
  );
}

const C = getModuleColor('commerce');
const BUILDER = getModuleColor('builder');

// Page-specific FAQ. Real evaluation questions for sparx Commerce, answered
// straight and grounded in docs/09 (PRD) + docs/17 (billing) — no tier/plan
// language. Feeds the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing.
const COMMERCE_FAQ: FaqItem[] = [
  {
    id: 'commerce-pricing',
    question: 'How much does sparx Commerce cost?',
    answer:
      'A flat $49/mo, with Invoicing and Inventory included free. No tiers and no setup fee — turn Commerce on, add any other modules à la carte, and it all lands on one bill. Start on a 14-day free trial; no card required to begin.',
  },
  {
    id: 'commerce-fees',
    question: 'Is there a per-transaction fee?',
    answer:
      'Only if you take card payments through sparx Pay, where it is a flat 0.5% and sparx handles chargebacks and card-security compliance for you. Connect your own Stripe, PayPal, or Square account instead and sparx charges nothing — we are not in the payment, so there is nothing to charge for. Payments you take by check, cash, or bank transfer are free too. There is no tiered or plan-based fee.',
  },
  {
    id: 'commerce-headless',
    question: 'Do I need a storefront, or can I run Commerce headless?',
    answer:
      'Either. Run Commerce entirely through the REST API and the MCP server against your own frontend, or switch on Builder for a hosted storefront on your own domain. It is the same order data and the same checkout either way.',
  },
  {
    id: 'commerce-payments',
    question: 'Which payment methods are supported?',
    answer:
      'Stripe is the primary processor: credit and debit cards, Apple Pay, Google Pay, and Link (Stripe’s one-click checkout). Everything runs through Stripe Connect, so funds settle into your own account.',
  },
  {
    id: 'commerce-tax-shipping',
    question: 'How are tax and shipping handled?',
    answer:
      'Sales tax is calculated by TaxJar or Avalara; live carrier rates (FedEx, UPS, USPS) come from EasyPost, alongside flat-rate rules and local pickup. Connect your accounts and totals calculate at checkout before the customer pays.',
  },
  {
    id: 'commerce-b2b',
    question: 'Can the same store sell wholesale and B2B?',
    answer:
      'Yes — D2C and B2B run on one engine. Add the B2B module for account-specific pricing, net terms, and RFQs; those orders move through the same checkout, inventory, and fulfillment as your retail orders, all on one customer record.',
  },
];

// ── HERO ──────────────────────────────────────────────────────────────────────
function CommerceHero() {
  // Plain language, because the person reading this runs a business and does not
  // write software. The old lede opened on "the transactional core of sparx" and
  // closed on "one order object, cart to fulfilled" — accurate, and meaningless
  // to the audience the platform is actually for. Every claim below is the same
  // claim, said in words an owner would use themselves.
  const lede =
    'Everything you need to sell: your products and what you have in stock, a checkout people actually finish, card payments through Stripe, and the day-to-day work after the order — picking, shipping, refunds. Build your own storefront on top of it, or turn on Builder and get one.';
  // Four claims, four hues — each the color of the thing it names, so the row
  // reads as four different promises instead of four copies of one. They were
  // four identical lowercase mono pills each led by the same orange dot.
  const chips: { label: string; color: string }[] = [
    { label: 'Stripe payments', color: 'module-commerce' },
    { label: 'Headless or hosted', color: 'module-builder' },
    { label: 'Retail and trade, one system', color: 'module-b2b' },
    { label: 'Invoicing + Inventory free', color: 'success' },
  ];
  return (
    // A real dark island, not a pale wash. This was `${C.bg} bg-soft` — the
    // module hue at ~5% flooded across the entire hero, which is the one thing
    // this page's own header comment says never to do ("Commerce orange is a
    // signal … never flood fill") and which RULE #3 calls out directly: soft is
    // an accent for the ONE thing that earns it, not a page background. It also
    // made the hue useless everywhere else, because a 5% orange field is the
    // faintest possible version of the color the rest of the page needs to mean
    // something.
    //
    // `data-theme="dark"` re-resolves every token underneath rather than
    // painting, so the buttons, badges and prose inside need no dark variants —
    // and it is where module hues finally become legible as INK (~7:1 here,
    // against ~2.4:1 on a light band). The house hero, same as /features,
    // /pricing, /partners and every tool page.
    <section
      data-theme="dark"
      className="bg-base-100 px-page pb-section-lg pt-[clamp(56px,9vw,96px)]"
    >
      <Container>
        <div className="flex flex-col items-center gap-[clamp(40px,6vw,72px)] lg:flex-row">
          <div className="min-w-0 flex-1">
            <Display as="h1" size={88} lineHeight={84}>
              Sell, ship, get paid
              <Spark color={C.color} />
            </Display>
            <p className="mt-7 max-w-[560px] font-sans text-[clamp(16px,1.6vw,20px)] leading-[1.55] font-normal">
              {lede}
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Button color="primary" size="lg">
                Start selling →
              </Button>
              <a href="#journey">
                <Button size="lg" variant="outline">
                  See how an order flows
                </Button>
              </a>
            </div>
            <ul className="mt-7 flex list-none flex-wrap items-center gap-2.5 p-0">
              {chips.map((c) => (
                <li key={c.label}>
                  <Badge color={c.color} variant="solid" size="lg">
                    {c.label}
                  </Badge>
                </li>
              ))}
            </ul>
          </div>
          {/* A nested LIGHT island, so the receipt stays a real white product
              surface and floats on the near-black hero instead of dissolving
              into a pale tint. `data-theme` is a real scope in
              @sparx/brand/theme.css in both directions.

              `rounded-2xl` is load-bearing, not decoration. A `data-theme` scope
              is a theme ROOT, so it PAINTS its own base surface — this div
              computes solid white and is a visible box in its own right. Left
              square, it wrapped the receipt's 16px corners in a hard-edged white
              rectangle and the card read as if it had lost its radius. Matching
              the radius makes the two coincide.

              Anything carrying `data-theme` needs the shape of the surface it is
              standing in for. No `overflow-hidden` — that would clip the card's
              own shadow. */}
          <div data-theme="light" className="w-full min-w-0 flex-1 rounded-2xl">
            <OrderReceipt />
          </div>
        </div>
      </Container>
    </section>
  );
}

/**
 * The hero's product-surface proof — a real order object, not a faux dashboard.
 * Crossfades through EXAMPLE_BUSINESSES (the shared, app-wide fixture set) so
 * Commerce reads as the same engine for ANY business, never anchored on one
 * vertical. Each scene is a complete, coherent order; all share the two-line
 * shape so the card never reflows. <Cycle> pins to the first scene under
 * prefers-reduced-motion.
 */
function OrderReceipt() {
  return (
    <Cycle
      items={EXAMPLE_BUSINESSES.map((b) => (
        <ReceiptCard key={b.domain} business={b} />
      ))}
    />
  );
}

function ReceiptCard({ business }: { business: ExampleBusiness }) {
  const { order, customer } = business;
  return (
    // No `shadow-lg` — banned as a visual device. The border, the radius, and
    // the base-tone shift against the dark hero already separate this card.
    <div className="border-base-300 bg-base-100 overflow-hidden rounded-2xl border">
      <div className="border-base-300 flex items-center justify-between border-b px-5 py-4">
        <span className="flex items-center gap-2.5">
          <Dot color={C.color} size={9} />
          <span>
            <span className="font-sans text-sm font-medium">{order.number}</span>
            <br />
            <span className="font-sans text-sm">{customer.name} · just now</span>
          </span>
        </span>
        {/* Paid is a STATUS, and status is its own color axis — it is not the
            module's hue. This was `module-commerce` + `bg-soft`: the wrong
            meaning (orange says "commerce", green says "the money arrived") at
            2.43:1, because a soft badge inks its label in the raw accent over a
            15% tint of that same accent. */}
        <Badge color="success" variant="solid" size="md" className="gap-[7px]">
          <Check size={13} color="currentColor" /> Paid
        </Badge>
      </div>
      {order.products.map((it) => (
        <div key={it.sku} className="border-base-200 flex items-center gap-3 border-b px-5 py-3">
          {/* A real product photograph, not a grey square. A receipt whose line
              items are empty placeholders reads as a wireframe of a shop; with
              the actual thing on it, it reads as a shop. Fixture set + licence:
              apps/web/public/products/README.md.

              `alt=""` and aria-hidden: this is decoration inside a MOCKUP, and
              the product name sits in text immediately beside it — announcing
              the photo would just repeat it. Explicit width/height reserve the
              box so the receipt never reflows as images arrive. */}
          <img
            src={it.image}
            alt=""
            aria-hidden
            width={38}
            height={38}
            loading="lazy"
            decoding="async"
            className="border-base-300 size-[38px] shrink-0 rounded-lg border object-cover"
          />
          <span>
            <span className="font-sans text-sm font-medium">{it.name}</span>
            <br />
            <span className="font-sans text-sm">
              {it.sku} · qty {it.qty}
            </span>
          </span>
          <span className="ml-auto font-sans text-sm">{it.price}</span>
        </div>
      ))}
      <div className="px-5 py-3.5">
        {[
          ['Subtotal', order.subtotal],
          [order.shipping.label, order.shipping.value],
          [order.tax.label, order.tax.value],
        ].map(([l, v]) => (
          <div key={l} className="flex justify-between py-1 font-sans text-sm">
            <span>{l}</span>
            <span>{v}</span>
          </div>
        ))}
        <div className="border-base-300 mt-2 flex items-baseline justify-between border-t pt-3">
          <span className="font-sans text-sm font-medium">Total</span>
          <span className="font-sans text-2xl font-medium tracking-[-0.02em]">{order.total}</span>
        </div>
      </div>
      <div className="border-base-300 bg-base-200 flex items-center gap-2 border-t px-5 py-3">
        <Dot color={C.color} size={6} />
        <span className="font-mono text-sm">paid with {order.paidWith} · stock updated</span>
      </div>
    </div>
  );
}

// ── PAYMENT METHODS — THE SETTINGS LIST, ALREADY ON ─────────────────────────
function PaymentsRail() {
  // STRUCTURE, not decoration. Five sections of this page in a row were the same
  // object — a row of bordered boxes, each with a chip, a title and a paragraph
  // — so no amount of recoloring was going to make the page read as designed.
  // This section is the one whose argument has an obvious SHAPE, so it gets it.
  //
  // The claim is "all four are already on." So the device is the settings list
  // you would go looking for to switch them on — four rows, every switch already
  // thrown. The reader sees the answer before reading a word, and the
  // `<Badge>All four on by default</Badge>` that used to carry the claim is
  // DELETED, because the device now says it. That is the DESIGN.md §5 test: if
  // adding the design didn't let you delete words, you decorated.
  //
  // The four still share one hue — they are four instances of one thing, and
  // four colors here would be decoration. RULE #4 cuts both ways.
  const methods: { nm: string; ds: string; icon: LucideIcon }[] = [
    {
      nm: 'Cards',
      ds: 'Every major card, with the bank’s extra verification step handled for you.',
      icon: CreditCard,
    },
    {
      nm: 'Apple Pay',
      ds: 'One-tap on iPhone and Safari — no card entry, higher conversion.',
      icon: Smartphone,
    },
    {
      nm: 'Google Pay',
      ds: 'The same one-tap path for Android and Chrome shoppers.',
      icon: Wallet,
    },
    {
      nm: 'Link',
      ds: 'Stripe’s one-click checkout — saved details across every Stripe store.',
      icon: Zap,
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        headline="Stripe, plus the wallets they already use"
        // Rewritten alongside the fee correction below. The old lede said "you
        // keep your own Stripe account and relationship", which describes the
        // BYO-gateway path, not sparx Pay — and this section is about the four
        // methods that are on either way, so it should not claim either path.
        lede="Card payments run on Stripe. Every method below is switched on the day you open, so you are never the shop that could not take somebody's Apple Pay."
      />
      <div className="border-base-300 bg-base-100 mt-13 max-w-[860px] overflow-hidden rounded-xl border">
        {methods.map((m, i) => {
          const Icon = m.icon;
          return (
            <div
              key={m.nm}
              className={`flex items-center gap-5 px-6 py-5 ${
                i === 0 ? '' : 'border-base-300 border-t'
              }`}
            >
              <span
                aria-hidden
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${C.bg} ${C.content}`}
              >
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <span className="min-w-0 flex-1">
                <span className="text-md block font-sans font-medium tracking-[-0.01em]">
                  {m.nm}
                </span>
                <span className="text-md block font-sans">{m.ds}</span>
              </span>
              {/* The switch. It is decorative in the sense that you cannot click
                  it, so it is `aria-hidden` and the row reads to a screen reader
                  as the method plus the "On" text below — but it is the whole
                  point of the section visually. `bg-success` for the track, and
                  the knob is the track's paired ink so it stays legible if the
                  semantic palette is ever repointed. */}
              <span className="flex shrink-0 items-center gap-3">
                <span className="text-md font-sans font-medium">On</span>
                <span
                  aria-hidden
                  className="bg-success flex h-6 w-11 items-center justify-end rounded-full px-[3px]"
                >
                  <span className="bg-success-content size-[18px] rounded-full" />
                </span>
              </span>
            </div>
          );
        })}
      </div>
      <p className="text-md mt-4 max-w-[720px] font-sans">
        You can take test orders before you go live, and a refund goes back to the card they paid
        with. Need to invoice a trade customer, or take a purchase order at checkout instead?{' '}
        <a href="/b2b" className="font-medium underline underline-offset-2">
          That&rsquo;s B2B
        </a>
        , layered on the same engine.
      </p>
    </Section>
  );
}

// ── WHO TAKES A CUT ─────────────────────────────────────────────────────────
function FeeLadder() {
  // FACT CORRECTION, 2026-08-02. This section used to show a 0.5% → 0.3% → 0%
  // "fee ladder" that stepped down when you added CRM and vanished at $299/mo of
  // modules. That pricing model was REMOVED on 2026-07-22 (docs/17 §"Transaction
  // Fees — REMOVED") and never shipped: `transactionFeeRate()`, the function
  // docs/92 says holds the ladder, does not exist anywhere in the codebase.
  //
  // The governing rule is docs/94 §8 (marked "Decided — do not relitigate"), and
  // it is what `packages/payments/src/fee.ts` actually implements, test and all:
  //
  //     sparx Pay (Stripe Connect)         → 0.5% of every payment
  //     any other gateway (Stripe direct,
  //       PayPal, Square…)                 → $0, sparx is not in the flow
  //     manual (check, cash, wire, ACH)     → $0, sparx never touched the money
  //
  //   "No tier-based fee structure. No plan-based fee structure. One rule."
  //
  // So this is not a ladder and must not be drawn as one. It is a CHOICE with
  // three doors, which changes both the structure and the color: there is no
  // descending cost to ramp error → info → success across. `info` states the one
  // case where a fee exists; `success` marks the two where it does not.
  //
  // The old copy also had the fee "on top of your own Stripe processing", which
  // is backwards — bringing your own Stripe is precisely the case where sparx
  // charges nothing.
  const doors = [
    {
      when: 'You use sparx Pay',
      pct: '0.5%',
      pctSize: 64,
      pctInk: 'text-info',
      barFill: 'bg-info',
      barW: '100%',
      body: 'Card payments handled end to end. sparx is the merchant of record, which means we take the chargebacks, the card-security paperwork, and the setup — you take the money.',
    },
    {
      when: 'You bring your own',
      pct: '0%',
      pctSize: 64,
      pctInk: 'text-success',
      barFill: 'bg-success',
      barW: '4%',
      body: 'Already have Stripe, PayPal, or Square? Connect it and keep your own rates. sparx never touches the payment, so sparx charges nothing for it.',
    },
    {
      when: 'You get paid directly',
      pct: '0%',
      pctSize: 64,
      pctInk: 'text-success',
      barFill: 'bg-success',
      barW: '4%',
      body: 'Check, cash, bank transfer. Mark the invoice paid and that is the end of it — there is no card, no processor, and nothing for us to take a share of.',
    },
  ];
  return (
    // The page's one PAINTED band, and it is here because this is the page's
    // sharpest claim: in two of the three cases sparx takes nothing at all.
    // `accent` (bright cyan) rather than `primary` — the cards are inked info
    // and success, and ember fights both. Cyan is far from every hue this
    // section already carries.
    //
    // It also lands mid-page on purpose. /commerce ran six alternating
    // white/grey sections in a row; a tone has to interrupt the ladder near its
    // middle to break it, not at either end. DESIGN.md §2.4.
    <Section surface="accent" padding="lg">
      <SectionHeader
        headline="We only take a cut when we move the money"
        lede="There is one payment fee at sparx and no version of it depends on how much you spend with us. Use sparx Pay and it is half a percent. Use your own card processor, or get paid by check, and it is nothing."
      />
      <div className="mt-13 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {doors.map((r) => (
          <div
            key={r.when}
            // `text-base-content` alongside the fill, not just the fill. A
            // painted band is not a theme scope, so a card that carried only
            // `bg-base-100` would inherit the band's `text-accent-content` — and
            // the same omission on a `primary` band is white type on a white
            // card. Fill and ink travel together (Section's doc comment).
            className="border-base-300 bg-base-100 text-base-content flex flex-col gap-3.5 rounded-xl border px-6 pt-6 pb-7"
          >
            <span className="font-mono text-sm">{r.when}</span>
            <span
              className={`font-sans leading-none font-medium tracking-[-0.03em] ${r.pctInk}`}
              // Only the display SIZE stays inline — it is a computed clamp. The
              // hue is a token class now, so re-pointing the semantic palette
              // re-colors this ladder with no edit here.
              style={{ fontSize: `clamp(48px, 7vw, ${r.pctSize}px)` }}
            >
              {r.pct}
            </span>
            <span
              className={`h-1.5 rounded-full ${r.barFill}`}
              // Width encodes the rung's value and is dynamic by definition; the
              // fill is a token class.
              style={{ width: r.barW }}
            />
            <p className="text-md font-sans">{r.body}</p>
          </div>
        ))}
      </div>
      <p className="text-md mt-5 max-w-[680px] font-sans">
        On sparx Pay the half percent comes out automatically before the money reaches your account,
        and it is separate from what the card networks charge to process the payment. Nothing extra
        per staff member, nothing extra per product, and no minimum — see{' '}
        <a href="/pricing" className="font-medium underline underline-offset-2">
          full pricing
        </a>
        .
      </p>
    </Section>
  );
}

// ── OPERATIONS GRID ─────────────────────────────────────────────────────────
function Operations() {
  // Six capabilities, six hues, each chosen for what the card MEANS — not six
  // copies of the module color.
  //
  // This grid was the single biggest source of the page's monotone: every card
  // wore the same orange dot inside the same orange `bg-soft` square, which
  // distinguished nothing and made a bullet out of the module's identity. A
  // reader scanning six identical marks learns only that all six are Commerce,
  // which the heading already said.
  //
  // Two of these genuinely belong to OTHER modules and now say so, which is the
  // house rule that color follows FUNCTIONALITY rather than route (CLAUDE.md):
  // Inventory is its own module — bundled free with Commerce, which is a fact
  // worth the reader noticing — and reporting is the analytics surface. The rest
  // take the semantic that matches the money: promotions bring it in (`success`),
  // refunds send it back (`warning`).
  //
  // `fill`/`ink` are literal class names because Tailwind's scanner cannot see an
  // interpolated `bg-${x}`, and they always travel as a PAIR: a hue is a fill,
  // and the only legible way to show one at size is to fill a shape and write on
  // top in its own `-content`.
  const ops: { title: string; body: string; icon: LucideIcon; fill: string; ink: string }[] = [
    {
      title: 'Inventory that tracks',
      body: 'A count for every size and color. Decide whether to keep selling when you run out, and get told before you do. Update the whole lot from a spreadsheet.',
      icon: Boxes,
      fill: 'bg-module-inventory',
      ink: 'text-module-inventory-content',
    },
    {
      title: 'Discounts & promotions',
      body: 'Take a percentage off, take a dollar amount off, throw in free shipping, or buy-one-get-one. Give out a code or apply it automatically, with a spend minimum, an end date, and a cap on how many go out.',
      icon: Percent,
      fill: 'bg-success',
      ink: 'text-success-content',
    },
    {
      title: 'Refunds & returns',
      body: 'Refund all of it or part of it, back to the card they paid with. The stock goes back on the shelf automatically and the reason is kept, so you can see what keeps coming back.',
      icon: Undo2,
      fill: 'bg-warning',
      ink: 'text-warning-content',
    },
    {
      title: 'Order timeline',
      body: 'Everything that happened to an order, in order, with the date on it. Leave a note your team can see, or one the customer gets too.',
      icon: History,
      fill: 'bg-module-commerce',
      ink: 'text-module-commerce-content',
    },
    {
      title: 'Reports that matter',
      body: 'What you sold this week, your best products and customers, whether the average order is going up, what your stock is worth, and how many visitors end up buying.',
      icon: BarChart3,
      fill: 'bg-info',
      ink: 'text-info-content',
    },
    {
      title: 'Built for real volume',
      body: 'Ship part of an order today and the rest when it lands. Handle a hundred orders at once instead of one at a time, and take the whole lot out to a spreadsheet whenever you want it.',
      icon: Layers,
      fill: 'bg-secondary',
      ink: 'text-secondary-content',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        headline={<>Everything after &ldquo;paid&rdquo;</>}
        lede="Taking the money is the easy part. The work that decides whether selling is worth it happens afterwards — keeping stock straight, running a promotion, handling the return, and knowing at the end of the month what actually made you money."
      />
      {/* One CONTINUOUS ledger, not six floating boxes. Six equal bordered
          cards was the page's most generic object and the third copy of the
          same shape in a row — a reader learns nothing from six identical
          rectangles except that there are six of them.

          A single bordered plate divided by hairlines reads as one system with
          six parts, which is what this section actually claims ("the order is
          only the start"). It also lets the icon column line up down the whole
          block, so the six hues form a legible column of signal instead of
          six unrelated chips floating at six different heights. */}
      <div className="border-base-300 bg-base-200 mt-13 grid grid-cols-1 overflow-hidden rounded-xl border md:grid-cols-2">
        {ops.map((o, i) => {
          const Icon = o.icon;
          return (
            <div
              key={o.title}
              // Hairlines instead of gaps + per-card borders. `i >= 2` opens the
              // top rule from the second row down; odd cells take the vertical
              // rule. On one column (mobile) every cell but the first takes a
              // top rule and none take a left one.
              className={`flex gap-4 p-6 max-md:border-t max-md:first:border-t-0 md:[&:nth-child(even)]:border-l md:[&:nth-child(n+3)]:border-t ${
                i >= 0 ? 'border-base-300' : ''
              }`}
            >
              {/* A solid filled chip, not a soft square with a dot in it. The
                  fill is the hue and the icon is drawn in its paired ink, so it
                  is legible at every one of these six colors — and the icon
                  carries the meaning a bullet never could. */}
              <span
                aria-hidden
                className={`flex size-10 shrink-0 items-center justify-center rounded-lg ${o.fill} ${o.ink}`}
              >
                <Icon size={20} strokeWidth={1.8} />
              </span>
              <div className="min-w-0">
                <h3 className="m-0 font-sans text-lg font-medium tracking-[-0.01em]">{o.title}</h3>
                <p className="text-md mt-2 mb-0 font-sans">{o.body}</p>
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

// ── HEADLESS / HOSTED ───────────────────────────────────────────────────────
function HeadlessOrHosted() {
  // No `tag` field: the uppercase mono label that used to sit above each card's
  // <h3> was an eyebrow (RULE #2). The module combination it named is already
  // carried, unambiguously, by the `runs` line at the foot of the card.
  // `runs` is a list of real modules now, not one mono string. Each renders as a
  // solid badge in that module's own registered hue, so the reader can see at a
  // glance that the hosted route brings Builder in and the headless route brings
  // AI/MCP — which is the actual decision the section is asking them to make.
  const ways: {
    title: string;
    body: string;
    points: string[];
    dotFill: string;
    runs: { label: string; color: string }[];
  }[] = [
    {
      title: 'Run it headless',
      body: 'Every capability is an API endpoint first; the dashboard is one consumer among many. Build your own front end, or let an AI assistant work the catalog and orders over MCP.',
      points: [
        'Full REST + GraphQL surface — catalog, cart, checkout, orders.',
        'SSR-ready with CDN caching for sub-200ms TTFB.',
        'Read and write live commerce data from Claude, ChatGPT, or Copilot.',
      ],
      dotFill: C.bg,
      runs: [
        { label: 'Commerce', color: 'module-commerce' },
        { label: 'AI · MCP', color: 'module-ai' },
      ],
    },
    {
      title: 'Get a hosted storefront',
      body: 'Pair Commerce with Builder and the storefront renders for you — product pages, collections, cart, and the converting checkout — on your custom domain, SSL and CDN handled.',
      points: [
        'Product, collection, cart, and account pages out of the box.',
        'Full-text product search with filters and sort.',
        'Your theme and brand — selling shares one design system with the rest of the site.',
      ],
      dotFill: BUILDER.bg,
      runs: [
        { label: 'Commerce', color: 'module-commerce' },
        { label: 'Builder', color: 'module-builder' },
      ],
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        headline="Headless, hosted, or both"
        lede="Commerce is the engine, not the front end. Drive it entirely through the API and MCP, or switch on Builder and get a hosted storefront on your own domain — same data either way."
      />
      {/* A FORK, drawn as one. Two detached cards side by side is the same
          bordered-box object as every other section, and it reads as "here are
          two features" rather than "pick one of these." `.mkt-auto-row` is the
          site's existing fork device — one plate, two halves, and a 56px pivot
          gutter between them that turns 90° when the layout stacks. It already
          exists in marketing.css for /crm's automation rows and nothing on this
          page was using it.

          Neither half is tinted. The first wore `bg-soft` in the module hue,
          which read as "this is the selected one" on a pair whose entire point
          is that both are equally valid. The distinction is carried by the
          badges naming which modules each way runs on, and by the bullet hue
          that already differed (Commerce vs Builder). */}
      <div className="mkt-auto-row mt-13">
        {ways.map((w, i) => (
          <Fragment key={w.title}>
            {i === 1 ? (
              <div className="mkt-auto-then bg-base-200 flex items-center justify-center">
                <span className="font-sans text-lg font-medium">or</span>
              </div>
            ) : null}
            <div className="flex flex-col gap-4 p-8">
              <h3 className="m-0 font-sans text-2xl font-medium tracking-[-0.02em]">{w.title}</h3>
              <p className="text-md m-0 font-sans">{w.body}</p>
              <ul className="m-0 grid list-none gap-3 p-0">
                {w.points.map((p) => (
                  <li key={p} className="flex items-start gap-3">
                    <span className="shrink-0 pt-[7px]">
                      <Dot fill={w.dotFill} size={7} />
                    </span>
                    <span className="text-md font-sans">{p}</span>
                  </li>
                ))}
              </ul>
              <div className="mt-auto flex flex-wrap gap-2 pt-1">
                {w.runs.map((r) => (
                  <Badge key={r.label} color={r.color} variant="solid" size="md">
                    {r.label}
                  </Badge>
                ))}
              </div>
            </div>
          </Fragment>
        ))}
      </div>
    </Section>
  );
}

// ── PROOF ROW (dark) ────────────────────────────────────────────────────────
function CommerceProof() {
  // Four numbers about four different things, so they wear four hues. This is
  // the one band on the page where MODULE hues can be inks at all — inside the
  // dark island they clear AA comfortably, where on a light band the same
  // classes measure ~2:1 and are fill-only. So the B2B stat gets to actually be
  // B2B slate, and the two that are not about a module take the semantic that
  // fits: `$0` is money you keep, `<200ms` is a spec.
  const stats: { n: ReactNode; l: string; ink: string }[] = [
    {
      n: <>1{<Spark color={C.color} />}</>,
      l: 'place your products, orders and customers live — nothing to keep in step',
      ink: C.ink,
    },
    {
      n: 'Retail + trade',
      // NOT `text-module-b2b`. B2B's hue is a slate, and slate on the dark
      // island measures 2.6:1 — at 56px it needs 3.0, and on screen it was a
      // grey ghost between two bright numbers. A module hue is a FILL; it does
      // not become an ink just because the surface is dark.
      //
      // `secondary` is the honest replacement rather than a contrast dodge:
      // DESIGN.md calls it "the second voice — a supporting action, an alternate
      // path," and selling to trade customers off the same engine is exactly an
      // alternate path. Measured 11.11:1 here.
      l: 'on one engine — turn trade pricing on for the accounts that get it',
      ink: 'text-secondary',
    },
    {
      n: '$0',
      l: 'extra for Invoicing — quotes, work orders, and chasing what you are owed come with Commerce',
      ink: 'text-success',
    },
    { n: '<200ms', l: 'typical page load, so shoppers are not left waiting', ink: 'text-info' },
  ];
  return (
    <Section surface="dark" padding="lg">
      {/* Inside the dark island the base ramp is flipped, so ink resolves from
          tokens — no #FFFFFF / #A1A1AA / #262626 hand-picked for the band. */}
      <div className="max-w-[760px]">
        <Display size={46} lineHeight={48}>
          See the whole funnel, on the same data
          <Spark color={C.color} />
        </Display>
        <p className="mt-5 max-w-[640px] font-sans text-lg">
          Because orders, customers, and content share one database, the numbers reconcile by
          default — no exports, no two systems disagreeing about what happened.
        </p>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className={i === 0 ? '' : 'border-base-300 border-l pl-8'}>
            <div
              className={`font-sans text-[clamp(40px,5vw,56px)] leading-none font-medium tracking-[-0.03em] ${s.ink}`}
            >
              {s.n}
            </div>
            <div className="text-md mt-3 font-sans">{s.l}</div>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP ─────────────────────────────────────────────────────────────
function CommercePricing() {
  return (
    // Ember, and the band IS the card now. This was a grey section wrapping a
    // `${C.bg} bg-soft` strip — a module wash used as a surface, which is the
    // RULE #3 default-soft failure, and it sat between the dark Proof band and a
    // grey FAQ, so the page ended on grey/grey. Painting the band solves both:
    // the money moment gets the brand's affirmative color, and the tone sequence
    // reads dark → ember → grey → dark instead of dark → grey → grey → dark.
    //
    // Matches /platform's pricing band, which is the site's precedent for
    // `primary` (DESIGN.md §3.0).
    //
    // ONE MEASURED CONSTRAINT SHAPES THIS WHOLE LAYOUT: `--color-primary-content`
    // is white, and white on ember measures 4.13:1. That clears the 3.0 bar for
    // large text and MISSES the 4.5 bar for body copy. So nothing small is
    // allowed to sit directly on the ember: the price is display-size, the
    // controls are self-inking solid components, and the paragraph moved onto a
    // white card. Ember is a display ground, not a reading ground.
    <Section surface="primary" padding="lg">
      {/* Two columns that MEET, not two clumps flung to opposite edges.
          `justify-between` on a 1900px viewport opened a void down the middle
          and left the white card reading as a sticky note someone had parked in
          the corner. A `1fr / 380px` pair with a real gap keeps the price and
          the panel in one composition at every width. */}
      <div className="grid grid-cols-1 items-center gap-10 lg:grid-cols-[1fr_380px] lg:gap-16">
        <div className="flex flex-col items-start gap-6">
          <div className="flex flex-wrap items-baseline gap-x-3">
            <span className="font-sans text-[clamp(64px,8vw,92px)] leading-none font-medium tracking-[-0.03em]">
              $49
            </span>
            {/* 24px, not 16px. At `text-md` this unit label was 4.13:1 on the
                ember — the only thing separating it from the compliant price
                beside it was font size, so the size is the fix. */}
            <span className="font-sans text-2xl">/mo</span>
          </div>
          {/* 24px, not 20px, and that is the constraint rather than taste: white
              on ember measures 4.13:1, which clears the 3.0 large-text bar and
              misses the 4.5 body bar. At `text-xl` this line was the one thing
              on the band failing it. Ember is a display ground — anything on it
              is either ≥24px or a self-inking solid component. DESIGN.md §2.4. */}
          <p className="m-0 max-w-[460px] font-sans text-2xl leading-[1.45]">
            One price, every month. No tiers to pick between, nothing extra when you hire someone,
            nothing extra when you add a product.
          </p>
          {/* Two SOLID controls. An outline button inks itself from the LIGHT
              theme's `--color-base-content` — a silica component never sees the
              band's inherited `text-primary-content` — so it would land
              near-black on ember; and `color="primary"` on a `primary` fill is
              invisible.

              `neutral` is the right CTA, not a compromise: near-black on ember
              is a strong contrasting solid, the one surface DESIGN.md §3.0 calls
              out as neutral's proper home. The sibling is COLORLESS — it falls
              back to the base surface scale, which is the correct control for a
              genuinely untyped action, and like every silica component it
              resolves its own foreground rather than inheriting the band's. */}
          <div className="mt-1 flex flex-wrap items-center gap-3">
            <Button color="neutral" size="lg">
              Activate Commerce
            </Button>
            <a href="/pricing">
              <Button size="lg">See all plans →</Button>
            </a>
          </div>
        </div>

        {/* The white panel has a JOB now. It was a floating paragraph restating
            the sentence to its left, which is why it read as a sticky note — a
            card with no reason to be a card.

            It carries the arithmetic instead, and the arithmetic is the whole
            argument: Invoicing is $19 and Inventory is $29 on their own
            (modules-catalog.ts), so $48 a month of modules arrives inside a $49
            price. That fact was previously the third clause of a paragraph. Now
            it is the panel, each line in its own module's hue, and the two loose
            `Invoicing included` / `Inventory included` badges are gone because
            the rows say it better and say what it is worth.

            `text-base-content` alongside `bg-base-100`, never the fill alone — a
            painted band is not a theme scope, so a card carrying only the fill
            inherits the band's white ink and renders white type on white. */}
        {/* TWO MODULE TILES, not a second receipt. The first pass at this panel
            was a white card with itemized rows, a dividing rule and a total —
            which is precisely the OrderReceipt device in this page's own hero.
            Repeating the page's signature object four sections later is the same
            mistake as every section being a bordered box; a device is only a
            device while it means one thing.

            So the fact gets said as two things instead of a ledger: each bundled
            module as a solid tile in its own registered hue. That is what a
            module hue is FOR — a fill, at size, carrying an identity — and the
            two tiles read as "you are getting these" rather than "here is your
            bill." Solid fills paint their own paired ink, so both are legible on
            the ember with no color decision here. */}
        <div className="flex w-full flex-col gap-3">
          {/* Fill and ink as literal PAIRS — Tailwind's scanner cannot see an
              interpolated `bg-module-${id}`, and a fill without its paired ink
              would inherit the ember band's white. */}
          {[
            {
              label: 'Invoicing',
              was: '$19',
              icon: ReceiptText,
              tone: 'bg-module-invoicing text-module-invoicing-content',
            },
            {
              label: 'Inventory',
              was: '$29',
              icon: Warehouse,
              tone: 'bg-module-inventory text-module-inventory-content',
            },
          ].map((m) => {
            const Icon = m.icon;
            return (
              <div
                key={m.label}
                className={`${m.tone} flex items-center gap-4 rounded-2xl px-6 py-5`}
              >
                <Icon size={22} strokeWidth={1.8} aria-hidden />
                <span className="flex-1 font-sans text-xl font-medium tracking-[-0.01em]">
                  {m.label}
                </span>
                <span className="text-right font-sans">
                  <span className="block text-xl leading-tight font-medium">Included</span>
                  <span className="block text-lg line-through">{m.was}/mo</span>
                </span>
              </div>
            );
          })}
          <p className="mt-2 max-w-[380px] font-sans text-2xl leading-[1.4]">
            That is <span className="font-medium">$48 a month</span> of modules inside a $49 price.
            Free for 14 days, no card to start.
          </p>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ────────────────────────────────────────────────────────
function CommerceCta() {
  return (
    // A real dark island rather than a hand-painted #0A0A0A band: `surface="dark"`
    // flips the whole base ramp, so the headline, lede, and outline button all
    // resolve their own ink.
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display size={88} lineHeight={84}>
          Start selling this afternoon
          <Spark color={C.color} />
        </Display>
        <p className="m-0 max-w-[640px] font-sans text-lg">
          Add products, connect Stripe, and take your first order — no contract, no migration
          weekend. Turn Commerce off the day you stop selling; your data stays, and you keep your
          processor relationships.
        </p>
        <div className="flex flex-wrap items-center gap-3">
          <Button color="module-commerce" size="xl">
            Start selling →
          </Button>
          <a href="#journey">
            <Button size="xl" variant="outline">
              See how an order flows
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}

/** Small inline check glyph used by the receipt's Paid badge. */
function Check({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2.4}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}
