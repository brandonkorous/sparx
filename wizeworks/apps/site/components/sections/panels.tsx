// Panels section — a row of 1–4 self-contained panels. Two variants:
//  • media: a full-bleed photo card with overlaid eyebrow/heading/copy/CTAs at a
//    configurable anchor (the recurring 2-up "feature card row").
//  • card:  a light surface card — image on top, content below.
// Stacks to one column on narrow screens (CSS).

import type { PanelsConfig } from '@wizeworks/sitebuilder-schemas';
import { focalToPosition } from '@wizeworks/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow } from './_shared';

// Panel column count → responsive grid (mobile 1-up; 3/4 collapse to 2 in the
// mid band, drop to 1 below 640px).
const PANEL_COLS: Record<number, string> = {
  1: 'grid-cols-1',
  2: 'grid-cols-1 min-[641px]:grid-cols-2',
  3: 'grid-cols-1 min-[641px]:grid-cols-2 min-[901px]:grid-cols-3',
  4: 'grid-cols-1 min-[641px]:grid-cols-2 min-[901px]:grid-cols-4',
};
// Media-panel height floors.
const HEIGHT: Record<string, string> = {
  sm: 'min-h-[320px]',
  md: 'min-h-[440px]',
  lg: 'min-h-[560px]',
};
// Vertical placement of a media panel's content (default bottom).
const VALIGN: Record<string, string> = {
  top: 'items-start',
  center: 'items-center',
  bottom: 'items-end',
};
// Horizontal placement + text alignment of a media panel (default left).
const ALIGN: Record<string, string> = {
  left: '',
  center: 'justify-center text-center',
  right: 'justify-end text-right',
};

export function PanelsSection({ config, ctx }: { config: PanelsConfig; ctx: SectionContext }) {
  const items = config.items ?? [];
  if (items.length === 0) return null;
  const overlay = Math.min(100, Math.max(0, config.overlayOpacity)) / 100;
  const isMedia = config.variant === 'media';

  return (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">
      {config.heading ? (
        <div className="mb-7 flex items-end justify-between gap-4">
          <h2 className="text-base-content text-3xl font-semibold tracking-tight">
            {config.heading}
          </h2>
        </div>
      ) : null}
      <div className={`grid gap-6 ${PANEL_COLS[config.columns] ?? PANEL_COLS[2]}`}>
        {items.map((p, i) => {
          const img = mediaUrl(p.mediaId ?? null, ctx.tenantSlug);
          const bg = img
            ? {
                backgroundImage: `url("${img}")`,
                backgroundSize: p.imageFit === 'contain' ? 'contain' : 'cover',
                backgroundPosition: focalToPosition(p.imageFocal),
              }
            : undefined;
          const innerCls = isMedia
            ? `relative z-[1] grid gap-3 ${
                config.align === 'center' ? 'justify-items-center' : 'max-w-[32ch]'
              }`
            : 'grid gap-3 p-[clamp(1.25rem,2.5vw,1.75rem)]';
          const content = (
            <div className={innerCls}>
              {p.eyebrow ? (
                <p className="m-0 text-[0.78rem] font-semibold tracking-[0.07em] uppercase">
                  {p.eyebrow}
                </p>
              ) : null}
              {p.heading ? (
                <h3 className="m-0 text-[clamp(1.5rem,2.6vw,2.1rem)] font-semibold tracking-[-0.02em]">
                  {p.heading}
                </h3>
              ) : null}
              {p.subheading ? <p className="m-0 leading-snug">{p.subheading}</p> : null}
              <SbCtaRow
                ctas={p.ctas}
                className={isMedia ? 'mt-1 [&>*]:min-w-[12rem] [&>*]:rounded-full' : 'mt-1'}
              />
            </div>
          );

          if (isMedia) {
            return (
              <div
                key={i}
                className={`rounded-box bg-base-200 relative isolate flex items-end overflow-hidden bg-cover bg-center p-[clamp(1.25rem,2.5vw,2rem)] ${
                  config.textColor === 'dark' ? 'text-base-content' : 'text-white'
                } ${HEIGHT[config.height] ?? ''} ${VALIGN[config.verticalAlign] ?? VALIGN.bottom} ${
                  ALIGN[config.align] ?? ''
                }`}
                style={bg}
              >
                {img ? (
                  <div
                    className="absolute inset-0 z-0 bg-black"
                    style={{ opacity: overlay }}
                    aria-hidden="true"
                  />
                ) : null}
                {/* Fixed bottom-up legibility scrim so bottom-anchored content stays
                    readable regardless of the configurable flat scrim's opacity. */}
                <div
                  className="pointer-events-none absolute inset-0 z-0 bg-linear-to-t from-black/50 to-transparent to-[55%]"
                  aria-hidden="true"
                />
                {content}
              </div>
            );
          }

          return (
            <div
              key={i}
              className="rounded-box border-base-300 bg-base-100 flex flex-col overflow-hidden border"
            >
              {img ? (
                <div className="bg-base-200 aspect-[16/10] bg-cover bg-center" style={bg} />
              ) : null}
              {content}
            </div>
          );
        })}
      </div>
    </section>
  );
}
