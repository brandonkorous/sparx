import type { ReactNode } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, getModuleColor, Section, Spark } from './primitives';
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
 * Commerce — enabling it auto-activates and bills Commerce ($49); Invoicing
 * rides along free. No tiers, 14-day trial, no card to begin.
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
const SANS = 'var(--font-sans)';

// Page-specific FAQ. Real evaluation questions for sparx B2B, answered straight
// and grounded in docs/10 (PRD) + docs/17 (billing) — no tier/plan language.
// Feeds the FAQPage JSON-LD via <Faq>, so accuracy is load-bearing.
const B2B_FAQ: FaqItem[] = [
  {
    id: 'b2b-pricing',
    question: 'How much does sparx B2B cost?',
    answer:
      'A flat $99/mo. B2B layers on Commerce, so turning it on also activates Commerce at $49/mo — the two run as one engine, on one bill. Invoicing is included free with either. No tiers, no per-account or per-seat charge. Start on a 14-day free trial; no card required to begin.',
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
    { n: '$0', l: 'extra for Invoicing — estimates, invoices, and A/R aging ride along' },
    { n: 'Net 60', l: 'terms, credit limits, and approval holds — native, not a spreadsheet' },
  ];
  return (
    <Section surface="dark" padding="lg">
      <div style={{ maxWidth: '760px' }}>
        <Display size={46} lineHeight={48} color="#FFFFFF">
          One catalog, retail and wholesale at once
          <Spark color={M.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: '22px 0 0',
          }}
        >
          B2B isn’t a second store bolted onto the first. It’s the same products, inventory, and
          orders your retail side runs — with account pricing, net terms, and quotes layered on top,
          so nothing is duplicated and nothing drifts out of sync.
        </p>
      </div>
      <div className="mkt-grid-4-2-1" style={{ marginTop: '56px', gap: 0 }}>
        {stats.map((s, i) => (
          <div
            key={s.l}
            style={{
              padding: i === 0 ? '0' : '0 0 0 32px',
              borderLeft: i === 0 ? 'none' : '1px solid #262626',
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: 'clamp(34px, 5vw, 52px)',
                letterSpacing: '-0.03em',
                color: '#FFFFFF',
                lineHeight: 1,
              }}
            >
              {s.n}
            </div>
            <div
              style={{
                marginTop: '12px',
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '22px',
                color: '#A1A1AA',
              }}
            >
              {s.l}
            </div>
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
        className={`mkt-stack-on-tablet ${M.bg} bg-soft`}
        style={{
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '40px',
          border: '1px solid var(--color-base-300)',
          borderRadius: '14px',
          gap: '32px',
        }}
      >
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px', flex: 1 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: '6px' }}>
            <span
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '56px',
                letterSpacing: '-0.025em',
                color: 'var(--color-base-content)',
              }}
            >
              $99
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '16px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              /mo + Commerce
            </span>
          </div>
          <p
            style={{
              fontFamily: SANS,
              fontSize: '14px',
              lineHeight: '22px',
              color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              margin: 0,
              maxWidth: '660px',
            }}
          >
            A flat $99/mo — account pricing, RFQ and quotes, net terms and credit, bulk PO ordering,
            and fleet accounts. B2B layers on Commerce, so turning it on activates Commerce too
            ($49/mo) and the two bill as one engine. Invoicing is included free; add the Scheduling
            module ($29/mo) to book service against a fleet. No tiers, no per-account or per-seat
            charge. Start free for 14 days; no card to begin.
          </p>
        </div>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <a href="/pricing">
            <Button size="lg" variant="outline">
              See all plans →
            </Button>
          </a>
          <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
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
    <section
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Container
        style={{ display: 'flex', flexDirection: 'column', gap: '36px', alignItems: 'flex-start' }}
      >
        <Display size={88} lineHeight={84} color="#FFFFFF">
          Open your wholesale book
          <Spark color={M.color} />
        </Display>
        <p
          style={{
            fontFamily: SANS,
            fontSize: '18px',
            lineHeight: '30px',
            color: '#A1A1AA',
            maxWidth: '640px',
            margin: 0,
          }}
        >
          Set up a pricing tier, invite your accounts, and take a PO on net terms — on the same
          catalog you already sell from. No second platform, no migration weekend; switch B2B off
          the day you stop selling wholesale, and your accounts and history stay yours.
        </p>
        <div className="mkt-cluster" style={{ gap: '12px' }}>
          <Button size="xl" style={{ backgroundColor: M.color }}>
            Activate B2B →
          </Button>
          <a href="#price-list">
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
            >
              See account pricing
            </Button>
          </a>
        </div>
      </Container>
    </section>
  );
}
