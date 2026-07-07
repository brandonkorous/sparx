'use client';

// Client-only favorites (wishlist) for the marketplace. sparx.market shoppers are
// cross-tenant guests with no login, so favorites live in localStorage (like the
// guest cart token) — a list of product slugs, most-recent first. A custom event
// broadcasts changes so every heart + the /favorites page + the header badge stay
// in sync within the tab; the native `storage` event syncs across tabs.

import { useCallback, useEffect, useState } from 'react';

import { fetchListingsBySlugs } from './listings-client';

const STORE_KEY = 'sparx_market_favorites';
const EVENT = 'sparx-favorites-changed';

export function readFavorites(): string[] {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as unknown;
    return Array.isArray(parsed) ? parsed.filter((x): x is string => typeof x === 'string') : [];
  } catch {
    return [];
  }
}

function writeFavorites(slugs: string[]): void {
  try {
    localStorage.setItem(STORE_KEY, JSON.stringify(slugs));
    window.dispatchEvent(new CustomEvent(EVENT));
  } catch {
    /* private mode / disabled storage */
  }
}

/** Toggle a slug's favorite state; returns the NEW state (true = now favorited). */
export function toggleFavorite(slug: string): boolean {
  const current = readFavorites();
  const has = current.includes(slug);
  writeFavorites(has ? current.filter((s) => s !== slug) : [slug, ...current]);
  return !has;
}

export function removeFavorite(slug: string): void {
  writeFavorites(readFavorites().filter((s) => s !== slug));
}

// ── Hooks ────────────────────────────────────────────────────────────────────

/** Live favorites slug list — re-renders on any change (this tab or another). */
export function useFavorites(): string[] {
  const [slugs, setSlugs] = useState<string[]>([]);
  useEffect(() => {
    const sync = () => setSlugs(readFavorites());
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

/** [isFavorited, toggle] for a single product. */
export function useIsFavorite(slug: string): [boolean, () => void] {
  const slugs = useFavorites();
  const toggle = useCallback(() => {
    toggleFavorite(slug);
  }, [slug]);
  return [slugs.includes(slug), toggle];
}

// ── Data ─────────────────────────────────────────────────────────────────────

/** Resolve saved slugs to product cards (order preserved). Thin alias over the
 *  shared by-slugs resolver — the /favorites page imports this name. */
export const fetchFavoriteListings = fetchListingsBySlugs;
