// `data-sx-scrollspy` — a scroll-adaptive nav (docs/98 Pillar 5).
//
// Two jobs, both driven by the page scroll:
//   1. A `data-scrolled` flag flips true once the page is scrolled past
//      `data-sx-threshold` px — the Tesla-style nav that turns solid / shrinks on
//      scroll (the CSS keys off `[data-scrolled="true"]`).
//   2. In-view section highlighting: each `a[href="#id"]` inside gets
//      `data-active="true"` while its target section is the one in view
//      (IntersectionObserver), for a one-page section nav.
//
// Suppressed in the editor canvas (ctx.edit): the canvas is its own scroll
// container, not the window, and a window-scroll listener there would do nothing
// useful and could fight the author — so the canvas previews the resting (top,
// unscrolled) state.

import { type Behavior, disposer, noop, numAttr, on } from './types';

export const scrollspy: Behavior = (root, ctx) => {
  if (ctx.edit) {
    root.setAttribute('data-scrolled', 'false');
    return noop;
  }
  const d = disposer();

  const threshold = numAttr(root, 'threshold', 8, 0);
  const sync = (): void => {
    root.setAttribute('data-scrolled', String(window.scrollY > threshold));
  };
  sync();
  d.add(on(window, 'scroll', sync, { passive: true }));

  // Section highlighting — map each in-page anchor to its target section.
  const links = Array.from(root.querySelectorAll<HTMLAnchorElement>('a[href^="#"]'));
  const linkById = new Map<string, HTMLAnchorElement>();
  for (const link of links) {
    const id = decodeURIComponent((link.getAttribute('href') ?? '').slice(1));
    if (id && document.getElementById(id)) linkById.set(id, link);
  }
  if (linkById.size > 0 && typeof IntersectionObserver !== 'undefined') {
    const obs = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (!entry.isIntersecting) continue;
          const active = entry.target.id;
          for (const [id, link] of linkById)
            link.setAttribute('data-active', String(id === active));
        }
      },
      { rootMargin: '-40% 0px -55% 0px' }
    );
    for (const id of linkById.keys()) {
      const section = document.getElementById(id);
      if (section) obs.observe(section);
    }
    d.add(() => obs.disconnect());
  }
  return d.run;
};
