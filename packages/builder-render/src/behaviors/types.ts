// The behavior runtime contract (docs/98 Pillar 5).
//
// A behavior is a tiny, CLOSED, platform-authored interaction attached to a DOM
// element by a `data-sx-<name>` attribute, with parameters read from sibling
// `data-sx-<param>` attributes. It is vanilla TS (no React, no tenant JS): the
// shared renderer emits the attributes on both surfaces, and `hydrateBehaviors`
// (index.ts) wires them up after render — identically on the live storefront and,
// in a non-hijacking preview mode, in the editor canvas. The whole vocabulary is
// audited here; a tenant can never introduce a new behavior or any script.

/** Ambient render context. `edit` ⇒ the editor canvas: a behavior must NOT run
 *  effects that fight authoring (autoplay timers, scroll listeners that move the
 *  page), but SHOULD still render its resting visual state so the preview reads
 *  right. The interactive affordances (clicking a tab, opening a menu) stay live. */
export interface BehaviorContext {
  edit: boolean;
}

/** Detach + restore. Every behavior returns one so `hydrateBehaviors` can fully
 *  tear down on unmount / re-render (no leaked listeners, timers, or observers). */
export type BehaviorCleanup = () => void;

/** Attach a behavior to its root element; return its cleanup. */
export type Behavior = (el: HTMLElement, ctx: BehaviorContext) => BehaviorCleanup;

/** The closed behavior vocabulary — the `data-sx-<name>` attribute each is keyed by. */
export const BEHAVIOR_NAMES = [
  'carousel',
  'disclosure',
  'tabs',
  'scrollspy',
  'marquee',
  'menu',
  'counter',
] as const;
export type BehaviorName = (typeof BEHAVIOR_NAMES)[number];

// ── Param readers (defensive: a missing/garbled data-attr falls back) ──────────

/** A `data-sx-<param>` string value, or '' when absent. */
export function attr(el: Element, param: string): string {
  return el.getAttribute(`data-sx-${param}`) ?? '';
}

/** A numeric param, clamped to a sane floor, with a fallback. */
export function numAttr(el: Element, param: string, fallback: number, min = 0): number {
  const n = Number(attr(el, param));
  return Number.isFinite(n) && n >= min ? n : fallback;
}

/** A boolean param: present + not "false"/"0" ⇒ true; absent ⇒ the fallback. */
export function boolAttr(el: Element, param: string, fallback: boolean): boolean {
  const raw = el.getAttribute(`data-sx-${param}`);
  if (raw === null) return fallback;
  return raw !== 'false' && raw !== '0';
}

/** Collect a cleanup so a behavior can register several listeners/observers and
 *  tear them ALL down with the single returned function. */
export function disposer(): { add: (fn: BehaviorCleanup) => void; run: BehaviorCleanup } {
  const fns: BehaviorCleanup[] = [];
  return {
    add: (fn) => fns.push(fn),
    run: () => {
      for (const fn of fns.splice(0)) fn();
    },
  };
}

let _uid = 0;
/** A stable-enough unique id for ARIA wiring (client-only, post-hydration, so a
 *  monotonic counter is fine — never used for SSR markup). */
export function uid(prefix = 'sx'): string {
  _uid += 1;
  return `${prefix}-${_uid.toString(36)}`;
}

/** A behavior with nothing to wire (e.g. missing structure, or suppressed in the
 *  canvas) returns this, so cleanup is always callable. */
export const noop: BehaviorCleanup = () => {
  /* nothing to tear down */
};

/** Add a DOM listener and return its remover (for the disposer). */
export function on(
  target: EventTarget,
  type: string,
  handler: (e: Event) => void,
  options?: AddEventListenerOptions
): BehaviorCleanup {
  target.addEventListener(type, handler, options);
  return () => target.removeEventListener(type, handler, options);
}
