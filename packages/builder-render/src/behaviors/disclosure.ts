// `data-sx-disclosure` — an accordion / show-hide group (docs/98 Pillar 5).
//
// Each `[data-sx-item]` pairs a `[data-sx-trigger]` (button) with a `[data-sx-panel]`.
// Clicking a trigger toggles its panel; `data-sx-single` keeps at most one open
// (the classic FAQ accordion). A panel authored `data-open="true"` starts open.
// This is the SCRIPTED accordion; a single `<details>`/`<summary>` is the CSS-native
// alternative the catalog already uses where one-at-a-time grouping isn't needed.
// Fully live in the editor canvas — clicking to open a section never fights authoring.

import { type Behavior, boolAttr, disposer, on, uid } from './types';

export const disclosure: Behavior = (root) => {
  const d = disposer();
  const single = boolAttr(root, 'single', false);
  const items = Array.from(root.querySelectorAll<HTMLElement>('[data-sx-item]'));

  const setOpen = (item: HTMLElement, open: boolean): void => {
    const trigger = item.querySelector<HTMLElement>('[data-sx-trigger]');
    const panel = item.querySelector<HTMLElement>('[data-sx-panel]');
    item.setAttribute('data-open', String(open));
    trigger?.setAttribute('aria-expanded', String(open));
    if (panel) panel.hidden = !open;
  };

  for (const item of items) {
    const trigger = item.querySelector<HTMLElement>('[data-sx-trigger]');
    const panel = item.querySelector<HTMLElement>('[data-sx-panel]');
    if (!trigger || !panel) continue;
    if (!panel.id) panel.id = uid('sx-acc');
    trigger.setAttribute('aria-controls', panel.id);
    setOpen(item, item.getAttribute('data-open') === 'true');
    d.add(
      on(trigger, 'click', (e) => {
        e.preventDefault();
        const willOpen = item.getAttribute('data-open') !== 'true';
        if (single && willOpen)
          for (const other of items) if (other !== item) setOpen(other, false);
        setOpen(item, willOpen);
      })
    );
  }
  return d.run;
};
