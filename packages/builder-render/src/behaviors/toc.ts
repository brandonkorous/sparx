// `data-sx-toc` — an auto-generated table of contents (docs/103 Phase 6f).
//
// The article body is one bound rich-text blob (a Prose leaf), so its headings aren't
// known until render — a TOC over it can't be authored statically. This behavior scans
// the `[data-sx-spy]` content for h2/h3, gives each a stable id, and fills the
// `[data-sx-panel]` list with anchor links, then highlights the in-view section as the
// reader scrolls (IntersectionObserver, like scrollspy).
//
// This is the ONE behavior that creates DOM (the links) — so it is LIVE-ONLY: in the
// canvas (ctx.edit) it does nothing, leaving the authored placeholder links visible and
// the body's sample text untouched, exactly the way autoplay/animation are suppressed.

import { type Behavior, disposer, noop } from './types';

function slugify(text: string, fallback: string): string {
  const slug = text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || fallback;
}

export const toc: Behavior = (root, ctx) => {
  const body = root.querySelector<HTMLElement>('[data-sx-spy]');
  const list = root.querySelector<HTMLElement>('[data-sx-panel]');
  if (!body || !list || ctx.edit) return noop;

  const headings = Array.from(body.querySelectorAll<HTMLElement>('h2, h3'));
  if (headings.length === 0) return noop;

  list.textContent = ''; // drop the authored placeholder links
  const linkById = new Map<string, HTMLAnchorElement>();
  headings.forEach((h, i) => {
    if (!h.id) h.id = slugify(h.textContent ?? '', `section-${i + 1}`);
    const a = document.createElement('a');
    a.href = `#${h.id}`;
    a.textContent = h.textContent ?? '';
    a.className = h.tagName === 'H3' ? 'bx-toc__link bx-toc__link--sub' : 'bx-toc__link';
    list.appendChild(a);
    linkById.set(h.id, a);
  });

  const d = disposer();
  // Clicking a link is a normal in-page anchor jump — let the browser handle it; we
  // only need to keep the highlight in sync on scroll.
  if (typeof IntersectionObserver === 'function') {
    const io = new IntersectionObserver(
      (entries) => {
        for (const e of entries) {
          if (!e.isIntersecting) continue;
          const active = linkById.get((e.target as HTMLElement).id);
          if (!active) continue;
          linkById.forEach((link) => link.removeAttribute('data-active'));
          active.setAttribute('data-active', 'true');
        }
      },
      { rootMargin: '0px 0px -70% 0px' }
    );
    headings.forEach((h) => io.observe(h));
    d.add(() => io.disconnect());
  } else {
    // No observer → highlight the first link so the TOC still reads as active.
    const first = linkById.values().next().value;
    if (first) first.setAttribute('data-active', 'true');
  }
  return d.run;
};
