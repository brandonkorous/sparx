'use client';

import { useEffect, useState, type RefObject } from 'react';

/** True while `ref` is in the viewport and the tab is visible, so an animation
 *  nobody can see stops ticking (the hero re-rendered every 38 ms off-screen). */
export function useOnScreen(ref: RefObject<Element | null>): boolean {
  const [inView, setInView] = useState(true);
  const [tabVisible, setTabVisible] = useState(true);

  useEffect(() => {
    const el = ref.current;
    if (!el || typeof IntersectionObserver === 'undefined') return;
    const observer = new IntersectionObserver(([entry]) =>
      setInView(entry?.isIntersecting ?? true)
    );
    observer.observe(el);
    return () => observer.disconnect();
  }, [ref]);

  useEffect(() => {
    const onChange = (): void => setTabVisible(document.visibilityState !== 'hidden');
    onChange();
    document.addEventListener('visibilitychange', onChange);
    return () => document.removeEventListener('visibilitychange', onChange);
  }, []);

  return inView && tabVisible;
}
