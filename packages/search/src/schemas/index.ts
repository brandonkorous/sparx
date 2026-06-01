// Typesense schemas barrel. The commerce-indexer worker imports these to
// `collections().create()` on first deploy + every schema version bump.

export * from './products';
export * from './customers';
export * from './orders';
export * from './entities';

import type { CollectionCreateSchema } from 'typesense/lib/Typesense/Collections';

import { CUSTOMERS_COLLECTION, customersSchema } from './customers';
import { ENTITIES_COLLECTION, entitiesSchema } from './entities';
import { ORDERS_COLLECTION, ordersSchema } from './orders';
import { PRODUCTS_COLLECTION, productsSchema } from './products';

/** All schemas Sparx manages. The indexer worker creates these on boot
 *  (idempotent — checks for existence first) and recreates them with
 *  `_v2`-style suffixes when a breaking change lands.
 *
 *  `entities` is the universal collection (docs/39) every module projects
 *  into; products/customers/orders keep their rich faceted collections. */
export function allSchemas(): { name: string; schema: CollectionCreateSchema }[] {
  return [
    { name: PRODUCTS_COLLECTION, schema: productsSchema() },
    { name: CUSTOMERS_COLLECTION, schema: customersSchema() },
    { name: ORDERS_COLLECTION, schema: ordersSchema() },
    { name: ENTITIES_COLLECTION, schema: entitiesSchema() },
  ];
}
