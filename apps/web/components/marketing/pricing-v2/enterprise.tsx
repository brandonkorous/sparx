import { Check } from 'lucide-react';
import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { Reveal } from '../reveal';
import { PLATFORM_HREF, SALES_HREF } from '../cta';
import { ENTERPRISE_FEATS } from '../pricing-v1/data';

/**
 * "Bigger needs? Let's talk." — the enterprise beat, rebuilt as a DOM-scoped
 * `data-theme="dark"` island (v1 used the `mkt-accent` class with hardcoded
 * #FFFFFF/#A1A1AA/#818CF8 hex; all of it is gone). On the scoped dark theme,
 * both Buttons and every text/check color resolve from `color`/`variant` props
 * and `base-content`/`primary` tokens — zero hardcoded hex.
 */
export function PricingV2Enterprise() {
  return (
    <section data-theme="dark" className="bg-base-100 m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto max-w-7xl">
        <Reveal className="flex flex-col items-start gap-12 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex-1">
            <Heading
              level={2}
              size="display"
              className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              Bigger needs?
              <br />
              Let&rsquo;s talk
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-base-content/70 mt-5 max-w-xl">
              For teams with security reviews, procurement, and uptime commitments. Custom pricing
              that still works like the switchboard: you pay for the modules you run.
            </Text>

            <div className="mt-7 grid max-w-xl grid-cols-1 gap-x-7 gap-y-3.5 sm:grid-cols-2">
              {ENTERPRISE_FEATS.map((f) => (
                <span
                  key={f}
                  className="text-base-content/85 flex items-center gap-2.5 text-[15px]"
                >
                  <Check
                    size={16}
                    strokeWidth={2.4}
                    className="text-primary shrink-0"
                    aria-hidden
                  />
                  {f}
                </span>
              ))}
            </div>
          </div>

          <div className="flex shrink-0 flex-col items-start gap-3">
            <Button
              size="xl"
              color="primary"
              variant="solid"
              render={<a href={SALES_HREF} aria-label="Talk to sales" />}
            >
              Talk to sales
            </Button>
            <Button
              size="xl"
              variant="outline"
              render={<a href={PLATFORM_HREF} aria-label="See the platform" />}
            >
              See the platform &rarr;
            </Button>
          </div>
        </Reveal>
      </div>
    </section>
  );
}
