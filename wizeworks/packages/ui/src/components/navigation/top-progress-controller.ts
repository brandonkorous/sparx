import type { SparxModule } from '../../providers/module-provider';

// TopProgress controller — the framework-agnostic engine behind the page-top
// loading bar. It owns a fake, decelerating "trickle" curve (a navigation has
// no measurable progress, so the bar eases toward a cap and only completes when
// the work does — the NProgress model) and a set of concurrent "jobs" so an
// in-flight route AND a couple of mutations share one bar without fighting.
//
// No React, no DOM, no Next — just state + timers + a pub/sub. The React view
// (`top-progress.tsx`) subscribes; the DOM navigation glue (`top-progress-nav`)
// and any app mutation drive it. One singleton (`topProgress`) per bundle.

export interface TopProgressState {
  /** A job is in flight — the bar is on screen (filling, or fading out). */
  active: boolean;
  /** Fill ratio 0..1. Pinned below 1 until every job completes. */
  value: number;
  /** Palette hint: the destination module of the active navigation, or null
   *  (→ the platform spectrum). */
  module: SparxModule | null;
  /** Value has reached 100% and the bar is settling. */
  finishing: boolean;
  /** Final opacity fade-out is running — keep width, drop opacity. */
  fading: boolean;
}

export interface TopProgressHandle {
  /** End this job. Idempotent. */
  done(): void;
}

export interface StartOptions {
  /** Stable id: a second `start()` with the same id updates the existing job
   *  instead of adding one (used for the singleton route job). Omit for a
   *  unique, self-owned job (mutations). */
  id?: string;
  /** Destination module — tints the bar while the job runs. */
  module?: SparxModule | null;
  /** Force-finish backstop in ms (default 20000) so a dropped `done()` can
   *  never strand the bar. Pass 0 to disable. */
  timeout?: number;
}

type Listener = (state: TopProgressState) => void;

/** Id of the singleton navigation job. */
export const ROUTE_ID = 'route';

const TRICKLE_MS = 220;
const MIN = 0.08;
const CAP = 0.994;
const FILL_HOLD_MS = 180; // hold at 100% before fading, so completion reads
const FADE_MS = 320;
const DEFAULT_TIMEOUT = 20_000;

const INACTIVE: TopProgressState = {
  active: false,
  value: 0,
  module: null,
  finishing: false,
  fading: false,
};

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

interface Job {
  module: SparxModule | null;
  timer: ReturnType<typeof setTimeout> | null;
}

class TopProgressController {
  private state: TopProgressState = INACTIVE;
  private readonly listeners = new Set<Listener>();
  private readonly jobs = new Map<string, Job>();
  private trickle: ReturnType<typeof setInterval> | null = null;
  private settle: ReturnType<typeof setTimeout> | null = null;
  private seq = 0;

  /** Snapshot for `useSyncExternalStore` (stable ref until state changes). */
  getState = (): TopProgressState => this.state;
  /** Server snapshot — always inactive (no bar in the SSR markup). */
  getServerState = (): TopProgressState => INACTIVE;

  subscribe = (fn: Listener): (() => void) => {
    this.listeners.add(fn);
    return () => {
      this.listeners.delete(fn);
    };
  };

  private emit(next: TopProgressState): void {
    this.state = next;
    for (const fn of this.listeners) fn(next);
  }

  private patch(part: Partial<TopProgressState>): void {
    this.emit({ ...this.state, ...part });
  }

  /** The most recently started job that carries a module wins the tint. */
  private resolveModule(): SparxModule | null {
    let mod: SparxModule | null = null;
    for (const job of this.jobs.values()) if (job.module) mod = job.module;
    return mod;
  }

  /** Begin (or refresh) a job and ensure the bar is running. */
  start(opts: StartOptions = {}): TopProgressHandle {
    const id = opts.id ?? `j${++this.seq}`;
    const prev = this.jobs.get(id);
    if (prev?.timer) clearTimeout(prev.timer);
    const ms = opts.timeout ?? DEFAULT_TIMEOUT;
    const timer = ms > 0 ? setTimeout(() => this.done(id), ms) : null;
    this.jobs.set(id, { module: opts.module ?? prev?.module ?? null, timer });

    if (this.settle) {
      clearTimeout(this.settle);
      this.settle = null;
    }

    if (!this.state.active || this.state.finishing) {
      this.emit({
        active: true,
        value: MIN,
        module: this.resolveModule(),
        finishing: false,
        fading: false,
      });
      this.run();
    } else {
      this.patch({ module: this.resolveModule() });
    }
    return { done: () => this.done(id) };
  }

  /** Ensure the singleton route job is running (idempotent across sources). */
  startRoute(module: SparxModule | null = null): void {
    this.start({ id: ROUTE_ID, module });
  }

  /** End the route job — call when the new route has committed. */
  endRoute(): void {
    this.done(ROUTE_ID);
  }

  private run(): void {
    if (prefersReducedMotion()) {
      // No continuous motion: jump to a high hold and wait for completion.
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

  /** End a job by id. When the last one ends, fill → hold → fade → reset. */
  done(id: string): void {
    const job = this.jobs.get(id);
    if (!job) return;
    if (job.timer) clearTimeout(job.timer);
    this.jobs.delete(id);

    if (this.jobs.size > 0) {
      this.patch({ module: this.resolveModule() });
      return;
    }

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

  /** Abort everything immediately (e.g. a hard navigation error). */
  reset(): void {
    for (const job of this.jobs.values()) if (job.timer) clearTimeout(job.timer);
    this.jobs.clear();
    this.stopTrickle();
    if (this.settle) {
      clearTimeout(this.settle);
      this.settle = null;
    }
    this.emit(INACTIVE);
  }
}

/** The process-wide bar controller. Import and call from anywhere. */
export const topProgress = new TopProgressController();
export type { TopProgressController };

/**
 * Run async work with the bar showing for its duration. Resolves/rejects with
 * the work's result; the bar always completes, even on throw.
 *
 *   await withTopProgress(() => saveDraft(), { module: 'builder' });
 */
export async function withTopProgress<T>(
  work: Promise<T> | (() => Promise<T>),
  opts?: StartOptions
): Promise<T> {
  const handle = topProgress.start(opts);
  try {
    return await (typeof work === 'function' ? work() : work);
  } finally {
    handle.done();
  }
}
