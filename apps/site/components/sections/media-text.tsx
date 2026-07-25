// Media + text section — an image column beside a text column (eyebrow /
// heading / body / CTAs). The image side and background are configurable;
// stacks to one column on narrow screens (CSS).

import type { MediaTextConfig } from '@sparx/sitebuilder-schemas';
import { focalToPosition } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow } from './_shared';

export function MediaTextSection({
  config,
  ctx,
}: {
  config: MediaTextConfig;
  ctx: SectionContext;
}) {
  const img = mediaUrl(config.mediaId ?? null, ctx.tenantSlug);
  const position = focalToPosition(config.imageFocal);

  // Two-column band; collapses to a single column below 760px. Full-bleed runs
  // edge-to-edge (no container, no gap, stretched rows, self-padded text).
  const gridCls = config.fullBleed
    ? 'grid grid-cols-2 items-stretch gap-0 max-[760px]:grid-cols-1'
    : 'mx-auto grid w-full max-w-6xl grid-cols-2 items-center gap-[clamp(1.5rem,4vw,3.5rem)] px-6 max-[760px]:grid-cols-1';
  const imgCls = config.fullBleed
    ? 'h-full min-h-[340px] w-full bg-base-200 bg-cover bg-center'
    : 'aspect-[4/3] w-full rounded-box bg-base-200 bg-cover bg-center';
  const textCls = config.fullBleed
    ? 'grid gap-4 p-[clamp(2rem,5vw,4rem)] max-[760px]:p-[clamp(1.5rem,5vw,2.5rem)]'
    : 'grid gap-4';

  const grid = (
    <div className={gridCls}>
      <div
        className={config.mediaSide === 'left' ? 'order-[-1] max-[760px]:order-none' : undefined}
      >
        {img ? (
          <div
            className={imgCls}
            style={{
              backgroundImage: `url("${img}")`,
              backgroundSize: config.imageFit === 'contain' ? 'contain' : 'cover',
              backgroundPosition: position,
            }}
          />
        ) : null}
      </div>
      <div className={textCls}>
        {config.eyebrow ? (
          <p className="text-base-content m-0 text-[0.8rem] font-semibold tracking-[0.07em] uppercase">
            {config.eyebrow}
          </p>
        ) : null}
        {config.heading ? (
          <h2 className="text-base-content text-3xl font-semibold tracking-tight">
            {config.heading}
          </h2>
        ) : null}
        {config.body ? (
          <p className="text-base-content m-0 leading-relaxed">{config.body}</p>
        ) : null}
        <SbCtaRow ctas={config.ctas} />
      </div>
    </div>
  );

  return (
    <section className={`py-16 ${config.background === 'subtle' ? 'bg-base-200' : ''}`}>
      {grid}
    </section>
  );
}
