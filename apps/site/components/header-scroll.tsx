'use client';

// Overlay-header scroll probe. Toggles `data-sf-scrolled` on <html> once the
// page scrolls past a threshold, so an overlay (transparent-over-hero) header
// can resolve to a solid bar. Renders nothing — pure side effect. Mounted by
// SiteHeader only when the header's overlay mode is on.

import { useEffect } from 'react';

export function HeaderScroll({ threshold = 60 }: { threshold?: number }) {
  useEffect(() => {
    const root = document.documentElement;
    const onScroll = () => {
      if (window.scrollY > threshold) root.setAttribute('data-sf-scrolled', '1');
      else root.removeAttribute('data-sf-scrolled');
    };
    onScroll();
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => {
      window.removeEventListener('scroll', onScroll);
      root.removeAttribute('data-sf-scrolled');
    };
  }, [threshold]);
  return null;
}
