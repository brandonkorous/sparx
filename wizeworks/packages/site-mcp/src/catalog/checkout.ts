// Checkout catalog tools (docs/113 §6). The checkout session is owned by the
// same guest cart token. The assistant can build the order (contact, shipping,
// discount) and START payment; the actual card payment is completed by the
// shopper in a browser via the returned client secret / redirect URL — an LLM
// never handles raw card data. Wraps /v1/public/commerce/checkout.

import { z } from 'zod';
import type { SiteTool } from '../types.js';

const sessionId = z.string().uuid();
const cartToken = z
  .string()
  .min(1)
  .describe('The cart token from create_cart (owns the checkout).');

const address = z.object({
  name: z.string().min(1).max(255),
  line1: z.string().min(1).max(255),
  line2: z.string().max(255).optional(),
  city: z.string().min(1).max(127),
  region: z.string().max(127).optional(),
  postalCode: z.string().min(1).max(32),
  country: z.string().length(2).describe('ISO 3166-1 alpha-2.'),
  phone: z.string().max(32).optional(),
});

const startCheckout: SiteTool = {
  name: 'start_checkout',
  description: 'Start a checkout session from a cart. Returns the session (step + totals).',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({ cartId: z.string().uuid(), cartToken, email: z.string().email().optional() }),
  call: (client, _ctx, input) => {
    const { cartToken: token, ...body } = input as Record<string, unknown> & { cartToken: string };
    return client.request({
      method: 'POST',
      path: '/v1/public/commerce/checkout',
      cartToken: token,
      body,
    });
  },
};

const getCheckout: SiteTool = {
  name: 'get_checkout',
  description: 'Read the current state of a checkout session.',
  kind: 'read',
  module: 'commerce',
  input: z.object({ sessionId, cartToken }),
  call: (client, _ctx, input) => {
    const { sessionId: id, cartToken: token } = input as { sessionId: string; cartToken: string };
    return client.request({
      method: 'GET',
      path: `/v1/public/commerce/checkout/${encodeURIComponent(id)}`,
      cartToken: token,
    });
  },
};

const setCheckoutContact: SiteTool = {
  name: 'set_checkout_contact',
  description: 'Set the contact email/phone on a checkout session.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    sessionId,
    cartToken,
    email: z.string().email(),
    phone: z.string().max(32).optional(),
    acceptsMarketing: z.boolean().optional(),
  }),
  call: (client, _ctx, input) => {
    const {
      sessionId: id,
      cartToken: token,
      ...body
    } = input as Record<string, unknown> & {
      sessionId: string;
      cartToken: string;
    };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/checkout/${encodeURIComponent(id)}/contact`,
      cartToken: token,
      body,
    });
  },
};

const getShippingQuotes: SiteTool = {
  name: 'get_shipping_quotes',
  description: 'Get shipping rate options for a checkout session and destination.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    sessionId,
    cartToken,
    destinationCountry: z.string().length(2).optional(),
    destinationPostal: z.string().max(32).optional(),
  }),
  call: (client, _ctx, input) => {
    const {
      sessionId: id,
      cartToken: token,
      ...body
    } = input as Record<string, unknown> & {
      sessionId: string;
      cartToken: string;
    };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/checkout/${encodeURIComponent(id)}/shipping-quote`,
      cartToken: token,
      body,
    });
  },
};

const setCheckoutShipping: SiteTool = {
  name: 'set_checkout_shipping',
  description: 'Set the shipping (and optional billing) address + chosen shipping rate.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    sessionId,
    cartToken,
    shippingAddress: address,
    billingAddress: address.optional(),
    shippingRateRef: z.string().min(1),
    shippingProviderSlug: z.string().min(1),
  }),
  call: (client, _ctx, input) => {
    const {
      sessionId: id,
      cartToken: token,
      ...body
    } = input as Record<string, unknown> & {
      sessionId: string;
      cartToken: string;
    };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/checkout/${encodeURIComponent(id)}/shipping`,
      cartToken: token,
      body,
    });
  },
};

const applyCheckoutDiscount: SiteTool = {
  name: 'apply_checkout_discount',
  description: 'Apply a discount code to a checkout session.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({ sessionId, cartToken, code: z.string().min(1).max(64) }),
  call: (client, _ctx, input) => {
    const {
      sessionId: id,
      cartToken: token,
      code,
    } = input as {
      sessionId: string;
      cartToken: string;
      code: string;
    };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/checkout/${encodeURIComponent(id)}/discount`,
      cartToken: token,
      body: { code },
    });
  },
};

const createPaymentIntent: SiteTool = {
  name: 'create_payment_intent',
  description:
    'Begin payment for a checkout session. Returns a client secret / redirect URL the SHOPPER completes in a browser — the assistant never handles card details. Provide return/cancel URLs for the redirect flow.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    sessionId,
    cartToken,
    returnUrl: z.string().url().optional(),
    cancelUrl: z.string().url().optional(),
  }),
  call: (client, _ctx, input) => {
    const {
      sessionId: id,
      cartToken: token,
      ...body
    } = input as Record<string, unknown> & {
      sessionId: string;
      cartToken: string;
    };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/checkout/${encodeURIComponent(id)}/payment-intent`,
      cartToken: token,
      body,
    });
  },
};

const completeCheckout: SiteTool = {
  name: 'complete_checkout',
  description:
    'Finalize a checkout into an order once payment is authorized (e.g. after a redirect-return or terms/PO flow). Returns {orderId, orderNumber}.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    sessionId,
    cartToken,
    idempotencyKey: z.string().min(8).max(127).optional(),
  }),
  call: (client, _ctx, input) => {
    const {
      sessionId: id,
      cartToken: token,
      ...body
    } = input as Record<string, unknown> & {
      sessionId: string;
      cartToken: string;
    };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/checkout/${encodeURIComponent(id)}/complete`,
      cartToken: token,
      body,
    });
  },
};

export const checkoutTools: SiteTool[] = [
  startCheckout,
  getCheckout,
  setCheckoutContact,
  getShippingQuotes,
  setCheckoutShipping,
  applyCheckoutDiscount,
  createPaymentIntent,
  completeCheckout,
];
