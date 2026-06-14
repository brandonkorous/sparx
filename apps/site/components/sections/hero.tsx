// Hero section — full-width banner with an optional image/video background, an
// overlay scrim, eyebrow/heading/subheading, and up to two CTAs. Height,
// alignment (horizontal + vertical), and text color come from the config.

import type { CSSProperties } from 'react';

import type { HeroConfig } from '@sparx/sitebuilder-schemas';
import { focalToPosition } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow, resolveCtas } from './_shared';

export function HeroSection({ config, ctx }: { config: HeroConfig; ctx: SectionContext }) {
  const bg = mediaUrl(config.backgroundMediaId ?? null, ctx.tenantSlug);
  const overlay = Math.min(100, Math.max(0, config.overlayOpacity)) / 100;
  const ctas = resolveCtas(config);
  const isVideo = config.mediaType === 'video' && Boolean(bg);
  const fit = config.imageFit === 'contain' ? 'contain' : 'cover';
  const position = focalToPosition(config.imageFocal);
  const zoom = typeof config.imageZoom === 'number' ? config.imageZoom : 1;
  // object-fit + object-position frame the crop; transform scales (zooms) around
  // the same focal point so punching in keeps the chosen subject centred.
  const mediaStyle: CSSProperties = {
    objectFit: fit,
    objectPosition: position,
    transform: zoom > 1 ? `scale(${zoom})` : undefined,
    transformOrigin: position,
  };

  return (
    <section
      className="st-sb-hero"
      data-align={config.align}
      data-valign={config.verticalAlign}
      data-height={config.height}
      data-text={config.textColor}
      data-has-bg={bg ? 'true' : 'false'}
      data-fullbleed={config.fullBleed ? 'true' : 'false'}
    >
      {isVideo ? (
        <video
          className="st-sb-hero__media"
          autoPlay
          muted
          loop
          playsInline
          src={bg ?? undefined}
          aria-hidden="true"
          style={mediaStyle}
        />
      ) : bg ? (
        <img className="st-sb-hero__media" src={bg} alt="" aria-hidden="true" style={mediaStyle} />
      ) : null}
      {bg ? (
        <div className="st-sb-hero__scrim" style={{ opacity: overlay }} aria-hidden="true" />
      ) : null}
      <div className={config.fullBleed ? 'st-sb-hero__inner' : 'st-container st-sb-hero__inner'}>
        {config.eyebrow ? <p className="st-sb-hero__eyebrow">{config.eyebrow}</p> : null}
        {config.heading ? <h1 className="st-sb-hero__title">{config.heading}</h1> : null}
        {config.subheading ? <p className="st-sb-hero__sub">{config.subheading}</p> : null}
        <SbCtaRow ctas={ctas} size="lg" layout={config.ctaLayout} />
      </div>
      {config.showScrollHint ? (
        <span className="st-sb-hero__scroll-hint" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </section>
  );
}
