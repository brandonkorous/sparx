// `data-sx-marquee` — a continuously scrolling strip / logo cloud (docs/98 Pillar 5).
//
// The visual motion is the CSS `animate-marquee` utility (Pillar 4, surface-compile
// theme): the track translates by -50%, which loops seamlessly ONLY when its content
// is doubled. This behavior does that doubling on the LIVE surface by cloning the
// track's children once, and adds hover-pause. `data-sx-pause-on-hover` (default on).
//
// React-safety: cloning is LIVE-ONLY. In the editor canvas React owns this DOM and
// would reconcile cloned children away (or duplicate them) on the next edit, so the
// canvas instead previews the single resting set with the animation paused — legible,
// and never moving under the author's cursor (same posture as the carousel autoplay).

import { type Behavior, boolAttr, disposer, on } from './types';

export const marquee: Behavior = (root, ctx) => {
  const track = root.querySelector<HTMLElement>('[data-sx-track]') ?? root;

  if (ctx.edit) {
    track.style.animationPlayState = 'paused';
    return () => {
      track.style.animationPlayState = '';
    };
  }

  const d = disposer();
  if (track.getAttribute('data-sx-cloned') !== 'true' && track.children.length > 0) {
    for (const child of Array.from(track.children)) track.appendChild(child.cloneNode(true));
    track.setAttribute('data-sx-cloned', 'true');
  }
  if (boolAttr(root, 'pause-on-hover', true)) {
    d.add(
      on(root, 'mouseenter', () => {
        track.style.animationPlayState = 'paused';
      })
    );
    d.add(
      on(root, 'mouseleave', () => {
        track.style.animationPlayState = 'running';
      })
    );
  }
  return d.run;
};
