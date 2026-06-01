// Hero section — full-width banner with an optional image/video background, an
// overlay scrim, eyebrow/heading/subheading, and up to two CTAs. Height,
// alignment (horizontal + vertical), and text color come from the config.

import type { HeroConfig } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow, resolveCtas } from './_shared';

export function HeroSection({ config, ctx }: { config: HeroConfig; ctx: SectionContext }) {
  const bg = mediaUrl(config.backgroundMediaId ?? null, ctx.tenantSlug);
  const overlay = Math.min(100, Math.max(0, config.overlayOpacity)) / 100;
  const ctas = resolveCtas(config);
  const isVideo = config.mediaType === 'video' && Boolean(bg);

  return (
    <section
      className="sf-sb-hero"
      data-align={config.align}
      data-valign={config.verticalAlign}
      data-height={config.height}
      data-text={config.textColor}
      data-has-bg={bg ? 'true' : 'false'}
      style={bg && !isVideo ? { backgroundImage: `url("${bg}")` } : undefined}
    >
      {isVideo ? (
        <video
          className="sf-sb-hero__video"
          autoPlay
          muted
          loop
          playsInline
          src={bg ?? undefined}
          aria-hidden="true"
        />
      ) : null}
      {bg ? (
        <div className="sf-sb-hero__scrim" style={{ opacity: overlay }} aria-hidden="true" />
      ) : null}
      <div className="sf-container sf-sb-hero__inner">
        {config.eyebrow ? <p className="sf-sb-hero__eyebrow">{config.eyebrow}</p> : null}
        {config.heading ? <h1 className="sf-sb-hero__title">{config.heading}</h1> : null}
        {config.subheading ? <p className="sf-sb-hero__sub">{config.subheading}</p> : null}
        <SbCtaRow ctas={ctas} size="lg" />
      </div>
      {config.showScrollHint ? (
        <span className="sf-sb-hero__scroll-hint" aria-hidden="true">
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </section>
  );
}
