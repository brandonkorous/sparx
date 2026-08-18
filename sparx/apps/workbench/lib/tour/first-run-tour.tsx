'use client';

// The first-run driver: decides WHEN the welcome tour runs and records the
// outcome. Mounted once in the shell. Renders nothing.
//
//   • Auto-starts once, after a short settle, when the tour is unseen for the
//     current version (docs/132 §2). `enabled` gates on onboarding being finished.
//   • Persists a resume point on each step and a terminal outcome on finish/skip,
//     so an interrupted tour resumes and a finished/skipped one never re-nags.
//   • Listens for a launch event so "Take the tour" (account menu) can replay it
//     from the top on demand.
//
// It used to hold a `Driver` and portal brand art into a slot driver.js handed it
// per step. The runtime is a store now and the card renders its own art, so both
// the ref and the portal are gone — this file is back to being only about timing
// and persistence.

import { useEffect, useRef } from 'react';
import { buildTourSteps } from './steps';
import { TOUR_VERSION, isTourSettled } from './types';
import { runTour, stopTour } from './use-tour';
import { useSaveTourOutcome, useTourPrefs } from './data';

const LAUNCH_EVENT = 'sparx:launch-tour';

/** Replay the tour from the top — fire from anywhere (e.g. the account menu). */
export function launchTour(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LAUNCH_EVENT));
}

export function FirstRunTour({ enabled }: { enabled: boolean }) {
  const { data, isPending } = useTourPrefs();
  const save = useSaveTourOutcome();
  const autoStartedRef = useRef(false);

  // Kept in a ref so the (empty-dep) launch listener always calls the current
  // starter without re-subscribing on every render.
  const startRef = useRef<(resumeFromId?: string) => void>(() => undefined);
  startRef.current = (resumeFromId?: string) => {
    // Composed fresh each launch: core shell steps + a step per enabled module
    // (gated on its rail icon being present) + the close. Resume lands on the
    // saved step if it's still in the list, else the top.
    const steps = buildTourSteps();
    const found = resumeFromId ? steps.findIndex((s) => s.id === resumeFromId) : 0;
    const startIndex = found > 0 ? found : 0;
    const now = () => new Date().toISOString();
    runTour({
      steps,
      startIndex,
      onStepShown: (step) =>
        save.mutate({
          status: 'in-progress',
          version: TOUR_VERSION,
          lastStepId: step.id,
          at: now(),
        }),
      onCompleted: () => save.mutate({ status: 'completed', version: TOUR_VERSION, at: now() }),
      onSkipped: (step) =>
        save.mutate({
          status: 'skipped',
          version: TOUR_VERSION,
          lastStepId: step.id,
          at: now(),
        }),
    });
  };

  // Auto-start once, after a short settle, when unseen for this version.
  useEffect(() => {
    if (!enabled || isPending || autoStartedRef.current) return;
    const welcome = data?.tour?.welcome;
    if (isTourSettled(welcome)) return;
    autoStartedRef.current = true;
    const settle = setTimeout(() => startRef.current(welcome?.lastStepId), 800);
    return () => clearTimeout(settle);
  }, [enabled, isPending, data]);

  // On-demand replay always restarts from the top.
  useEffect(() => {
    const onLaunch = () => startRef.current();
    window.addEventListener(LAUNCH_EVENT, onLaunch);
    return () => window.removeEventListener(LAUNCH_EVENT, onLaunch);
  }, []);

  // Tear down any running tour when the shell unmounts. `stopTour`, not
  // `leaveTour`: navigating away is not somebody deciding to stop, and recording
  // it as a skip would mark a tour they never left as abandoned.
  useEffect(() => () => stopTour(), []);

  return null;
}
