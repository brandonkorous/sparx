'use client';

// Left and right, on a title bar whose tabs no longer fit.
//
// dockview's own overflow control is off (`disableTabsOverflowList`) because its
// dropdown renders a stack of broken tabs. Scrolling the strip is the direct
// answer: the tabs stay tabs, and the arrows only exist while something is
// genuinely out of view — chrome that appears when it has a job and not before.

import { useCallback, useEffect, useRef, useState, type RefObject } from 'react';
import { faChevronLeft, faChevronRight } from '@fortawesome/pro-solid-svg-icons';
import { Icon } from '@piggles/ui';
import { Button, Tooltip } from '@wizeworks/silicaui-react';

/** One press moves most of a strip — a near-page, so context survives it. */
const PAGE = 0.8;

/** A pixel of slack: scrollLeft is fractional on a zoomed or scaled display. */
const SLACK = 1;

interface Reach {
  overflowing: boolean;
  atStart: boolean;
  atEnd: boolean;
}

const AT_REST: Reach = { overflowing: false, atStart: true, atEnd: true };

/** The scrolling tab strip of the title bar this control was rendered into. */
function findStrip(anchor: HTMLElement | null): HTMLElement | null {
  const header = anchor?.closest('.dv-tabs-and-actions-container');
  return header?.querySelector<HTMLElement>('.dv-tabs-container') ?? null;
}

function measureStrip(strip: HTMLElement): Reach {
  const furthest = strip.scrollWidth - strip.clientWidth;
  return {
    overflowing: furthest > SLACK,
    atStart: strip.scrollLeft <= SLACK,
    atEnd: strip.scrollLeft >= furthest - SLACK,
  };
}

/**
 * Watches the strip beside this control and scrolls it.
 *
 * The strip is dockview's own element, found through the DOM rather than handed
 * over: `rightHeaderActionsComponent` is given the group's api and its panels,
 * and neither of those knows how wide a tab ended up.
 */
function useTabStrip(): {
  anchorRef: RefObject<HTMLDivElement | null>;
  reach: Reach;
  step: (direction: -1 | 1) => void;
} {
  const anchorRef = useRef<HTMLDivElement | null>(null);
  const stripRef = useRef<HTMLElement | null>(null);
  const [reach, setReach] = useState<Reach>(AT_REST);

  useEffect(() => {
    const strip = findStrip(anchorRef.current);
    stripRef.current = strip;
    if (!strip) return;

    const measure = () => {
      setReach(measureStrip(strip));
    };
    measure();

    // Three separate things change the answer, and only one of them is a scroll:
    // the window being resized, a tab arriving or leaving, and a surface
    // renaming itself to something longer once its record loads.
    const resize = new ResizeObserver(measure);
    resize.observe(strip);
    const mutate = new MutationObserver(measure);
    mutate.observe(strip, { childList: true, subtree: true, characterData: true });
    strip.addEventListener('scroll', measure, { passive: true });

    return () => {
      resize.disconnect();
      mutate.disconnect();
      strip.removeEventListener('scroll', measure);
    };
  }, []);

  // A jump, not `behavior: 'smooth'`. dockview's own scrollbar re-asserts
  // `scrollLeft` on every scroll event to keep its thumb in step, and assigning
  // it aborts an animation in progress — so a smooth press moved one frame and
  // stopped. An instant move always lands the whole page.
  const step = useCallback((direction: -1 | 1) => {
    const strip = stripRef.current;
    if (!strip) return;
    strip.scrollLeft += direction * strip.clientWidth * PAGE;
  }, []);

  return { anchorRef, reach, step };
}

export function TabScrollButtons() {
  const { anchorRef, reach, step } = useTabStrip();

  return (
    // Mounted whether or not it has arrows to show: this element is how the
    // strip beside it gets found, so it cannot come and go with the overflow.
    <div ref={anchorRef} className="flex items-center">
      {reach.overflowing ? (
        <>
          <Tooltip content="Scroll left">
            <Button
              variant="ghost"
              size="xs"
              shape="square"
              aria-label="Scroll the tabs left"
              disabled={reach.atStart}
              onClick={() => {
                step(-1);
              }}
            >
              <Icon glyph={faChevronLeft} className="size-3.5" aria-hidden />
            </Button>
          </Tooltip>

          <Tooltip content="Scroll right">
            <Button
              variant="ghost"
              size="xs"
              shape="square"
              aria-label="Scroll the tabs right"
              disabled={reach.atEnd}
              onClick={() => {
                step(1);
              }}
            >
              <Icon glyph={faChevronRight} className="size-3.5" aria-hidden />
            </Button>
          </Tooltip>
        </>
      ) : null}
    </div>
  );
}
