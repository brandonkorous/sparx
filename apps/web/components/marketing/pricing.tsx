import { Button } from '@sparx/ui';
import { Section, SectionHeader } from './primitives';

// Homepage pricing teaser — a short, on-model summary that points to the full
// /pricing page (the switchboard). Per-module flat pricing from $10/mo; a 14-day
// trial. No bundle cards (the bundle model was dropped — see docs/17).
const MODULES: { name: string; price: string; color: string }[] = [
  { name: 'Builder', price: '$10', color: 'var(--module-builder)' },
  { name: 'Commerce', price: '$49', color: 'var(--module-commerce)' },
  { name: 'CMS', price: '$49', color: 'var(--module-cms)' },
  { name: 'CRM', price: '$49', color: 'var(--module-crm)' },
  { name: 'Email', price: '$29', color: 'var(--module-email)' },
  { name: 'B2B · Fleet', price: '$99', color: 'var(--module-b2b)' },
  { name: 'AI · MCP', price: '$49', color: 'var(--module-ai)' },
  { name: 'Dropship', price: '$29', color: 'var(--module-dropship)' },
];

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
            <div key={m.name} style={chip}>
              <span style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                <span
                  style={{
                    width: 9,
                    height: 9,
                    borderRadius: 9999,
                    backgroundColor: m.color,
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
                  {m.name}
                </span>
              </span>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '14px',
                  color: 'var(--color-text-secondary)',
                }}
              >
                {m.price}
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
            All nine modules run{' '}
            <strong style={{ color: 'var(--color-text-primary)', fontWeight: 500 }}>$392/mo</strong>{' '}
            — about $38,000 a year less than the same stack bought as separate tools. Turn any
            module off and billing stops the same day.
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
