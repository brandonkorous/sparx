// Cart catalog tools (docs/113 §6). A guest cart is owned by an opaque token
// minted on create_cart; because the MCP transport is stateless, the token +
// cartId travel as explicit tool arguments (the assistant carries them across
// turns) and are relayed as the `x-cart-token` header. Wraps /v1/public/commerce/cart.

import { z } from 'zod';
import type { StorefrontTool } from '../types.js';

const cartId = z.string().uuid();
const cartToken = z.string().min(1).describe('The cart token returned by create_cart.');

const createCart: StorefrontTool = {
  name: 'create_cart',
  description:
    'Create a new guest cart. Returns the cart plus a `token` — keep the cartId AND token and pass them to every later cart/checkout tool.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({}),
  call: (client) => client.request({ method: 'POST', path: '/v1/public/commerce/cart' }),
};

const getCart: StorefrontTool = {
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

const addToCart: StorefrontTool = {
  name: 'add_to_cart',
  description: 'Add a product variant to the cart.',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    cartId,
    cartToken,
    variantId: z.string().uuid(),
    quantity: z.number().int().min(1).max(999).default(1),
  }),
  call: (client, _ctx, input) => {
    const {
      cartId: id,
      cartToken: token,
      variantId,
      quantity,
    } = input as {
      cartId: string;
      cartToken: string;
      variantId: string;
      quantity: number;
    };
    return client.request({
      method: 'POST',
      path: `/v1/public/commerce/cart/${encodeURIComponent(id)}/items`,
      cartToken: token,
      body: { variantId, quantity },
    });
  },
};

const updateCartItem: StorefrontTool = {
  name: 'update_cart_item',
  description: 'Set the quantity of a cart line (0 removes it).',
  kind: 'guest_write',
  module: 'commerce',
  input: z.object({
    cartId,
    cartToken,
    itemId: z.string().uuid(),
    quantity: z.number().int().min(0).max(999),
  }),
  call: (client, _ctx, input) => {
    const {
      cartId: id,
      cartToken: token,
      itemId,
      quantity,
    } = input as {
      cartId: string;
      cartToken: string;
      itemId: string;
      quantity: number;
    };
    return client.request({
      method: 'PATCH',
      path: `/v1/public/commerce/cart/${encodeURIComponent(id)}/items/${encodeURIComponent(itemId)}`,
      cartToken: token,
      body: { quantity },
    });
  },
};

const removeCartItem: StorefrontTool = {
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

const applyDiscount: StorefrontTool = {
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

const removeDiscount: StorefrontTool = {
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

export const cartTools: StorefrontTool[] = [
  createCart,
  getCart,
  addToCart,
  updateCartItem,
  removeCartItem,
  applyDiscount,
  removeDiscount,
];
