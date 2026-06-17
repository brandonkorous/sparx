// `data-sx-carousel` — a declarative slider (docs/98 Pillar 5).
//
// Structure is AUTHORED (the comprehensive composites bake it in): a `[data-sx-track]`
// holds `[data-sx-slide]` children; optional `[data-sx-prev]`/`[data-sx-next]` arrows
// and `[data-sx-dot]` buttons (one per slide) drive navigation. The behavior only
// WIRES authored elements — it never creates DOM — so it is safe over React-owned
// canvas markup. Autoplay (`data-sx-autoplay`, `data-sx-interval` seconds) runs on
// the live storefront only; in the canvas it's suppressed (like the React carousel)
// so slides don't advance under the author's cursor. Hover pauses autoplay.

import { type Behavior, boolAttr, disposer, noop, numAttr, on } from './types';

export const carousel: Behavior = (root, ctx) => {
  const track = root.querySelector<HTMLElement>('[data-sx-track]');
  const slides = Array.from(root.querySelectorAll<HTMLElement>('[data-sx-slide]'));
  const count = slides.length;
  if (!track || count === 0) return noop;

  const d = disposer();
  const dots = Array.from(root.querySelectorAll<HTMLElement>('[data-sx-dot]'));
  let index = 0;

  const render = (): void => {
    track.style.transform = `translateX(-${index * 100}%)`;
    slides.forEach((s, i) => s.setAttribute('aria-hidden', String(i !== index)));
    dots.forEach((dot, i) => {
      dot.setAttribute('data-active', String(i === index));
      if (i === index) dot.setAttribute('aria-current', 'true');
      else dot.removeAttribute('aria-current');
    });
  };
  const go = (next: number): void => {
    index = ((next % count) + count) % count;
    render();
  };
  render();

  const prev = root.querySelector<HTMLElement>('[data-sx-prev]');
  const next = root.querySelector<HTMLElement>('[data-sx-next]');
  if (prev) d.add(on(prev, 'click', (e) => (e.preventDefault(), go(index - 1))));
  if (next) d.add(on(next, 'click', (e) => (e.preventDefault(), go(index + 1))));
  dots.forEach((dot, i) => d.add(on(dot, 'click', (e) => (e.preventDefault(), go(i)))));

  if (boolAttr(root, 'autoplay', true) && !ctx.edit && count > 1) {
    const ms = Math.max(2, numAttr(root, 'interval', 6, 2)) * 1000;
    let paused = false;
    const timer = window.setInterval(() => {
      if (!paused) go(index + 1);
    }, ms);
    d.add(
      on(root, 'mouseenter', () => {
        paused = true;
      })
    );
    d.add(
      on(root, 'mouseleave', () => {
        paused = false;
      })
    );
    d.add(() => window.clearInterval(timer));
  }
  return d.run;
};
