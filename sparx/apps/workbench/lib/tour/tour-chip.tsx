'use client';

// The tour itself: a chip on the status bar, and a card next to whatever the step
// is about.
//
// ── WHY THE CHIP LIVES DOWN HERE AND THE CARD DOES NOT ──────────────────────
//
// The chip is a handle — where "3 of 8" lives, and the thing still sitting there
// when somebody wanders off mid-tour and comes back. The status bar already does
// exactly that job for the occasional "how's it going?" ask
// (components/feedback/sentiment-chip.tsx): it is the one shelf in the product
// that is never in the way.
//
// The CARD is not a handle, it is the sentence, and a sentence belongs beside the
// thing it describes — see ./anchor.ts.
//
// ── THE ART IS A REAL COMPONENT NOW ─────────────────────────────────────────
//
// driver.js owned the popover's DOM, so brand art had to be portalled into a slot
// this file's predecessor hand-injected, with `onArt`/`onArtClear` callbacks
// threaded through both callers to do it. Composing silica's Popover means Sparky
// is simply rendered here, theme-aware, like any other component — and those two
// callbacks disappear from `first-run-tour.tsx` and `module-tour-offers.tsx`.

import { useEffect } from 'react';
import { Compass } from 'lucide-react';
import {
  Button,
  Popover,
  PopoverContent,
  PopoverTitle,
  PopoverTrigger,
} from '@wizeworks/silicaui-react';
import { Spark, SparkMascot } from '@sparx/brand/react';
import './tour.css';
import { tourSide, useTourAnchor } from './anchor';
import { currentStep, useTourActions, useTourState } from './use-tour';
import { ModuleScope } from '../../components/module-scope';
import { useWorkbenchTheme } from '../use-theme';
import type { TourStep } from './types';

export function TourChip() {
  const state = useTourState();
  const step = currentStep(state);
  const { next, back, leave } = useTourActions();
  const { theme } = useWorkbenchTheme();

  // The element this step is ringing, or null on the welcome and closing cards.
  // It is what the card is positioned against — see ./anchor.ts.
  const anchor = useTourAnchor(step);

  // Esc leaves — the one keyboard habit everybody already has for "I am done with
  // this". It does not close the popover on its own: closing it mid-tour would
  // strand somebody with a chip showing a step number and nothing else.
  useEffect(() => {
    if (state.phase !== 'running') return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') leave();
    };
    window.addEventListener('keydown', onKey);
    return () => {
      window.removeEventListener('keydown', onKey);
    };
  }, [state.phase, leave]);

  if (state.phase !== 'running' || !step) return null;

  const position = `${String(state.index + 1)} of ${String(state.steps.length)}`;
  const last = state.index === state.steps.length - 1;

  const card = (
    // `open` and no `onOpenChange`: the popover belongs to the tour, not to the
    // person's click. It opens when a step does and closes when the tour ends.
    <Popover open>
      <PopoverTrigger>
        <Button color="primary" variant="soft" size="xs" className="gap-1.5">
          <Compass className="size-3.5" aria-hidden />
          <span className="max-w-64 truncate">{step.title}</span>
          <span className="tabular-nums">{position}</span>
        </Button>
      </PopoverTrigger>
      {/* Beside the thing being explained, whenever there IS one. The card only
          falls back to the status bar on a step with no anchor — the welcome and
          closing cards, which are about the product rather than any one control.

          `sticky` because a rail item can scroll under the card in a long panel and
          the words should not sail off with it. `sideOffset` clears the ring, which
          draws 2px outside the box with a 2px offset (./tour.css). */}
      <PopoverContent
        side={anchor ? tourSide(anchor) : 'top'}
        align={anchor ? 'center' : 'end'}
        anchor={anchor ?? undefined}
        sideOffset={anchor ? 10 : undefined}
        sticky={anchor ? true : undefined}
        className="sparx-tour-card w-96"
      >
        <div className={step.art === 'mascot' ? 'flex items-start gap-3' : undefined}>
          <TourArt step={step} theme={theme} />
          <div className="min-w-0 flex-1">
            <PopoverTitle>{step.title}</PopoverTitle>
            {/* 16px, full ink. It is the only thing in this feature anybody reads. */}
            <p className="mt-2 text-base">{step.body}</p>
          </div>
        </div>
        <div className="mt-4 flex items-center gap-2">
          {/* "Stop here" is gone on the last step: stopping and finishing are the
              same act there, and offering both would record somebody who read the
              whole thing as having walked out of it. */}
          {last ? null : (
            <Button variant="ghost" size="sm" onClick={leave}>
              Stop here
            </Button>
          )}
          <span className="flex-1" />
          <Button variant="outline" size="sm" disabled={state.index === 0} onClick={back}>
            Back
          </Button>
          <Button color="primary" size="sm" onClick={next}>
            {last ? 'Got it' : 'Next'}
          </Button>
        </div>
      </PopoverContent>
    </Popover>
  );

  // A module tour's steps wear that module's hue, which is the same
  // colour-follows-functionality rule the rest of the app obeys — so the card is
  // scoped rather than reading a colour from a table.
  return step.module ? <ModuleScope module={step.module}>{card}</ModuleScope> : card;
}

/** Brand art for a step's card: Sparky greets on the welcome card; every other
 *  step wears the small Spark mark in the step's hue (module, else brand primary). */
function TourArt({ step, theme }: { step: TourStep; theme: string }) {
  if (step.art === 'mascot') {
    return (
      <SparkMascot size={72} bob blink tone={theme === 'dark' ? 'dark' : 'light'} title="sparky" />
    );
  }
  return (
    <span className="mb-1 block">
      <Spark size={22} color={step.module ? 'var(--color-module)' : 'var(--color-primary)'} />
    </span>
  );
}
