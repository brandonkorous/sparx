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
    <section className="st-sb-carousel-section">
      {config.heading ? (
        <div className="st-container st-section__head">
          <h2 className="st-h2">{config.heading}</h2>
        </div>
      ) : null}
      <div
        className="st-sb-carousel"
        onMouseEnter={() => (pausedRef.current = true)}
        onMouseLeave={() => (pausedRef.current = false)}
        onFocusCapture={() => (pausedRef.current = true)}
        onBlurCapture={() => (pausedRef.current = false)}
      >
        <div className="st-sb-carousel__track" ref={trackRef}>
          {items.map((s, i) => {
            const img = mediaUrl(s.mediaId ?? null, ctx.tenantSlug);
            return (
              <div
                key={i}
                className="st-sb-carousel__slide"
                data-align={config.align}
                data-valign={config.verticalAlign}
                data-text={config.textColor}
                data-height={config.height}
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
                    className="st-sb-carousel__scrim"
                    style={{ opacity: overlay }}
                    aria-hidden="true"
                  />
                ) : null}
                <div className="st-container st-sb-carousel__inner">
                  {s.eyebrow ? <p className="st-sb-carousel__eyebrow">{s.eyebrow}</p> : null}
                  {s.heading ? <h3 className="st-sb-carousel__title">{s.heading}</h3> : null}
                  {s.subheading ? <p className="st-sb-carousel__sub">{s.subheading}</p> : null}
                  <SbCtaRow ctas={s.ctas} layout={config.ctaLayout} />
                </div>
              </div>
            );
          })}
        </div>

        {config.showArrows && multi ? (
          <>
            <button
              type="button"
              className="st-sb-carousel__arrow st-sb-carousel__arrow--prev"
              aria-label="Previous slide"
              onClick={() => scrollToIndex(index - 1)}
            >
              <Chevron dir="prev" />
            </button>
            <button
              type="button"
              className="st-sb-carousel__arrow st-sb-carousel__arrow--next"
              aria-label="Next slide"
              onClick={() => scrollToIndex(index + 1)}
            >
              <Chevron dir="next" />
            </button>
          </>
        ) : null}

        {config.showDots && multi ? (
          <div className="st-sb-carousel__dots" role="tablist" aria-label="Slides">
            {items.map((_, i) => (
              <button
                key={i}
                type="button"
                className="st-sb-carousel__dot"
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
