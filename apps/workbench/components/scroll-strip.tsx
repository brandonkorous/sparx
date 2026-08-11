'use client';

// A horizontal strip that says so when there is more of it off-screen.
//
// `overflow-x-auto` alone is a trap on a pane that can be dragged narrow: the
// content is reachable, but the only thing telling you it exists is a scrollbar
// the platform may not draw at all. A customer's tab strip ended at "Activity"
// with Documents and Details past the edge, so from the operator's side those
// two tabs simply did not exist.
//
// ── The buttons are in flow, not floating over the content ────────────────
//
// An overlaid chevron sits on top of whatever is at the edge — usually a tab you
// were trying to read. These take their own space and push the strip in, so
// nothing is ever hidden behind an affordance (DESIGN.md: prefer an in-flow push
// over an overlay).
//
// ── Why they appear together and only disable ─────────────────────────────
//
// Mounting a button narrows the scroller, which can create the overflow that
// justifies the button — remove it and the overflow goes, so it comes back. That
// oscillates forever. So overflow decides whether the PAIR is mounted, and
// position decides only whether each is disabled. Removing the pair strictly
// widens the scroller, so it can never re-trigger its own condition.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Button } from '@wizeworks/silicaui-react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

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
    // Both are needed: the pane is resizable (the element changes size with no
    // scroll event) AND the content itself changes as tabs gain dirty dots or
    // counts, which resizes children rather than the container.
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
          <ChevronLeft className="size-4" aria-hidden />
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
          <ChevronRight className="size-4" aria-hidden />
        </Button>
      ) : null}
    </div>
  );
}
