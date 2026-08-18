// The processor registry — the one place that knows what can be imported.
//
// Adding an entity is adding a line here. It used to be adding a branch to a
// four-way if/else in the handler, each arm carrying its own copy of the same
// result-writing loop, which is why the list stayed at four for as long as it did.
//
// The three original processors that predate the `EntityProcessor` shape are wrapped
// rather than rewritten: they work, they are tested, and the wrapper is honest about
// what it can and cannot preview.

import type { Logger } from 'pino';

import { processB2bAccountRows } from './b2b_accounts';
import { processCustomerRows } from './customers';
import { processDiscountRows } from './discounts';
import { companiesProcessor } from './companies';
import { contentProcessor } from './content';
import { dealsProcessor } from './deals';
import { inventoryLevelsProcessor } from './inventory-levels';
import { mediaProcessor } from './media';
import { ordersProcessor } from './orders';
import { productsProcessor } from './products';
import { redirectsProcessor } from './redirects';
import { segmentsProcessor } from './segments';
import { purchaseOrdersProcessor, suppliersProcessor } from './supply';
import { categoriesProcessor, collectionsProcessor } from './taxonomy';
import { ticketsProcessor } from './tickets';
import type {
  EntityProcessor,
  ImportRow,
  PreviewResult,
  ProcessorContext,
  ProcessorOptions,
  RowResult,
} from './types';

/**
 * Wrap a pre-`EntityProcessor` row function.
 *
 * Its preview reports every row as `create`, which is deliberately the pessimistic
 * answer: these three resolve their own natural keys inside the write path, so the
 * only way to know create-from-update would be to run them. Saying "create" and then
 * updating is a smaller surprise than the reverse, and the row-level result after the
 * run tells the tenant exactly what happened.
 */
function wrapLegacy(
  entity: string,
  module: string | null,
  run: (
    ctx: { tenantId: string },
    rows: never[],
    opts: { upsert: boolean },
    logger: Logger
  ) => Promise<RowResult[]>
): EntityProcessor {
  return {
    entity,
    module,
    run: (ctx, rows, options, logger) =>
      run(ctx, rows as never[], { upsert: options.upsert }, logger),
    // eslint-disable-next-line @typescript-eslint/require-await
    preview: async (_ctx, rows): Promise<PreviewResult[]> =>
      rows.map((_row, rowIndex) => ({ rowIndex, action: 'create' })),
  };
}

const ALL: EntityProcessor[] = [
  productsProcessor,
  inventoryLevelsProcessor,
  ordersProcessor,
  categoriesProcessor,
  collectionsProcessor,
  contentProcessor,
  mediaProcessor,
  redirectsProcessor,
  companiesProcessor,
  dealsProcessor,
  ticketsProcessor,
  segmentsProcessor,
  suppliersProcessor,
  purchaseOrdersProcessor,
  wrapLegacy('customers', 'crm', processCustomerRows),
  wrapLegacy('discounts', 'commerce', processDiscountRows),
  wrapLegacy('b2b_accounts', 'b2b', processB2bAccountRows),
];

const BY_ENTITY = new Map(ALL.map((processor) => [processor.entity, processor]));

export function getProcessor(entity: string): EntityProcessor | undefined {
  return BY_ENTITY.get(entity);
}

/** Every entity this worker can import. Served by the API so a client never offers
 *  the tenant an entity that would fail on arrival. */
export function supportedEntities(): string[] {
  return [...BY_ENTITY.keys()];
}

export type {
  EntityProcessor,
  ImportRow,
  PreviewResult,
  ProcessorContext,
  ProcessorOptions,
  RowResult,
};
