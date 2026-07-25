'use client';

// Carousel section — a swipeable, scroll-snap slider of full-bleed media
// slides with overlaid content + CTAs, plus optional autoplay, arrows, and dots.
// Native horizontal scroll-snap does the heavy lifting (so it swipes without JS);
// this island adds arrow/dot controls, active-slide tracking, and autoplay.

import { useCallback, useEffect, useRef, useState } from 'react';

import type { CarouselConfig } from '@sparx/sitebuilder-schemas';
import { focalToPosition } from '@sparx/sitebuilder-schemas';

import { mediaUrl } from '@/lib/media';
import type { SectionContext } from '../section-renderer';
import { SbCtaRow } from './_shared';

// Fixed slide height (min == max, locks to a viewport fraction).
const HEIGHT: Record<string, string> = {
  sm: 'min-h-[25svh] max-h-[25svh]',
  md: 'min-h-[50svh] max-h-[50svh]',
  lg: 'min-h-[75svh] max-h-[75svh]',
  screen: 'min-h-[100svh] max-h-[100svh]',
};
// Vertical placement of a slide's content (default bottom).
const VALIGN: Record<string, string> = {
  top: 'items-start',
  center: 'items-center',
  bottom: 'items-end',
};
// Horizontal placement + text alignment of the content block (default left).
const ALIGN: Record<string, string> = {
  left: 'justify-items-start text-left',
  center: 'justify-items-center text-center',
  right: 'justify-items-end text-right',
};
// Over-photo pill treatment for a slide's CTA buttons.
const CTA_PILL = '[&>*]:min-w-[12rem] [&>*]:rounded-full';

function Chevron({ dir }: { dir: 'prev' | 'next' }) {
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      aria-hidden="true"
    >
      <path
        d={dir === 'prev' ? 'M15 6l-6 6 6 6' : 'M9 6l6 6-6 6'}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function CarouselSection({ config, ctx }: { config: CarouselConfig; ctx: SectionContext }) {
  const items = config.items ?? [];
  const trackRef = useRef<HTMLDivElement>(null);
  const indexRef = useRef(0);
  const pausedRef = useRef(false);
  const [index, setIndex] = useState(0);
  const overlay = Math.min(100, Math.max(0, config.overlayOpacity)) / 100;

  useEffect(() => {
    indexRef.current = index;
  }, [index]);

  const scrollToIndex = useCallback((i: number) => {
    const track = trackRef.current;
    if (!track) return;
    const count = track.children.length;
    if (count === 0) return;
    const clamped = ((i % count) + count) % count;
    const slide = track.children[clamped] as HTMLElement;
    track.scrollTo({ left: slide.offsetLeft, behavior: 'smooth' });
    setIndex(clamped);
  }, []);

  // Track the centered slide as the user swipes/scrolls.
  useEffect(() => {
    const track = trackRef.current;
    if (!track) return;
    let raf = 0;
    const onScroll = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        const center = track.scrollLeft + track.clientWidth / 2;
        let best = 0;
        let bestDist = Infinity;
        Array.from(track.children).forEach((c, i) => {
          const el = c as HTMLElement;
          const mid = el.offsetLeft + el.clientWidth / 2;
          const dist = Math.abs(mid - center);
          if (dist < bestDist) {
            bestDist = dist;
            best = i;
          }
        });
        setIndex(best);
      });
    };
    track.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      track.removeEventListener('scroll', onScroll);
      cancelAnimationFrame(raf);
    };
  }, []);

  // Autoplay — advances on an interval, paused on hover/focus and when reduced
  // motion is requested.
  useEffect(() => {
    if (!config.autoplay || items.length < 2) return;
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const id = window.setInterval(() => {
      if (!pausedRef.current) scrollToIndex(indexRef.current + 1);
    }, config.intervalSec * 1000);
    return () => window.clearInterval(id);
  }, [config.autoplay, config.intervalSec, items.length, scrollToIndex]);

  if (items.length === 0) return null;
  const multi = items.length > 1;

  return (
    <section className="relative">
      {config.heading ? (
        <div className="mx-auto flex w-full max-w-6xl items-end justify-between gap-4 px-6 pt-[clamp(1.5rem,3vw,2.5rem)] pb-4">
          <h2 className="text-base-content text-3xl font-semibold tracking-tight">
            {config.heading}
          </h2>
        </div>
      ) : null}
      <div
        className="relative isolate"
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
        onFocusCapture={() => (pausedRef.current = true)}
        onBlurCapture={() => (pausedRef.current = false)}
      >
        <div
          className="flex snap-x snap-mandatory overflow-x-auto scroll-smooth [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          ref={trackRef}
        >
          {items.map((s, i) => {
            const img = mediaUrl(s.mediaId ?? null, ctx.tenantSlug);
            return (
              <div
                key={i}
                className={`bg-base-200 relative flex min-w-full flex-[0_0_100%] snap-start items-end overflow-hidden bg-cover bg-center py-[clamp(2.5rem,6vw,5rem)] ${
                  config.textColor === 'dark' ? 'text-base-content' : 'text-white'
                } ${HEIGHT[config.height] ?? ''} ${VALIGN[config.verticalAlign] ?? VALIGN.bottom}`}
                style={
                  img
                    ? {
                        backgroundImage: `url("${img}")`,
                        backgroundSize: s.imageFit === 'contain' ? 'contain' : 'cover',
                        backgroundPosition: focalToPosition(s.imageFocal),
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
                <div
                  className={`relative z-[1] mx-auto grid w-full max-w-6xl gap-4 px-6 ${
                    ALIGN[config.align] ?? ALIGN.left
                  }`}
                >
                  {s.eyebrow ? (
                    <p className="m-0 text-sm font-semibold tracking-[0.08em] uppercase">
                      {s.eyebrow}
                    </p>
                  ) : null}
                  {s.heading ? (
                    <h3 className="m-0 max-w-[18ch] text-[clamp(2rem,4.5vw,3.25rem)] leading-[1.06] font-bold tracking-[-0.03em]">
                      {s.heading}
                    </h3>
                  ) : null}
                  {s.subheading ? (
                    <p className="m-0 max-w-[48ch] text-[clamp(1rem,1.8vw,1.2rem)] leading-normal">
                      {s.subheading}
                    </p>
                  ) : null}
                  <SbCtaRow ctas={s.ctas} layout={config.ctaLayout} className={CTA_PILL} />
                </div>
              </div>
            );
          })}
        </div>

        {config.showArrows && multi ? (
          <>
            <button
              type="button"
              className="border-base-300 bg-base-100/90 text-base-content hover:bg-base-100 absolute top-1/2 left-[clamp(0.75rem,2vw,1.5rem)] z-[2] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border transition active:scale-95 max-[640px]:h-[38px] max-[640px]:w-[38px]"
              aria-label="Previous slide"
              onClick={() => scrollToIndex(index - 1)}
            >
              <Chevron dir="prev" />
            </button>
            <button
              type="button"
              className="border-base-300 bg-base-100/90 text-base-content hover:bg-base-100 absolute top-1/2 right-[clamp(0.75rem,2vw,1.5rem)] z-[2] inline-flex h-11 w-11 -translate-y-1/2 items-center justify-center rounded-full border transition active:scale-95 max-[640px]:h-[38px] max-[640px]:w-[38px]"
              aria-label="Next slide"
              onClick={() => scrollToIndex(index + 1)}
            >
              <Chevron dir="next" />
            </button>
          </>
        ) : null}

        {config.showDots && multi ? (
          <div
            className="absolute bottom-4 left-1/2 z-[2] flex -translate-x-1/2 gap-2"
            role="tablist"
            aria-label="Slides"
          >
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                className="bg-base-100/60 data-[active=true]:bg-base-100 h-[9px] w-[9px] rounded-full border-none p-0 transition data-[active=true]:scale-125"
                data-active={i === index}
                aria-label={`Go to slide ${i + 1}`}
                aria-current={i === index}
                onClick={() => scrollToIndex(i)}
              />
            ))}
          </div>
        ) : null}
      </div>
    </section>
  );
}
