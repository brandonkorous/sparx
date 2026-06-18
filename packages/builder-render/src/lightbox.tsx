'use client';

// Lightbox island (docs/103 Phase 6e). A gallery whose thumbnails open a full-screen
// viewer. Like the Dialog island, the full-viewport overlay CAN'T be a catalog class
// (the compile allowlist denies fixed center-overlays — clickjacking guard), so it is
// platform-authored here against the `st-lightbox` CSS. The island reads image srcs
// from its OWN rendered <img>s, so the thumbnails stay ordinary, editable Image nodes
// (the dropped children) — nothing special to author.
//
//   · live — clicking a thumbnail opens the overlay (prev / next / close + arrow keys
//             + Esc + backdrop click).
//   · edit — just the thumbnail grid; no overlay ever pops over the editor canvas.

import * as React from 'react';
import { BuilderIcon } from './icon';

function cx(...parts: (string | false | null | undefined)[]): string {
  return parts.filter(Boolean).join(' ');
}

interface Slide {
  src: string;
  alt: string;
}

export interface BuilderLightboxProps {
  /** node.class — the thumbnail grid layout (CLASS_ON_LEAF passes it here). */
  leafClass?: string;
  edit: boolean;
  /** The dropped thumbnail nodes (Image atoms), pre-rendered by the host walker. */
  children?: React.ReactNode;
}

export function BuilderLightbox({
  leafClass,
  edit,
  children,
}: BuilderLightboxProps): React.ReactElement {
  const gridRef = React.useRef<HTMLDivElement>(null);
  const [open, setOpen] = React.useState(false);
  const [index, setIndex] = React.useState(0);
  const [slides, setSlides] = React.useState<Slide[]>([]);

  // Open the viewer at thumbnail `start`, snapshotting every thumbnail's src/alt from
  // the rendered grid (so the enlarged view matches whatever the author dropped).
  const openAt = (start: number): void => {
    const host = gridRef.current;
    if (!host) return;
    const imgs = Array.from(host.querySelectorAll('img'));
    setSlides(imgs.map((el) => ({ src: el.currentSrc || el.src, alt: el.alt })));
    setIndex(start);
    setOpen(true);
  };

  const go = (delta: number): void => setIndex((i) => i + delta);

  React.useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key === 'Escape') setOpen(false);
      else if (e.key === 'ArrowLeft') setIndex((i) => i - 1);
      else if (e.key === 'ArrowRight') setIndex((i) => i + 1);
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [open]);

  const count = slides.length;
  const current = count ? slides[((index % count) + count) % count] : undefined;

  // Edit: render the thumbnails directly so they stay selectable builder nodes (and no
  // overlay pops over the canvas). Live: wrap each in a real <button> so the gallery is
  // keyboard-operable (Tab + Enter), and the viewer opens on activation.
  const grid = edit
    ? children
    : React.Children.map(children, (child, i) => (
        <button
          type="button"
          className="st-lightbox-thumb"
          aria-label={`View image ${i + 1}`}
          onClick={() => openAt(i)}
        >
          {child}
        </button>
      ));

  return (
    <>
      <div ref={gridRef} className={cx('st-lightbox-grid', leafClass)}>
        {grid}
      </div>
      {open && current && !edit ? (
        // The viewer is keyboard-operable via the close button + Esc + arrow keys; the
        // backdrop click is a redundant mouse affordance, so the static-element rule is
        // not meaningful here.
        // eslint-disable-next-line jsx-a11y/no-noninteractive-element-interactions, jsx-a11y/click-events-have-key-events
        <div
          className="st-lightbox"
          role="dialog"
          aria-modal="true"
          aria-label="Image viewer"
          onClick={(e) => {
            if (e.target === e.currentTarget) setOpen(false);
          }}
        >
          <button
            type="button"
            className="st-lightbox__close"
            aria-label="Close"
            onClick={() => setOpen(false)}
          >
            <BuilderIcon name="x" />
          </button>
          {count > 1 ? (
            <button
              type="button"
              className="st-lightbox__nav st-lightbox__nav--prev"
              aria-label="Previous image"
              onClick={() => go(-1)}
            >
              ‹
            </button>
          ) : null}
          <img className="st-lightbox__img" src={current.src} alt={current.alt} />
          {count > 1 ? (
            <button
              type="button"
              className="st-lightbox__nav st-lightbox__nav--next"
              aria-label="Next image"
              onClick={() => go(1)}
            >
              ›
            </button>
          ) : null}
        </div>
      ) : null}
    </>
  );
}
