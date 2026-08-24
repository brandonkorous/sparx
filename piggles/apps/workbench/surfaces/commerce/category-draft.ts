// The category editor's draft: what it holds, and how it is read off a saved one.

import type { CategoryDetail } from './categories-data';

/* ── The draft ──────────────────────────────────────────────────────────── */

export interface Draft {
  name: string;
  handle: string;
  description: string;
  parentId: string | null;
  position: number;
  featured: boolean;
  iconMediaId: string | null;
  heroMediaId: string | null;
  seoTitle: string;
  seoDescription: string;
  ogImageId: string | null;
  /** Empty means every site — the platform's own default. */
  propertyIds: string[];
}

export function emptyDraft(): Draft {
  return {
    name: '',
    handle: '',
    description: '',
    parentId: null,
    position: 0,
    featured: false,
    iconMediaId: null,
    heroMediaId: null,
    seoTitle: '',
    seoDescription: '',
    ogImageId: null,
    propertyIds: [],
  };
}

export function toDraft(category: CategoryDetail): Draft {
  return {
    name: category.name,
    handle: category.handle,
    description: category.description ?? '',
    parentId: category.parentId,
    position: category.position,
    featured: category.featured,
    iconMediaId: category.iconMediaId,
    heroMediaId: category.heroMediaId,
    seoTitle: category.seoTitle ?? '',
    seoDescription: category.seoDescription ?? '',
    ogImageId: category.ogImageId,
    propertyIds: category.propertyIds,
  };
}

export function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(b);
  return a.every((value) => seen.has(value));
}
