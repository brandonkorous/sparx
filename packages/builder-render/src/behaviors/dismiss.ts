// `data-sx-dismiss` — a dismissible banner / notice (docs/103). Any `[data-sx-trigger]`
// inside hides the root on click; with `data-sx-key` the dismissal is remembered in
// localStorage so the banner stays hidden on the visitor's next visit. This is what
// makes the cookie-consent and promo bars real rather than decorative.
//
// In the canvas (ctx.edit) the triggers are inert and the banner always shows, so the
// author can see and edit it — mirroring how autoplay/animation are suppressed there.

import { type Behavior, attr, disposer, noop, on } from './types';

export const dismiss: Behavior = (root, ctx) => {
  const key = attr(root, 'key');
  const storeKey = key ? `sx-dismissed:${key}` : '';

  // Live + already dismissed → stay hidden, wire nothing.
  if (!ctx.edit && storeKey) {
    try {
      if (localStorage.getItem(storeKey)) {
        root.hidden = true;
        return noop;
      }
    } catch {
      /* storage blocked (private mode) — fall through to click-to-dismiss only */
    }
  }

  const d = disposer();
  for (const trigger of Array.from(root.querySelectorAll<HTMLElement>('[data-sx-trigger]'))) {
    d.add(
      on(trigger, 'click', (e) => {
        if (ctx.edit) return; // canvas: keep the banner visible + editable
        e.preventDefault();
        root.hidden = true;
        if (storeKey) {
          try {
            localStorage.setItem(storeKey, '1');
          } catch {
            /* ignore — best-effort persistence */
          }
        }
      })
    );
  }
  return d.run;
};
