import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { signupHref } from '../cta';
import { HeroStoryRotator } from './hero-story';

/**
 * The v3 hero. Rebuilt on pure silicaui — no `primitives.tsx` (Display/Container/
 * mkt-* classes), no inline style objects, no hardcoded hex. The dark "ink" band is
 * a real DOM-scoped `data-theme="dark"` island (silicaui themes are scoped, not
 * global — see packages/brand/src/theme.css), so every color below is a plain
 * `color`/`variant` prop or a `bg-*`/`text-*` token class that resolves correctly on
 * its own — including the second CTA, which needs no override at all to render
 * light-on-dark.
 *
 * The right column used to be a mocked-up AI check-in card. It now tells the real
 * example stories from the story onboarding, rotating slowly — the headline promises
 * "your story, multiplied", so the hero shows actual stories rather than a vignette
 * of a screen that doesn't exist.
 */
export function LandingV3Hero() {
  return (
    <section data-theme="dark" className="bg-base-100 h-dvh place-content-center">
      <div className="@container mx-auto max-w-7xl px-6">
        <div className="grid grid-cols-1 items-center gap-16 @4xl:grid-cols-2">
          <div className="flex flex-col gap-8">
            {/* The type scale is responsive because it has to be: at a flat text-8xl
                (96px) "MULTIPLIED" is ~495px wide and ran off every phone, and at
                1024 the hero is already two columns (~456px each) — so the step to
                8xl waits for xl, where the column is genuinely wide enough. */}
            <Heading
              level={1}
              size="display"
              className="text-5xl leading-[0.92] tracking-tight sm:text-6xl md:text-7xl xl:text-8xl"
            >
              YOUR STORY,
              <br />
              <span className="text-primary">MULTIPLIED.</span>
            </Heading>
            <Text variant="lead" className="text-base-content max-w-xl text-2xl">
              You already know your story. Tell sparx yours, and we&apos;ll assemble the website,
              customers, scheduling, payments, marketing, and operations into one connected platform
              that grows with you, so you can focus on building your business instead of managing
              software.
            </Text>
            <div className="flex flex-wrap gap-3">
              <a
                href={signupHref('landing-v3-hero')}
                aria-label="Launch your site"
                className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
              >
                Start your story &rarr;
              </a>
              <a
                href="#day"
                aria-label="See a day on sparx"
                className={buttonClasses({ size: 'xl', variant: 'outline' })}
              >
                See a day on sparx &darr;
              </a>
            </div>
            <Text variant="caption">
              No credit card &middot; Live in minutes &middot; Start with only what you need
            </Text>
          </div>

          <HeroStoryRotator />
        </div>
      </div>
    </section>
  );
}
