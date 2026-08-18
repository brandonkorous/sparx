import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { signupHref } from '../cta';
import { WhoeverVideo } from './whoever-video';

/**
 * The "whoever you are" multi-vertical video beat, on pure silicaui — the
 * section is a DOM-scoped `data-theme="dark"` island (same technique as the
 * hero) so the
 * headline/lede/buttons/ticker all resolve their colors from plain
 * `color`/`variant` props and `text-base-content`/`text-primary` token
 * classes, with zero hardcoded white/hex anywhere.
 */
export function LandingWhoever() {
  return (
    <section
      data-theme="dark"
      className="bg-primary relative flex min-h-[clamp(560px,88vh,880px)] items-center overflow-hidden rounded-b-4xl"
    >
      <WhoeverVideo />
      <div className="relative z-10 mx-auto w-full max-w-7xl px-6 sm:px-8">
        <div className="flex max-w-2xl flex-col gap-9">
          <div className="flex flex-col gap-6">
            <Heading
              level={2}
              size="display"
              className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
            >
              Whoever you are, it&apos;s already for you
              <span className="text-primary">.</span>
            </Heading>
            <Text variant="lead" className="text-base-content max-w-xl text-2xl">
              A maker, a shop, a studio, a workshop, a wholesaler. sparx bends to the business you
              actually run, not the other way around.
            </Text>
          </div>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-3">
              <a
                href={signupHref('landing-whoever')}
                aria-label="Start free"
                className={buttonClasses({ size: 'lg', color: 'primary', variant: 'solid' })}
              >
                Start free &rarr;
              </a>
              <a
                href="#modules"
                aria-label="Explore the modules"
                className={buttonClasses({ size: 'lg', variant: 'outline' })}
              >
                Explore the modules
              </a>
            </div>
            <Text variant="caption">
              No card &middot; Cancel anytime &middot; Pay only for what you use
            </Text>
          </div>
        </div>
      </div>
    </section>
  );
}
