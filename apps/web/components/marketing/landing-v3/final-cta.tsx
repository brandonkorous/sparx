import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { EARLY_HREF, SALES_HREF, signupHref } from '../cta';

/**
 * The closing beat — a near-black band that ends the page on the offer. Same
 * DOM-scoped `data-theme="dark"` technique as Hero/Whoever: `bg-base-100`
 * resolves to the dark theme's near-black canvas (`#1a1a1a`, the same idea
 * as v2's hardcoded `#0A0A0A`, just token-driven), so every button/text color
 * below resolves automatically with zero hardcoded hex.
 */
export function LandingV3FinalCta() {
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
            Sign up free. Switch on the modules you need. Be live before the kettle boils — then
            keep the site, the data, and the control for years. No card, no contract, no upgrade
            lock-in.
          </Text>
        </div>

        <div className="flex flex-col items-start gap-3.5">
          <a
            href={signupHref('landing-v3-final')}
            aria-label="Start your site"
            className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
          >
            Start your site &rarr;
          </a>
          <a
            href={SALES_HREF}
            aria-label="Book a 20-min call"
            className={buttonClasses({ size: 'xl', variant: 'outline' })}
          >
            Book a 20-min call
          </a>
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
