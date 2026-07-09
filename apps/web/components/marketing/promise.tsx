import { Container, Display, Spark } from './primitives';
import { Reveal } from './reveal';

const STEPS = [
  {
    time: '00:00',
    label: 'Step 1',
    title: 'Sign up.',
    body: 'Email and password. No credit card. No sales call.',
  },
  {
    time: '00:45',
    label: 'Step 2',
    title: 'Pick a theme.',
    body: 'Browse, preview, apply. Every theme works on phone and desktop.',
  },
  {
    time: '01:30',
    label: 'Step 3',
    title: 'Activate modules.',
    body: 'One toggle per module. Pricing updates live. Cancel any time.',
  },
  {
    time: '02:30',
    label: 'Step 4',
    title: 'Add your first product.',
    body: 'Drag, drop, price. Inventory, variants, and SEO inferred.',
  },
  {
    time: '04:50',
    label: 'Live',
    title: 'Take your first order',
    body: 'Stripe wired. Email confirmation sent. Your site is live.',
    invert: true,
  },
] as const;

export function Promise() {
  return (
    <section
      style={{
        paddingTop: 'var(--section-py-lg)',
        paddingBottom: 'var(--section-py-lg)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-base-200)',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
        <Reveal style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: '20px', maxWidth: '900px' }}>
            <Display size={72} lineHeight={76}>
              Live in five
              <br />
              minutes
              <Spark />
            </Display>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '18px',
                lineHeight: '30px',
                color: 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                maxWidth: '640px',
                paddingTop: '8px',
                margin: 0,
              }}
            >
              Sign up. Pick a theme. Activate the modules you need. Add a product. Take an order. No
              developer. No app store. No Zapier. No upgrade required.
            </p>
          </div>

          <div className="mkt-grid-5-wrap">
            {STEPS.map((s) => (
              <div
                key={s.time}
                style={{
                  display: 'flex',
                  flexDirection: 'column',
                  padding: '32px 28px',
                  gap: '20px',
                  backgroundColor: 'invert' in s && s.invert ? '#0A0A0A' : 'var(--color-base-100)',
                }}
              >
                <div
                  style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}
                >
                  <span
                    style={{
                      fontFamily: 'var(--font-mono)',
                      fontSize: '12px',
                      color: 'color-mix(in oklab, var(--color-base-content) 50%, transparent)',
                    }}
                  >
                    {s.time}
                  </span>
                  <span
                    style={{
                      fontFamily: 'var(--font-sans)',
                      fontWeight: 500,
                      fontSize: '11px',
                      letterSpacing: '0.05em',
                      color:
                        'invert' in s && s.invert
                          ? 'var(--color-primary)'
                          : 'var(--color-base-content)',
                      textTransform: 'uppercase',
                    }}
                  >
                    {s.label}
                  </span>
                </div>
                <div
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '20px',
                    letterSpacing: '-0.015em',
                    lineHeight: '26px',
                    color: 'invert' in s && s.invert ? '#FFFFFF' : 'var(--color-base-content)',
                  }}
                >
                  {s.title}
                  {'invert' in s && s.invert ? <Spark /> : null}
                </div>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '13px',
                    lineHeight: '20px',
                    color:
                      'invert' in s && s.invert
                        ? '#A1A1AA'
                        : 'color-mix(in oklab, var(--color-base-content) 70%, transparent)',
                  }}
                >
                  {s.body}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
