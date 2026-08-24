// The collection editor's draft: what it holds, and the two shapes it converts
// between.

import {
  asRuleSet,
  type CollectionDetail,
  type CollectionRuleSet,
  type CollectionType,
} from './collections-data';

export const EMPTY_RULES: CollectionRuleSet = { match: 'all', predicates: [] };

/* ── Draft ──────────────────────────────────────────────────────────────── */

export interface Draft {
  name: string;
  handle: string;
  description: string;
  featured: boolean;
  heroMediaId: string | null;
  seoTitle: string;
  seoDescription: string;
  ogImageId: string | null;
  propertyIds: string[];
  /** Chosen at create, fixed after. */
  type: CollectionType;
  /** The rule set, used only when `type` is `rules`. */
  ruleSet: CollectionRuleSet;
  /** The hand-picked members, used only when `type` is `manual`. */
  productIds: string[];
}

export function emptyDraft(): Draft {
  return {
    name: '',
    handle: '',
    description: '',
    featured: false,
    heroMediaId: null,
    seoTitle: '',
    seoDescription: '',
    ogImageId: null,
    propertyIds: [],
    type: 'manual',
    ruleSet: EMPTY_RULES,
    productIds: [],
  };
}

export function toDraft(collection: CollectionDetail): Draft {
  return {
    name: collection.name,
    handle: collection.handle,
    description: collection.description ?? '',
    featured: collection.featured,
    heroMediaId: collection.heroMediaId,
    seoTitle: collection.seoTitle ?? '',
    seoDescription: collection.seoDescription ?? '',
    ogImageId: collection.ogImageId,
    propertyIds: collection.propertyIds,
    type: collection.type,
    ruleSet: asRuleSet(collection.ruleSet) ?? EMPTY_RULES,
    productIds: collection.productIds,
  };
}

export function sameSet(a: string[], b: string[]): boolean {
  if (a.length !== b.length) return false;
  const seen = new Set(b);
  return a.every((value) => seen.has(value));
}
