'use client';

// WHEN an app's own guide is offered. Mounted once in the shell, beside
// FirstRunGuide. Renders nothing.
//
// The moment is the first time somebody opens an app's panel — they have just
// arrived somewhere new and are looking at a column of screens they have not
// seen before, which is exactly when "shall I talk you through these?" is a
// welcome question and five minutes later is not.
//
// It waits for the shell guide to be settled first. Two offers stacked on a
// first morning is not twice as helpful.

import { useEffect, useRef } from 'react';
import { appGuide } from './app-tours';
import { useGuidePrefs, useSaveAppGuide } from './data';
import {
  GUIDE_KEY_BY_APP,
  GUIDE_VERSION,
  isAnswered,
  isSettled,
  type GuideKey,
  type GuideStep,
} from './types';
import { offerGuide, startGuide, type GuideHandlers } from './use-guide';

const LAUNCH_EVENT = 'piggles:show-me-around-app';

/** Run an app's guide from the top — what its panel's "Show me around" does. */
export function launchAppGuide(key: GuideKey): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<GuideKey>(LAUNCH_EVENT, { detail: key }));
  }
}

export function AppGuideOffers({ browsing }: { browsing: string | null }) {
  const { data, isPending } = useGuidePrefs();
  const save = useSaveAppGuide();

  const handlersRef = useRef<(key: GuideKey) => GuideHandlers>(() => ({}));
  handlersRef.current = (key: GuideKey) => {
    const at = () => new Date().toISOString();
    return {
      onStep: (step: GuideStep) =>
        save.mutate({
          key,
          outcome: { status: 'in-progress', version: GUIDE_VERSION, lastStepId: step.id, at: at() },
        }),
      onDone: () =>
        save.mutate({ key, outcome: { status: 'completed', version: GUIDE_VERSION, at: at() } }),
      onLeft: (step: GuideStep) =>
        save.mutate({
          key,
          outcome: { status: 'skipped', version: GUIDE_VERSION, lastStepId: step.id, at: at() },
        }),
      // `dismissed`, not `skipped` — it never ran. Kept apart because "declined
      // the offer" and "started and left" are answers to different questions,
      // and only one of them tells you the guide itself was no good.
      onDeclined: () =>
        save.mutate({ key, outcome: { status: 'dismissed', version: GUIDE_VERSION, at: at() } }),
    };
  };

  // No "already offered" set here — `offerGuide` is idempotent for the session
  // (lib/tour/use-guide.ts), so this may re-run and be torn down freely.
  useEffect(() => {
    if (!browsing || isPending) return;
    // Nothing is offered until the shell guide has been answered: somebody who
    // has not been shown around the console does not need a walk through one
    // corner of it yet.
    if (!isSettled(data?.tour?.welcome)) return;

    const key = GUIDE_KEY_BY_APP[browsing];
    if (!key) return;
    if (isAnswered(data?.tour?.modules?.[key])) return;

    const guide = appGuide(key);
    if (!guide) return;
    // Longer than the shell's settle: the panel animates open, and an offer that
    // arrives while it is still moving reads as part of the animation. Cleared
    // when they leave the app before it elapses — the offer is about the panel
    // they were looking at, and they are no longer looking at it.
    const timer = setTimeout(() => {
      offerGuide(guide, handlersRef.current(key));
    }, 1200);
    return () => {
      clearTimeout(timer);
    };
  }, [browsing, isPending, data]);

  useEffect(() => {
    const onLaunch = (event: Event) => {
      const key = (event as CustomEvent<GuideKey>).detail;
      const guide = appGuide(key);
      if (guide) startGuide(guide, handlersRef.current(key));
    };
    window.addEventListener(LAUNCH_EVENT, onLaunch);
    return () => {
      window.removeEventListener(LAUNCH_EVENT, onLaunch);
    };
  }, []);

  return null;
}
