// Hero section — full-width banner with an optional image/video background, an
// overlay scrim, eyebrow/heading/subheading, and up to two CTAs. Height,
// alignment (horizontal + vertical), and text color come from the config.

import type { CSSProperties } from 'react';

import type { HeroConfig } from '@sparx/sitebuilder-schemas';
import { focalToPosition } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow, resolveCtas } from './_shared';

// Fixed section height (min == max, so the hero locks to a viewport fraction).
const HEIGHT: Record<string, string> = {
  sm: 'min-h-[25svh] max-h-[25svh]',
  md: 'min-h-[50svh] max-h-[50svh]',
  lg: 'min-h-[75svh] max-h-[75svh]',
  screen: 'min-h-[100svh] max-h-[100svh]',
};
// Vertical placement of the content block (default centered).
const VALIGN: Record<string, string> = {
  top: 'items-start',
  center: 'items-center',
  bottom: 'items-end',
};
// Horizontal placement + text alignment of the inner grid (default centered).
const ALIGN: Record<string, string> = {
  left: 'place-items-start text-left',
  center: 'place-items-center text-center',
  right: 'place-items-end text-right',
};

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

  // Media present (or an explicit light text color) reads over a photo/scrim, so
  // ink goes white; otherwise it's the themed base ink.
  const textCls = bg || config.textColor === 'light' ? 'text-white' : 'text-base-content';
  const innerAlign = ALIGN[config.align] ?? ALIGN.center;
  const inner = `relative z-[2] grid w-full gap-5 ${innerAlign}`;

  return (
    <section
      className={`relative isolate flex overflow-hidden py-[clamp(3rem,7vw,6rem)] ${
        VALIGN[config.verticalAlign] ?? VALIGN.center
      } ${HEIGHT[config.height] ?? ''} ${textCls}`}
    >
      {isVideo ? (
        <video
          className="absolute inset-0 z-0 h-full w-full object-cover"
          autoPlay
          muted
          loop
          playsInline
          src={bg ?? undefined}
          aria-hidden="true"
          style={mediaStyle}
        />
      ) : bg ? (
        <img
          className="absolute inset-0 z-0 h-full w-full object-cover"
          src={bg}
          alt=""
          aria-hidden="true"
          style={mediaStyle}
        />
      ) : null}
      {bg ? (
        <div
          className="absolute inset-0 z-[1] bg-black"
          style={{ opacity: overlay }}
          aria-hidden="true"
        />
      ) : null}
      <div
        className={
          config.fullBleed
            ? `${inner} px-[clamp(1.5rem,6vw,5rem)]`
            : `mx-auto w-full max-w-6xl px-6 ${inner}`
        }
      >
        {config.eyebrow ? (
          <p className="m-0 text-sm font-semibold tracking-[0.08em] uppercase">{config.eyebrow}</p>
        ) : null}
        {config.heading ? (
          <h1 className="m-0 max-w-[18ch] text-[clamp(2.25rem,5.5vw,4rem)] leading-[1.05] font-bold tracking-[-0.03em]">
            {config.heading}
          </h1>
        ) : null}
        {config.subheading ? (
          <p className="m-0 max-w-[52ch] text-[clamp(1.05rem,2vw,1.3rem)] leading-normal">
            {config.subheading}
          </p>
        ) : null}
        <SbCtaRow
          ctas={ctas}
          size="lg"
          layout={config.ctaLayout}
          className={bg ? '[&>*]:min-w-[12rem] [&>*]:rounded-full' : undefined}
        />
      </div>
      {config.showScrollHint ? (
        <span
          className="absolute bottom-6 left-1/2 z-[3] inline-flex -translate-x-1/2 animate-bounce"
          aria-hidden="true"
        >
          <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor">
            <path d="M6 9l6 6 6-6" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </span>
      ) : null}
    </section>
  );
}
