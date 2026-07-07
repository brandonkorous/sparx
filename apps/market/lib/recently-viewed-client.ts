// Recently-viewed history for the marketplace. Like favorites, sparx.market
// shoppers are cross-tenant guests with no login, so the browse history lives in
// localStorage — a list of product slugs, most-recent first, capped. The PDP
// records a view on mount; the home "Recently viewed" rail reads the list and
// hydrates it to cards. A custom event keeps it live within the tab.

import { useEffect, useState } from 'react';

const STORE_KEY = 'sparx_market_recently_viewed';
const EVENT = 'sparx-recently-viewed-changed';
const MAX = 20;

export function readRecentlyViewed(): string[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

/** Record a product view — moves the slug to the front, de-duped, capped at MAX. */
export function recordView(slug: string): void {
  try {
    const next = [slug, ...readRecentlyViewed().filter((s) => s !== slug)].slice(0, MAX);
    localStorage.setItem(STORE_KEY, JSON.stringify(next));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* private mode / disabled storage */
  }
}

/** Live recently-viewed slug list — re-renders on any change (this tab or another). */
export function useRecentlyViewed(): string[] {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setSlugs(readRecentlyViewed());
    sync();
    window.addEventListener(EVENT, sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener(EVENT, sync);
      window.removeEventListener('storage', sync);
    };
  }, []);
  return slugs;
}
