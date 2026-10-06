// Typesense schema for the orders collection. Dashboard ⌘K palette
// searches across order number, customer name/email, and item titles.

import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { resolveCollectionName } from './naming';

// Prefixed in tests only; see ./naming.ts.
export const ORDERS_COLLECTION = resolveCollectionName('orders');

export function ordersSchema(collectionName: string = ORDERS_COLLECTION): CollectionCreateSchema {
  return {
    name: collectionName,
    fields: [
      { name: 'tenant_id', type: 'string', facet: false, index: true },
      // Origin web property (docs/58 D1). Single-valued — an order is placed on
      // exactly one site (null/absent = unknown origin, e.g. legacy or no
      // `?property=`). Optional so `ensureSchemas` can add it to a populated
      // collection on the next indexer boot. The dashboard Orders Site filter
      // matches `property_id:=<id>`; "All sites" omits it.
      { name: 'property_id', type: 'string', facet: true, optional: true },
      { name: 'order_id', type: 'string', facet: false, index: true },
      { name: 'order_number', type: 'string', facet: false, sort: true, infix: true },
      { name: 'customer_id', type: 'string', facet: true, optional: true },
      { name: 'customer_name', type: 'string', facet: false, optional: true },
      { name: 'customer_email', type: 'string', facet: false, optional: true },
      { name: 'b2b_account_id', type: 'string', facet: true, optional: true },
      // The trade account the order belongs to, by name, so typing an account's
      // name finds its orders. The account the order was quoted or invoiced to
      // when one is on record, else the buyer's pricing account, else the
      // employer the buyer typed. Optional, so `ensureSchemas` adds it to a live
      // collection on the next indexer boot. Searches ask for it only once the
      // live collection has it (`collectionHasField`), because naming a field
      // the collection lacks in `query_by` fails the whole search.
      { name: 'company', type: 'string', facet: false, optional: true },
      { name: 'channel', type: 'string', facet: true },
      { name: 'status', type: 'string', facet: true },
      { name: 'payment_status', type: 'string', facet: true },
      { name: 'fulfillment_status', type: 'string', facet: true, optional: true },
      { name: 'item_titles', type: 'string[]', facet: false, optional: true },
      { name: 'item_skus', type: 'string[]', facet: false, optional: true },
      { name: 'tags', type: 'string[]', facet: true, optional: true },
      { name: 'total_cents', type: 'int64', facet: false, sort: true },
      { name: 'currency', type: 'string', facet: true },
      { name: 'placed_at', type: 'int64', facet: false, sort: true },
    ],
    default_sorting_field: 'placed_at',
  };
}

export interface OrderSearchDocument {
  id: string; // `${tenantId}:${orderId}`
  tenant_id: string;
  /** Origin web property (docs/58 D1); absent when the origin is unknown. */
  property_id?: string;
  order_id: string;
  order_number: string;
  customer_id?: string;
  customer_name?: string;
  customer_email?: string;
  /** The trade account the order belongs to (see `company`). */
  b2b_account_id?: string;
  /** That account's name; the buyer's typed employer when there is no account. */
  company?: string;
  channel: string;
  status: string;
  payment_status: string;
  fulfillment_status?: string;
  item_titles?: string[];
  item_skus?: string[];
  tags?: string[];
  total_cents: number;
  currency: string;
  placed_at: number;
}
