import {
  Dot,
  getModuleColor,
  type MarketingModule,
  Section,
  SectionHeader,
  Text,
} from './primitives';

/**
 * Two more structural devices for the /b2b page, split out of b2b-devices.tsx:
 *
 *  - B2bFleet ........ fleet management + the Scheduling-module bridge for
 *    service booking — industry-NEUTRAL, one of several (never the anchor).
 *    Booking itself is the standalone Scheduling module ($29/mo), not bundled
 *    into B2B; this section frames the pairing, not an included feature.
 *  - B2bSameEngine ... the "D2C + B2B on one engine" beat — a retail column
 *    (commerce orange) beside a wholesale column (b2b slate), over one shared
 *    catalog / checkout / record.
 *
 * Grounded in docs/10 (B2B PRD) + the real dashboard fleet/service + sales-
 * channel surfaces. Module hues are signals, not fill.
 */

const M = getModuleColor('b2b');

// ── FLEET & SERVICE SCHEDULING (industry-neutral capability) ─────────────────
export function B2bFleet() {
  const points = [
    {
      title: 'Fitment-aware catalog',
      body: 'Accounts with a registered fleet see a “fits your fleet” badge and fitment-matched products first — relevant parts surface, incompatible ones still browse with a warning.',
    },
    {
      title: 'Bookable service',
      body: 'Add the Scheduling module and a fleet account books service from the same portal — service types, durations, and capacity, tied to the account, with confirmations and reminders. Booking is its own $29/mo module; B2B brings the account and fleet context.',
    },
    {
      title: 'History per unit',
      body: 'Service history records against the vehicle in the fleet profile, and parts from an order link to the service record — the full picture for the next visit.',
    },
  ];
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Fleet management, and service when the account needs it"
        lede="For accounts that run equipment or vehicles, sparx stores a fleet profile — and, paired with the Scheduling module, books service against it. Fleet is one capability of B2B; a salon-products or office-coffee distributor never touches it, while a parts-and-service supplier leans on it daily."
      />
      <div className="mt-12 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-3">
        {points.map((p) => (
          <div
            key={p.title}
            className="bg-base-200 border-base-300 flex min-h-[186px] flex-col gap-3 rounded-xl border p-6"
          >
            <span className={`${M.bg} bg-soft flex size-8 items-center justify-center rounded-lg`}>
              <Dot color={M.color} size={9} />
            </span>
            <h3 className="text-body-lg text-base-content m-0 font-sans font-medium tracking-[-0.01em]">
              {p.title}
            </h3>
            <Text size={13} className="m-0">
              {p.body}
            </Text>
          </div>
        ))}
      </div>
    </Section>
  );
}

interface EngineCol {
  title: string;
  body: string;
  points: string[];
  accent: MarketingModule;
}

// ── SAME ENGINE: D2C + B2B ──────────────────────────────────────────────────
export function B2bSameEngine() {
  const cols: EngineCol[] = [
    {
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
      <div className="mt-12 grid grid-cols-1 gap-6 md:grid-cols-2">
        {cols.map((c) => (
          <EngineColumn key={c.title} col={c} />
        ))}
      </div>
      <Text size={14} tone="subtle" className="mt-5 max-w-[700px]">
        B2B requires Commerce — it’s wholesale on top of the commerce engine, so they run as one and
        bill as one. See{' '}
        <a href="/commerce" className={`${M.ink} font-medium`}>
          Commerce
        </a>{' '}
        for the retail side.
      </Text>
    </Section>
  );
}

function EngineColumn({ col }: { col: EngineCol }) {
  const accent = getModuleColor(col.accent);
  return (
    <div
      className={`${accent.bg} border-base-300 bg-soft flex flex-col gap-4 rounded-xl border p-8`}
    >
      <h3 className="text-h2 text-base-content m-0 font-sans font-medium tracking-[-0.02em]">
        {col.title}
      </h3>
      <Text size={15} className="m-0">
        {col.body}
      </Text>
      <ul className="m-0 grid list-none gap-3 p-0">
        {col.points.map((p) => (
          <li key={p} className="flex items-start gap-2.5">
            <span className="shrink-0 pt-[7px]">
              <Dot color={accent.color} size={7} />
            </span>
            <Text as="span" size={14}>
              {p}
            </Text>
          </li>
        ))}
      </ul>
    </div>
  );
}
