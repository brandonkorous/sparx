// Typesense schema for the customers collection. Dashboard ⌘K palette
// and the CRM customers list both read from this — the underlying CRM
// service is the source of truth, this is a denormalized read mirror.

import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { resolveCollectionName } from './naming';

// Prefixed in tests only; see ./naming.ts.
export const CUSTOMERS_COLLECTION = resolveCollectionName('customers');

export function customersSchema(
  collectionName: string = CUSTOMERS_COLLECTION
): CollectionCreateSchema {
  return {
    name: collectionName,
    fields: [
      { name: 'tenant_id', type: 'string', facet: false, index: true },
      // Membership web property (docs/58 D2). A customer is a per-site
      // membership, so each doc belongs to exactly one site (null/absent for
      // legacy rows). Optional so `ensureSchemas` adds it to the live
      // collection on the next indexer boot. The dashboard Customers Site
      // filter matches `property_id:=<id>`; "All sites" omits it.
      { name: 'property_id', type: 'string', facet: true, optional: true },
      { name: 'customer_id', type: 'string', facet: false, index: true },
      { name: 'full_name', type: 'string', facet: false, sort: true, infix: true },
      { name: 'email', type: 'string', facet: false, infix: true },
      { name: 'phone', type: 'string', facet: false, optional: true },
      { name: 'company', type: 'string', facet: true, optional: true },
      // Relationship type (retail|b2b|partner|vendor). docs/137.
      { name: 'type', type: 'string', facet: true },
      // Lifecycle stage + lead status (docs/137). Optional so `ensureSchemas`
      // adds them to the live collection on the next indexer boot.
      { name: 'lifecycle_stage', type: 'string', facet: true, optional: true },
      { name: 'lead_status', type: 'string', facet: true, optional: true },
      { name: 'b2b_account_id', type: 'string', facet: true, optional: true },
      { name: 'tags', type: 'string[]', facet: true, optional: true },
      { name: 'total_spent_cents', type: 'int64', facet: false, sort: true },
      // What their orders come to, paid or not. `total_spent_cents` is money
      // received, so a fleet on account read "$150" over $11,285.69 of orders
      // (sparx persona issue 223, the chat panel's issue 163 again). Optional so
      // `ensureSchemas` adds it to the live collection on the next indexer boot.
      { name: 'total_ordered_cents', type: 'int64', facet: false, sort: true, optional: true },
      { name: 'order_count', type: 'int32', facet: false, sort: true },
      { name: 'last_order_at', type: 'int64', facet: false, sort: true, optional: true },
      { name: 'created_at', type: 'int64', facet: false, sort: true },
    ],
    default_sorting_field: 'total_spent_cents',
  };
}

export interface CustomerSearchDocument {
  id: string; // `${tenantId}:${customerId}`
  tenant_id: string;
  /** Membership web property (docs/58 D2); absent for legacy rows. */
  property_id?: string;
  customer_id: string;
  full_name: string;
  email: string;
  phone?: string;
  company?: string;
  type: 'retail' | 'b2b' | 'partner' | 'vendor';
  lifecycle_stage?: string;
  lead_status?: string;
  b2b_account_id?: string;
  tags?: string[];
  /** Money received from them, net of refunds. */
  total_spent_cents: number;
  /** What their orders come to, net of refunds, paid or not. Absent on
   *  documents written before it existed. */
  total_ordered_cents?: number;
  order_count: number;
  last_order_at?: number;
  created_at: number;
}
