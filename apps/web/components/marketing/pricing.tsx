import { Button } from '@sparx/ui';
import { Section, SectionHeader, getModuleColor } from './primitives';
import { MODULES, MODULES_ALL_ON_TOTAL } from './modules-catalog';

// Homepage pricing teaser — a short, on-model summary that points to the full
// /pricing page (the switchboard). Per-module flat pricing from $10/mo; a 14-day
// trial. No bundle cards (the bundle model was dropped — see docs/17). The chip
// list and the all-on total both derive from the shared modules-catalog, so this
// teaser can never drift from the grid or the pricing page again.

const chip = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '16px 18px',
  backgroundColor: 'var(--color-bg-surface)',
  border: '1px solid var(--color-border-default)',
  borderRadius: '10px',
} as const;

export function Pricing() {
  return (
    <Section id="pricing" padding="xl">
      <div style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <SectionHeader
          headline="Pay for what you use"
          accent="var(--sparx-primary)"
          lede="Per-module pricing from $10/mo — switch on only what you need, all on one invoice. Start with a 14-day free trial, no card required."
        />

        <div className="mkt-grid-4-2-1">
          {MODULES.map((m) => (
            <div key={m.id} style={chip}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 9999,
                    backgroundColor: getModuleColor(m.id).color,
                    flexShrink: 0,
                  }}
                />
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '15px',
                    color: 'var(--color-text-primary)',
                  }}
                >
                  {m.label}
                </span>
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {`$${m.price}`}
                <span style={{ color: 'var(--color-text-tertiary)' }}>/mo</span>
              </span>
            </div>
          ))}
        </div>

        <div className="mkt-cluster" style={{ justifyContent: 'space-between', gap: '24px' }}>
          <p
            style={{
              margin: 0,
              maxWidth: '520px',
              fontFamily: 'var(--font-sans)',
              fontSize: '15px',
              lineHeight: '24px',
              color: 'var(--color-text-secondary)',
            }}
          >
            All {MODULES.length} modules run{' '}
            <strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>
              ${MODULES_ALL_ON_TOTAL}/mo
            </strong>{' '}
            — about $41,000 a year less than the same stack bought as separate tools, with Invoicing
            and Inventory included free. Turn any module off and billing stops the same day.
          </p>
          <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
            <a href="/pricing">
              <Button size="lg" style={{ backgroundColor: '#0A0A0A' }}>
                See full pricing →
              </Button>
            </a>
            <a href="/enterprise">
              <Button size="lg" variant="outline">
                Talk to sales
              </Button>
            </a>
          </div>
        </div>
      </div>
    </Section>
  );
}
