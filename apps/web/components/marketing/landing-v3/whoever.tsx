import { Button, Heading, Text } from '@wizeworks/silicaui-react';
import { signupHref } from '../cta';
import { WhoeverVideo } from './whoever-video';

/**
 * v3 of the "whoever you are" multi-vertical video beat. Same copy, same
 * video playlist, rebuilt on pure silicaui — the section is a DOM-scoped
 * `data-theme="dark"` island (same technique as the v3 hero) so the
 * headline/lede/buttons/ticker all resolve their colors from plain
 * `color`/`variant` props and `text-base-content`/`text-primary` token
 * classes, with zero hardcoded white/hex anywhere.
 */
export function LandingV3Whoever() {
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
            <Text variant="lead" className="text-base-content/90 max-w-xl text-2xl">
              A maker, a shop, a studio, a workshop, a wholesaler. sparx bends to the business you
              actually run, not the other way around.
            </Text>
          </div>
          <div className="flex flex-col gap-3.5">
            <div className="flex flex-wrap gap-3">
              <Button
                size="lg"
                color="primary"
                variant="solid"
                render={<a href={signupHref('landing-v3-whoever')} aria-label="Start free" />}
              >
                Start free &rarr;
              </Button>
              <Button
                size="lg"
                variant="outline"
                render={<a href="#modules" aria-label="Explore the modules" />}
              >
                Explore the modules
              </Button>
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
