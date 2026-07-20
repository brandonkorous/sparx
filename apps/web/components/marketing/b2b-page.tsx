import type { ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { Display, getModuleColor, Section, Spark, Text } from './primitives';
import { B2bHero } from './b2b-hero';
import { B2bPriceList, B2bRfq } from './b2b-sections';
import { B2bTerms, B2bBulkPo } from './b2b-devices';
import { B2bFleet, B2bSameEngine } from './b2b-extras';
import { Faq, type FaqItem } from './faq';

/**
 * The /b2b marketing page — B2B/Wholesale is wholesale **layered on the same
 * Commerce engine**. The thesis is the B2B ACCOUNT: one catalog and one
 * checkout, but each business buyer logs in to *their* negotiated price list,
 * *their* net terms, and an RFQ → quote flow retail never sees. The page walks
 * account → account pricing → RFQ→quote → terms/credit → bulk PO → fleet &
 * service → "same engine as D2C" → dark proof → pricing → FAQ → CTA. B2B slate
 * is a *signal* (the account dot, tier badge, the spark) — never flood fill;
 * the hero takes the light slate tint with near-black ink.
 *
 * Bespoke + full-length, modeled on commerce-page.tsx / crm-page.tsx; the
 * markup-heavy device sections live in b2b-sections.tsx / b2b-devices.tsx so
 * each file stays cohesive.
 *
 * Facts are grounded in docs/10 (B2B PRD) + docs/17 (billing) + the real
 * dashboard B2B surfaces (accounts, pricing tiers "% off list", credit
 * limit/used, payment terms "Net 30", the RFQ quote lifecycle, A/R aging,
 * approval rules, fleet/engine profiles). B2B is a flat $99/mo and REQUIRES
 * Commerce — enabling it auto-activates and bills Commerce ($49); Invoicing and
 * Inventory ride along free. No tiers, 14-day trial, no card to begin.
 */
export function B2bPage() {
  return (
    <>
      <B2bHero />
      <B2bPriceList />
      <B2bRfq />
      <B2bTerms />
      <B2bBulkPo />
      <B2bFleet />
      <B2bSameEngine />
      <B2bProof />
      <B2bPricing />
      <Faq
        items={B2B_FAQ}
        id="faq"
        accent={M.color}
        heading={
          <>
            B2B questions
            <Spark color={M.color} />
          </>
        }
        lede="Account pricing, net terms, RFQs, and how it fits Commerce — answered straight. Still deciding? Read the B2B docs or start the 14-day trial."
      />
      <B2bCta />
    </>
  );
}

const M = getModuleColor('b2b');

// Page-specific FAQ. Real evaluation questions for sparx B2B, answered straight
// and grounded in docs/10 (PRD) + docs/17 (billing) — no tier/plan language.
// Feeds the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing.
const B2B_FAQ: FaqItem[] = [
  {
    id: 'b2b-pricing',
    question: 'How much does sparx B2B cost?',
    answer:
      'A flat $99/mo. B2B layers on Commerce, so turning it on also activates Commerce at $49/mo — the two run as one engine, on one bill. Invoicing and Inventory are included free with either. No tiers, no per-account or per-seat charge. Start on a 14-day free trial; no card required to begin.',
  },
  {
    id: 'b2b-needs-commerce',
    question: 'Do I need Commerce to run B2B?',
    answer:
      'Yes — B2B is wholesale on top of the commerce engine, so enabling it auto-activates Commerce, and Commerce can’t be switched off while B2B is on. Your wholesale and retail orders then share one catalog, one inventory, one checkout, and one customer record; the difference is account-aware pricing and terms.',
  },
  {
    id: 'b2b-account-pricing',
    question: 'How does account-specific pricing work?',
    answer:
      'You build pricing tiers — a percentage off list, a fixed price, or a per-product price list — and assign them to accounts, with optional account-level overrides on a variant or collection. When a buyer logs in, the catalog and checkout show their negotiated price automatically. No manual quoting for everyday orders; the price resolves from the account.',
  },
  {
    id: 'b2b-net-terms',
    question: 'Can I offer net terms and credit limits?',
    answer:
      'Yes. Set payment terms per account — Net 15, 30, 45, or 60 — and a credit limit. An order on terms generates an invoice with the due date and the buyer’s PO number, and counts against the limit. When an account would exceed its limit the order holds for your approval, and the dashboard tracks A/R aging — current, 1–30, 31–60, and 60+ days — so you see what’s outstanding.',
  },
  {
    id: 'b2b-rfq',
    question: 'How does the RFQ and quote flow work?',
    answer:
      'A buyer builds a request for quote from the catalog — quantities, delivery needs, and notes — and submits it. You review it in the dashboard, set line-item pricing, add notes and an expiry, and send the quote back. When the buyer accepts, the quote converts straight to an order at the quoted prices. The lifecycle is tracked end to end: submitted, under review, quoted, accepted, converted.',
  },
  {
    id: 'b2b-portal',
    question: 'Do my wholesale customers get their own portal?',
    answer:
      'Yes. B2B contacts log in to an account portal — order history with invoice downloads, outstanding balance, RFQs and quote responses, one-click reorder, and a fitment-filtered catalog for accounts with a registered fleet. Contacts carry roles: account admin, buyer, or view-only, so AP can see invoices without being able to place orders.',
  },
  {
    id: 'b2b-fleet',
    question: 'Does it handle fleet management and service booking?',
    answer:
      'Fleet management is built into B2B: store a fleet profile per account — vehicles and engine types — so the catalog can surface and badge the parts that fit. Service booking itself is the separate Scheduling module ($29/mo); activate it alongside B2B and customers book service against the fleet account, with confirmation and reminder emails. Fleet is one capability of B2B, not a requirement — a salon-products or office-coffee distributor never touches it.',
  },
];

// ── DARK PROOF ────────────────────────────────────────────────────────────────
function B2bProof() {
  const stats: { n: ReactNode; l: string }[] = [
    {
      n: <>1{<Spark color={M.color} />}</>,
      l: 'catalog and checkout under retail and wholesale — nothing to mirror',
    },
    { n: 'D2C + B2B', l: 'on one engine — wholesale toggles on per account, not per store' },
    {
      n: '$0',
      l: 'extra for Invoicing and Inventory — estimates, A/R aging, and stock ride along',
    },
    { n: 'Net 60', l: 'terms, credit limits, and approval holds — native, not a spreadsheet' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div className="max-w-[760px]">
        <Display size={46} lineHeight={48}>
          One catalog, retail and wholesale at once
          <Spark color={M.color} />
        </Display>
        <Text size={18} className="mt-6 max-w-[640px]">
          B2B isn’t a second store bolted onto the first. It’s the same products, inventory, and
          orders your retail side runs — with account pricing, net terms, and quotes layered on top,
          so nothing is duplicated and nothing drifts out of sync.
        </Text>
      </div>
      <div className="mt-14 grid grid-cols-1 gap-0 sm:grid-cols-2 lg:grid-cols-4">
        {stats.map((s, i) => (
          <div key={s.l} className={i === 0 ? undefined : 'border-base-300 border-l pl-8'}>
            <div className="text-base-content font-sans text-[clamp(34px,5vw,52px)] leading-none font-medium tracking-[-0.03em]">
              {s.n}
            </div>
            <Text as="div" size={14} className="mt-3">
              {s.l}
            </Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── PRICING STRIP ───────────────────────────────────────────────────────────────
function B2bPricing() {
  return (
    <Section padding="lg">
      <div
        className={`flex flex-col lg:flex-row ${M.bg} border-base-300 bg-soft items-center justify-between gap-8 rounded-xl border p-10`}
      >
        <div className="flex flex-1 flex-col gap-3">
          <div className="flex items-baseline gap-1.5">
            <span className="text-base-content font-sans text-[56px] leading-none font-medium tracking-[-0.025em]">
              $99
            </span>
            <Text as="span" size={16} tone="subtle">
              /mo + Commerce
            </Text>
          </div>
          <Text size={14} className="max-w-[660px]">
            A flat $99/mo — account pricing, RFQ and quotes, net terms and credit, bulk PO ordering,
            and fleet accounts. B2B layers on Commerce, so turning it on activates Commerce too
            ($49/mo) and the two bill as one engine. Invoicing and Inventory are included free; add
            the Scheduling module ($29/mo) to book service against a fleet. No tiers, no per-account
            or per-seat charge. Start free for 14 days; no card to begin.
          </Text>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button color="neutral" size="lg">
            Activate B2B
          </Button>
        </div>
      </div>
    </Section>
  );
}

// ── FINAL CTA (dark) ──────────────────────────────────────────────────────────
function B2bCta() {
  return (
    <Section surface="dark" padding="xl">
      <div className="flex flex-col items-start gap-9">
        <Display size={88} lineHeight={84}>
          Open your wholesale book
          <Spark color={M.color} />
        </Display>
        <Text size={18} className="max-w-[640px]">
          Set up a pricing tier, invite your accounts, and take a PO on net terms — on the same
          catalog you already sell from. No second platform, no migration weekend; switch B2B off
          the day you stop selling wholesale, and your accounts and history stay yours.
        </Text>
        <div className="flex flex-wrap items-center gap-3">
          <Button color="module-b2b" size="xl">
            Activate B2B →
          </Button>
          <a href="#price-list">
            <Button size="xl" variant="outline">
              See account pricing
            </Button>
          </a>
        </div>
      </div>
    </Section>
  );
}
