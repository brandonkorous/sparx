import type { ReactNode } from 'react';
import { Section, SectionHeader, Spark, getModuleColor } from './primitives';
import { Reveal } from './reveal';

// B2B is the slate module. Carried as a soft tint on the icon chips + the one
// price-contrast panel (the section's single tinted accent); the feature cards
// stay neutral so six same-hue cards don't read as a wall of identical wash.
const B2B = getModuleColor('b2b');
const CHIP_BG = `color-mix(in oklab, ${B2B.color} 13%, var(--color-base-100))`;
const PANEL_BG = `color-mix(in oklab, ${B2B.color} 7%, var(--color-base-100))`;

const FEATURES = [
  {
    icon: <PriceIcon />,
    number: '01',
    title: 'Account-tier pricing',
    body: 'Per-account price lists, volume breaks, contract pricing. Login determines price; no manual quote needed.',
  },
  {
    icon: <TermsIcon />,
    number: '02',
    title: 'Net terms & POs',
    body: 'Net 15, 30, 60, 90. PO number required at checkout. Aging reports, statements, dunning — built in.',
  },
  {
    icon: <FleetIcon />,
    number: '03',
    title: 'Fleet & location accounts',
    body: 'Order per vehicle or per site, with budgets, service history, and PO routing rolled up by cost center.',
  },
  {
    icon: <RfqIcon />,
    number: '04',
    title: 'RFQ & quotes',
    body: 'Buyers request quotes from a product page. You reply with line-item pricing and expiration. Approved quotes convert to orders.',
  },
  {
    icon: <CatalogIcon />,
    number: '05',
    title: 'Catalog & access control',
    body: 'Per-account catalog visibility, product overrides, and quantity rules. Each buyer sees exactly the assortment, pricing, and minimums you set for them.',
  },
  {
    icon: <ShieldIcon />,
    number: '06',
    title: 'Approval workflows',
    body: 'Spend caps per buyer. Manager approval for orders over a threshold. Multi-step approvals for bigger customers.',
  },
] as const;

export function B2bSpotlight() {
  return (
    <Section padding="xl">
      <Reveal style={{ display: 'flex', flexDirection: 'column', gap: '72px' }}>
        {/* Two-column header — argument left, the price contrast right. A
            deliberate break from the page's repeated full-width left headers,
            and it surfaces the "$2,400 vs $99" hook as a visual instead of a
            buried sentence. */}
        <div
          className="mkt-stack-on-tablet"
          style={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: '48px' }}
        >
          <div style={{ flex: 1, maxWidth: '600px' }}>
            <SectionHeader
              headlineSize={54}
              headline={
                <>
                  Wholesale,
                  <br />
                  built in
                  <Spark color={B2B.color} />
                </>
              }
              lede={
                <>
                  Whether you supply salons, stock corner stores, or sell wholesale to boutiques,
                  your business accounts get account pricing, net terms, POs, RFQs, and approvals —
                  all native, with no enterprise tier to unlock.
                </>
              }
            />
          </div>
          <PricePanel />
        </div>

        <div className="mkt-grid-3-2-1">
          {FEATURES.map((f) => (
            <FeatureCard key={f.number} {...f} />
          ))}
        </div>
      </Reveal>
    </Section>
  );
}

function FeatureCard({
  icon,
  number,
  title,
  body,
}: {
  icon: ReactNode;
  number: string;
  title: string;
  body: string;
}) {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        padding: '28px',
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '12px',
        gap: '16px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 46,
            height: 46,
            borderRadius: 12,
            backgroundColor: CHIP_BG,
          }}
        >
          {icon}
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          {number}
        </span>
      </div>
      <h3
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '20px',
          letterSpacing: '-0.02em',
          lineHeight: '26px',
          color: 'var(--color-base-content)',
          margin: 0,
        }}
      >
        {title}
      </h3>
      <p
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '13px',
          lineHeight: '20px',
          color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          margin: 0,
        }}
      >
        {body}
      </p>
    </div>
  );
}

// The section's one tinted element: the competitor's B2B tier vs sparx's, framed
// as a two-row ledger (the same "show the swap" device the cost section uses).
function PricePanel() {
  return (
    <div
      style={{
        width: '100%',
        maxWidth: '384px',
        flexShrink: 0,
        backgroundColor: PANEL_BG,
        border: '1px solid var(--color-base-300)',
        borderRadius: '16px',
        padding: '26px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: 500,
          fontSize: '13px',
          color: B2B.text,
        }}
      >
        The same wholesale toolkit, priced sanely
      </span>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <PriceRow vendor="Shopify Plus, for B2B" amount="$2,400" muted />
        <PriceRow vendor="sparx B2B module" amount="$99" />
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'space-between',
          gap: '12px',
          padding: '12px 14px',
          borderRadius: '10px',
          backgroundColor: `color-mix(in oklab, ${B2B.color} 16%, var(--color-base-100))`,
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '14px',
            color: B2B.text,
          }}
        >
          You keep $2,301/mo
        </span>
        <span
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: '12px',
            color: B2B.text,
          }}
        >
          ~1/24 the price
        </span>
      </div>
    </div>
  );
}

function PriceRow({ vendor, amount, muted }: { vendor: string; amount: string; muted?: boolean }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'space-between',
        gap: '12px',
      }}
    >
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontSize: '14px',
          color: muted
            ? 'color-mix(in oklab, var(--color-base-content) 50%, transparent)'
            : 'var(--color-base-content)',
        }}
      >
        {vendor}
      </span>
      <span
        style={{
          fontFamily: 'var(--font-sans)',
          fontWeight: muted ? 400 : 500,
          fontSize: muted ? '18px' : '24px',
          letterSpacing: '-0.02em',
          color: muted
            ? 'color-mix(in oklab, var(--color-base-content) 50%, transparent)'
            : B2B.text,
        }}
      >
        {amount}
        <span
          style={{
            fontSize: '13px',
            fontWeight: 400,
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          /mo
        </span>
      </span>
    </div>
  );
}

function PriceIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M3 12V6L9 3L15 6V12M3 12V18L9 21L15 18V12M3 12L9 15L15 12M9 21V15"
        stroke="#475569"
        strokeWidth={1.5}
      />
    </svg>
  );
}
function TermsIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x={3} y={5} width={18} height={14} stroke="#475569" strokeWidth={1.5} />
      <path d="M3 9H21" stroke="#475569" strokeWidth={1.5} />
      <path d="M7 14H10" stroke="#475569" strokeWidth={1.5} />
    </svg>
  );
}
function FleetIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx={7} cy={17} r={2} stroke="#475569" strokeWidth={1.5} />
      <circle cx={17} cy={17} r={2} stroke="#475569" strokeWidth={1.5} />
      <path
        d="M2 17H5M9 17H15M19 17H22M2 6V14H16V6H2ZM16 8H21L22 12V14H19"
        stroke="#475569"
        strokeWidth={1.5}
      />
    </svg>
  );
}
function RfqIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M9 11L3 17V21H7L13 15M9 11L15 5C16 4 18 4 19 5C20 6 20 8 19 9L13 15M9 11L13 15"
        stroke="#475569"
        strokeWidth={1.5}
      />
    </svg>
  );
}
function CatalogIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
      <rect x={3} y={4} width={18} height={16} rx={1} stroke="#475569" strokeWidth={1.5} />
      <path d="M3 9H21M8 14H13" stroke="#475569" strokeWidth={1.5} />
      <circle cx={16.5} cy={14.5} r={2} stroke="#475569" strokeWidth={1.5} />
      <path d="M18 16L20 18" stroke="#475569" strokeWidth={1.5} strokeLinecap="round" />
    </svg>
  );
}
function ShieldIcon() {
  return (
    <svg width={28} height={28} viewBox="0 0 24 24" fill="none" aria-hidden>
      <path
        d="M12 2L4 6V12C4 17 7 21 12 22C17 21 20 17 20 12V6L12 2Z"
        stroke="#475569"
        strokeWidth={1.5}
      />
      <path d="M9 12L11 14L15 10" stroke="#475569" strokeWidth={1.5} />
    </svg>
  );
}
