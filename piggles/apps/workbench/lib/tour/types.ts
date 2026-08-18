// What "show me around" is made of, and how an answer is remembered.
//
// ── THE SHAPE OF THE THING ──────────────────────────────────────────────────
//
// A guide is a short list of steps. A step names ONE thing on screen, says what
// it is for in a sentence, and waits. Nothing is covered, nothing is disabled,
// nothing has to be clicked in order — see lib/tour/use-guide.ts for why that is
// the whole design and not a limitation of it.
//
// Content lives in steps.ts (the shell) and app-tours/ (one tool at a time).
// Persistence is data.ts. This file is the vocabulary all three share, and it
// deliberately pulls in nothing, so the curriculum can be read on its own.

/** Bump when a guide materially changes what it teaches. An older answer stops
 *  counting, and the person is offered the new one once. */
export const GUIDE_VERSION = 1;

/**
 * The key a tier-2 guide is remembered under.
 *
 * These are the platform's tour keys, not Piggles' app ids, because the answer
 * is stored in `users.preferences.tour.modules` — a shared, validated key space
 * (api-rest routes/v1/me.ts). Piggles' own word for each of them lives in the
 * app registry and never leaks into storage.
 */
export type GuideKey =
  | 'platform'
  | 'builder'
  | 'cms'
  | 'seo'
  | 'commerce'
  | 'inventory'
  | 'partners'
  | 'crm'
  | 'email'
  | 'scheduling'
  | 'invoicing'
  | 'finance'
  | 'staff'
  | 'automations'
  | 'connections';

/**
 * Piggles app id → the key its guide is stored under.
 *
 * Mostly the module the app is built from, and deliberately not always: Partners
 * is assembled out of the inventory module's supplier screens, which Stock has
 * already claimed, so the two need separate keys or answering one would answer
 * both. The key is a place to write an answer, never a statement about what an
 * app is made of.
 *
 * Home keys on `platform`, the module it fronts — NOT on 'home', which is
 * Piggles' word for it and must not reach storage (see the note on GuideKey).
 * It used to be absent here, on the grounds that the shell guide covered it. It
 * does not: the shell guide teaches the rail, the panel, the workspace and
 * search, and Home is eighteen screens of business details, sites, domains,
 * security and the setup checklist. The visible symptom was that Home's panel
 * was the one panel with no "Show me around" wand, because ./panel-header.tsx
 * renders that button only where this map resolves.
 *
 * An app absent from this map simply has no guide of its own, which changes
 * nothing else about how it works.
 */
export const GUIDE_KEY_BY_APP: Readonly<Record<string, GuideKey>> = {
  home: 'platform',
  site: 'builder',
  content: 'cms',
  get_found: 'seo',
  sell: 'commerce',
  stock: 'inventory',
  partners: 'partners',
  customers: 'crm',
  messages: 'email',
  bookings: 'scheduling',
  invoices: 'invoicing',
  money: 'finance',
  team: 'staff',
  automations: 'automations',
  connections: 'connections',
};

/**
 * One step.
 *
 * `anchor` is the value of a `data-guide` attribute somewhere on screen. The
 * runtime finds it, rings it, and scrolls it into view. A step with no anchor is
 * a plain card in the strip — used for the opening and closing words, which are
 * about the product rather than about any one control.
 */
export interface GuideStep {
  /** Stable — it is also the resume point that gets written down. */
  id: string;
  /** The `data-guide` value to ring, e.g. `app-rail`. */
  anchor?: string;
  /** A short sentence, not a label. It is read, so it is a real sentence. */
  title: string;
  /** One or two more. What this is for, in the words an owner would use. */
  body: string;
  /**
   * The app whose panel this step is about, opened before the step is shown.
   *
   * Every app guide sets it, because an app guide walks the ROWS of that app's
   * panel and the rows only exist while the panel is open. Asking on every step
   * rather than only the first is deliberate: somebody who wandered off to
   * another app mid-guide comes back to a guide that still works.
   */
  app?: string;
  /**
   * A screen this step is about, opened before the step is shown.
   *
   * The controller re-focuses an already-open screen rather than opening a
   * second copy, so this is safe to ask for repeatedly.
   */
  open?: { surface: string; params?: Record<string, string> };
}

/** A whole guide: who it is for, and what it walks through. */
export interface Guide {
  /** `welcome` for the shell tour; otherwise the tier-2 key. */
  id: 'welcome' | GuideKey;
  /** The chip's own words while this guide is being offered. */
  offer: string;
  steps: GuideStep[];
}

/** How a guide ended. `dismissed` means the offer was declined and it never
 *  ran — kept apart from `skipped` (started, then left) because the two are
 *  different answers to different questions. */
export type GuideStatus = 'in-progress' | 'completed' | 'skipped' | 'dismissed';

/** What gets written down. */
export interface GuideOutcome {
  status: GuideStatus;
  version: number;
  /** Where they had got to, so an interrupted guide picks up rather than restarts. */
  lastStepId?: string;
  at: string;
}

/** The `tour` branch of `users.preferences`, as this app reads it. */
export interface GuidePrefs {
  welcome?: GuideOutcome;
  modules?: Partial<Record<GuideKey, GuideOutcome>>;
}

/** True when the shell guide should not offer itself again. An outcome from an
 *  older version does not count — that is what a version bump is for. */
export function isSettled(outcome: GuideOutcome | undefined): boolean {
  if (!outcome || outcome.version < GUIDE_VERSION) return false;
  return outcome.status === 'completed' || outcome.status === 'skipped';
}

/** True when an app's guide has been ANSWERED — run, left, or declined. Any
 *  answer settles it; the guide stays available from the app's panel forever. */
export function isAnswered(outcome: GuideOutcome | undefined): boolean {
  return outcome !== undefined && outcome.version >= GUIDE_VERSION;
}

/** Where to pick up: the saved step if it is still in this guide, else the top. */
export function resumeIndex(guide: Guide, outcome: GuideOutcome | undefined): number {
  if (!outcome?.lastStepId) return 0;
  const at = guide.steps.findIndex((step) => step.id === outcome.lastStepId);
  return at > 0 ? at : 0;
}

/** The selector a step's anchor resolves to. */
export function guideSelector(step: GuideStep): string | null {
  return step.anchor ? `[data-guide="${step.anchor}"]` : null;
}
