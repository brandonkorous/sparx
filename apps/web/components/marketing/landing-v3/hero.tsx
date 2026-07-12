import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { signupHref } from '../cta';
import { BusinessDemoCard } from './hero-device';

/**
 * The v3 hero. Same copy and device-vignette content as v2's hero, rebuilt
 * on pure silicaui — no `primitives.tsx` (Display/Container/mkt-* classes),
 * no inline style objects, no hardcoded hex. The dark "ink" band is a real
 * DOM-scoped `data-theme="dark"` island (silicaui themes are scoped, not
 * global — see packages/brand/src/theme.css), so every color below is a
 * plain `color`/`variant` prop or a `bg-*`/`text-*` token class that
 * resolves correctly on its own — including the second CTA, which needs no
 * override at all to render light-on-dark.
 */
export function LandingV3Hero() {
  return (
    <section data-theme="dark" className="bg-base-100">
      <div className="@container mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:py-32">
        <div className="grid grid-cols-1 items-center gap-16 @4xl:grid-cols-2">
          <div className="flex flex-col gap-8">
            <Heading level={1} size="display" className="text-8xl leading-[0.92] tracking-tight">
              Run the business.
              <br />
              <span className="text-primary">Not the software.</span>
            </Heading>
            <Text variant="lead" className="text-base-content/80 max-w-xl text-xl">
              You started a business to make, sell, serve, teach, or finally work for yourself.
              Sparx brings your website, customers, sales, email and AI into one place that grows
              with you.
            </Text>
            <div className="flex flex-wrap gap-3">
              <Button
                size="xl"
                color="primary"
                variant="solid"
                render={<a href={signupHref('landing-v3-hero')} aria-label="Launch your site" />}
              >
                Launch your site
              </Button>
              <Button
                size="xl"
                variant="outline"
                render={<a href="#day" aria-label="See a day on sparx" />}
              >
                See a day on sparx &darr;
              </Button>
            </div>
            <Text variant="caption">
              No credit card &middot; Live in minutes &middot; Start with only what you need
            </Text>
          </div>

          <BusinessDemoCard />
        </div>
      </div>
    </section>
  );
}
