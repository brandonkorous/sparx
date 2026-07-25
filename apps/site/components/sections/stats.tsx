// Stats section — an optional full-width lead image (e.g. a map), a heading /
// subcopy with up to two CTAs, and a row of big figure + label stats.

import type { StatsConfig } from '@sparx/sitebuilder-schemas';
import { focalToPosition } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow } from './_shared';
import { StatValue } from './stat-count';

// Stat column count → auto-width columns; every layout drops to 2 columns below
// 640px.
const STAT_COLS: Record<number, string> = {
  1: 'grid-cols-[repeat(2,auto)] min-[641px]:grid-cols-[repeat(1,auto)]',
  2: 'grid-cols-[repeat(2,auto)]',
  3: 'grid-cols-[repeat(2,auto)] min-[641px]:grid-cols-[repeat(3,auto)]',
  4: 'grid-cols-[repeat(2,auto)] min-[641px]:grid-cols-[repeat(4,auto)]',
};

export function StatsSection({ config, ctx }: { config: StatsConfig; ctx: SectionContext }) {
  const img = mediaUrl(config.mediaId ?? null, ctx.tenantSlug);
  const items = config.items ?? [];
  const hasLead = Boolean(config.heading || config.subheading || (config.ctas ?? []).length);

  return (
    <section className="py-16">
      {img ? (
        <div
          className="rounded-box bg-base-200 mb-8 aspect-[21/9] bg-cover bg-center"
          style={{
            backgroundImage: `url("${img}")`,
            backgroundSize: config.imageFit === 'contain' ? 'contain' : 'cover',
            backgroundPosition: focalToPosition(config.imageFocal),
          }}
        />
      ) : null}
      <div className="mx-auto flex w-full max-w-6xl flex-wrap items-center justify-between gap-x-12 gap-y-6 px-6">
        {hasLead ? (
          <div className="grid max-w-[46ch] gap-3">
            {config.heading ? (
              <h2 className="text-base-content text-3xl font-semibold tracking-tight">
                {config.heading}
              </h2>
            ) : null}
            {config.subheading ? <p className="text-base-content">{config.subheading}</p> : null}
            <SbCtaRow ctas={config.ctas} />
          </div>
        ) : null}
        {items.length ? (
          <div className={`grid gap-x-10 gap-y-6 ${STAT_COLS[config.columns] ?? STAT_COLS[3]}`}>
            {items.map((s, i) => (
              <div key={i} className="grid gap-[0.15rem]">
                <StatValue value={s.value} animate={config.animate} />
                <span className="text-base-content text-[0.9rem]">{s.label}</span>
              </div>
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
