// Commerce — pricing, discounts, gift cards, account credit.

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';
import { discountService, pricingService } from '@sparx/commerce';
import { ok, paged } from '@sparx/api-core/envelope';
import { requireRole } from '@sparx/api-core/auth';
import { requireCommerceModule, toCommerceContext } from '../../../lib/commerce-context.js';

const PathId = z.object({ id: z.string().uuid() });
const EntryParam = z.object({ entryId: z.string().uuid() });
const TierParam = z.object({ tierId: z.string().uuid() });
const ProductIdParam = z.object({ productId: z.string().uuid() });

const ListDiscountsQuery = z.object({
  status: z.string().optional(),
  q: z.string().optional(),
  take: z.coerce.number().int().min(1).max(250).optional(),
  skip: z.coerce.number().int().min(0).optional(),
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

const AccountCreditLedgerParams = z.object({ customerId: z.string().uuid() });
const AccountCreditLedgerQuery = z.object({ currency: z.string().length(3).optional() });

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
      ...(q.b2b_account_id ? { b2bAccountId: q.b2b_account_id } : {}),
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

  // Gift cards
  app.get('/v1/commerce/gift-cards', async (request) => {
    requireRole(request, 'viewer');
    await requireCommerceModule(request);
    const q = request.query as Record<string, string | undefined>;
    return ok(
      await discountService.listGiftCards(toCommerceContext(request), {
        q: q?.q,
        take: q?.take ? Number(q.take) : undefined,
      })
    );
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
