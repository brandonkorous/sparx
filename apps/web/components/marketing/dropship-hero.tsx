import { Button } from '@sparx/ui';
import { Container, Display, Dot, getModuleColor, Spark } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * The /dropship hero — a tinted-band split: copy on the left, the marquee
 * ROUTED-ORDER card on the right. The card crossfades through EXAMPLE_BUSINESSES
 * so Dropship reads as the engine for ANY store — POD apparel, US/EU stocked
 * goods, AliExpress-sourced, a CSV-fed industrial supplier — never anchored on
 * one vertical. Every scene has the same shape (supplier + rule, a routed order
 * with status + tracking, the order-level profit) so the card never reflows.
 *
 * Grounded in docs/14 (Dropship PRD) + the real @sparx/dropship vendor catalog
 * (Printify, Printful, DSers, Spocket, CSV) and the dashboard routed-order
 * status (submitted → shipped → delivered). Dropship emerald is a signal, not
 * fill; the band is the light emerald tint with near-black ink. See
 * feedback-industry-agnostic-no-diesel + the rotation rule.
 */

const M = getModuleColor('dropship');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

export function DropshipHero() {
  const lede =
    'Connect a supplier, import their catalog, set a markup rule. When an order comes in, sparx routes it to the right supplier automatically, pulls back tracking, and emails the customer — all without you touching a box. Sell without holding inventory, on a real platform where suppliers, products, and orders live in one place.';
  const chips = [
    'supplier connectors',
    'auto order routing',
    'margin rules',
    'tracking sync',
  ];
  return (
    <section
      style={{
        paddingTop: 'clamp(56px, 9vw, 96px)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: M.tint,
      }}
    >
      <Container>
        <div
          className="mkt-stack-on-tablet"
          style={{ gap: 'clamp(40px, 6vw, 72px)', alignItems: 'center' }}
        >
          <div style={{ flex: 1, minWidth: 0 }}>
            <Display as="h1" size={84} lineHeight={80}>
              Sell it, never stock it
              <Spark color={M.color} />
            </Display>
            <p
              style={{
                fontFamily: SANS,
                fontWeight: 400,
                fontSize: 'clamp(16px, 1.6vw, 20px)',
                lineHeight: 1.55,
                color: 'var(--color-text-secondary)',
                maxWidth: '580px',
                margin: '28px 0 0',
              }}
            >
              {lede}
            </p>
            <div className="mkt-cluster" style={{ gap: '12px', marginTop: '34px' }}>
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                Activate Dropship →
              </Button>
              <a href="#routing">
                <Button size="lg" variant="outline">
                  See how an order routes
                </Button>
              </a>
            </div>
            <ul
              className="mkt-cluster"
              style={{ gap: '10px', marginTop: '26px', listStyle: 'none', padding: 0 }}
            >
              {chips.map((c) => (
                <li
                  key={c}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '7px 13px',
                    backgroundColor: 'var(--color-bg-surface)',
                    border: '1px solid var(--color-border-default)',
                    borderRadius: '9999px',
                  }}
                >
                  <Dot color={M.color} size={6} />
                  <span
                    style={{
                      fontFamily: MONO,
                      fontSize: '12px',
                      color: 'var(--color-text-secondary)',
                    }}
                  >
                    {c}
                  </span>
                </li>
              ))}
            </ul>
          </div>
          <div style={{ flex: 1, minWidth: 0, width: '100%' }}>
            <Cycle
              items={EXAMPLE_BUSINESSES.map((b) => (
                <RoutedOrderCard key={b.domain} business={b} />
              ))}
            />
          </div>
        </div>
      </Container>
    </section>
  );
}

/** The hero's product-surface proof — one real routed order: it came in, split
 *  to a supplier, and tracking flowed back, with the order-level profit shown. */
function RoutedOrderCard({ business }: { business: ExampleBusiness }) {
  const { dropship: d, customer } = business;
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '16px',
        boxShadow: '0 14px 40px rgba(15, 15, 20, 0.06)',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <Dot color={M.color} size={9} />
          <span>
            <span style={{ fontFamily: SANS, fontWeight: 500, fontSize: '14px' }}>
              {d.routed.number}
            </span>
            <br />
            <span style={{ fontFamily: SANS, fontSize: '12px', color: 'var(--color-text-tertiary)' }}>
              {customer.name} · routed to {d.supplier}
            </span>
          </span>
        </span>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '5px 11px',
            borderRadius: '9999px',
            backgroundColor: M.tint,
            color: M.text,
            fontFamily: SANS,
            fontSize: '12px',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          <Dot color={M.color} size={6} /> {d.routed.status}
        </span>
      </div>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(3, 1fr)',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        {(
          [
            [d.routed.revenue, 'revenue'],
            [d.routed.cost, 'supplier cost'],
            [d.routed.profit, 'your profit'],
          ] as [string, string][]
        ).map(([v, l], i) => (
          <div
            key={l}
            style={{
              padding: '14px 16px',
              borderLeft: i === 0 ? 'none' : '1px solid var(--color-bg-subtle)',
            }}
          >
            <div
              style={{
                fontFamily: SANS,
                fontWeight: 500,
                fontSize: '17px',
                letterSpacing: '-0.01em',
                color: i === 2 ? M.text : 'var(--color-text-primary)',
              }}
            >
              {v}
            </div>
            <div
              style={{
                fontFamily: MONO,
                fontSize: '11px',
                color: 'var(--color-text-tertiary)',
                marginTop: '2px',
              }}
            >
              {l}
            </div>
          </div>
        ))}
      </div>
      <div style={{ padding: '16px 20px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '12px 14px',
            backgroundColor: 'var(--color-bg-page)',
            border: '1px solid var(--color-border-default)',
            borderRadius: '10px',
          }}
        >
          <TruckIcon size={16} color={M.text} />
          <span style={{ minWidth: 0 }}>
            <span
              style={{
                display: 'block',
                fontFamily: SANS,
                fontSize: '13px',
                fontWeight: 500,
                color: 'var(--color-text-primary)',
              }}
            >
              {d.routed.carrier}
            </span>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
              {d.routed.tracking}
            </span>
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: SANS,
              fontSize: '11.5px',
              fontWeight: 500,
              color: M.text,
              flexShrink: 0,
            }}
          >
            sent to customer
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px' }}>
          <Dot color={M.color} size={6} />
          <span style={{ fontFamily: MONO, fontSize: '11.5px', color: 'var(--color-text-tertiary)' }}>
            {d.connection} · {d.rule} · no inventory held
          </span>
        </div>
      </div>
    </div>
  );
}

function TruckIcon({ size, color }: { size: number; color: string }) {
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
