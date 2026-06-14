// Image banner section — an image with an overlay scrim, optional eyebrow /
// heading / copy, and up to two CTAs. Height, alignment, text color, and a
// full-bleed (edge-to-edge) toggle come from config.

import type { ImageBannerConfig } from '@sparx/sitebuilder-schemas';
import { focalToPosition } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow, resolveCtas } from './_shared';

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

  const textBlock = (
    <>
      {config.eyebrow ? <p className="st-sb-banner__eyebrow">{config.eyebrow}</p> : null}
      {config.heading ? <h2 className="st-sb-banner__title">{config.heading}</h2> : null}
      {config.subheading ? <p className="st-sb-banner__sub">{config.subheading}</p> : null}
    </>
  );

  const banner = (
    <div
      className="st-sb-banner"
      data-height={config.height}
      data-align={config.align}
      data-valign={config.verticalAlign}
      data-text={config.textColor}
      data-fullbleed={config.fullBleed ? 'true' : 'false'}
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
        <div className="st-sb-banner__scrim" style={{ opacity: overlay }} aria-hidden="true" />
      ) : null}
      {hasText ? (
        <div className="st-sb-banner__inner">
          {isSplit ? (
            <>
              <div className="st-sb-banner__group st-sb-banner__group--top">{textBlock}</div>
              {ctas.length ? (
                <div className="st-sb-banner__group st-sb-banner__group--bottom">
                  <SbCtaRow ctas={ctas} />
                </div>
              ) : null}
            </>
          ) : (
            <>
              {textBlock}
              <SbCtaRow ctas={ctas} />
            </>
          )}
        </div>
      ) : null}
    </div>
  );

  return config.fullBleed ? (
    <section className="st-section st-section--flush">{banner}</section>
  ) : (
    <section className="st-container st-section">{banner}</section>
  );
}
