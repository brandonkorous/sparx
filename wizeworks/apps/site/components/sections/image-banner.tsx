// Image banner section — an image with an overlay scrim, optional eyebrow /
// heading / copy, and up to two CTAs. Height, alignment, text color, and a
// full-bleed (edge-to-edge) toggle come from config.

import type { ImageBannerConfig } from '@wizeworks/sitebuilder-schemas';
import { focalToPosition } from '@wizeworks/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow, resolveCtas } from './_shared';

// Fixed banner height (min == max, locks to a viewport fraction).
const HEIGHT: Record<string, string> = {
  sm: 'min-h-[25svh] max-h-[25svh]',
  md: 'min-h-[50svh] max-h-[50svh]',
  lg: 'min-h-[75svh] max-h-[75svh]',
  screen: 'min-h-[100svh] max-h-[100svh]',
};
// Vertical placement of the content block. `split` stretches so its two groups
// can pin top + bottom.
const VALIGN: Record<string, string> = {
  top: 'items-start',
  center: 'items-center',
  bottom: 'items-end',
  split: 'items-stretch',
};
// Horizontal placement + text alignment of the banner.
const ALIGN: Record<string, string> = {
  left: '',
  center: 'justify-center text-center',
  right: 'justify-end text-right',
};
// Cross-axis alignment inside the (grid) content block.
const INNER_ALIGN: Record<string, string> = {
  left: '',
  center: 'justify-items-center',
  right: 'justify-items-end',
};
// Over-photo pill treatment for the CTA buttons (banners always read over media).
const CTA_PILL = '[&>*]:min-w-[12rem] [&>*]:rounded-full';

export function ImageBannerSection({
  config,
  ctx,
}: {
  config: ImageBannerConfig;
  ctx: SectionContext;
}) {
  const img = mediaUrl(config.imageMediaId ?? null, ctx.tenantSlug);
  const overlay = Math.min(100, Math.max(0, config.overlayOpacity)) / 100;
  const ctas = resolveCtas(config);
  const hasText = Boolean(config.eyebrow || config.heading || config.subheading || ctas.length);
  // `split` pins the text to the top and the CTAs to the bottom of a full-height
  // section (the Tesla-style model section). Otherwise everything stacks together.
  const isSplit = config.verticalAlign === 'split';

  const groupAlign = INNER_ALIGN[config.align] ?? '';
  const textBlock = (
    <>
      {config.eyebrow ? (
        <p className="m-0 text-[0.8rem] font-semibold tracking-[0.08em] uppercase">
          {config.eyebrow}
        </p>
      ) : null}
      {config.heading ? (
        <h2 className="m-0 text-[clamp(1.75rem,4vw,2.75rem)] font-semibold tracking-[-0.02em]">
          {config.heading}
        </h2>
      ) : null}
      {config.subheading ? <p className="m-0 leading-normal">{config.subheading}</p> : null}
    </>
  );

  const banner = (
    <div
      className={`bg-base-200 relative isolate flex overflow-hidden bg-cover bg-center p-[clamp(1.5rem,4vw,3rem)] ${
        config.fullBleed ? 'rounded-none' : 'rounded-box'
      } ${config.textColor === 'dark' ? 'text-base-content' : 'text-white'} ${
        HEIGHT[config.height] ?? ''
      } ${VALIGN[config.verticalAlign] ?? VALIGN.center} ${ALIGN[config.align] ?? ''}`}
      style={
        img
          ? {
              backgroundImage: `url("${img}")`,
              backgroundSize: config.imageFit === 'contain' ? 'contain' : 'cover',
              backgroundPosition: focalToPosition(config.imageFocal),
            }
          : undefined
      }
    >
      {img ? (
        <div
          className="absolute inset-0 z-0 bg-black"
          style={{ opacity: overlay }}
          aria-hidden="true"
        />
      ) : null}
      {hasText ? (
        isSplit ? (
          <div className="relative z-[1] flex w-full flex-col justify-between gap-6 self-stretch">
            <div className={`grid gap-3 pt-[clamp(0.5rem,4vh,3rem)] ${groupAlign}`}>
              {textBlock}
            </div>
            {ctas.length ? (
              <div className={`grid gap-3 pb-[clamp(0.5rem,3vh,2rem)] ${groupAlign}`}>
                <SbCtaRow ctas={ctas} className={CTA_PILL} />
              </div>
            ) : null}
          </div>
        ) : (
          <div className={`relative z-[1] grid max-w-[46ch] gap-4 ${groupAlign}`}>
            {textBlock}
            <SbCtaRow ctas={ctas} className={CTA_PILL} />
          </div>
        )
      ) : null}
    </div>
  );

  return config.fullBleed ? (
    <section className="py-16">{banner}</section>
  ) : (
    <section className="mx-auto w-full max-w-6xl px-6 py-16">{banner}</section>
  );
}
