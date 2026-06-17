// Storefront TopProgress controller — the engine behind the tenant-themed
// page-top loading bar. A lean sibling of @sparx/ui's controller: same fake,
// decelerating trickle curve (NProgress model) and concurrent-jobs model, but
// with NO module axis — a storefront wears the tenant's single brand color, so
// there is nothing to tint between. Self-contained on purpose: @sparx/site-ui
// must never pull in the admin library (docs/46 §3.1).

export interface SiteProgressState {
  /** A job is in flight — the bar is on screen (filling, or fading out). */
  active: boolean;
  /** Fill ratio 0..1. Pinned below 1 until every job completes. */
  value: number;
  /** Value has reached 100% and the bar is settling. */
  finishing: boolean;
  /** Final opacity fade-out is running. */
  fading: boolean;
}

export interface SiteProgressHandle {
  /** End this job. Idempotent. */
  done(): void;
}

export interface SiteProgressStartOptions {
  /** Stable id — a second start() with the same id updates the existing job
   *  (used for the singleton route job). Omit for a unique mutation job. */
  id?: string;
  /** Force-finish backstop in ms (default 20000). Pass 0 to disable. */
  timeout?: number;
}

type Listener = (state: SiteProgressState) => void;

/** Id of the singleton navigation job. */
export const ROUTE_ID = 'route';

const TRICKLE_MS = 220;
const MIN = 0.08;
const CAP = 0.994;
const FILL_HOLD_MS = 180;
const FADE_MS = 320;
const DEFAULT_TIMEOUT = 20_000;

const INACTIVE: SiteProgressState = { active: false, value: 0, finishing: false, fading: false };

/** Decreasing increments — fast through the first fifth, a crawl near the top. */
function stepAmount(n: number): number {
  if (n < 0.2) return 0.1;
  if (n < 0.5) return 0.04;
  if (n < 0.8) return 0.02;
  if (n < 0.99) return 0.005;
  return 0;
}

function prefersReducedMotion(): boolean {
  return (
    typeof window !== 'undefined' &&
    typeof window.matchMedia === 'function' &&
    window.matchMedia('(prefers-reduced-motion: reduce)').matches
  );
}

class SiteProgressController {
  private state: SiteProgressState = INACTIVE;
  private readonly listeners = new Set<Listener>();
  private readonly jobs = new Map<string, ReturnType<typeof setTimeout> | null>();
  private trickle: ReturnType<typeof setInterval> | null = null;
  private settle: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  getState = (): SiteProgressState => this.state;
  getServerState = (): SiteProgressState => INACTIVE;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emit(next: SiteProgressState): void {
    this.state = next;
    for (const fn of this.listeners) fn(next);
  }

  private patch(part: Partial<SiteProgressState>): void {
    this.emit({ ...this.state, ...part });
  }

  start(opts: SiteProgressStartOptions = {}): SiteProgressHandle {
    const id = opts.id ?? `j${++this.seq}`;
    const prev = this.jobs.get(id);
    if (prev) clearTimeout(prev);
    const ms = opts.timeout ?? DEFAULT_TIMEOUT;
    this.jobs.set(id, ms > 0 ? setTimeout(() => this.done(id), ms) : null);

    if (this.settle) {
      clearTimeout(this.settle);
      this.settle = null;
    }

    if (!this.state.active || this.state.finishing) {
      this.emit({ active: true, value: MIN, finishing: false, fading: false });
      this.run();
    }
    return { done: () => this.done(id) };
  }

  /** Ensure the singleton route job is running (idempotent across sources). */
  startRoute(): void {
    this.start({ id: ROUTE_ID });
  }

  /** End the route job — call when the new route has committed. */
  endRoute(): void {
    this.done(ROUTE_ID);
  }

  private run(): void {
    if (prefersReducedMotion()) {
      this.patch({ value: 0.8 });
      return;
    }
    if (this.trickle) return;
    this.trickle = setInterval(() => {
      const n = this.state.value;
      const amount = stepAmount(n) * (0.4 + Math.random() * 0.6);
      const next = Math.min(CAP, n + amount);
      if (next !== n) this.patch({ value: next });
    }, TRICKLE_MS);
  }

  private stopTrickle(): void {
    if (this.trickle) {
      clearInterval(this.trickle);
      this.trickle = null;
    }
  }

  done(id: string): void {
    if (!this.jobs.has(id)) return;
    const timer = this.jobs.get(id);
    if (timer) clearTimeout(timer);
    this.jobs.delete(id);
    if (this.jobs.size > 0) return;

    this.stopTrickle();
    this.emit({ ...this.state, value: 1, finishing: true, fading: false });
    this.settle = setTimeout(() => {
      this.patch({ fading: true });
      this.settle = setTimeout(() => {
        this.settle = null;
        this.emit(INACTIVE);
      }, FADE_MS);
    }, FILL_HOLD_MS);
  }

  reset(): void {
    for (const timer of this.jobs.values()) if (timer) clearTimeout(timer);
    this.jobs.clear();
    this.stopTrickle();
    if (this.settle) {
      clearTimeout(this.settle);
      this.settle = null;
    }
    this.emit(INACTIVE);
  }
}

/** The storefront's bar controller. Import and call from anywhere on the site. */
export const siteProgress = new SiteProgressController();

/**
 * Run async work with the bar showing for its duration. Resolves/rejects with
 * the work's result; the bar always completes, even on throw.
 */
export async function withSiteProgress<T>(
  work: Promise<T> | (() => Promise<T>),
  opts?: SiteProgressStartOptions
): Promise<T> {
  const handle = siteProgress.start(opts);
  try {
    return await (typeof work === 'function' ? work() : work);
  } finally {
    handle.done();
  }
}
