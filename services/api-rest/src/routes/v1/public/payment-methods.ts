// Public customer payment methods + repeat-order self-service (docs/142 §9).
//
//   GET    /v1/public/commerce/account/payment-methods           ?tenant=
//   POST   /v1/public/commerce/account/payment-methods/setup     ?tenant=   → begin vaulting
//   POST   /v1/public/commerce/account/payment-methods/complete  ?tenant=   → persist the token
//   POST   /v1/public/commerce/account/payment-methods/:id/default
//   DELETE /v1/public/commerce/account/payment-methods/:id
//   GET    /v1/public/commerce/account/subscriptions             ?tenant=
//   POST   /v1/public/commerce/account/subscriptions/:id/payment-method
//
// These exist because the vault is useless without them. A subscription that
// charges a saved card leaves the customer with a standing obligation they can
// only change by emailing the merchant — which is how a routine expired card
// turns into a cancellation.
//
// The card itself never passes through here. `setup` returns a client secret (or
// a hosted URL) the browser uses to talk to the gateway directly; `complete`
// reads back only a token plus "Visa ending 4242".

import type { FastifyPluginAsync } from 'fastify';
import { z } from 'zod';

import { paymentMethodService, subscriptionService } from '@sparx/commerce';
import { StoredMethodsUnsupportedError } from '@sparx/payments';
import { ok } from '@sparx/api-core/envelope';
import { notFound, validationError } from '@sparx/api-core/errors';

import { resolveTenantId } from '../../../lib/public-commerce-context.js';
import { requireCustomerId } from '../../../lib/customer-session.js';

const MethodParam = z.object({ id: z.string().uuid() });
const SubscriptionParam = z.object({ id: z.string().uuid() });

const SetupBody = z.object({
  /** Where a hosted (redirect-style) setup page should return the shopper. */
  returnUrl: z.string().url().max(2000).optional(),
});

// Two gateway shapes, one endpoint. Stripe echoes back the `setupRef` it was
// handed; Square and Authorize.net send the one-time card token their browser
// SDK produced. At least one must be present — which one is the gateway's
// business, not the storefront's.
const CompleteBody = z
  .object({
    setupRef: z.string().min(1).max(255).optional(),
    token: z.string().min(1).max(4000).optional(),
    makeDefault: z.boolean().optional(),
  })
  .refine((v) => v.setupRef !== undefined || v.token !== undefined, {
    message: 'Nothing to save — the card form did not return a result.',
    path: ['setupRef'],
  });

const ChangeMethodBody = z.object({
  billingMode: z.enum(['card', 'invoice']).default('card'),
  paymentMethodId: z.string().uuid().optional(),
});

const paymentMethodRoutes: FastifyPluginAsync = (app) => {
  const context = async (request: Parameters<typeof resolveTenantId>[0]) => ({
    tenantId: await resolveTenantId(request),
  });

  app.get('/v1/public/commerce/account/payment-methods', async (request) => {
    const ctx = await context(request);
    const customerId = await requireCustomerId(request, ctx, 'account:read');
    const [methods, canSave] = await Promise.all([
      paymentMethodService.list(ctx, customerId),
      paymentMethodService.canSaveMethods(ctx),
    ]);
    // `canSave` rides along so the storefront knows whether to offer "add a
    // card" at all. A shopper on a merchant whose processor cannot vault should
    // never be shown a button that leads nowhere.
    return ok({ methods, canSave });
  });

  app.post('/v1/public/commerce/account/payment-methods/setup', async (request) => {
    const body = SetupBody.parse(request.body ?? {});
    const ctx = await context(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    try {
      const session = await paymentMethodService.beginSetup(ctx, {
        customerId,
        ...(body.returnUrl ? { returnUrl: body.returnUrl } : {}),
      });
      return ok(session);
    } catch (err) {
      if (err instanceof StoredMethodsUnsupportedError) {
        // 422 rather than 500: nothing is broken, this merchant's processor
        // simply cannot hold a card. The message is already shopper-safe.
        throw validationError(err.message, [{ field: 'gateway', message: err.message }]);
      }
      throw err;
    }
  });

  app.post('/v1/public/commerce/account/payment-methods/complete', async (request) => {
    const body = CompleteBody.parse(request.body);
    const ctx = await context(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    const method = await paymentMethodService.completeSetup(ctx, {
      customerId,
      ...(body.setupRef ? { setupRef: body.setupRef } : {}),
      ...(body.token ? { token: body.token } : {}),
      ...(body.makeDefault !== undefined ? { makeDefault: body.makeDefault } : {}),
    });
    // Null means the shopper opened the card form and never finished — not an
    // error, and not something to show them a failure for.
    return ok({ method, saved: method !== null });
  });

  app.post('/v1/public/commerce/account/payment-methods/:id/default', async (request) => {
    const { id } = MethodParam.parse(request.params);
    const ctx = await context(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    await assertOwned(ctx, customerId, id);
    await paymentMethodService.setDefault(ctx, id);
    return ok({ id, isDefault: true });
  });

  app.delete('/v1/public/commerce/account/payment-methods/:id', async (request) => {
    const { id } = MethodParam.parse(request.params);
    const ctx = await context(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');
    await assertOwned(ctx, customerId, id);
    // `remove` throws a CommerceConflictError naming how many repeat orders are
    // in the way — the error mapper turns that into a 409 the storefront can
    // show verbatim, which is far better than the raw foreign-key violation the
    // database would otherwise produce.
    await paymentMethodService.remove(ctx, id);
    return ok({ ok: true });
  });

  app.get('/v1/public/commerce/account/subscriptions', async (request) => {
    const ctx = await context(request);
    const customerId = await requireCustomerId(request, ctx, 'account:read');
    const subscriptions = await subscriptionService.listForCustomer(ctx, customerId);
    return ok({ subscriptions });
  });

  app.post('/v1/public/commerce/account/subscriptions/:id/payment-method', async (request) => {
    const { id } = SubscriptionParam.parse(request.params);
    const body = ChangeMethodBody.parse(request.body ?? {});
    const ctx = await context(request);
    const customerId = await requireCustomerId(request, ctx, 'account:write');

    // Ownership is checked against the SUBSCRIPTION's customer, not the
    // session's — a subscription id is a guessable handle, and without this a
    // shopper could repoint someone else's repeat order at their own card.
    const detail = await subscriptionService.get(ctx, id);
    if (detail.customerId !== customerId) throw notFound('Subscription', id);

    if (body.paymentMethodId) await assertOwned(ctx, customerId, body.paymentMethodId);

    await subscriptionService.changePaymentMethod(ctx, {
      subscriptionId: id,
      billingMode: body.billingMode,
      ...(body.paymentMethodId ? { paymentMethodId: body.paymentMethodId } : {}),
    });
    return ok({ id, updated: true });
  });

  return Promise.resolve();
};

/** A saved card belongs to the signed-in shopper, or it does not exist as far as
 *  they are concerned. 404 rather than 403 so the endpoint cannot be used to
 *  probe which ids are real. */
async function assertOwned(
  ctx: { tenantId: string },
  customerId: string,
  methodId: string
): Promise<void> {
  const methods = await paymentMethodService.list(ctx, customerId);
  if (!methods.some((m) => m.id === methodId)) throw notFound('PaymentMethod', methodId);
}

export default paymentMethodRoutes;
