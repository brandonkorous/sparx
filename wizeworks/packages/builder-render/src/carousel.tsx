'use client';

// The storefront Carousel (docs/45). The renderer renders each Carousel child into
// a slide and hands them here as `slides`; this component owns only the runtime
// concerns a server component can't: the active-index state, autoplay timer,
// arrows, and dots.
//
// Pure CSS transform for the transition (no animation library) so it stays
// themeable and light — the track translates by -index * 100%.
//
// Used by BOTH render surfaces (docs/builder/02): the live storefront and the
// editor canvas. In the canvas (EditModeContext) the autoplay TIMER is suppressed
// — a slide auto-advancing every few seconds would fight the author trying to
// select a slide's contents — while the arrows, dots, and track stay live so the
// preview still reads as the real, navigable carousel. Slides are always mounted
// (translated off-screen), so every slide stays selectable from the Layers tree.

import * as React from 'react';

import { useEditMode } from './runtime-context';

export interface BuilderCarouselProps {
  slides: React.ReactNode[];
  autoplay?: boolean;
  /** Seconds per slide when autoplaying. */
  interval?: number;
  arrows?: boolean;
  dots?: boolean;
}

export function BuilderCarousel({
  slides,
  autoplay = true,
  interval = 6,
  arrows = true,
  dots = true,
}: BuilderCarouselProps) {
  const editMode = useEditMode();
  const count = slides.length;
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const go = React.useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count]
  );

  // Autoplay runs on the live storefront only; in the editor canvas the timer is
  // suppressed so it doesn't advance under the author's cursor.
  const autoplaying = autoplay && !editMode;
  React.useEffect(() => {
    if (!autoplaying || paused || count <= 1) return;
    const ms = Math.max(2, interval) * 1000;
    const t = setInterval(() => setIndex((p) => (p + 1) % count), ms);
    return () => clearInterval(t);
  }, [autoplaying, paused, interval, count]);

  if (count === 0) return null;
  if (count === 1) return <div className="bx-carousel">{slides[0]}</div>;

  return (
    <div
      className="bx-carousel"
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="bx-carousel__track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => (
          <div className="bx-carousel__slide" key={i} aria-hidden={i !== index}>
            {slide}
          </div>
        ))}
      </div>

      {arrows ? (
        <>
          <button
            type="button"
            className="bx-carousel__arrow bx-carousel__arrow--prev"
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path
                d="M15 18l-6-6 6-6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
          <button
            type="button"
            className="bx-carousel__arrow bx-carousel__arrow--next"
            aria-label="Next slide"
            onClick={() => go(index + 1)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden>
              <path
                d="M9 6l6 6-6 6"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </button>
        </>
      ) : null}

      {dots ? (
        <div className="bx-carousel__dots">
          {slides.map((_, i) => (
            <button
              type="button"
              key={i}
              className="bx-carousel__dot"
              data-on={i === index}
              aria-label={`Go to slide ${i + 1}`}
              aria-current={i === index}
              onClick={() => go(i)}
            />
          ))}
        </div>
      ) : null}
    </div>
  );
}
