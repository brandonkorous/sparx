import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Spark } from './primitives';
import { Reveal } from './reveal';
import { PLATFORM_HREF, signupHref } from './cta';

// The permanence beat — the "second promise" from docs/01 §7 and the brand
// guide §7.2. It sits late on the page (after the B2B spotlight, ahead of the
// Promise/testimonial trust cluster) as a near-black band punctuating the light
// sections around it, so the durability message reinforces the closing argument
// rather than competing with the hero — the dark surface itself signals
// solidity/permanence, the counterpoint to the era of disposable AI-generated
// sites. NOT a hero carousel slide (slide-2 never gets seen) — a scroll beat,
// because "fast to start, permanent to keep" is a sequence, not a toggle.
//
// Message rules (brand guide §7.1): AI + permanence, never anti-AI; "coding
// optional" = the docs/47 escape ladder, never a flat no-code-only claim.

// The day-2 proof — the capabilities that make a sparx site outlast a generated
// snapshot. Rendered as labeled columns (matching final-cta's metric row), not
// pills, to stay consistent with the flat marketing register.
const PROOF = [
  { value: 'No-code editor', subtitle: 'Change anything yourself' },
  { value: 'Own your data', subtitle: 'Export anytime, never locked in' },
  { value: 'Headless API', subtitle: 'Every feature, API-first' },
  { value: 'MCP-native', subtitle: 'Your AI speaks your business', spark: '#EC4899' },
] as const;

export function Permanence() {
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
      <Container style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
        <Reveal style={{ display: 'flex', flexDirection: 'column', gap: '64px' }}>
          <div
            className="mkt-stack-on-tablet mkt-align-end-on-desktop"
            style={{ justifyContent: 'space-between', gap: '40px' }}
          >
            <div
              style={{ display: 'flex', flexDirection: 'column', gap: '40px', maxWidth: '920px' }}
            >
              <Display size={88} lineHeight={84} color="#FFFFFF">
                The website that&apos;s still yours next year
                <Spark color="#818CF8" />
              </Display>
              <p
                style={{
                  fontFamily: 'var(--font-sans)',
                  fontSize: '20px',
                  lineHeight: '32px',
                  color: '#A1A1AA',
                  maxWidth: '640px',
                  margin: 0,
                }}
              >
                <span style={{ color: '#818CF8' }}>AI builds it. sparx keeps it.</span> Generate it
                with AI if you want. Then maintain and enhance it yourself — no-code by default,
                full code when you want it — for years. You own the data. You own the site.
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
              <Button size="xl" variant="solid" render={<a href={signupHref('permanence')} />}>
                Launch your site →
              </Button>
              <Button
                size="xl"
                variant="outline"
                style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
                render={<a href={PLATFORM_HREF} />}
              >
                See how it lasts
              </Button>
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: '12px',
                  color: '#52525B',
                  paddingTop: '8px',
                }}
              >
                No rebuild · No developer on retainer
              </span>
            </div>
          </div>

          <div
            className="mkt-cluster"
            style={{
              justifyContent: 'space-between',
              paddingTop: '40px',
              borderTop: '1px solid #1A1A1A',
              gap: '40px',
              rowGap: '24px',
            }}
          >
            {PROOF.map((p) => (
              <div key={p.value} style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontWeight: 500,
                    fontSize: '22px',
                    letterSpacing: '-0.015em',
                    color: '#FFFFFF',
                  }}
                >
                  {p.value}
                  {'spark' in p && p.spark ? <Spark color={p.spark} /> : null}
                </span>
                <span
                  style={{
                    fontFamily: 'var(--font-sans)',
                    fontSize: '12px',
                    color: '#71717A',
                  }}
                >
                  {p.subtitle}
                </span>
              </div>
            ))}
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
