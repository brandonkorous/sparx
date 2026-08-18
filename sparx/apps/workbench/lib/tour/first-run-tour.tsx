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

import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import type { Driver } from 'driver.js';
import { Spark, SparkMascot } from '@sparx/brand/react';
import { buildTourSteps } from './steps';
import { TOUR_VERSION, isTourSettled, type TourStep } from './types';
import { runTour } from './use-tour';
import { useSaveTourOutcome, useTourPrefs } from './data';
import type { Theme } from '../theme';

const LAUNCH_EVENT = 'sparx:launch-tour';

/** Replay the tour from the top — fire from anywhere (e.g. the account menu). */
export function launchTour(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LAUNCH_EVENT));
}

export function FirstRunTour({ enabled, theme }: { enabled: boolean; theme: Theme }) {
  const { data, isPending } = useTourPrefs();
  const save = useSaveTourOutcome();
  const activeRef = useRef<Driver | null>(null);
  const autoStartedRef = useRef(false);
  // The popover's brand-art slot: driver hands us a DOM container per step and we
  // portal the real (theme-aware) brand component into it.
  const [art, setArt] = useState<{ el: HTMLElement; step: TourStep } | null>(null);

  // Kept in a ref so the (empty-dep) launch listener always calls the current
  // starter without re-subscribing on every render.
  const startRef = useRef<(resumeFromId?: string) => void>(() => undefined);
  startRef.current = (resumeFromId?: string) => {
    activeRef.current?.destroy();
    // Composed fresh each launch: core shell steps + a step per enabled module
    // (gated on its rail icon being present) + the close. Resume lands on the
    // saved step if it's still in the list, else the top.
    const steps = buildTourSteps();
    const found = resumeFromId ? steps.findIndex((s) => s.id === resumeFromId) : 0;
    const startIndex = found > 0 ? found : 0;
    const now = () => new Date().toISOString();
    activeRef.current = runTour({
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
      onArt: (el, step) => setArt({ el, step }),
      onArtClear: () => setArt(null),
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

  // Tear down any running tour when the shell unmounts.
  useEffect(() => () => activeRef.current?.destroy(), []);

  // The brand art rides a portal into the popover's slot, so it stays a real,
  // theme-aware React component instead of hand-injected SVG.
  return art ? createPortal(<TourArt step={art.step} theme={theme} />, art.el) : null;
}

/** Brand art for a step's popover: Sparky greets on the welcome card; every other
 *  step wears the small Spark mark in the step's hue (module, else brand primary).
 *  Real @sparx/brand components — no re-inlined SVG, theme-aware via the portal. */
function TourArt({ step, theme }: { step: TourStep; theme: Theme }) {
  if (step.art === 'mascot') {
    return (
      <SparkMascot size={72} bob blink tone={theme === 'dark' ? 'dark' : 'light'} title="sparky" />
    );
  }
  return <Spark size={22} color={step.module ? 'var(--color-module)' : 'var(--color-primary)'} />;
}
