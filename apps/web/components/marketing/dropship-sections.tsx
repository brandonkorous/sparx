import { Dot, getModuleColor, Section, SectionHeader } from './primitives';
import { Cycle } from './cycle';
import { EXAMPLE_BUSINESSES, type ExampleBusiness } from '@/lib/example-businesses';

/**
 * Two structural devices for the /dropship page, split out of dropship-page.tsx:
 *
 *  - DropshipConnect ..... supplier connect + catalog sync: the real vendor
 *    picker rail (Printify, Printful, DSers, Spocket, CSV) beside the imported,
 *    synced-and-priced product the connection just pulled in.
 *  - DropshipMargin ...... the markup math: supplier cost → pricing rule →
 *    sell price → margin, as a ledger row per store.
 *
 * The synced product + the margin ledger crossfade through EXAMPLE_BUSINESSES so
 * neither anchors on one vertical. Grounded in docs/14 (Dropship PRD) +
 * @sparx/dropship (the vendor catalog, the percentage_markup / multiplier /
 * flat_markup / fixed_margin pricing rules). Dropship emerald is a signal, not
 * fill. (The hero + routed-order card live in dropship-hero.tsx; the routing
 * rail, inventory, and tracking devices live in dropship-devices.tsx.)
 */

const M = getModuleColor('dropship');
const SANS = 'var(--font-sans)';
const MONO = 'var(--font-mono)';

// The real selectable vendors from @sparx/dropship VENDOR_CATALOG (docs/14 §3).
const VENDORS: { name: string; tag: string; mode: string }[] = [
  { name: 'Printify', tag: 'print-on-demand', mode: 'API' },
  { name: 'Printful', tag: 'print-on-demand', mode: 'API' },
  { name: 'DSers', tag: 'general · AliExpress', mode: 'API' },
  { name: 'Spocket', tag: 'general · US/EU', mode: 'API' },
  { name: 'CSV feed', tag: 'any supplier', mode: 'manual' },
];

// ── SUPPLIER CONNECT + CATALOG SYNC ─────────────────────────────────────────
export function DropshipConnect() {
  return (
    <Section id="suppliers" surface="surface" padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Connect a supplier, import the catalog"
        lede="Pick a supplier from the catalog, paste a token, and sparx validates the connection before it saves. Its products, costs, images, and stock sync in — then you import the ones you want, priced automatically. Only suppliers with a real, self-serve API are offered; the rest are honestly left off."
      />
      <div className="mkt-ds-split" style={{ marginTop: '52px' }}>
        <VendorPicker />
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <SyncedProductPanel key={b.domain} business={b} />
          ))}
        />
      </div>
    </Section>
  );
}

/** Left rail: the real vendor picker — one card per selectable supplier. */
function VendorPicker() {
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderTop: `3px solid ${M.color}`,
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          padding: '16px 20px',
          borderBottom: '1px solid var(--color-border-default)',
          fontFamily: MONO,
          fontSize: '11px',
          letterSpacing: '0.05em',
          textTransform: 'uppercase',
          color: M.text,
        }}
      >
        choose a supplier
      </div>
      {VENDORS.map((v, i) => (
        <div
          key={v.name}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '12px',
            padding: '14px 20px',
            borderTop: i === 0 ? 'none' : '1px solid var(--color-bg-subtle)',
            backgroundColor: i === 0 ? M.tint : 'transparent',
          }}
        >
          <span
            style={{
              width: 34,
              height: 34,
              borderRadius: '8px',
              backgroundColor: i === 0 ? 'var(--color-bg-surface)' : 'var(--color-bg-subtle)',
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: 'inset 0 0 0 1px rgba(9, 9, 11, 0.05)',
            }}
          >
            <Dot color={i === 0 ? M.color : 'var(--color-text-tertiary)'} size={8} />
          </span>
          <span style={{ minWidth: 0 }}>
            <span style={{ display: 'block', fontFamily: SANS, fontSize: '14px', fontWeight: 500 }}>
              {v.name}
            </span>
            <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
              {v.tag}
            </span>
          </span>
          <span
            style={{
              marginLeft: 'auto',
              fontFamily: MONO,
              fontSize: '10.5px',
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              color: v.mode === 'API' ? M.text : 'var(--color-text-tertiary)',
              flexShrink: 0,
            }}
          >
            {v.mode}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Right panel: a product imported from the connection — cost, sell, stock. */
function SyncedProductPanel({ business }: { business: ExampleBusiness }) {
  const { dropship: d } = business;
  const rows: [string, string][] = [
    ['Supplier', `${d.supplier} · ${d.connection}`],
    ['Supplier cost', d.pricing.cost],
    ['Pricing rule', d.rule],
    ['Your sell price', d.pricing.sell],
    ['Stock synced', d.stock],
  ];
  return (
    <div
      style={{
        backgroundColor: 'var(--color-bg-surface)',
        border: '1px solid var(--color-border-default)',
        borderRadius: '14px',
        overflow: 'hidden',
      }}
    >
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '13px',
          padding: '18px 22px',
          borderBottom: '1px solid var(--color-border-default)',
        }}
      >
        <span
          style={{
            width: 40,
            height: 40,
            borderRadius: '9px',
            backgroundColor: 'var(--color-bg-subtle)',
            flexShrink: 0,
            boxShadow: 'inset 0 0 0 1px rgba(9, 9, 11, 0.05)',
          }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: SANS, fontWeight: 500, fontSize: '16px' }}>
            {d.pricing.item}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '11.5px', color: 'var(--color-text-tertiary)' }}>
            {d.pricing.sku} · imported draft
          </span>
        </span>
        <span
          style={{
            marginLeft: 'auto',
            display: 'inline-flex',
            alignItems: 'center',
            padding: '5px 11px',
            borderRadius: '9999px',
            backgroundColor: M.tint,
            color: M.text,
            fontFamily: SANS,
            fontSize: '11.5px',
            fontWeight: 500,
            flexShrink: 0,
          }}
        >
          synced
        </span>
      </div>
      <div style={{ padding: '8px 22px 16px' }}>
        {rows.map(([l, v]) => (
          <div
            key={l}
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: SANS,
              fontSize: '13.5px',
              padding: '11px 0',
              borderBottom: '1px solid var(--color-bg-subtle)',
            }}
          >
            <span style={{ color: 'var(--color-text-secondary)' }}>{l}</span>
            <span style={{ fontWeight: 500 }}>{v}</span>
          </div>
        ))}
        <div style={{ display: 'flex', alignItems: 'center', gap: '9px', paddingTop: '14px' }}>
          <Dot color={M.color} size={6} />
          <span style={{ fontFamily: MONO, fontSize: '11.5px', color: 'var(--color-text-tertiary)' }}>
            review &amp; publish — price tracks the supplier&rsquo;s cost
          </span>
        </div>
      </div>
    </div>
  );
}

// ── MARGIN / MARKUP LEDGER ──────────────────────────────────────────────────
export function DropshipMargin() {
  return (
    <Section padding="lg">
      <SectionHeader
        accent={M.color}
        headline="Cost in, margin out — automatically"
        lede="Set a pricing rule per supplier — a percentage markup, a multiplier, a flat markup, or a target margin — and every imported product prices itself off the supplier cost. When the supplier raises a cost on sync, your sell price and margin recompute. The dashboard reports profit and margin per product, per supplier, and per order."
      />
      <div
        style={{
          marginTop: '52px',
          border: '1px solid var(--color-border-default)',
          borderRadius: '14px',
          overflow: 'hidden',
          backgroundColor: 'var(--color-bg-surface)',
        }}
      >
        <div
          className="mkt-margin-head"
          style={{
            borderBottom: '1px solid var(--color-border-default)',
            backgroundColor: 'var(--color-bg-page)',
          }}
        >
          {['Imported product', 'Pricing rule', 'Your price', 'Margin'].map((h) => (
            <span
              key={h}
              style={{
                fontFamily: MONO,
                fontSize: '10.5px',
                letterSpacing: '0.05em',
                textTransform: 'uppercase',
                color: 'var(--color-text-tertiary)',
              }}
            >
              {h}
            </span>
          ))}
        </div>
        <Cycle
          items={EXAMPLE_BUSINESSES.map((b) => (
            <MarginRow key={b.domain} business={b} />
          ))}
        />
      </div>
    </Section>
  );
}

function MarginRow({ business }: { business: ExampleBusiness }) {
  const { dropship: d } = business;
  return (
    <div className="mkt-margin-row">
      <span className="mkt-margin-item" style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
        <span
          style={{
            width: 34,
            height: 34,
            borderRadius: '8px',
            backgroundColor: 'var(--color-bg-subtle)',
            flexShrink: 0,
            boxShadow: 'inset 0 0 0 1px rgba(9, 9, 11, 0.05)',
          }}
        />
        <span style={{ minWidth: 0 }}>
          <span style={{ display: 'block', fontFamily: SANS, fontSize: '14px', fontWeight: 500 }}>
            {d.pricing.item}
          </span>
          <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--color-text-tertiary)' }}>
            {d.supplier} · cost {d.pricing.cost}
          </span>
        </span>
      </span>
      <span
        className="mkt-margin-cell"
        style={{ fontFamily: SANS, fontSize: '13px', color: 'var(--color-text-secondary)' }}
      >
        {d.rule}
      </span>
      <span
        className="mkt-margin-cell"
        style={{ fontFamily: SANS, fontSize: '15px', fontWeight: 500, color: 'var(--color-text-primary)' }}
      >
        {d.pricing.sell}
      </span>
      <span className="mkt-margin-cell">
        <span style={{ fontFamily: SANS, fontSize: '14px', fontWeight: 500, color: M.text }}>
          {d.pricing.margin}
        </span>
        <span style={{ fontFamily: MONO, fontSize: '11px', color: 'var(--color-text-tertiary)', marginLeft: '8px' }}>
          {d.pricing.marginPct}
        </span>
      </span>
    </div>
  );
}
