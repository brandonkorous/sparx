'use client';

// The tour runtime — a thin, imperative wrapper over driver.js that applies the
// silica theming and reports outcomes (and an art slot) back to the caller.
// Content lives in steps.ts; persistence in data.ts; brand art is portalled in by
// the caller (first-run-tour.tsx) into the container this file exposes.
//
// Why imperative (drive/moveNext) rather than a declarative React tour: it keeps
// the door open for Phase-2 steps that must open a pane and wait for it to mount
// before advancing (docs/132 §6). Phase 1 needs none of that, but the shape does.

import { driver, type Config, type Driver, type PopoverDOM } from 'driver.js';
import 'driver.js/dist/driver.css';
import './tour.css';
import type { TourStep } from './types';
import { tourSelector } from './types';

export interface RunTourOptions {
  steps: TourStep[];
  /** Resume position; defaults to 0. */
  startIndex?: number;
  /** Fired each time a step is shown — used to persist resume position. */
  onStepShown?: (step: TourStep, index: number) => void;
  /** Reached the end (pressed Done on the last step). */
  onCompleted?: () => void;
  /** Left early (close / Esc / clicked outside) before the last step. */
  onSkipped?: (step: TourStep, index: number) => void;
  /** The popover's brand-art slot is ready for this step — portal into `container`. */
  onArt?: (container: HTMLElement, step: TourStep) => void;
  /** The tour ended; tear down any portalled art. */
  onArtClear?: () => void;
  /**
   * Make a step's anchor exist before it is shown — open the surface it lives on
   * and wait for the element to mount. Supplied by the tier-2 module tours, which
   * walk controls across more than one surface; the tier-1 welcome tour omits it
   * (every anchor is always-present shell chrome). When present, the runtime takes
   * over Next/Back so the open+wait completes before driver measures the target.
   */
  ensureStep?: (step: TourStep) => Promise<void>;
}

// Buttons are styled from tokens in tour.css, NOT via silica `.btn` classes here:
// driver's own `.driver-popover-footer button` rule (0,1,1) out-specifies silica's
// single-class `.btn-primary` (0,1,0) and repaints it, so the classes never win.
// tour.css paints the silica look at higher specificity instead.

/** Ensure a brand-art container exists at the top of the popover and hand it to
 *  the caller to portal into. Also stamps the module hue for the CSS tint. */
function mountArt(popover: PopoverDOM, step: TourStep | undefined, opts: RunTourOptions): void {
  const { wrapper } = popover;
  if (step?.module) wrapper.setAttribute('data-tour-module', step.module);
  else wrapper.removeAttribute('data-tour-module');
  // The mascot card lays out two-column (Sparky beside the text); the small-Spark
  // steps stack. A wrapper flag drives the CSS so driver's DOM order is untouched.
  if (step?.art === 'mascot') wrapper.setAttribute('data-tour-hero', '');
  else wrapper.removeAttribute('data-tour-hero');

  let container = wrapper.querySelector<HTMLElement>('.sparx-tour__art');
  if (!container) {
    container = document.createElement('div');
    container.className = 'sparx-tour__art';
    wrapper.insertBefore(container, wrapper.firstChild);
  }
  if (step) opts.onArt?.(container, step);
}

export function runTour(opts: RunTourOptions): Driver {
  const { steps } = opts;

  // `config`'s callbacks reference `d` below; that's a deferred self-reference —
  // they only fire after `driver()` has returned and initialised `d`.
  const config: Config = {
    showProgress: steps.length > 1,
    progressText: '{{current}} of {{total}}',
    allowClose: true,
    // A dark scrim reads correctly in both themes; the highlight cut-out matches
    // the field radius so the spotlighted control looks intentional.
    overlayColor: 'oklch(0% 0 0)',
    overlayOpacity: 0.6,
    stagePadding: 6,
    stageRadius: 8,
    smoothScroll: true,
    popoverClass: 'sparx-tour',
    nextBtnText: 'Next',
    prevBtnText: 'Back',
    doneBtnText: 'Done',
    onPopoverRender: (popover, { state }) => {
      mountArt(popover, steps[state.activeIndex ?? 0], opts);
    },
    // Report the shown step so the caller can persist a resume point.
    onHighlighted: (_el, _step, o) => {
      const index = o.state.activeIndex ?? 0;
      const step = steps[index];
      if (step) opts.onStepShown?.(step, index);
    },
    // Distinguish "finished" from "left early": on the last step there is no next.
    onDestroyStarted: () => {
      const index = d.getActiveIndex() ?? 0;
      if (!d.hasNextStep()) {
        opts.onCompleted?.();
      } else {
        const step = steps[index];
        if (step) opts.onSkipped?.(step, index);
      }
      d.destroy();
    },
    onDestroyed: () => {
      opts.onArtClear?.();
    },
    steps: steps.map((s) => ({
      element: tourSelector(s),
      popover: {
        title: s.title,
        description: s.body,
        side: s.side,
        align: s.align,
      },
    })),
  };

  // Orchestrated advance (tier-2 module tours only). Defining onNext/PrevClick
  // makes driver hand US the click: we open the destination step's surface and
  // wait for its anchor, THEN move — so driver never measures an element that
  // hasn't mounted. A failed ensure (surface slow/gone) still advances, landing
  // on driver's centered fallback rather than hanging the tour. Tier-1 leaves
  // these undefined, so driver keeps its own instant advance.
  if (opts.ensureStep) {
    const settle = async (step: TourStep | undefined): Promise<void> => {
      if (!step) return;
      try {
        await opts.ensureStep!(step);
      } catch {
        // Best effort — advance regardless of a missed anchor.
      }
    };
    config.onNextClick = () => {
      void settle(steps[(d.getActiveIndex() ?? 0) + 1]).then(() => d.moveNext());
    };
    config.onPrevClick = () => {
      void settle(steps[(d.getActiveIndex() ?? 0) - 1]).then(() => d.movePrevious());
    };
  }

  const d: Driver = driver(config);
  const start = opts.startIndex ?? 0;
  // Ensure the FIRST step's anchor too — a module tour can be replayed while its
  // landing surface is closed, so step one may itself need opening.
  if (opts.ensureStep) {
    void Promise.resolve(opts.ensureStep(steps[start]!))
      .catch(() => undefined)
      .then(() => d.drive(start));
  } else {
    d.drive(start);
  }
  return d;
}
