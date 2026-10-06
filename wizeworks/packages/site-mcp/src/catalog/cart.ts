// Cart catalog tools (docs/113 §6). A guest cart is owned by an opaque token
// minted on create_cart; because the MCP transport is stateless, the token +
// cartId travel as explicit tool arguments (the assistant carries them across
// turns) and are relayed as the `x-cart-token` header. Wraps /v1/public/commerce/cart.

import { z } from 'zod';
import type { SiteTool } from '../types.js';

const cartId = z.string().uuid();
const cartToken = z.string().min(1).describe('The cart token returned by create_cart.');

const createCart: SiteTool = {
  name: 'create_cart',
  description:
    'Create a new guest cart. Returns the cart plus a `token`: keep the cartId AND token and pass them to every later cart/checkout tool.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({}),
  call: (client) => client.request({ method: 'POST', path: '/v1/public/commerce/cart' }),
};

const getCart: SiteTool = {
  name: 'get_cart',
  description: 'Read the current contents + totals of a cart.',
  kind: 'read',
  module: 'commerce',
  input: z.object({ cartId, cartToken }),
  call: (client, _ctx, input) => {
    const { cartId: id, cartToken: token } = input as { cartId: string; cartToken: string };
    return client.request({
      method: 'GET',
      path: `/v1/public/commerce/cart/${encodeURIComponent(id)}`,
      cartToken: token,
    });
  },
};

const addToCart: SiteTool = {
  name: 'add_to_cart',
  description:
    'Add a product variant to the cart. A rebuilt part with a refundable core deposit (`coreChargeCents` on the variant) is bought by paying the deposit, unless the variant has `coreFirstOffered` and you pass `coreFirst: true`: then the buyer sends the old part first, pays no deposit, and the part is held until the old one arrives.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    cartId,
    cartToken,
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(999).default(1),
    coreFirst: z
      .boolean()
      .optional()
      .describe(
        'Send the old part first instead of paying the core deposit. Only on a variant with coreFirstOffered.'
      ),
  }),
  call: (client, _ctx, input) => {
    const {
      cartId: id,
      cartToken: token,
      variantId,
      quantity,
      coreFirst,
    } = input as {
      cartId: string;
      cartToken: string;
      variantId: string;
      quantity: number;
      coreFirst?: boolean;
    };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/cart/${encodeURIComponent(id)}/items`,
      cartToken: token,
      body: { variantId, quantity, ...(coreFirst ? { coreFirst: true } : {}) },
    });
  },
};

const updateCartItem: SiteTool = {
  name: 'update_cart_item',
  description:
    'Set the quantity of a cart line (0 removes it). On a rebuilt part whose line has a `coreChoice`, `coreFirst` switches it between paying the core deposit (false) and sending the old part first with no deposit (true).',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    cartId,
    cartToken,
    itemId: z.string().uuid(),
    quantity: z.number().int().min(0).max(999),
    coreFirst: z
      .boolean()
      .optional()
      .describe('Pay the core deposit (false) or send the old part first (true).'),
  }),
  call: (client, _ctx, input) => {
    const {
      cartId: id,
      cartToken: token,
      itemId,
      quantity,
      coreFirst,
    } = input as {
      cartId: string;
      cartToken: string;
      itemId: string;
      quantity: number;
      coreFirst?: boolean;
    };
    return client.request({
      method: 'PATCH',
      path: `/v1/public/commerce/cart/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`,
      cartToken: token,
      body: { quantity, ...(coreFirst !== undefined ? { coreFirst } : {}) },
    });
  },
};

const removeCartItem: SiteTool = {
  name: 'remove_cart_item',
  description: 'Remove a line from the cart.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({ cartId, cartToken, itemId: z.string().uuid() }),
  call: (client, _ctx, input) => {
    const {
      cartId: id,
      cartToken: token,
      itemId,
    } = input as {
      cartId: string;
      cartToken: string;
      itemId: string;
    };
    return client.request({
      method: 'DELETE',
      path: `/v1/public/commerce/cart/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`,
      cartToken: token,
    });
  },
};

const applyDiscount: SiteTool = {
  name: 'apply_discount',
  description: 'Apply a discount code to the cart.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({ cartId, cartToken, code: z.string().min(1).max(64) }),
  call: (client, _ctx, input) => {
    const {
      cartId: id,
      cartToken: token,
      code,
    } = input as {
      cartId: string;
      cartToken: string;
      code: string;
    };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/cart/${encodeURIComponent(id)}/discount`,
      cartToken: token,
      body: { code },
    });
  },
};

const removeDiscount: SiteTool = {
  name: 'remove_discount',
  description: 'Remove a previously applied discount code from the cart.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({ cartId, cartToken, code: z.string().min(1).max(64) }),
  call: (client, _ctx, input) => {
    const {
      cartId: id,
      cartToken: token,
      code,
    } = input as {
      cartId: string;
      cartToken: string;
      code: string;
    };
    return client.request({
      method: 'DELETE',
      path: `/v1/public/commerce/cart/${encodeURIComponent(id)}/discount/${encodeURIComponent(code)}`,
      cartToken: token,
    });
  },
};

export const cartTools: SiteTool[] = [
  createCart,
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  applyDiscount,
  removeDiscount,
];
