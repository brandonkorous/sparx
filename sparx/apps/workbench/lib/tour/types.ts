// Product-tour shared types + the persisted state shape.
//
// Kept separate from the runtime (use-tour.ts) and the content (steps.ts) so the
// curriculum and the persistence contract can be read without pulling in driver.js.
// Full design: docs/132-workbench-product-tour.md.

/** Bump when the tour materially changes what it teaches — a completed older
 *  version no longer suppresses the new one (see §2 "Version bumping"). */
export const TOUR_VERSION = 1;

/** The single tour we ship today. The persisted blob is keyed by tour id so more
 *  tours (e.g. a per-module deep-dive) can be added without reshaping storage. */
export const WELCOME_TOUR_ID = 'welcome';

/** A module hue a step can wear (primary button + accent + Spark), via the shell's
 *  `--color-module` bridge. Phase-1 steps are neutral chrome; the per-module steps
 *  each wear their tool's hue. Every value here needs a `[data-tour-module]`
 *  mapping in tour.css. Also the key space for the deep per-module tours (tier 2)
 *  and their persisted outcomes. */
export type TourModule = 'builder' | 'commerce' | 'cms' | 'crm' | 'email' | 'scheduling' | 'b2b';

/**
 * `in-progress` / `completed` / `skipped` describe a tour that RAN.
 * `dismissed` is unique to a tier-2 module tour: it means the owner saw the
 * first-open offer card and answered "No thanks" — the tour never started. Any
 * of these suppresses re-offering; the tour stays replayable on demand.
 */
export type TourStatus = 'in-progress' | 'completed' | 'skipped' | 'dismissed';

/**
 * A step whose anchor lives on a DIFFERENT surface than the one open when the
 * tour starts. Before the step is shown, the runtime opens this surface (the
 * controller re-focuses rather than duplicates an already-open one) and waits
 * for the anchor to mount. This is how the Selling tour reaches the "Add a
 * product" button that lives on Products, not the Orders landing.
 */
export interface TourStepOpen {
  /** Surface registry key, e.g. `commerce.products.list`. */
  surface: string;
  /** Params are strings so they round-trip like any descriptor (`{ id: 'new' }`). */
  params?: Record<string, string>;
  /** Where the pane lands. `tab` (default) is least disruptive during a walk. */
  target?: 'tab' | 'beside' | 'replace';
}

export interface TourStep {
  /** Stable id — also the resume key persisted as `lastStepId`. */
  id: string;
  /**
   * The `data-tour` attribute value this step spotlights, e.g. 'site-switcher'
   * resolves to `[data-tour="site-switcher"]`. Omit for a centered, targetless
   * step (the welcome/close cards).
   */
  anchor?: string;
  /** Short, self-carrying heading. No "Step 1 / 8" kicker — the progress dot does that. */
  title: string;
  /** One or two sentences, full ink, ≥16px. What this is and why the owner cares. */
  body: string;
  /** Which side of the anchor the popover sits (driver.js placement). */
  side?: 'top' | 'right' | 'bottom' | 'left';
  align?: 'start' | 'center' | 'end';
  /** Optional module hue — set on every tier-2 module-tour step. */
  module?: TourModule;
  /** Brand art in the popover: 'mascot' greets with Sparky BESIDE the text (the
   *  welcome card); omitted shows the small Spark mark above the title. */
  art?: 'mascot';
  /** When the step's anchor lives on another surface, open it first — see TourStepOpen. */
  open?: TourStepOpen;
  /** 1 = always-present shell chrome; 2 = opens a tool first (needs orchestration). */
  phase: 1 | 2;
}

/** One tour's persisted outcome, stored under `users.preferences.tour[<id>]`. */
export interface TourOutcome {
  status: TourStatus;
  version: number;
  /** Last step reached — lets an interrupted tour resume where it left off. */
  lastStepId?: string;
  /** ISO timestamp of the last write. */
  at: string;
}

/** The `tour` branch of `users.preferences`. `welcome` is the one always-shown
 *  orientation (tier 1); `modules` records the tier-2 deep tour outcome per module
 *  — a present entry (whatever its status) means "already offered", so the
 *  first-open card never nags twice. Absent module key = never entered that tool. */
export interface TourPrefs {
  welcome?: TourOutcome;
  modules?: Partial<Record<TourModule, TourOutcome>>;
}

/** True when a module's first-open offer should NOT be shown again — any recorded
 *  outcome for the current version settles it (the tour stays replayable by hand). */
export function isModuleTourAnswered(outcome: TourOutcome | undefined): boolean {
  if (!outcome) return false;
  return outcome.version >= TOUR_VERSION;
}

/** Resolve a step's anchor to the CSS selector the runtime highlights. */
export function tourSelector(step: TourStep): string | undefined {
  return step.anchor ? `[data-tour="${step.anchor}"]` : undefined;
}

/** Where to resume: index of `lastStepId` in `steps`, or 0 if unknown/finished. */
export function resumeIndex(steps: TourStep[], outcome: TourOutcome | undefined): number {
  if (!outcome?.lastStepId) return 0;
  const i = steps.findIndex((s) => s.id === outcome.lastStepId);
  return i > 0 ? i : 0;
}

/** True when this outcome means "don't auto-start again" for the current version. */
export function isTourSettled(outcome: TourOutcome | undefined): boolean {
  if (!outcome) return false;
  if (outcome.version < TOUR_VERSION) return false; // a newer tour re-offers
  return outcome.status === 'completed' || outcome.status === 'skipped';
}
