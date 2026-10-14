// Typesense schema for the UNIVERSAL `entities` collection (docs/39).
//
// Every user-facing entity in sparx — across CMS, Commerce, CRM, Email, and
// Site Builder — projects a uniform document into this one collection. It
// powers global ⌘K ("find anything across sparx") and list-page search for
// entities that don't warrant their own rich, faceted collection.
//
// The three rich collections (products/customers/orders) keep their own
// schemas for fitment/price/payment faceting + storefront instant-search;
// they ALSO project a lightweight doc here so global search stays a single
// query. See wizeworks/packages/search/src/schemas/products.ts for the rich pattern.

import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { resolveCollectionName } from './naming';

// Prefixed in tests only; see ./naming.ts.
export const ENTITIES_COLLECTION = resolveCollectionName('entities');

export interface UniversalSearchDocument {
  /** `${tenantId}:${entityType}:${recordId}` — globally unique. */
  id: string;
  /** Hidden tenancy guard. Every query MUST filter on this. */
  tenant_id: string;
  /** 'cms_page' | 'warehouse' | 'b2b_account' | 'quote' | … */
  entity_type: string;
  /** 'cms' | 'commerce' | 'crm' | 'email' | 'sitebuilder' — for grouping + module gating. */
  module: string;
  /** The owning module's stable record id (drives the deep link). */
  record_id: string;
  /** Primary label (page title, account name, discount code). */
  title: string;
  /** Secondary line (status, owner, sku, email). */
  subtitle?: string;
  /** Searchable snippet — descriptions / CMS body text (capped on projection). */
  body?: string;
  /** Extra match tokens (sku, code, slug, email, phone). */
  keywords?: string[];
  /** draft/active/archived/etc. — faceted. */
  status?: string;
  /** Deep-link path the ⌘K hit / list row navigates to. */
  url?: string;
  /** Epoch seconds. */
  created_at: number;
  /** Epoch seconds — sort + default_sorting_field. */
  updated_at: number;
  /**
   * Who may find this document: `['everyone']`, or the one person who made it
   * and kept it to herself (persona issue 264). Set only by the kinds listed in
   * `PERSONAL_ENTITY_TYPES`; every other kind leaves it out and is found by
   * anyone in the business, as before.
   */
  visible_to?: string[];
}

/** The `visible_to` value for a document anyone in the business may find. */
export const VISIBLE_TO_EVERYONE = 'everyone';

/**
 * The kinds of document that say who may find them. A search answers a document
 * of these kinds only when `visible_to` names this person or everyone, so one of
 * them indexed without the field is found by nobody until it is projected again,
 * which is the safe way round. A new kind that carries `visible_to` belongs here,
 * or its private documents are found by everyone.
 */
export const PERSONAL_ENTITY_TYPES: readonly string[] = ['report', 'dashboard'];

export function entitiesSchema(
  collectionName: string = ENTITIES_COLLECTION
): CollectionCreateSchema {
  return {
    name: collectionName,
    fields: [
      { name: 'tenant_id', type: 'string', index: true, facet: false },
      { name: 'entity_type', type: 'string', facet: true },
      { name: 'module', type: 'string', facet: true },
      { name: 'record_id', type: 'string', index: true, facet: false },
      { name: 'title', type: 'string', sort: true, infix: true },
      { name: 'subtitle', type: 'string', optional: true },
      { name: 'body', type: 'string', optional: true },
      { name: 'keywords', type: 'string[]', facet: false, optional: true },
      { name: 'status', type: 'string', facet: true, optional: true },
      // url is stored for the deep link only — never searched or faceted.
      { name: 'url', type: 'string', index: false, optional: true },
      { name: 'created_at', type: 'int64', sort: true },
      { name: 'updated_at', type: 'int64', sort: true },
      // Optional, so `ensureSchemas` adds it to a live collection on the next
      // indexer boot and Typesense indexes the documents already stored.
      { name: 'visible_to', type: 'string[]', facet: false, optional: true },
    ],
    default_sorting_field: 'updated_at',
    token_separators: ['-', '_', '/', '.'],
    symbols_to_index: ['+'],
  };
}
