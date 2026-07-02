import { Container } from './primitives';
import { Reveal } from './reveal';

// Honest replacement for a fabricated customer testimonial. sparx is pre-launch,
// so an invented quote + hard metrics attributed to a named person is exactly the
// fake proof the brand rules forbid. This is a founder's note instead: it carries
// the thesis in a real voice, and states the one true relationship we have — the
// design partnership with Gillett Diesel Service (the first enterprise client
// shaping the B2B/fleet feature set, per the product brief) — with no numbers put
// in anyone's mouth. Keeps the #customers anchor so existing nav/footer links hold.
export function Testimonial() {
  return (
    <section
      id="customers"
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: 'var(--color-bg-surface)',
        borderTop: '1px solid var(--color-border-default)',
        scrollMarginTop: '80px',
      }}
    >
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
        <Reveal style={{ display: 'flex', flexDirection: 'column', gap: '48px' }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'var(--color-text-tertiary)',
            }}
          >
            From the founder
          </span>

          <div
            className="mkt-stack-on-tablet"
            style={{ gap: '48px', alignItems: 'flex-start', padding: '8px 0' }}
          >
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontWeight: 500,
                fontSize: 'clamp(24px, 3vw, 40px)',
                letterSpacing: '-0.025em',
                lineHeight: 1.32,
                color: 'var(--color-text-primary)',
                margin: 0,
                flex: 1,
              }}
            >
              AI can spin up a website in an afternoon. It&apos;s the second year that&apos;s hard —
              the orders, the customer data, the wholesale accounts,{' '}
              <span style={{ color: 'var(--color-text-tertiary)' }}>
                the site still being yours when the trend moves on.
              </span>{' '}
              sparx is the home an AI-built site grows into:{' '}
              <span style={{ color: 'var(--sparx-primary)' }}>
                own it, run it, and change it yourself
              </span>{' '}
              — for years, no rebuild and no developer on retainer.
            </p>

            <FounderCard />
          </div>
        </Reveal>
      </Container>
    </section>
  );
}

// The signature block + the one true relationship we can name (the Gillett design
// partnership). Split out so the section's main body stays a single readable unit.
function FounderCard() {
  return (
    <aside
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '28px',
        width: '340px',
        maxWidth: '100%',
        flexShrink: 0,
        paddingTop: '8px',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: 48,
            height: 48,
            backgroundColor: '#0A0A0A',
            borderRadius: '9999px',
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '15px',
            letterSpacing: '0.02em',
            color: '#FFFFFF',
          }}
        >
          BK
        </span>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '2px' }}>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontWeight: 500,
              fontSize: '15px',
              color: 'var(--color-text-primary)',
            }}
          >
            Brandon Korous
          </span>
          <span
            style={{
              fontFamily: 'var(--font-sans)',
              fontSize: '13px',
              color: 'var(--color-text-secondary)',
            }}
          >
            Founder, sparx
          </span>
        </div>
      </div>

      <div
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: '6px',
          paddingTop: '20px',
          borderTop: '1px solid var(--color-border-default)',
        }}
      >
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontWeight: 500,
            fontSize: '13px',
            color: 'var(--color-text-primary)',
          }}
        >
          Design partner
        </span>
        <span
          style={{
            fontFamily: 'var(--font-sans)',
            fontSize: '14px',
            lineHeight: '21px',
            color: 'var(--color-text-secondary)',
          }}
        >
          Gillett Diesel Service is shaping our B2B, fleet, and net-terms features from real-world
          use.
        </span>
      </div>
    </aside>
  );
}
