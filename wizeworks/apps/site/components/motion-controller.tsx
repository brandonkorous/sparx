'use client';

// Scroll-reveal motion controller (docs/61 §9). Watches every `.bx-reveal` and
// `.bx-reveal-stagger` element and adds `.bx-in` as it scrolls into view, which
// fires the entrance defined in SCROLL_MOTION_CSS (shipped with the tenant
// stylesheet, @wizeworks/surface-compile/motion). One-shot per element (unobserved
// after it reveals). Re-scans on route change so client navigations pick up the
// new page's elements.
//
// The hidden initial state is gated on `html.bx-anim-ready` (set by a tiny
// before-paint script in the layout head, only when motion is allowed), so with
// JS disabled — or reduced motion — nothing is ever hidden. The island carries no
// per-token knowledge: the token-specific entrance lives in CSS, it just flips
// `.bx-in`. Renders nothing.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function MotionController() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(
      document.querySelectorAll<HTMLElement>(
        '.bx-reveal, .bx-reveal-stagger, .bx-reveal-stagger--bold'
      )
    ).filter((el) => !el.classList.contains('bx-in'));
    if (els.length === 0) return;
    // No IntersectionObserver (ancient browsers, some non-scrolling renderers):
    // reveal everything now rather than leave content stuck hidden at opacity:0
    // (bx-anim-ready was already set before paint, so it would never un-hide).
    if (typeof IntersectionObserver === 'undefined') {
      els.forEach((el) => el.classList.add('bx-in'));
      return;
    }
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('bx-in');
            io.unobserve(entry.target);
          }
        }
      },
      { rootMargin: '0px 0px -8% 0px', threshold: 0.04 }
    );
    els.forEach((el) => io.observe(el));
    return () => io.disconnect();
  }, [pathname]);
  return null;
}
