import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — an element passed as silica's
// `render` prop arrives at the RSC boundary as a lazy client reference and
// silica's unconditional `cloneElement` throws during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { Band } from '@/components/marketing/band';
import type { FacetCount } from '@/lib/partners';

/**
 * The directory's opening — the thing it had none of.
 *
 * The page began with a 14px "← Partner program" link and a mid-size heading on
 * the page background, which read as an internal admin list rather than the
 * public discovery surface docs/114 §B.6 describes. Every other marketing page
 * opens on a real band; this one now does too.
 *
 * The counts are read from the live tier facets, so the page cannot claim an
 * ecosystem it does not have. Two of the four metrics are deliberately NOT
 * volume: a directory with three entries should still be able to say something
 * true and useful, and "we take nothing from what you pay them" is the fact a
 * business actually wants before it clicks a stranger's website.
 */
export function DirectoryHero({
  tierFacets,
  specialtyCount,
}: {
  tierFacets: FacetCount[];
  specialtyCount: number;
}) {
  const total = tierFacets.reduce((n, f) => n + (f.count ?? 0), 0);
  const certified = tierFacets.find((f) => f.value === 'certified')?.count ?? 0;

  const metrics = [
    { v: String(total), s: total === 1 ? 'partner listed today.' : 'partners listed today.' },
    {
      v: String(certified),
      s: 'of them certified — they sat the course on the platform they are selling.',
    },
    {
      v: String(specialtyCount),
      s: 'kinds of work covered, from storefronts to migrations.',
    },
    {
      v: '$0',
      s: 'of their fee comes to us. They work for you, not for sparx.',
    },
  ];

  return (
    <Band tone="dark" flush>
      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-8">
          <Heading
            level={1}
            size="display"
            className="max-w-4xl text-6xl leading-[0.95] tracking-tight sm:text-7xl"
          >
            Find someone to build it with you
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-base-content max-w-2xl text-xl">
            Consultants, agencies and developers who set businesses up on sparx and keep them
            running. Filter by the work you need doing, then contact them directly — there is no
            middleman and no introduction fee.
          </Text>
          <div className="flex flex-wrap gap-3">
            <a
              href="#results"
              aria-label="Browse partners"
              className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
            >
              Browse partners &darr;
            </a>
            <a
              href="/partners"
              aria-label="Become a partner"
              className={buttonClasses({ size: 'xl', variant: 'outline' })}
            >
              Become a partner
            </a>
          </div>
        </div>

        <div className="border-base-300 grid grid-cols-2 gap-x-10 gap-y-8 border-t pt-10 lg:grid-cols-4">
          {metrics.map((m) => (
            <div key={m.s} className="flex flex-col gap-1.5">
              <span className="text-4xl font-medium tracking-[-0.02em] sm:text-5xl">{m.v}</span>
              <Text className="text-lg leading-snug">{m.s}</Text>
            </div>
          ))}
        </div>
      </div>
    </Band>
  );
}
