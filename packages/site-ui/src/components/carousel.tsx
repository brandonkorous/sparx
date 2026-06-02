'use client';

// Carousel — the one interactive primitive (docs/46 §3.2, §5.2). CLIENT
// component: it owns the runtime concerns a server component can't — active
// index, autoplay timer, arrows, dots. Ported from the storefront's
// builder-carousel.tsx (bx-carousel → sf-carousel); the server renderer builds
// each child into a slide and hands them in as `slides`. Pure CSS-transform
// transition (no animation lib): the track translates by -index * 100%.

import * as React from 'react';
import { cx } from '../utils/cx';

export interface CarouselProps {
  slides: React.ReactNode[];
  autoplay?: boolean;
  /** Seconds per slide when autoplaying. */
  interval?: number;
  arrows?: boolean;
  dots?: boolean;
  className?: string;
}

export function Carousel({
  slides,
  autoplay = true,
  interval = 6,
  arrows = true,
  dots = true,
  className,
}: CarouselProps) {
  const count = slides.length;
  const [index, setIndex] = React.useState(0);
  const [paused, setPaused] = React.useState(false);

  const go = React.useCallback(
    (next: number) => setIndex(((next % count) + count) % count),
    [count]
  );

  React.useEffect(() => {
    if (!autoplay || paused || count <= 1) return;
    const ms = Math.max(2, interval) * 1000;
    const t = setInterval(() => setIndex((p) => (p + 1) % count), ms);
    return () => clearInterval(t);
  }, [autoplay, paused, interval, count]);

  if (count === 0) return null;
  if (count === 1) return <div className={cx('sf-carousel', className)}>{slides[0]}</div>;

  return (
    <div
      className={cx('sf-carousel', className)}
      onMouseEnter={() => setPaused(true)}
      onMouseLeave={() => setPaused(false)}
    >
      <div className="sf-carousel__track" style={{ transform: `translateX(-${index * 100}%)` }}>
        {slides.map((slide, i) => (
          <div className="sf-carousel__slide" key={i} aria-hidden={i !== index}>
            {slide}
          </div>
        ))}
      </div>

      {arrows ? (
        <>
          <button
            type="button"
            className={cx(
              'sf-carousel__arrow',
              'sf-carousel__arrow--prev',
              'sf-c-surface',
              'sf-v-glass'
            )}
            aria-label="Previous slide"
            onClick={() => go(index - 1)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
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
            className={cx(
              'sf-carousel__arrow',
              'sf-carousel__arrow--next',
              'sf-c-surface',
              'sf-v-glass'
            )}
            aria-label="Next slide"
            onClick={() => go(index + 1)}
          >
            <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true">
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
        <div className="sf-carousel__dots">
          {slides.map((_, i) => (
            <button
              type="button"
              key={i}
              className="sf-carousel__dot"
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
Carousel.displayName = 'Carousel';
