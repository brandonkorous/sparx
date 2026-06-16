// `data-sx-tabs` — an index-matched tab group (docs/98 Pillar 5).
//
// `[data-sx-tab]` buttons map 1:1 (in DOM order) to `[data-sx-panel]` panels.
// Clicking tab i shows panel i and hides the rest, with roving tabindex + arrow-key
// navigation for keyboard users. A tab authored `data-active="true"` starts selected
// (else the first). Live in the canvas — switching tabs to preview each is wanted.

import { type Behavior, disposer, on } from './types';

export const tabs: Behavior = (root) => {
  const d = disposer();
  const tabEls = Array.from(root.querySelectorAll<HTMLElement>('[data-sx-tab]'));
  const panelEls = Array.from(root.querySelectorAll<HTMLElement>('[data-sx-panel]'));
  if (tabEls.length === 0) return d.run;

  const select = (i: number): void => {
    tabEls.forEach((t, j) => {
      const on_ = j === i;
      t.setAttribute('role', 'tab');
      t.setAttribute('aria-selected', String(on_));
      t.setAttribute('data-active', String(on_));
      t.tabIndex = on_ ? 0 : -1;
    });
    panelEls.forEach((p, j) => {
      p.setAttribute('role', 'tabpanel');
      p.hidden = j !== i;
    });
  };

  tabEls.forEach((t, i) => {
    d.add(on(t, 'click', (e) => (e.preventDefault(), select(i))));
    d.add(
      on(t, 'keydown', (e) => {
        const key = (e as KeyboardEvent).key;
        const delta = key === 'ArrowRight' ? 1 : key === 'ArrowLeft' ? -1 : 0;
        if (!delta) return;
        e.preventDefault();
        const next = (i + delta + tabEls.length) % tabEls.length;
        select(next);
        tabEls[next]?.focus();
      })
    );
  });

  const authored = tabEls.findIndex((t) => t.getAttribute('data-active') === 'true');
  select(authored === -1 ? 0 : authored);
  return d.run;
};
