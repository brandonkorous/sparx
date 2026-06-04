// Shared types for the SEO overview (docs/50 §7). Kept out of the 'use server'
// actions file so a plain type export never trips the server-action constraint.

import type { EntityType, Grade } from '@sparx/seo-audit';

/** A stored snapshot row from `GET /v1/seo/audits` — the denormalized fields the
 *  overview renders without re-fetching each entity. */
export interface SeoAuditRow {
  id: string;
  entityType: EntityType;
  entityId: string;
  score: number;
  grade: Grade;
  fixFirst: string | null;
  title: string | null;
  path: string | null;
  computedAt: string;
}

export const ENTITY_LABEL: Record<EntityType, string> = {
  builder_page: 'Page',
  cms_page: 'CMS page',
  product: 'Product',
  collection: 'Collection',
};
