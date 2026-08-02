import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — see the note in ./hero.tsx.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { capabilityCounts } from '@/lib/capabilities';
import { Band } from '../band';
import { EARLY_HREF, PLATFORM_HREF, signupHref } from '../cta';

/**
 * The closing beat — the house dark band, inset and rounded like every other
 * filled band on the site.
 *
 * The argument it has to land is the one the index above sets up: the list is
 * long, and none of it is a tier you have to reach. You start with one module
 * and the rest is already built and waiting.
 */
export function FeaturesFinalCta() {
  const counts = capabilityCounts();
  return (
    <Band tone="dark">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-8">
          <Heading
            level={2}
            size="display"
            className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            Start with one. The rest is already built
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-base-content max-w-xl">
            Switch on a single module from $10 a month and have a live site in five minutes. The
            other {counts.modules - 1} are one click away the day you need them — same login, same
            customers, same bill. Nothing to migrate, nothing to rebuild.
          </Text>
        </div>

        <div className="flex flex-col items-start gap-3.5">
          <a
            href={signupHref('features-final')}
            aria-label="Start free"
            className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
          >
            Start free &rarr;
          </a>
          <a
            href={PLATFORM_HREF}
            aria-label="See how it works"
            className={buttonClasses({ size: 'xl', variant: 'outline' })}
          >
            See how it works
          </a>
          <Text variant="caption">
            No card to start &middot; cancel any time &middot;{' '}
            <a href={EARLY_HREF} className="text-primary">
              not ready? join early access &rarr;
            </a>
          </Text>
        </div>
      </div>
    </Band>
  );
}
