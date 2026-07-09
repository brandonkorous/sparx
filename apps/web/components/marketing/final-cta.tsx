import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Spark } from './primitives';
import { Reveal } from './reveal';
import { EARLY_HREF, SALES_HREF, signupHref } from './cta';

// The closing beat. A near-black band that ends the page on the offer, not on a
// metric row — the earlier Permanence band carries the proof numbers, so
// repeating a four-stat row here just reads as the same slide a third time.
// Primary action is self-serve signup; "book a call" routes to the enterprise
// page; a quiet third line keeps the early-access waitlist reachable for anyone
// not ready to open an account yet.
export function FinalCta() {
  return (
    <section
      className="mkt-accent"
      style={{
        paddingTop: 'var(--section-py-xl)',
        paddingBottom: 'var(--section-py-xl)',
        paddingLeft: 'var(--gutter-page)',
        paddingRight: 'var(--gutter-page)',
        backgroundColor: '#0A0A0A',
      }}
    >
      <Container>
        <Reveal
          className="mkt-stack-on-tablet mkt-align-end-on-desktop"
          style={{ justifyContent: 'space-between', gap: '48px' }}
        >
          <div style={{ display: 'flex', flexDirection: 'column', gap: '32px', maxWidth: '920px' }}>
            <Display size={96} lineHeight={92} color="#FFFFFF">
              Light the spark
              <Spark color="#818CF8" />
            </Display>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '20px',
                lineHeight: '32px',
                color: '#A1A1AA',
                maxWidth: '620px',
                margin: 0,
              }}
            >
              Sign up free. Switch on the modules you need. Be live before the kettle boils — then
              keep the site, the data, and the control for years. No card, no contract, no upgrade
              lock-in.
            </p>
          </div>

          <div
            className="mkt-align-end-on-desktop"
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '14px',
              alignItems: 'flex-start',
            }}
          >
            <Button
              size="xl"
              variant="solid"
              render={<a href={signupHref('final')} aria-label="Start your site" />}
            >
              Start your site →
            </Button>
            <Button
              size="xl"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
              render={<a href={SALES_HREF} aria-label="Book a 20-min call" />}
            >
              Book a 20-min call
            </Button>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: '12px',
                color: '#71717A',
                paddingTop: '8px',
              }}
            >
              $0 to start · cancel any time ·{' '}
              <a href={EARLY_HREF} style={{ color: '#818CF8', textDecoration: 'none' }}>
                not ready? join early access →
              </a>
            </span>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
