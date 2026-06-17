import { Dot, getModuleColor, type MarketingModule, Section, SectionHeader } from './primitives';

/**
 * Two more structural devices for the /b2b page, split out of b2b-devices.tsx:
 *
 *  - B2bFleet ........ fleet & service scheduling — an industry-NEUTRAL
 *    capability (one of several; never the page's anchor).
 *  - B2bSameEngine ... the "D2C + B2B on one engine" beat — a retail column
 *    (commerce orange) beside a wholesale column (b2b slate), over one shared
 *    catalog / checkout / record.
 *
 * Grounded in docs/10 (B2B PRD) + the real dashboard fleet/service + sales-
 * channel surfaces. Module hues are signals, not fill.
 */

const M = getModuleColor('b2b');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── FLEET & SERVICE SCHEDULING (industry-neutral capability) ─────────────────
export function B2bFleet() {
  const points = [
    {
      title: 'Fitment-aware catalog',
      body: 'Accounts with a registered fleet see a “fits your fleet” badge and fitment-matched products first — relevant parts surface, incompatible ones still browse with a warning.',
    },
    {
      title: 'Bookable service',
      body: 'Define service types with durations and daily capacity; customers book appointments from the portal, tied to the account, with confirmations and reminders via sparx Email.',
    },
    {
      title: 'History per unit',
      body: 'Service history records against the vehicle in the fleet profile, and parts from an order link to the appointment — the full picture for the next visit.',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Fleet and service, when the account needs it"
        lede="For accounts that run equipment or vehicles, sparx stores a fleet profile and books service against it. It’s one capability of the module — a salon-products or office-coffee distributor never touches it, while a parts-and-service supplier leans on it daily."
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {points.map((p) => (
          <div
            key={p.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '26px',
              backgroundColor: 'var(--color-bg-page)',
              border: '1px solid var(--color-border-default)',
              borderRadius: '12px',
              minHeight: '186px',
            }}
          >
            <span
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
                backgroundColor: M.tint,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <Dot color={M.color} size={9} />
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '17px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
              }}
            >
              {p.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {p.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

interface EngineCol {
  tag: string;
  title: string;
  body: string;
  points: string[];
  accent: MarketingModule;
}

// ── SAME ENGINE: D2C + B2B ──────────────────────────────────────────────────
export function B2bSameEngine() {
  const cols: EngineCol[] = [
    {
      tag: 'retail · D2C',
      title: 'Your storefront',
      body: 'List price, public catalog, card and wallet checkout — the orders you take from anyone who lands on the site.',
      points: [
        'List pricing, open catalog, guest checkout.',
        'Cards, Apple Pay, Google Pay, Link via Stripe.',
        'Same inventory, same order timeline, same reports.',
      ],
      accent: 'commerce',
    },
    {
      tag: 'wholesale · B2B',
      title: 'Your account book',
      body: 'The same catalog, but a logged-in buyer sees their tier price, pays on net terms with a PO, and can request a quote.',
      points: [
        'Account price lists, credit limits, net terms.',
        'RFQ → quote, bulk POs, approval holds.',
        'A second sales channel, not a second platform.',
      ],
      accent: 'b2b',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Retail and wholesale, one engine underneath"
        lede="B2B isn’t a separate store you keep in sync. It’s a sales channel layered on Commerce — the same products, inventory, checkout, and customer record, with account pricing and terms switched on for the buyers who get them."
      />
      <div className="mkt-grid-2-1" style={{ marginTop: '52px', gap: '24px' }}>
        {cols.map((c) => (
          <EngineColumn key={c.title} col={c} />
        ))}
      </div>
      <p
        style={{
          marginTop: '20px',
          fontFamily: SANS,
          fontSize: '14px',
          lineHeight: '22px',
          color: 'var(--color-text-tertiary)',
          maxWidth: '700px',
        }}
      >
        B2B requires Commerce — it’s wholesale on top of the commerce engine, so they run as one and
        bill as one. See{' '}
        <a href="/commerce" style={{ color: M.text, fontWeight: 500 }}>
          Commerce
        </a>{' '}
        for the retail side.
      </p>
    </Section>
  );
}

function EngineColumn({ col }: { col: EngineCol }) {
  const accent = getModuleColor(col.accent);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '16px',
        padding: '32px',
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderTop: `3px solid ${accent.color}`,
        borderRadius: '14px',
      }}
    >
      <span
        style={{
          fontFamily: MONO,
          fontSize: '11px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: accent.text,
        }}
      >
        {col.tag}
      </span>
      <h3
        style={{
          margin: 0,
          fontFamily: SANS,
          fontSize: '24px',
          fontWeight: 500,
          letterSpacing: '-0.02em',
        }}
      >
        {col.title}
      </h3>
      <p
        style={{
          margin: 0,
          fontFamily: SANS,
          fontSize: '15px',
          lineHeight: '24px',
          color: 'var(--color-text-secondary)',
        }}
      >
        {col.body}
      </p>
      <ul style={{ listStyle: 'none', margin: 0, padding: 0, display: 'grid', gap: '12px' }}>
        {col.points.map((p) => (
          <li key={p} style={{ display: 'flex', gap: '11px', alignItems: 'flex-start' }}>
            <span style={{ paddingTop: '7px', flexShrink: 0 }}>
              <Dot color={accent.color} size={7} />
            </span>
            <span
              style={{
                fontFamily: SANS,
                fontSize: '14.5px',
                lineHeight: '23px',
                color: 'var(--color-text-secondary)',
              }}
            >
              {p}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
