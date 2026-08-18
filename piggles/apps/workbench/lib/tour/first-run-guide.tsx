'use client';

// WHEN the shell guide is offered, and what gets written down about it.
// Mounted once in the shell. Renders nothing — the chip is what you see.
//
// It OFFERS rather than starts. sparx's opens itself after a short settle, which
// is defensible there: its rail is nearly empty on a first visit, so a tour is
// the only thing to do. Here somebody has just answered what their business does
// and been dropped into a full console they are keen to poke at, and a walk that
// begins on its own is a walk they are trying to get past. So the strip says
// "New here? Show me around" and waits to be taken up on it.

import { useEffect, useRef } from 'react';
import { WELCOME_GUIDE } from './steps';
import { GUIDE_VERSION, isSettled, resumeIndex, type GuideStep } from './types';
import { useGuidePrefs, useSaveWelcome } from './data';
import { offerGuide, startGuide, type GuideHandlers } from './use-guide';

const LAUNCH_EVENT = 'piggles:show-me-around';

/** Run it again from the top — what the account menu's "Show me around" does. */
export function launchWelcomeGuide(): void {
  if (typeof window !== 'undefined') window.dispatchEvent(new Event(LAUNCH_EVENT));
}

export function FirstRunGuide({ enabled }: { enabled: boolean }) {
  const { data, isPending } = useGuidePrefs();
  const save = useSaveWelcome();

  // Held in a ref so the listener below never re-subscribes and the delayed
  // offer never fires through a mutation from an earlier render.
  const handlersRef = useRef<GuideHandlers>({});
  handlersRef.current = {
    onStep: (step: GuideStep) =>
      save.mutate({
        status: 'in-progress',
        version: GUIDE_VERSION,
        lastStepId: step.id,
        at: new Date().toISOString(),
      }),
    onDone: () =>
      save.mutate({ status: 'completed', version: GUIDE_VERSION, at: new Date().toISOString() }),
    onLeft: (step: GuideStep) =>
      save.mutate({
        status: 'skipped',
        version: GUIDE_VERSION,
        lastStepId: step.id,
        at: new Date().toISOString(),
      }),
    // Declining IS an answer, and it is recorded as one. Left unwritten, the
    // offer would come back on the next load and become the nag this shape was
    // chosen to avoid.
    onDeclined: () =>
      save.mutate({ status: 'skipped', version: GUIDE_VERSION, at: new Date().toISOString() }),
  };

  // No "already offered" flag here on purpose — `offerGuide` is idempotent for
  // the session (see lib/tour/use-guide.ts), so this effect is free to re-run,
  // be torn down and re-run again without either dropping the offer or making
  // it twice. A guard in a ref plus a timer in an effect is the combination that
  // silently loses it: the timer dies with the teardown and the ref survives it.
  useEffect(() => {
    if (!enabled || isPending) return;
    const welcome = data?.tour?.welcome;
    if (isSettled(welcome)) return;
    // A short settle so the offer arrives after the console has finished
    // appearing, rather than on top of it mid-render.
    const timer = setTimeout(() => {
      offerGuide(WELCOME_GUIDE, {
        ...handlersRef.current,
        resumeFrom: resumeIndex(WELCOME_GUIDE, welcome),
      });
    }, 900);
    return () => {
      clearTimeout(timer);
    };
  }, [enabled, isPending, data]);

  useEffect(() => {
    const onLaunch = () => {
      startGuide(WELCOME_GUIDE, handlersRef.current);
    };
    window.addEventListener(LAUNCH_EVENT, onLaunch);
    return () => {
      window.removeEventListener(LAUNCH_EVENT, onLaunch);
    };
  }, []);

  return null;
}
