import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — see the note in ./hero.tsx.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '../band';
import { SALES_HREF } from '../cta';

/** The closing beat — the house dark band, inset and rounded like every other
 *  filled band on the site. */
export function PartnersFinalCta() {
  return (
    <Band tone="dark">
      <div className="flex flex-col gap-12 lg:flex-row lg:items-end lg:justify-between">
        <div className="flex max-w-3xl flex-col gap-8">
          <Heading
            level={2}
            size="display"
            className="text-6xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            Start earning on sparx
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-base-content max-w-xl">
            Apply this afternoon, refer your first client this week, and get paid when their first
            invoice clears. No contract, no minimum, and nothing to buy.
          </Text>
        </div>

        <div className="flex flex-col items-start gap-3.5">
          <a
            href="#apply"
            aria-label="Apply to become a partner"
            className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
          >
            Apply to become a partner &rarr;
          </a>
          <a
            href={SALES_HREF}
            aria-label="Talk to us first"
            className={buttonClasses({ size: 'xl', variant: 'outline' })}
          >
            Talk to us first
          </a>
          <Text variant="caption">
            $0 to join &middot; no quota &middot;{' '}
            <a href="/partners/directory" className="text-primary">
              browse the directory &rarr;
            </a>
          </Text>
        </div>
      </div>
    </Band>
  );
}
