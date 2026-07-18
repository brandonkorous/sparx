import { Dot, getModuleColor, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * Three structural devices for the /dropship page, split out of dropship-page.tsx:
 *
 *  - DropshipRouting ..... the marquee: a 4-stage rail (order placed → split by
 *    supplier → submitted to each → tracking synced back) with connector arrows.
 *  - DropshipInventory ... live stock sync: a 3-up signal grid + a status strip.
 *  - DropshipTracking .... the routed-order lifecycle (submitted → shipped →
 *    delivered) on a branded shipping-email frame, rotating through verticals.
 *
 * Grounded in docs/14 §9–§10 (catalog sync, order routing) + the real dashboard
 * routed-order status. Dropship emerald is a signal, not fill. (The hero +
 * routed-order card live in dropship-hero.tsx; the supplier connect + margin
 * devices live in dropship-sections.tsx.)
 */

const M = getModuleColor('dropship');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// ── AUTOMATED ORDER ROUTING (the marquee rail) ──────────────────────────────
export function DropshipRouting() {
  const stages = [
    {
      n: '01 · placed',
      title: 'An order comes in',
      body: 'A customer checks out as normal — through your store or the API. The order can mix dropship lines with stock you hold; sparx sorts that out next.',
    },
    {
      n: '02 · split',
      title: 'Split by supplier',
      body: 'The router groups the lines into a fulfillment group per supplier. Two suppliers on one order become two groups, each handled independently.',
    },
    {
      n: '03 · submitted',
      title: 'Routed to each supplier',
      body: 'Every group is submitted automatically through its supplier adapter — idempotent on the order id, so a retry never double-orders. A failure holds and alerts you, never drops.',
    },
    {
      n: '04 · tracked',
      title: 'Tracking flows back',
      body: 'Tracking arrives by webhook or poll, updates the fulfillment record, emails the customer, and logs a CRM activity. Combined tracking once every group ships.',
    },
  ];
  return (
    <Section id="routing" surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Orders route themselves"
        lede="This is the part you stop doing by hand. When an order lands, sparx splits it by supplier, submits each group, and pulls tracking back to the customer — automatically, whether one supplier fills it or three."
      />
      <div
        className="mkt-pipeline"
        style={{ marginTop: '52px', backgroundColor: 'var(--color-base-100)' }}
      >
        {stages.map((s, i) => (
          <div
            key={s.n}
            className="mkt-stage"
            style={{
              position: 'relative',
              padding: '26px 24px 28px',
              minHeight: '208px',
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
            }}
          >
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                letterSpacing: '0.06em',
                textTransform: 'uppercase',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {s.n}
            </span>
            <h3
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '18px',
                fontWeight: 500,
                letterSpacing: '-0.01em',
                display: 'flex',
                alignItems: 'center',
                gap: '9px',
              }}
            >
              <Dot color={M.color} size={8} />
              {s.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {s.body}
            </p>
            {i < stages.length - 1 ? (
              <span
                className="mkt-hide-on-tablet"
                style={{
                  position: 'absolute',
                  right: '-11px',
                  top: '38px',
                  zIndex: 2,
                  width: 22,
                  height: 22,
                  borderRadius: '9999px',
                  backgroundColor: 'var(--color-base-100)',
                  border: '1px solid var(--color-base-300)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  color: M.color,
                }}
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

// ── LIVE INVENTORY SYNC ─────────────────────────────────────────────────────
export function DropshipInventory() {
  const cells = [
    {
      title: 'Live stock, pulled on sync',
      body: 'API suppliers report stock on every scheduled sync. A product that sells out is flagged unavailable and you are notified in the dashboard and by email.',
    },
    {
      title: 'Per-combo availability',
      body: 'A supplier can mark one colour or size temporarily unfulfillable while the product stays listed. That exact combo greys out on the product page, struck-through, not the whole product.',
    },
    {
      title: 'Made-to-order is unlimited',
      body: 'Print-on-demand suppliers have no finite stock, so there is nothing to count — those products never go out of stock for a sync reason.',
    },
  ];
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline={<>Never sell what the supplier can&rsquo;t ship</>}
        lede={
          <>
            Stock you don&rsquo;t hold is stock you can&rsquo;t see &mdash; unless it syncs. sparx
            pulls live availability from each supplier, so a sold-out item comes off the shelf
            before a customer can order it, and a back-in-stock combo returns on its own.
          </>
        }
      />
      <div className="mkt-grid-3-2-1" style={{ marginTop: '52px' }}>
        {cells.map((c) => (
          <div
            key={c.title}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '12px',
              padding: '26px',
              backgroundColor: 'var(--color-base-100)',
              border: '1px solid var(--color-base-300)',
              borderRadius: '12px',
              minHeight: '186px',
            }}
          >
            <span
              className={`${M.bg} bg-soft`}
              style={{
                width: 32,
                height: 32,
                borderRadius: '8px',
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
              {c.title}
            </h3>
            <p
              style={{
                margin: 0,
                fontFamily: SANS,
                fontSize: '13.5px',
                lineHeight: '21px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
              }}
            >
              {c.body}
            </p>
          </div>
        ))}
      </div>
    </Section>
  );
}

// ── TRACKING SYNC BACK TO THE CUSTOMER ──────────────────────────────────────
export function DropshipTracking() {
  return (
    <Section surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="The customer hears from you, not the supplier"
        lede={
          <>
            When the supplier ships, sparx forwards the tracking to your customer in a branded email
            from your own domain, and moves the order through its status. They never see the
            supplier&rsquo;s name &mdash; to them, it&rsquo;s your store, start to finish.
          </>
        }
      />
      <div className="mkt-ds-split" style={{ marginTop: '52px' }}>
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <TrackingTimeline key={b.domain} business={b} />
          ))}
        />
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <ShippingEmail key={b.domain} business={b} />
          ))}
        />
      </div>
    </Section>
  );
}

/** Left: the routed-order status lifecycle, with the live one highlighted. */
function TrackingTimeline({ business }: { business: ExampleBusiness }) {
  const { dropship: d } = business;
  const steps = ['Submitted', 'Shipped', 'Delivered'];
  const activeIdx = Math.max(0, steps.indexOf(d.routed.status));
  return (
    <div
      className={`${M.bg} bg-soft`}
      style={{
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        padding: '24px',
        display: 'flex',
        flexDirection: 'column',
        gap: '18px',
        height: '100%',
      }}
    >
      <div>
        <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '16px' }}>
          {d.routed.number}
        </span>
        <span
          style={{
            display: 'block',
            fontFamily: MONO,
            fontSize: '11.5px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            marginTop: '4px',
          }}
        >
          routed to {d.supplier} · {d.routed.carrier}
        </span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
        {steps.map((s, i) => {
          const done = i <= activeIdx;
          return (
            <div key={s} style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <span
                style={{
                  width: 18,
                  height: 18,
                  borderRadius: '9999px',
                  flexShrink: 0,
                  backgroundColor: done ? M.color : 'var(--color-base-200)',
                  border: done ? 'none' : '1px solid var(--color-base-300)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                }}
              >
                {done ? <Check size={11} color="#fff" /> : null}
              </span>
              <span
                style={{
                  fontFamily: SANS,
                  fontSize: '14px',
                  fontWeight: i === activeIdx ? 500 : 400,
                  color: done
                    ? 'var(--color-base-content)'
                    : 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                }}
              >
                {s}
              </span>
              {i === activeIdx ? (
                <span
                  className={M.ink}
                  style={{
                    marginLeft: 'auto',
                    fontFamily: MONO,
                    fontSize: '11px',
                  }}
                >
                  current
                </span>
              ) : null}
            </div>
          );
        })}
      </div>
    </div>
  );
}

/** Right: the branded shipping email the customer receives, on the store domain. */
function ShippingEmail({ business }: { business: ExampleBusiness }) {
  const { dropship: d, customer, name, email } = business;
  return (
    <div
      style={{
        backgroundColor: 'var(--color-base-100)',
        border: '1px solid var(--color-base-300)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '10px',
          padding: '14px 20px',
          borderBottom: '1px solid var(--color-base-300)',
          backgroundColor: 'var(--color-base-200)',
        }}
      >
        <Dot color={M.color} size={8} />
        <span
          style={{
            fontFamily: MONO,
            fontSize: '11.5px',
            color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
          }}
        >
          from {email.sender}
        </span>
      </div>
      <div style={{ padding: '22px' }}>
        <div
          style={{ fontFamily: SANS, fontWeight: 500, fontSize: '16px', letterSpacing: '-0.01em' }}
        >
          Your {name} order has shipped
        </div>
        <p
          style={{
            margin: '12px 0 0',
            fontFamily: SANS,
            fontSize: '13.5px',
            lineHeight: '21px',
            color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
          }}
        >
          Hi {customer.name.split(' ')[0]} — {d.routed.number} is on its way via {d.routed.carrier}.
          Track it any time with the number below.
        </p>
        <div
          style={{
            marginTop: '16px',
            padding: '14px 16px',
            backgroundColor: 'var(--color-base-200)',
            border: '1px solid var(--color-base-300)',
            borderRadius: '10px',
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
          }}
        >
          <TruckGlyph size={16} color={M.color} />
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontFamily: SANS,
                fontSize: '12.5px',
                fontWeight: 500,
              }}
            >
              {d.routed.carrier}
            </span>
            <span
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
              }}
            >
              {d.routed.tracking}
            </span>
          </span>
          <span
            className={`${M.bg} bg-soft ${M.ink}`}
            style={{
              marginLeft: 'auto',
              fontFamily: SANS,
              fontSize: '11.5px',
              fontWeight: 500,
              padding: '6px 12px',
              borderRadius: '9999px',
              flexShrink: 0,
            }}
          >
            Track order
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', marginTop: '16px' }}>
          <Dot color={M.color} size={6} />
          <span
            style={{
              fontFamily: MONO,
              fontSize: '11px',
              color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
            }}
          >
            sent via sparx Email · {d.supplier} never named
          </span>
        </div>
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
      strokeWidth={3}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <polyline points="20 6 9 17 4 12" />
    </svg>
  );
}

function TruckGlyph({ size, color }: { size: number; color: string }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke={color}
      strokeWidth={2}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
      style={{ flexShrink: 0 }}
    >
      <path d="M1 3h15v13H1z" />
      <path d="M16 8h4l3 3v5h-7V8z" />
      <circle cx="5.5" cy="18.5" r="2.5" />
      <circle cx="18.5" cy="18.5" r="2.5" />
    </svg>
  );
}
