// Commerce — pricing, discounts, gift cards, account credit.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { discountService, pricingService } from '@wizeworks/commerce';
import { ok, paged } from '@wizeworks/api-core/envelope';
import { requireRole } from '@wizeworks/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const PathId = z.object({ id: z.string().uuid() });
const EntryParam = z.object({ entryId: z.string().uuid() });
const TierParam = z.object({ tierId: z.string().uuid() });
const ProductIdParam = z.object({ productId: z.string().uuid() });

// Sort columns are a server-side WHITELIST (mirrors the discount service's
// `DiscountSortField`). A client-supplied column that is not on the list is
// rejected by the enum, never interpolated into an orderBy — Zod answers a bad
// `sort_by` with a 422. Sorting lives on the server because both lists page.
const SortOrder = z.enum(['asc', 'desc']);
const DiscountSort = z.enum([
  'name',
  'code',
  'status',
  'valueCents',
  'valuePercent',
  'createdAt',
  'updatedAt',
]);
const GiftCardSort = z.enum([
  'code',
  'balanceCents',
  'initialBalanceCents',
  'status',
  'expiresAt',
  'createdAt',
]);

const ListDiscountsQuery = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  sort_by: DiscountSort.optional(),
  order: SortOrder.optional(),
});

const ListGiftCardsQuery = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
  sort_by: GiftCardSort.optional(),
  order: SortOrder.optional(),
});

const ListPriceListsQuery = z.object({
  status: z.string().optional(),
  channel: z.string().optional(),
  b2b_account_id: z.string().optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
});

const ListContractPricesQuery = z.object({
  b2b_account_id: z.string().uuid(),
});

// What this customer pays for these things, today, on this site. The counter's
// question, and the ONLY way to ask it from the console — the till used to read
// the variant's list price and post it through, so a shop with an agreed price
// was quoted full retail at the till it sells from (issue 737).
//
// A read that takes a body, because a basket is a list and a query string is
// the wrong shape for one. POST is the verb; nothing is written.
const QuoteLinesBody = z.object({
  customerId: z.string().uuid(),
  property_id: z.string().uuid().optional(),
  channel: z.enum(['storefront', 'b2b_portal', 'admin', 'subscription']).default('admin'),
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'A currency code is three letters, like USD or GBP')
    .default('USD'),
  lines: z
    .array(
      z.object({
        variantId: z.string().uuid(),
        quantity: z.number().int().positive().max(100_000),
      })
    )
    .min(1)
    // One price resolution is one query chain, so a basket is bounded. Nobody
    // rings up 251 different things at a counter; a bulk import does, and it
    // has its own path.
    .max(250),
});

const AccountCreditLedgerParams = z.object({ customerId: z.string().uuid() });
const AccountCreditLedgerQuery = z.object({
  currency: z
    .string()
    .regex(/^[A-Za-z]{3}$/, 'A currency code is three letters, like USD or GBP')
    .optional(),
});

// eslint-disable-next-line @typescript-eslint/require-await -- FastifyPluginAsync type demands async; no top-level await needed because route registration is sync.
const pricingRoutes: FastifyPluginAsync = async (app) => {
  // Price lists
  app.get('/v1/commerce/price-lists', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListPriceListsQuery.parse(request.query);
    const { items, total } = await pricingService.listPriceLists(toCommerceContext(request), {
      ...(q.status ? { status: q.status } : {}),
      ...(q.channel ? { channel: q.channel } : {}),
      ...(q.b2b_account_id ? { companyId: q.b2b_account_id } : {}),
      ...(q.q ? { q: q.q } : {}),
      take: q.take,
      skip: q.skip,
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/commerce/price-lists/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await pricingService.getPriceList(toCommerceContext(request), id));
  });

  app.post('/v1/commerce/price-lists', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await pricingService.createPriceList(toCommerceContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/commerce/price-lists/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await pricingService.updatePriceList(toCommerceContext(request), id, request.body));
  });

  app.post('/v1/commerce/price-lists/:id/archive', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await pricingService.archivePriceList(toCommerceContext(request), id);
    return ok({ id, archived: true });
  });

  app.get('/v1/commerce/price-lists/:id/entries', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await pricingService.listEntries(toCommerceContext(request), id));
  });

  // Write MANY entries for ONE list in a single request (upsert on variant +
  // quantity). This is the authoring write side the workbench price-list editor
  // uses: a list can carry hundreds of prices, and a request per entry is the
  // N+1 storm the client data layer forbids. The list id comes from the path;
  // the body carries only the entries. Distinct path (`/entries/bulk`) + method
  // from the reads above, so no route collides.
  app.post('/v1/commerce/price-lists/:id/entries/bulk', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    const body = (request.body ?? {}) as { entries?: unknown };
    return ok(
      await pricingService.bulkSetEntries(toCommerceContext(request), {
        priceListId: id,
        entries: body.entries ?? [],
      })
    );
  });

  // Every price-list entry for ONE product, across all its lists — the inverse
  // of :id/entries, for the Product → Pricing tab. Answered in one query so the
  // client never loops price lists (the workbench data layer forbids the N+1).
  app.get('/v1/commerce/products/:productId/price-list-entries', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { productId } = ProductIdParam.parse(request.params);
    return ok(await pricingService.listEntriesForProduct(toCommerceContext(request), productId));
  });

  app.post('/v1/commerce/price-list-entries', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    return ok(await pricingService.setPriceListEntry(toCommerceContext(request), request.body));
  });

  app.delete('/v1/commerce/price-list-entries/:entryId', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { entryId } = EntryParam.parse(request.params);
    await pricingService.deletePriceListEntry(toCommerceContext(request), entryId);
    reply.code(204);
  });

  // Bulk tiers
  app.get('/v1/commerce/bulk-tiers', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = request.query as Record<string, string | undefined>;
    return ok(
      await pricingService.listBulkTiers(toCommerceContext(request), {
        variantId: q?.variant_id,
        productId: q?.product_id,
      })
    );
  });

  app.post('/v1/commerce/bulk-tiers', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await pricingService.createBulkTier(toCommerceContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.delete('/v1/commerce/bulk-tiers/:tierId', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { tierId } = TierParam.parse(request.params);
    await pricingService.deleteBulkTier(toCommerceContext(request), tierId);
    reply.code(204);
  });

  // Contract prices
  app.get('/v1/commerce/contract-prices', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListContractPricesQuery.parse(request.query);
    return ok(
      await pricingService.listContractPricesForAccount(
        toCommerceContext(request),
        q.b2b_account_id
      )
    );
  });

  app.post('/v1/commerce/contract-prices', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await pricingService.createContractPrice(
      toCommerceContext(request),
      request.body
    );
    reply.code(201);
    return ok(created);
  });

  app.delete('/v1/commerce/contract-prices/:id', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await pricingService.deleteContractPrice(toCommerceContext(request), id);
    reply.code(204);
  });

  // What a named customer pays (issue 737)
  app.post('/v1/commerce/pricing/quote', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const body = QuoteLinesBody.parse(request.body);
    return ok(
      await pricingService.resolveForCustomer(toCommerceContext(request), {
        channel: body.channel,
        currency: body.currency.toUpperCase(),
        customerId: body.customerId,
        ...(body.property_id ? { propertyId: body.property_id } : {}),
        lines: body.lines,
      })
    );
  });

  // Discounts
  app.get('/v1/commerce/discounts', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListDiscountsQuery.parse(request.query);
    const { items, total } = await discountService.listDiscounts(toCommerceContext(request), {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { q: q.q } : {}),
      take: q.take,
      skip: q.skip,
      ...(q.sort_by ? { sortBy: q.sort_by } : {}),
      ...(q.order ? { order: q.order } : {}),
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.get('/v1/commerce/discounts/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await discountService.getDiscount(toCommerceContext(request), id));
  });

  app.post('/v1/commerce/discounts', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await discountService.createDiscount(toCommerceContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.patch('/v1/commerce/discounts/:id', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await discountService.updateDiscount(toCommerceContext(request), id, request.body));
  });

  app.post('/v1/commerce/discounts/:id/activate', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await discountService.activateDiscount(toCommerceContext(request), id);
    return ok({ id, activated: true });
  });

  app.post('/v1/commerce/discounts/:id/archive', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    await discountService.archiveDiscount(toCommerceContext(request), id);
    return ok({ id, archived: true });
  });

  // Gift cards — a real paged list (skip/take/total + server-side sort), the
  // same shape as discounts, so the workbench table pages and sorts correctly.
  app.get('/v1/commerce/gift-cards', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = ListGiftCardsQuery.parse(request.query);
    const { items, total } = await discountService.listGiftCards(toCommerceContext(request), {
      ...(q.status ? { status: q.status } : {}),
      ...(q.q ? { q: q.q } : {}),
      take: q.take,
      skip: q.skip,
      ...(q.sort_by ? { sortBy: q.sort_by } : {}),
      ...(q.order ? { order: q.order } : {}),
    });
    return paged(items, { total, per_page: q.take ?? 50 });
  });

  app.post('/v1/commerce/gift-cards', async (request, reply) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    const created = await discountService.issueGiftCard(toCommerceContext(request), request.body);
    reply.code(201);
    return ok(created);
  });

  app.get('/v1/commerce/gift-cards/lookup', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = request.query as Record<string, string | undefined>;
    return ok(await discountService.lookupGiftCard(toCommerceContext(request), q?.code ?? ''));
  });

  // One gift card in full, WITH its ledger. Static `/lookup` is registered above;
  // Fastify prefers the literal segment, so this param route never shadows it.
  app.get('/v1/commerce/gift-cards/:id', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { id } = PathId.parse(request.params);
    return ok(await discountService.getGiftCard(toCommerceContext(request), id));
  });

  app.post('/v1/commerce/gift-cards/adjust', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    return ok(await discountService.adjustGiftCard(toCommerceContext(request), request.body));
  });

  // Account credit
  app.post('/v1/commerce/account-credit/grant', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    return ok(await discountService.grantAccountCredit(toCommerceContext(request), request.body));
  });

  // Taking it back. Its own endpoint rather than a negative amount on `grant`:
  // the two are different intentions with different audit actions, and a sign
  // is one character away from the opposite of what the caller meant.
  app.post('/v1/commerce/account-credit/take-back', async (request) => {
    requireRole(request, 'editor');
    await requireCommerceModule(request);
    return ok(
      await discountService.takeBackAccountCredit(toCommerceContext(request), request.body)
    );
  });

  // One customer's store-credit balance + its ledger. Static `/grant` is
  // registered above; Fastify prefers the literal segment over `:customerId`.
  // (The list of every customer WITH credit lives at GET /v1/commerce/
  // account-credit in routes/v1/commerce/lists.ts.)
  app.get('/v1/commerce/account-credit/:customerId/ledger', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const { customerId } = AccountCreditLedgerParams.parse(request.params);
    const q = AccountCreditLedgerQuery.parse(request.query);
    const currency = q.currency ?? 'USD';
    const ctx = toCommerceContext(request);
    const [balance, transactions] = await Promise.all([
      discountService.getAccountCreditBalance(ctx, customerId, currency),
      discountService.listAccountCreditTransactions(ctx, customerId, currency),
    ]);
    return ok({
      customerId,
      currency,
      balanceCents: balance?.balanceCents ?? 0,
      transactions,
    });
  });
};

export default pricingRoutes;
