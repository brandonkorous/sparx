import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { EARLY_HREF, SALES_HREF, signupHref } from '../cta';

/**
 * The closing beat — a near-black band that ends the page on the offer, rebuilt
 * on the same DOM-scoped `data-theme="dark"` island landing-v3's final CTA uses
 * (rather than reusing the legacy inline-style `<FinalCta>` that v1 imported).
 * `bg-base-100` resolves to the dark theme's near-black canvas, so every
 * button/text color resolves automatically with zero hardcoded hex.
 */
export function PricingV2FinalCta() {
  return (
    <section data-theme="dark" className="bg-base-100 m-6 rounded-4xl px-6 py-24 sm:px-8 lg:py-32">
      <div className="mx-auto flex max-w-7xl flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-8">
          <Heading
            level={2}
            size="display"
            className="text-7xl leading-[0.95] tracking-tight sm:text-8xl"
          >
            Light the spark
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-base-content max-w-xl">
            Sign up free. Switch on the modules you need. One invoice, no card, cancel any time.
            Keep the site, the data, and the control for years.
          </Text>
        </div>

        <div className="flex flex-col items-start gap-3.5">
          <Button
            size="xl"
            color="primary"
            variant="solid"
            render={<a href={signupHref('pricing-v2-final')} aria-label="Start your site" />}
          >
            Start your site &rarr;
          </Button>
          <Button
            size="xl"
            variant="outline"
            render={<a href={SALES_HREF} aria-label="Book a 20-min call" />}
          >
            Book a 20-min call
          </Button>
          <Text variant="caption">
            $0 to start &middot; cancel any time &middot;{' '}
            <a href={EARLY_HREF} className="text-primary">
              not ready? join early access &rarr;
            </a>
          </Text>
        </div>
      </div>
    </section>
  );
}
