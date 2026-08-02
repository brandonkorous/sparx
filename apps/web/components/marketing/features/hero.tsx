import { Heading, Text } from '@wizeworks/silicaui-react';
// `buttonClasses` from the `/server` subpath — NOT `<Button render={<a/>}>`.
// This is a Server Component: an element passed as silica's `render` prop
// arrives at the RSC boundary as a lazy client reference whose `.type` is
// undefined, and silica's unconditional `cloneElement(render, …)` then throws
// "Element type is invalid … got: undefined" during prerender.
import { buttonClasses } from '@wizeworks/silicaui-react/server';
import { CAPABILITY_AREAS, capabilityCounts } from '@/lib/capabilities';
import { Band } from '../band';
import { signupHref } from '../cta';

/**
 * The /features hero — a flush dark band, the house opening (landing and
 * /pricing both start this way).
 *
 * Its whole job is to make BREADTH land as a number before the reader meets the
 * list, and then to tell them the list is searchable. The old hero buried the
 * only real argument on the page — the count — in a 30px figure below a
 * 96px headline about not buying modules.
 *
 * Every figure is read from `capabilityCounts()`, so the hero cannot drift from
 * the catalog it introduces.
 */
export function FeaturesHero() {
  const counts = capabilityCounts();
  const freeAreas = CAPABILITY_AREAS.filter((a) => !a.module).length;

  /**
   * Breadth first, then the two facts a reader assumes cut against it: that
   * "everything" means "everything you pay for," and that the foundation is an
   * upsell. It is neither, so the row says so.
   */
  const metrics = [
    { v: String(counts.live), s: 'working today' },
    { v: String(counts.building), s: 'being built right now' },
    { v: String(counts.planned), s: 'planned next' },
    { v: String(counts.modules), s: 'modules — pay only for the ones you turn on' },
    { v: String(freeAreas), s: 'areas free on every plan, whatever you turn on' },
  ] as const;

  return (
    <Band tone="dark" flush>
      <div className="flex flex-col gap-16">
        <div className="flex flex-col gap-8">
          <Heading
            level={1}
            size="display"
            className="max-w-5xl text-7xl leading-[0.94] tracking-tight sm:text-8xl"
          >
            Every single thing sparx does
            <span className="text-primary">.</span>
          </Heading>
          <Text variant="lead" className="text-base-content max-w-2xl text-xl">
            All {counts.total} of them, written down — {counts.live} of which you can use today.
            Search it for the thing your business actually needs, and see which module it comes with
            before you spend a cent.
          </Text>
          <div className="flex flex-wrap gap-3">
            <a
              href={signupHref('features-hero')}
              aria-label="Start free"
              className={buttonClasses({ size: 'xl', color: 'primary', variant: 'solid' })}
            >
              Start free &rarr;
            </a>
            <a
              href="#find"
              aria-label="Search the list"
              className={buttonClasses({ size: 'xl', variant: 'outline' })}
            >
              Search the list &darr;
            </a>
          </div>
        </div>

        {/* A 5-column grid, not a flex row: `justify-between` on five items wraps
            4 + 1 and orphans the last one on its own line. */}
        <div className="border-base-300 grid grid-cols-2 gap-x-10 gap-y-8 border-t pt-10 sm:grid-cols-3 lg:grid-cols-5">
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
