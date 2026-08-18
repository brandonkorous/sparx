import { Dot, getModuleColor, Section, SectionHeader, Text } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * Two structural devices for the /b2b page, split out of b2b-page.tsx:
 *
 *  - B2bTerms ........ net terms & credit: an account's terms + credit bar beside
 *    the A/R aging ledger (current → 60+), the cashflow-risk view.
 *  - B2bBulkPo ....... bulk / PO ordering: how a wholesale order is placed (PO
 *    number, saved cart reorder, quantity rules, approval hold) as labeled rows.
 *
 * Grounded in docs/10 (B2B PRD) + the real dashboard B2B surfaces (credit
 * limit/used, A/R aging buckets, approval rules). B2B slate is a signal, not
 * fill. (Fleet/service + the same-engine beat live in b2b-extras.tsx.)
 */

const M = getModuleColor('b2b');

// ── NET TERMS & CREDIT + A/R AGING ──────────────────────────────────────────
export function B2bTerms() {
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Net terms, credit, and what’s outstanding"
        lede="Sell on terms without selling blind. Set Net 15 to 60 and a credit limit per account; orders on terms invoice automatically with the buyer’s PO number and count against the limit. When an account would run over, the order holds for your approval — and A/R aging shows what’s outstanding by age."
      />
      <div className="mkt-b2b-split mt-12">
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <CreditCard key={b.domain} business={b} />
          ))}
        />
        <AgingLedger />
      </div>
    </Section>
  );
}

function CreditCard({ business }: { business: ExampleBusiness }) {
  const { b2b } = business;
  return (
    <div
      className={`${M.bg} border-base-300 bg-soft flex h-full flex-col gap-5 rounded-xl border p-6`}
    >
      <div>
        <Text as="div" size={18} weight={500} className="tracking-[-0.01em]">
          {b2b.account}
        </Text>
        <Text as="div" size={12} mono className="mt-1">
          {b2b.terms} · {b2b.tier}
        </Text>
      </div>
      <div className="flex flex-col gap-2">
        <div className="flex items-baseline justify-between">
          <Text as="span" size={13}>
            Credit used
          </Text>
          <Text as="span" size={13}>
            {b2b.creditUsed} / {b2b.creditLimit}
          </Text>
        </div>
        <span className="bg-base-200 block h-2 overflow-hidden rounded-full">
          <span
            className="bg-module-b2b block h-full rounded-full"
            style={{ width: b2b.creditUsedPct }}
          />
        </span>
        <Text as="span" size={11} mono>
          {b2b.creditUsedPct} of limit used
        </Text>
      </div>
      <div className={`${M.bg} bg-soft mt-auto flex items-center gap-2 rounded-lg px-3.5 py-3`}>
        <Dot color={M.color} size={7} />
        <Text as="span" size={13} className={M.ink}>
          New PO checks the limit before it’s placed
        </Text>
      </div>
    </div>
  );
}

/** Static A/R aging ledger — the real dashboard buckets (current, 1–30, 31–60,
 *  60+). Illustrative totals; the device is the shape, not a tenant's numbers.
 *  The two older buckets wear the SEMANTIC warning/error hues, not a hex. */
function AgingLedger() {
  const rows: { label: string; value: string; bar: string; tone: string }[] = [
    { label: 'Current', value: '$34,200', bar: '100%', tone: 'bg-module-b2b' },
    { label: '1–30 days', value: '$11,400', bar: '34%', tone: 'bg-module-b2b' },
    { label: '31–60 days', value: '$4,100', bar: '12%', tone: 'bg-warning' },
    { label: '60+ days', value: '$2,400', bar: '7%', tone: 'bg-error' },
  ];
  return (
    <div className="bg-base-100 border-base-300 rounded-xl border p-6">
      <div className="flex items-baseline justify-between">
        <Text as="span" size={15} weight={500}>
          Accounts receivable
        </Text>
        <Text as="span" size={11} mono>
          outstanding by age
        </Text>
      </div>
      <Text as="div" size={28} weight={500} className="mt-2.5 tracking-[-0.02em]">
        $52,100
      </Text>
      <Text as="div" size={13} className="mb-5">
        across 41 open invoices
      </Text>
      <div className="flex flex-col gap-4">
        {rows.map((r) => (
          <div key={r.label} className="flex flex-col gap-2">
            <div className="flex items-baseline justify-between">
              <Text as="span" size={13}>
                {r.label}
              </Text>
              <Text as="span" size={13} weight={500}>
                {r.value}
              </Text>
            </div>
            <span className="bg-base-200 block h-1.5 overflow-hidden rounded-full">
              <span className={`${r.tone} block h-full rounded-full`} style={{ width: r.bar }} />
            </span>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── BULK / PO ORDERING ──────────────────────────────────────────────────────
export function B2bBulkPo() {
  const rows = [
    {
      title: 'PO number at checkout',
      body: 'Buyers enter their purchase-order number when they place an order; it rides onto the invoice and every statement, so AP can reconcile without a phone call.',
    },
    {
      title: 'Saved carts & one-click reorder',
      body: 'Accounts keep named saved carts and reorder a past order in a click — the routine wholesale buy that doesn’t need a fresh quote every time.',
    },
    {
      title: 'Quantity rules per account',
      body: 'Set minimum and maximum order quantities, case packs, and minimum order values per product per account — the rules that make wholesale wholesale.',
    },
    {
      title: 'Approval holds over a threshold',
      body: 'Orders above a configured amount hold for staff approval before they’re placed — and so do orders that would push an account over its credit limit.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Ordering the way buyers actually order"
        lede="Wholesale isn’t a retail cart with a bigger total. POs, saved carts, case quantities, and approval thresholds are built into the same checkout — so a routine reorder is one click and a big first order routes for sign-off."
      />
      <div className="mt-12 grid grid-cols-1 gap-5 md:grid-cols-2">
        {rows.map((r) => (
          <div
            key={r.title}
            className="bg-base-100 border-base-300 flex gap-4 rounded-xl border p-6"
          >
            <span
              className={`${M.bg} bg-soft flex size-[34px] shrink-0 items-center justify-center rounded-lg`}
            >
              <Dot color={M.color} size={9} />
            </span>
            <div>
              <h3 className="text-md mt-0 mb-1.5 font-sans font-medium tracking-[-0.01em]">
                {r.title}
              </h3>
              <Text size={13} className="m-0">
                {r.body}
              </Text>
            </div>
          </div>
        ))}
      </div>
    </Section>
  );
}
