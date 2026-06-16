// `data-sx-menu` — a disclosure popover: mobile nav drawer, dropdown, or mega-menu
// (docs/98 Pillar 5).
//
// A `[data-sx-trigger]` toggles a `[data-sx-panel]` (`data-open` + `aria-expanded`
// drive the CSS reveal). Closes on outside-click, Escape, and — for a nav — when a
// link inside the panel is followed. Live in the canvas so the author can open it to
// edit its contents; the open/close state is visual only, never a page effect.

import { type Behavior, disposer, on, uid } from './types';

export const menu: Behavior = (root) => {
  const d = disposer();
  const trigger = root.querySelector<HTMLElement>('[data-sx-trigger]');
  const panel = root.querySelector<HTMLElement>('[data-sx-panel]');
  if (!trigger || !panel) return d.run;

  if (!panel.id) panel.id = uid('sx-menu');
  trigger.setAttribute('aria-haspopup', 'true');
  trigger.setAttribute('aria-controls', panel.id);

  const isOpen = (): boolean => root.getAttribute('data-open') === 'true';
  const set = (open: boolean): void => {
    root.setAttribute('data-open', String(open));
    trigger.setAttribute('aria-expanded', String(open));
    panel.hidden = !open;
  };
  set(false);

  d.add(on(trigger, 'click', (e) => (e.preventDefault(), set(!isOpen()))));
  d.add(
    on(document, 'click', (e) => {
      if (isOpen() && !root.contains(e.target as Node)) set(false);
    })
  );
  d.add(
    on(document, 'keydown', (e) => {
      if ((e as KeyboardEvent).key === 'Escape' && isOpen()) {
        set(false);
        trigger.focus();
      }
    })
  );
  // A followed nav link closes the drawer (so the next page doesn't open mid-menu).
  d.add(
    on(panel, 'click', (e) => {
      if ((e.target as HTMLElement).closest('a')) set(false);
    })
  );
  return d.run;
};
