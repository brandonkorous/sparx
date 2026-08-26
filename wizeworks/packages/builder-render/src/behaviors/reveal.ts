// `data-sx-reveal` — the reason an offer appears (docs/151 §7, docs/152 C1).
//
// The builder already had the SHAPES an offer takes: a dialog, a lightbox, an
// announcement bar, a popover. What none of them had was a reason to show up.
// This is that reason, and it is one behavior rather than four because "after 20
// seconds" means the same thing to a slide-in as it does to a modal.
//
//   · load    — as soon as the page is ready.
//   · delay   — after `data-sx-delay` seconds.
//   · scroll  — once `data-sx-scroll` percent of the page has been passed.
//   · exit    — when the pointer leaves the top of the window. Desktop only, and
//               deliberately not faked on touch: there is no honest mobile
//               equivalent, and the usual substitutes (a back-button trap, a
//               scroll-up guess) interrupt somebody who was not leaving.
//   · return  — only on a later visit, never the first one.
//
// ── THE ELEMENT STARTS HIDDEN IN THE MARKUP ──────────────────────────────────
//
// The catalog entries author `hidden` on the root and this behavior removes it.
// That ordering is deliberate: hiding it from script instead would flash the
// offer on every page load before the timer it is waiting for, and a visitor
// with no JavaScript would get an offer they can see and cannot dismiss. Hidden
// in the markup means no-JS shows nothing, which for a promotion is right.
//
// ── THE FREQUENCY CAP IS LOCAL, AND THAT IS THE DESIGN ───────────────────────
//
// `data-sx-key` + `data-sx-every` (days) remember the last showing in
// localStorage. A server-side cap would need the durable anonymous identity that
// docs/151 §4 refuses on purpose, and refusing it is why a sparx site needs no
// consent banner. This degrades honestly: a cleared browser sees the offer
// again, which is a far smaller harm to a visitor than being tracked so it
// cannot. Storage being unavailable (private mode, blocked cookies) must never
// mean the offer is silently dead, so every read fails OPEN.

import { type Behavior, attr, disposer, noop, numAttr, on } from './types';

/** How the offer is asked for. Anything unrecognised behaves as `load`, so a
 *  node authored before a trigger existed still shows rather than vanishing. */
type RevealOn = 'load' | 'delay' | 'scroll' | 'exit' | 'return';

const DAY_MS = 86_400_000;

/** Has this offer been shown recently enough to skip? Fails OPEN: if storage
 *  cannot be read we show the offer, because an offer nobody sees is a worse
 *  failure than one somebody sees twice. */
function suppressed(storeKey: string, everyDays: number): boolean {
  if (!storeKey || everyDays <= 0) return false;
  try {
    const last = Number(localStorage.getItem(storeKey));
    if (!Number.isFinite(last) || last <= 0) return false;
    return Date.now() - last < everyDays * DAY_MS;
  } catch {
    return false;
  }
}

/** Record that it was shown. Best-effort by design — see the note above. */
function remember(storeKey: string): void {
  if (!storeKey) return;
  try {
    localStorage.setItem(storeKey, String(Date.now()));
  } catch {
    /* storage blocked — the cap lapses, the offer still worked */
  }
}

/**
 * Is this a returning visit?
 *
 * Deliberately a single boolean flag and not a visit count, a first-seen date,
 * or anything else that would accumulate into the persistent anonymous identity
 * §4 rules out. "Have I been here before" is the whole question, and one bit
 * answers it.
 */
function isReturning(): boolean {
  const FLAG = 'sx-seen';
  try {
    const seen = localStorage.getItem(FLAG) !== null;
    if (!seen) localStorage.setItem(FLAG, '1');
    return seen;
  } catch {
    // Cannot tell, so treat them as new: showing a returning-visitor offer to
    // a first-timer is the more intrusive of the two mistakes.
    return false;
  }
}

/** How far down the page the visitor has read, 0–100. Guarded against a page
 *  shorter than the viewport, where there is nothing to scroll and the ratio
 *  would divide by zero. */
function scrolledPercent(): number {
  const doc = document.documentElement;
  const scrollable = doc.scrollHeight - window.innerHeight;
  if (scrollable <= 0) return 100;
  return (window.scrollY / scrollable) * 100;
}

/**
 * Click whatever `[data-sx-trigger]` marks.
 *
 * The marker lands in one of two places depending on what was marked: directly
 * on a raw `<button>`, or on the wrapper the walker puts around a registry atom
 * like Dialog, whose real control is inside it. Handling both is what lets an
 * author point a timed offer at either.
 */
function openTrigger(root: HTMLElement): void {
  const CONTROL = 'button, a, [role="button"]';
  const marked = root.querySelector<HTMLElement>('[data-sx-trigger]');
  if (!marked) return;
  const control = marked.matches(CONTROL) ? marked : marked.querySelector<HTMLElement>(CONTROL);
  (control ?? marked).click();
}

export const reveal: Behavior = (root, ctx) => {
  // Canvas: the author has to be able to see and edit what they placed, so it is
  // shown at rest with no timers, listeners or storage writes. Mirrors how
  // autoplay and animation are suppressed there.
  if (ctx.edit) {
    root.hidden = false;
    return noop;
  }

  const key = attr(root, 'key');
  const storeKey = key ? `sx-revealed:${key}` : '';
  // A week between showings by default: often enough to catch somebody who is
  // still deciding, rare enough not to become furniture they stop seeing.
  const everyDays = numAttr(root, 'every', 7);
  if (suppressed(storeKey, everyDays)) return noop;

  const mode = (attr(root, 'on') || 'load') as RevealOn;
  if (mode === 'return' && !isReturning()) return noop;

  const d = disposer();
  let shown = false;

  const show = (): void => {
    if (shown) return;
    shown = true;
    remember(storeKey);
    // A centered modal cannot be a plain hidden element — the compile allowlist
    // denies `fixed inset-0` on purpose (a clickjacking guard, and weakening it
    // for a promotion would be a poor trade). The sanctioned modal is silica's
    // Dialog, which opens from a trigger, so `opens` says to CLICK that trigger
    // and leave the host hidden. That gives a timed modal offer with no second
    // dialog implementation, no new prop on the island, and no stray trigger
    // button left sitting on the page.
    if (attr(root, 'opens')) openTrigger(root);
    else root.hidden = false;
    d.run(); // whatever was waiting has fired; stop listening
  };

  switch (mode) {
    case 'delay': {
      const timer = window.setTimeout(show, numAttr(root, 'delay', 10) * 1000);
      d.add(() => {
        window.clearTimeout(timer);
      });
      break;
    }
    case 'scroll': {
      const target = numAttr(root, 'scroll', 50);
      const check = (): void => {
        if (scrolledPercent() >= target) show();
      };
      d.add(on(window, 'scroll', check, { passive: true }));
      check(); // already past it on load (a restored scroll position, a #anchor)
      break;
    }
    case 'exit': {
      // `mouseout` to null relatedTarget above the viewport = the pointer left
      // through the top of the window, which is the address bar and the close
      // button. Pointer-coarse devices never fire it, and that is intended.
      d.add(
        on(document, 'mouseout', (e) => {
          const me = e as MouseEvent;
          if (me.relatedTarget === null && me.clientY <= 0) show();
        })
      );
      break;
    }
    case 'load':
    case 'return':
    default:
      show();
      break;
  }

  return d.run;
};
