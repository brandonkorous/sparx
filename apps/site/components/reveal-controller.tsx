'use client';

// Scroll-reveal controller. Watches every `[data-sf-reveal]` element (the
// Site Builder section wrappers) and adds `is-visible` as each scrolls into
// view, driving the fade-up entrance defined in site.css. One-shot per
// element (unobserved after it reveals). Re-scans on route change so client
// navigations pick up the new page's sections.
//
// The hidden initial state is gated on `html.sf-reveal-ready` (set by a tiny
// before-paint script in the layout head), so with JS disabled — or reduced
// motion — nothing ever hides. Renders nothing.

import { useEffect } from 'react';
import { usePathname } from 'next/navigation';

export function RevealController() {
  const pathname = usePathname();
  useEffect(() => {
    if (typeof window === 'undefined') return;
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return;
    const els = Array.from(document.querySelectorAll<HTMLElement>('[data-sf-reveal]'));
    if (els.length === 0) return;
    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
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
