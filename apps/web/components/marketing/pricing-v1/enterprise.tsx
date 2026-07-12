import { Check } from 'lucide-react';
import { Button } from '@wizeworks/silicaui-react';
import { Container, Display, Spark } from '../primitives';
import { Reveal } from '../reveal';
import { PLATFORM_HREF, SALES_HREF } from '../cta';
import { ENTERPRISE_FEATS } from './data';

// Device: the dark inverse beat. A theme-aware charcoal band (mkt-accent) with
// an inverted display headline, a two-column capability check-list, and two real
// silicaui Buttons — matching the dark-band treatment used across the homepage.
export function PricingV1Enterprise() {
  return (
    <section className="mkt-accent px-[var(--gutter-page)] py-[var(--section-py-xl)]">
      <Container>
        <Reveal
          className="mkt-stack-on-tablet"
          style={{ justifyContent: 'space-between', gap: '48px', alignItems: 'center' }}
        >
          <div style={{ flex: 1, minWidth: '300px' }}>
            <Display size={46} color="#FFFFFF">
              Bigger needs? Let&rsquo;s talk
              <Spark color="#818CF8" />
            </Display>
            <p
              style={{
                fontFamily: 'var(--font-sans)',
                fontSize: '18px',
                lineHeight: '30px',
                color: '#A1A1AA',
                maxWidth: '560px',
                margin: '20px 0 0',
              }}
            >
              For teams with security reviews, procurement, and uptime commitments. Custom pricing
              that still bills the way the switchboard does — pay for the modules you run.
            </p>

            <div className="mt-7 grid max-w-xl grid-cols-1 gap-x-7 gap-y-3.5 sm:grid-cols-2">
              {ENTERPRISE_FEATS.map((f) => (
                <span
                  key={f}
                  className="flex items-center gap-2.5 text-[15px]"
                  style={{ color: 'rgba(255,255,255,0.82)' }}
                >
                  <Check size={16} strokeWidth={2.4} color="#818CF8" aria-hidden />
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3">
            <Button
              size="lg"
              color="primary"
              variant="solid"
              render={<a href={SALES_HREF} aria-label="Talk to sales" />}
            >
              Talk to sales
            </Button>
            <Button
              size="lg"
              variant="outline"
              style={{ backgroundColor: 'transparent', borderColor: '#2A2A2A', color: '#FFFFFF' }}
              render={<a href={PLATFORM_HREF} aria-label="See the platform" />}
            >
              See the platform →
            </Button>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
