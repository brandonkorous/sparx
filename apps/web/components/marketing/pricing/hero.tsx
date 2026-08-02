import { Badge, Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { signupHref } from '../cta';
import { PricingModuleDeck } from './module-deck';

/**
 * The pricing hero — the promise, not the tool. A DOM-scoped
 * `data-theme="dark"` island (same technique as the homepage hero) so every
 * color resolves from `color`/`variant` props and `bg-*`/`text-*` token
 * classes. There is now no hardcoded hex and no `style` prop anywhere in this
 * hero: the last one was a `MODULE_HEX` dot on the card the deck replaced.
 *
 * The device: fact chips carry the pricing model at a glance, and the module
 * deck (see module-deck.tsx for why it is a deck and not a grid or a receipt)
 * shows what actually switches on.
 */

export function PricingHero() {
  return (
    <section data-theme="dark" className="bg-base-100">
      <div className="mx-auto max-w-7xl px-6 py-24 sm:px-8 lg:py-32">
        <div className="grid grid-cols-1 items-center gap-14 lg:grid-cols-[1.1fr_0.9fr] lg:gap-16">
          <div className="flex flex-col gap-8">
            <Heading
              level={1}
              size="display"
              className="text-7xl leading-[0.94] tracking-tight sm:text-8xl"
            >
              Pay for what you use.
              <br />
              <span className="text-base-content">Nothing else</span>
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-base-content max-w-xl text-xl">
              Flat pricing, one module at a time. Switch on only the parts you need, get one
              invoice, and change your mind whenever the business does.
            </Text>
            {/* No `color` on these. They sat on `color="neutral"`, which inside
                this `data-theme="dark"` island resolved to `--color-neutral`
                (oklch(32%) — DARK) and painted dark ink on a near-black band:
                1.68:1, unreadable. Only the nested `text-primary` spans showed.
                A bare `badge-outline` inherits the island's own `-content` ink
                instead, which is the whole point of the surface pairing — and it
                keeps the chips quiet so the $10 / 14-day accents still carry.
                Neutral is earned by chassis, bare prose, or a dismiss action;
                four proof points are none of those. */}
            <div className="flex flex-wrap gap-2.5">
              <Badge variant="outline" size="lg">
                from&nbsp;<span className="text-primary font-semibold">$10</span>/mo
              </Badge>
              <Badge variant="outline" size="lg">
                one invoice
              </Badge>
              <Badge variant="outline" size="lg">
                <span className="text-primary font-semibold">14-day</span>&nbsp;free trial
              </Badge>
              <Badge variant="outline" size="lg">
                no card to start
              </Badge>
            </div>
            <div className="flex flex-wrap gap-3">
              <a
                href={signupHref('pricing-hero')}
                aria-label="Start free"
                className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
              >
                Start free &rarr;
              </a>
              <a
                href="#switchboard"
                aria-label="Price your stack"
                className={buttonClasses({ size: 'xl', variant: 'outline' })}
              >
                Price your stack &darr;
              </a>
            </div>
          </div>

          <PricingModuleDeck />
        </div>
      </div>
    </section>
  );
}
