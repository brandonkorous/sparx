'use client';

// The tier-2 driver — decides WHEN a module's deep tour is OFFERED, runs it, and
// records the outcome. Mounted once in the shell beside FirstRunTour.
//
//   • Watches the focused pane's module. The first time an owner lands in a
//     tourable tool (and the welcome tour is already settled), a small, dismissible
//     card offers a quick walk — "New to Selling? Take a quick tour."
//   • Show me → runs the module's tour; No thanks → records a 'dismissed' outcome.
//     Either way the module is answered and never nags again; the tour stays
//     replayable on demand (the module panel's "Take the tour", launchModuleTour).
//   • The tour ORCHESTRATES: a step whose control lives on another surface (Selling's
//     "Add a product" is on Products, not Orders) opens that surface and waits for
//     the button before pointing at it. The controller re-focuses an already-open
//     surface rather than duplicating it, so this is safe to run every step.
//
// Renders the offer card and portals the popover's brand art, nothing else.

import { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { createPortal } from 'react-dom';
import { X } from 'lucide-react';
import { Button, Card } from '@wizeworks/silicaui-react';
import { Spark, SparkMascot } from '@sparx/brand/react';
import type { Driver } from 'driver.js';
import { ModuleScope } from '../../components/module-scope';
import { getSurface } from '../surfaces/registry';
import { useWorkbench } from '../workbench/context';
import { getModuleTour, isTourableModule, moduleLabel } from './module-tours';
import { runTour } from './use-tour';
import { useSaveModuleTourOutcome, useTourPrefs } from './data';
import {
  TOUR_VERSION,
  isModuleTourAnswered,
  isTourSettled,
  type TourModule,
  type TourStep,
} from './types';
import type { Theme } from '../theme';

const LAUNCH_MODULE_EVENT = 'sparx:launch-module-tour';

/** Replay a module's deep tour from the top — fired from the module panel. */
export function launchModuleTour(module: TourModule): void {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent<TourModule>(LAUNCH_MODULE_EVENT, { detail: module }));
  }
}

/** Poll for a tour anchor to mount after its surface is opened. Resolves when it
 *  appears, or gives up after `timeoutMs` (the step then lands on driver's
 *  centered fallback rather than hanging). */
function waitForAnchor(anchor: string, timeoutMs = 4000): Promise<void> {
  return new Promise((resolve) => {
    const selector = `[data-tour="${anchor}"]`;
    if (typeof document === 'undefined' || document.querySelector(selector)) return resolve();
    const start = performance.now();
    const tick = () => {
      if (document.querySelector(selector) || performance.now() - start > timeoutMs)
        return resolve();
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });
}

export function ModuleTourOffers({ enabled, theme }: { enabled: boolean; theme: Theme }) {
  const { controller } = useWorkbench();
  const { data: prefs, isPending } = useTourPrefs();
  const save = useSaveModuleTourOutcome();

  const activeDriverRef = useRef<Driver | null>(null);
  const [running, setRunning] = useState(false);
  const [art, setArt] = useState<{ el: HTMLElement; step: TourStep } | null>(null);
  // Modules answered THIS session — hides the offer the instant it's clicked,
  // without waiting on the prefs cache write.
  const [answeredNow, setAnsweredNow] = useState<ReadonlySet<TourModule>>(() => new Set());

  // The focused pane's module, narrowed to the ones that actually have a tour.
  const activeDescriptor = useSyncExternalStore(
    controller.subscribe,
    () => controller.getActiveDescriptor(),
    () => null
  );
  const activeModule = useMemo<TourModule | null>(() => {
    const surfaceKey = activeDescriptor?.surface;
    if (!surfaceKey) return null;
    const mod = getSurface(surfaceKey)?.module;
    return mod && isTourableModule(mod) ? mod : null;
  }, [activeDescriptor]);

  // Let the focused module settle before offering — panes open and close during
  // navigation, and a card that flickers in and out reads as a glitch.
  const [settledModule, setSettledModule] = useState<TourModule | null>(null);
  useEffect(() => {
    if (!activeModule) {
      setSettledModule(null);
      return;
    }
    const t = setTimeout(() => setSettledModule(activeModule), 600);
    return () => clearTimeout(t);
  }, [activeModule]);

  // Start (or replay) a module tour. Kept in a ref so the launch listener always
  // calls the current closure without resubscribing every render.
  const startRef = useRef<(module: TourModule) => void>(() => undefined);
  startRef.current = (module: TourModule) => {
    const tour = getModuleTour(module);
    if (!tour) return;
    activeDriverRef.current?.destroy();
    const now = () => new Date().toISOString();
    setAnsweredNow((prev) => new Set(prev).add(module));
    setRunning(true);
    // Starting counts as answered — a reload mid-tour must not re-nag.
    save.mutate({ module, outcome: { status: 'in-progress', version: TOUR_VERSION, at: now() } });
    activeDriverRef.current = runTour({
      steps: tour.steps,
      onCompleted: () =>
        save.mutate({ module, outcome: { status: 'completed', version: TOUR_VERSION, at: now() } }),
      onSkipped: () =>
        save.mutate({ module, outcome: { status: 'skipped', version: TOUR_VERSION, at: now() } }),
      onArt: (el, step) => setArt({ el, step }),
      onArtClear: () => {
        setArt(null);
        setRunning(false);
      },
      ensureStep: async (step) => {
        if (!step.open) return;
        controller.open(step.open.surface, step.open.params, { target: step.open.target ?? 'tab' });
        if (step.anchor) await waitForAnchor(step.anchor);
      },
    });
  };

  // Replay from the module panel.
  useEffect(() => {
    const onLaunch = (event: Event) => {
      const module = (event as CustomEvent<TourModule>).detail;
      if (module) startRef.current(module);
    };
    window.addEventListener(LAUNCH_MODULE_EVENT, onLaunch);
    return () => window.removeEventListener(LAUNCH_MODULE_EVENT, onLaunch);
  }, []);

  // Tear down any running tour when the shell unmounts.
  useEffect(() => () => activeDriverRef.current?.destroy(), []);

  const dismiss = (module: TourModule) => {
    setAnsweredNow((prev) => new Set(prev).add(module));
    save.mutate({
      module,
      outcome: { status: 'dismissed', version: TOUR_VERSION, at: new Date().toISOString() },
    });
  };

  const outcome = settledModule ? prefs?.tour?.modules?.[settledModule] : undefined;
  const showOffer =
    enabled &&
    !isPending &&
    !running &&
    // Never stack the module offer on top of the still-unseen welcome tour.
    isTourSettled(prefs?.tour?.welcome) &&
    settledModule !== null &&
    !isModuleTourAnswered(outcome) &&
    !answeredNow.has(settledModule);

  return (
    <>
      {showOffer && settledModule ? (
        <OfferCard
          module={settledModule}
          theme={theme}
          onAccept={() => startRef.current(settledModule)}
          onDismiss={() => dismiss(settledModule)}
        />
      ) : null}
      {/* The popover's brand art rides a portal, so it stays a real, theme-aware
          @sparx/brand component instead of injected SVG (same as the welcome tour). */}
      {art ? createPortal(<TourArt step={art.step} />, art.el) : null}
    </>
  );
}

/** The floating first-open offer. Pinned bottom-right, above the status bar, in
 *  the module's hue — Sparky asks, two buttons answer. Dismissible by button, the
 *  ×, or Escape. */
function OfferCard({
  module,
  theme,
  onAccept,
  onDismiss,
}: {
  module: TourModule;
  theme: Theme;
  onAccept: () => void;
  onDismiss: () => void;
}) {
  const label = moduleLabel(module);

  // Escape dismisses — the same expectation any transient overlay sets.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onDismiss();
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [onDismiss]);

  return (
    <ModuleScope
      module={module}
      className="sparx-tour-offer fixed right-4 bottom-14 z-40 w-80 max-w-[calc(100vw-2rem)]"
    >
      {/* Sparky rides BEHIND the card and pokes out the top-left corner (z-0), the
          way he peeks from behind the sign-in pane. The opaque card (z-10) occludes
          whatever hasn't leaned past the corner. Decorative + click-through, so it
          never intercepts a "Show me" / "No thanks". */}
      <div className="sparky-tour-peek pointer-events-none absolute z-0">
        <SparkMascot
          size={76}
          bob
          blink
          tone={theme === 'dark' ? 'dark' : 'light'}
          title="sparky"
        />
      </div>

      {/* Border + base tone carry the lift — no shadow (house rule). The module
          hue on the border says which tool this belongs to. Opaque + z-10 so it
          hides the part of Sparky still tucked behind it. */}
      <Card
        role="region"
        aria-label={`Tour offer for ${label}`}
        className="border-module bg-base-100 relative z-10 p-3.5"
      >
        <p className="pr-5 font-medium">New to {label}?</p>
        <p className="mt-0.5 text-sm">
          Take a quick tour — about a minute, and you can stop any time.
        </p>
        <div className="mt-2.5 flex gap-2">
          <Button color="module" size="sm" onClick={onAccept}>
            Show me
          </Button>
          <Button variant="ghost" color="neutral" size="sm" onClick={onDismiss}>
            No thanks
          </Button>
        </div>
        {/* The always-there quick dismiss. Icon-weight ghost, top-right corner. */}
        <Button
          variant="ghost"
          color="neutral"
          size="xs"
          shape="square"
          aria-label="Dismiss"
          className="absolute top-2 right-2"
          onClick={onDismiss}
        >
          <X className="size-3.5" aria-hidden />
        </Button>
      </Card>
    </ModuleScope>
  );
}

/** The small Spark mark in the popover, in the step's module hue. The popover
 *  carries `--color-module` (set by the runtime from the step's `module`), so the
 *  var resolves to the right tool's color with no extra wiring. */
function TourArt({ step }: { step: TourStep }) {
  return <Spark size={22} color={step.module ? 'var(--color-module)' : 'var(--color-primary)'} />;
}
