'use client';

// A horizontal strip with a chevron at each end when there is more of it
// off-screen.
//
// `overflow-x-auto` alone is a trap on a pane that can be dragged narrow: the
// content is reachable, but the only thing telling you it exists is a scrollbar
// the platform may not draw at all. A customer's tab strip ended at "Activity"
// with Documents and Details past the edge, so from the operator's side those
// two tabs simply did not exist.
//
// ══════════════════════════════════════════════════════════════════════════
// THIS IS A STOPGAP. SILICAUI ALREADY HAS IT, AND WE CANNOT INSTALL IT YET.
// ══════════════════════════════════════════════════════════════════════════
//
// `TabsList` upstream takes `scrollable` (default true) and `scrollLabel`, built
// on silica's own `ScrollStrip` + `useScrollStrip` — silicaui commit cba5df1,
// which sits on `feat/email-token-expressions`, is not on main, is untagged, and
// is therefore absent from the 0.51.0 this repo installs. When it ships, DELETE
// this file: all six call sites collapse to `<TabsList scrollable>`. Tracked in
// docs/144.
//
// ── Do not "improve" this by wrapping the list in a ScrollArea ────────────
//
// That was tried and reverted. Silica's `pills` selection is a Base UI moving
// indicator that measures against the list's own box; putting ScrollArea's
// Viewport and Content between the two makes the selected pill's fill vanish
// entirely, so the current tab stops being marked at all. Upstream solves it by
// making the LIST itself the scroller rather than wrapping a scroller around it
// — which is only reachable from inside the component, and is the real reason
// this belongs there rather than here.
//
// ── Two decisions worth keeping ───────────────────────────────────────────
//
// The buttons are IN FLOW, not floating over the content: an overlaid chevron
// sits on top of whatever is at the edge — usually the tab you were reaching for
// (DESIGN.md prefers an in-flow push to an overlay).
//
// And overflow decides whether the PAIR is mounted, while position decides only
// whether each is disabled. Mounting a button narrows the scroller, which can
// create the very overflow that justifies the button — remove it and the
// overflow goes, so it comes back, forever. Tying the mount to overflow alone
// makes that impossible, because removing the pair strictly widens the scroller.
// (Upstream reached the same conclusion independently, in the same words.)

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { faChevronLeft, faChevronRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';

/** Nothing is scrolled by a fraction of a pixel; sub-pixel layout rounding
 *  otherwise leaves a button enabled at a hard stop. */
const EDGE_SLACK = 2;

export function ScrollStrip({
  children,
  className,
  /** Announced on the two controls, e.g. "tabs" → "Scroll tabs left". */
  label,
}: {
  children: React.ReactNode;
  className?: string;
  label: string;
}) {
  const scroller = useRef<HTMLDivElement>(null);
  const [overflows, setOverflows] = useState(false);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);

  // State is written only when a number actually moved. A ResizeObserver fires
  // once immediately on `observe()`, so an unguarded write here is a render
  // loop: measure → setState → render → observe → measure.
  const measure = useCallback(() => {
    const el = scroller.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setOverflows(max > EDGE_SLACK);
    setAtStart(el.scrollLeft <= EDGE_SLACK);
    setAtEnd(el.scrollLeft >= max - EDGE_SLACK);
  }, []);

  useEffect(() => {
    const el = scroller.current;
    if (!el) return;
    measure();
    // The scroller for a resized pane; its children for a strip that gains a tab
    // or a dirty dot without the pane moving at all.
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    for (const child of Array.from(el.children)) observer.observe(child);
    return () => {
      observer.disconnect();
    };
  }, [measure, children]);

  const nudge = (direction: -1 | 1) => {
    const el = scroller.current;
    if (!el) return;
    // Most of a screenful, not all of it: leaving a little overlap is what makes
    // it obvious the strip moved rather than jumped somewhere new.
    el.scrollBy({ left: direction * el.clientWidth * 0.8, behavior: 'smooth' });
  };

  return (
    <div className={`flex min-w-0 items-center gap-1 ${className ?? ''}`}>
      {overflows ? (
        <Button
          variant="ghost"
          color="neutral"
          size="sm"
          shape="circle"
          className="shrink-0"
          disabled={atStart}
          aria-label={`Scroll ${label} left`}
          onClick={() => {
            nudge(-1);
          }}
        >
          <Icon glyph={faChevronLeft} className="size-4" aria-hidden />
        </Button>
      ) : null}

      <div
        ref={scroller}
        onScroll={measure}
        // The scrollbar is suppressed only because the buttons now carry the
        // same message and a strip this short looks broken with one across it.
        className="min-w-0 flex-1 [scrollbar-width:none] overflow-x-auto [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
      >
        {children}
      </div>

      {overflows ? (
        <Button
          variant="ghost"
          color="neutral"
          size="sm"
          shape="circle"
          className="shrink-0"
          disabled={atEnd}
          aria-label={`Scroll ${label} right`}
          onClick={() => {
            nudge(1);
          }}
        >
          <Icon glyph={faChevronRight} className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
