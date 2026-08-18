'use client';

// Lightbox island (docs/103 Phase 6e). A gallery whose thumbnails open a
// full-screen viewer.
//
// The overlay itself is silicaui's `Lightbox` — it owns the backdrop, the portal,
// prev/next, the counter, the close button, arrow keys and Esc. What stays here is
// the part that is specific to BUILDER NODES: the thumbnails are ordinary,
// editable Image nodes the author dropped, so the island reads the slide sources
// out of its own rendered `<img>`s rather than taking an authored list. Nothing
// special to author, and the grid keeps working as a normal builder container.
//
//   · live — clicking a thumbnail opens the overlay.
//   · edit — just the thumbnail grid; no overlay ever pops over the editor canvas.

import * as React from 'react';
import { Lightbox, cx, type LightboxItem } from '@wizeworks/silicaui-react';

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
  const [index, setIndex] = React.useState<number | null>(null);
  const [slides, setSlides] = React.useState<LightboxItem[]>([]);

  // Open the viewer at thumbnail `start`, snapshotting every thumbnail's src/alt
  // from the rendered grid — so the enlarged view matches whatever was dropped,
  // including a bound image resolved at request time.
  const openAt = (start: number): void => {
    const host = gridRef.current;
    if (!host) return;
    const imgs = Array.from(host.querySelectorAll('img'));
    setSlides(imgs.map((el) => ({ src: el.currentSrc || el.src, alt: el.alt })));
    setIndex(start);
  };

  // Edit: render the thumbnails directly so they stay selectable builder nodes.
  // Live: wrap each in a real <button> so the gallery is keyboard-operable
  // (Tab + Enter) and the viewer opens on activation.
  const grid = edit
    ? children
    : React.Children.map(children, (child, i) => (
        <button
          type="button"
          className="rounded-box block cursor-zoom-in overflow-hidden"
          aria-label={`View image ${i + 1}`}
          onClick={() => openAt(i)}
        >
          {child}
        </button>
      ));

  return (
    <>
      <div ref={gridRef} className={cx('grid gap-3', leafClass)}>
        {grid}
      </div>
      {edit ? null : <Lightbox items={slides} index={index} onIndexChange={setIndex} />}
    </>
  );
}
