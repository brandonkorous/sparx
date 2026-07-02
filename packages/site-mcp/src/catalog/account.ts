// Customer-tier tools (docs/113 §5) — the RETURNING-customer surface: my profile,
// orders, saved addresses, wishlist, appointments (view + reschedule/cancel), and
// B2B portal. Every tool is `kind: 'customer'`, so it is registered only once the
// shopper has authorized via OAuth (the site MCP relays their bearer, which
// api-rest verifies + scope-gates). These wrap the authenticated
// /v1/public/commerce/account, /v1/public/scheduling/account, and /v1/public/b2b
// public routes — the client's bearer carries the granted scopes each route enforces.

import { z } from 'zod';
import type { SiteTool } from '../types.js';

const uuid = z.string().uuid();
const iso = z.string().datetime({ offset: true });

// ── Profile ──────────────────────────────────────────────────────────────────

const getMyProfile: SiteTool = {
  name: 'get_my_profile',
  description: 'Get the signed-in customer’s profile (name, email, phone). Requires account:read.',
  kind: 'customer',
  input: z.object({}),
  call: (client) => client.request({ method: 'GET', path: '/v1/public/commerce/account/me' }),
};

// ── Orders ───────────────────────────────────────────────────────────────────

const listMyOrders: SiteTool = {
  name: 'list_my_orders',
  description:
    'List the signed-in customer’s past orders (paged, newest first). Requires orders:read.',
  kind: 'customer',
  module: 'commerce',
  input: z.object({
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(50).optional(),
  }),
  call: (client, _ctx, input) =>
    client.request({
      method: 'GET',
      path: '/v1/public/commerce/account/orders',
      query: input as Record<string, number>,
    }),
};

const getMyOrder: SiteTool = {
  name: 'get_my_order',
  description:
    'Get one of the signed-in customer’s orders in full (line items, totals, shipping address). Requires orders:read.',
  kind: 'customer',
  module: 'commerce',
  input: z.object({ orderId: uuid }),
  call: (client, _ctx, input) => {
    const { orderId } = input as { orderId: string };
    return client.request({
      method: 'GET',
      path: `/v1/public/commerce/account/orders/${encodeURIComponent(orderId)}`,
    });
  },
};

// ── Addresses ────────────────────────────────────────────────────────────────

const listMyAddresses: SiteTool = {
  name: 'list_my_addresses',
  description: 'List the signed-in customer’s saved addresses. Requires account:read.',
  kind: 'customer',
  module: 'commerce',
  input: z.object({}),
  call: (client) =>
    client.request({ method: 'GET', path: '/v1/public/commerce/account/addresses' }),
};

const addMyAddress: SiteTool = {
  name: 'add_my_address',
  description:
    'Save a new address to the signed-in customer’s address book. Requires account:write.',
  kind: 'customer',
  module: 'commerce',
  input: z.object({
    type: z.enum(['shipping', 'billing', 'both']).optional(),
    label: z.string().max(120).optional(),
    recipientName: z.string().max(255).optional(),
    company: z.string().max(255).optional(),
    line1: z.string().min(1).max(255),
    line2: z.string().max(255).optional(),
    city: z.string().min(1).max(120),
    region: z.string().max(120).optional(),
    postalCode: z.string().max(32).optional(),
    country: z.string().length(2).describe('ISO 3166-1 alpha-2 country code.'),
    phone: z.string().max(50).optional(),
    isDefault: z.boolean().optional(),
  }),
  call: (client, _ctx, input) =>
    client.request({ method: 'POST', path: '/v1/public/commerce/account/addresses', body: input }),
};

// ── Wishlist ─────────────────────────────────────────────────────────────────

const listMyWishlist: SiteTool = {
  name: 'list_my_wishlist',
  description: 'List the signed-in customer’s wishlist items. Requires account:read.',
  kind: 'customer',
  module: 'commerce',
  input: z.object({}),
  call: (client) => client.request({ method: 'GET', path: '/v1/public/commerce/account/wishlist' }),
};

const addToWishlist: SiteTool = {
  name: 'add_to_wishlist',
  description:
    'Add a product variant to the signed-in customer’s wishlist. Requires account:write.',
  kind: 'customer',
  module: 'commerce',
  input: z.object({ variantId: uuid }),
  call: (client, _ctx, input) =>
    client.request({ method: 'POST', path: '/v1/public/commerce/account/wishlist', body: input }),
};

const removeFromWishlist: SiteTool = {
  name: 'remove_from_wishlist',
  description: 'Remove a variant from the signed-in customer’s wishlist. Requires account:write.',
  kind: 'customer',
  module: 'commerce',
  input: z.object({ variantId: uuid }),
  call: (client, _ctx, input) => {
    const { variantId } = input as { variantId: string };
    return client.request({
      method: 'DELETE',
      path: `/v1/public/commerce/account/wishlist/${encodeURIComponent(variantId)}`,
    });
  },
};

// ── Appointments ─────────────────────────────────────────────────────────────

const listMyBookings: SiteTool = {
  name: 'list_my_bookings',
  description:
    'List the signed-in customer’s appointments (scope: upcoming | past | all). Requires bookings:read.',
  kind: 'customer',
  module: 'scheduling',
  input: z.object({
    scope: z.enum(['upcoming', 'past', 'all']).optional(),
    page: z.number().int().min(1).optional(),
    pageSize: z.number().int().min(1).max(50).optional(),
  }),
  call: (client, _ctx, input) =>
    client.request({
      method: 'GET',
      path: '/v1/public/scheduling/account/bookings',
      query: input as Record<string, string | number>,
    }),
};

const getMyBooking: SiteTool = {
  name: 'get_my_booking',
  description: 'Get one of the signed-in customer’s appointments in full. Requires bookings:read.',
  kind: 'customer',
  module: 'scheduling',
  input: z.object({ bookingId: uuid }),
  call: (client, _ctx, input) => {
    const { bookingId } = input as { bookingId: string };
    return client.request({
      method: 'GET',
      path: `/v1/public/scheduling/account/bookings/${encodeURIComponent(bookingId)}`,
    });
  },
};

const rescheduleMyBooking: SiteTool = {
  name: 'reschedule_my_booking',
  description:
    'Move one of the signed-in customer’s appointments to a new start time. Confirm the new slot with check_availability first. Requires bookings:write.',
  kind: 'customer',
  module: 'scheduling',
  input: z.object({ bookingId: uuid, startAt: iso.describe('New start time (ISO 8601).') }),
  call: (client, _ctx, input) => {
    const { bookingId, ...body } = input as { bookingId: string; startAt: string };
    return client.request({
      method: 'POST',
      path: `/v1/public/scheduling/account/bookings/${encodeURIComponent(bookingId)}/reschedule`,
      body,
    });
  },
};

const cancelMyBooking: SiteTool = {
  name: 'cancel_my_booking',
  description:
    'Cancel one of the signed-in customer’s appointments (a cancellation fee may apply per the site’s policy). Requires bookings:write.',
  kind: 'customer',
  module: 'scheduling',
  input: z.object({ bookingId: uuid, reason: z.string().max(500).optional() }),
  call: (client, _ctx, input) => {
    const { bookingId, ...body } = input as { bookingId: string; reason?: string };
    return client.request({
      method: 'POST',
      path: `/v1/public/scheduling/account/bookings/${encodeURIComponent(bookingId)}/cancel`,
      body,
    });
  },
};

// ── B2B portal ───────────────────────────────────────────────────────────────

const listMyB2bAccounts: SiteTool = {
  name: 'list_my_b2b_accounts',
  description:
    'List the B2B/wholesale accounts the signed-in customer is a contact on (company, credit, terms). Requires b2b:read.',
  kind: 'customer',
  input: z.object({}),
  call: (client) => client.request({ method: 'GET', path: '/v1/public/b2b/portal' }),
};

const getMyB2bAccount: SiteTool = {
  name: 'get_my_b2b_account',
  description:
    'Summary for one of the signed-in customer’s B2B accounts (credit, receivables, recent orders). Requires b2b:read.',
  kind: 'customer',
  input: z.object({ accountId: uuid }),
  call: (client, _ctx, input) => {
    const { accountId } = input as { accountId: string };
    return client.request({
      method: 'GET',
      path: `/v1/public/b2b/portal/${encodeURIComponent(accountId)}/summary`,
    });
  },
};

const listMyB2bInvoices: SiteTool = {
  name: 'list_my_b2b_invoices',
  description: 'List invoices for one of the signed-in customer’s B2B accounts. Requires b2b:read.',
  kind: 'customer',
  input: z.object({
    accountId: uuid,
    take: z.number().int().min(1).max(100).optional(),
    skip: z.number().int().min(0).optional(),
  }),
  call: (client, _ctx, input) => {
    const { accountId, ...query } = input as { accountId: string; take?: number; skip?: number };
    return client.request({
      method: 'GET',
      path: `/v1/public/b2b/portal/${encodeURIComponent(accountId)}/invoices`,
      query,
    });
  },
};

export const accountTools: SiteTool[] = [
  getMyProfile,
  listMyOrders,
  getMyOrder,
  listMyAddresses,
  addMyAddress,
  listMyWishlist,
  addToWishlist,
  removeFromWishlist,
  listMyBookings,
  getMyBooking,
  rescheduleMyBooking,
  cancelMyBooking,
  listMyB2bAccounts,
  getMyB2bAccount,
  listMyB2bInvoices,
];
