import { Check } from 'lucide-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Container, Display, Spark, Text } from '../primitives';
import { Reveal } from '../reveal';
import { PLATFORM_HREF, SALES_HREF } from '../cta';
import { ENTERPRISE_FEATS } from './data';

// Device: the dark beat. A `data-theme="dark"` island with an inverted display
// headline, a two-column capability check-list, and two real silicaui Buttons —
// matching the dark-band treatment used across the homepage.
export function PricingV1Enterprise() {
  return (
    // `data-theme="dark"` makes this a real themed island: the whole
    // `--color-base-*` ramp flips, so the headline, lede, checks, and the outline
    // button all resolve on-brand — no #FFFFFF / #A1A1AA / #2A2A2A / #818CF8.
    // `.mkt-inverse` declares the paneled system's INVERSE TIER and paints
    // nothing — it exists so the seam-merge selectors see this band as a tier
    // CHANGE against its light neighbours and keep the corner notch. Without it
    // the section falls to the content tier, which force-paints it and merges
    // its corners into the adjacent plates. `bg-base-100` does the actual
    // painting (dark inside the island), and covers the un-paneled case too.
    <section data-theme="dark" className="mkt-inverse bg-base-100 px-page py-section-xl">
      <Container>
        <Reveal className="flex flex-col items-center justify-between gap-12 lg:flex-row">
          <div className="min-w-[300px] flex-1">
            <Display size={46}>
              Bigger needs? Let&rsquo;s talk
              <Spark />
            </Display>
            <Text size={18} className="mt-5 max-w-[560px]">
              For teams with security reviews, procurement, and uptime commitments. Custom pricing
              that still bills the way the switchboard does — pay for the modules you run.
            </Text>

            <div className="mt-7 grid max-w-xl grid-cols-1 gap-x-7 gap-y-3.5 sm:grid-cols-2">
              {ENTERPRISE_FEATS.map((f) => (
                <Text as="span" key={f} size={15} className="flex items-center gap-2.5">
                  <Check
                    size={16}
                    strokeWidth={2.4}
                    className="text-primary shrink-0"
                    aria-hidden
                  />
                  {f}
                </Text>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3">
            <a
              href={SALES_HREF}
              aria-label="Talk to sales"
              className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
            >
              Talk to sales
            </a>
            <a
              href={PLATFORM_HREF}
              aria-label="See the platform"
              className={buttonClasses({ size: 'lg', variant: 'outline' })}
            >
              See the platform →
            </a>
          </div>
        </Reveal>
      </Container>
    </section>
  );
}
