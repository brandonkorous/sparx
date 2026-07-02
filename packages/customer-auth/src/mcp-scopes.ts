// Shopper MCP OAuth scope vocabulary (docs/113 customer tier). Better Auth's
// mcp() plugin always adds openid/profile/email/offline_access; these are the
// sparx-specific capability scopes a shopper grants their LLM client. The
// storefront-MCP customer-tier tools map to these (read vs write).

export const CUSTOMER_MCP_SCOPES = [
  'shop:read', // browse catalog, availability, store info (the anonymous surface, authenticated)
  'account:read', // my profile + addresses
  'orders:read', // my order history
  'bookings:read', // my appointments
  'bookings:write', // book / reschedule / cancel my appointments
  'cart:write', // build a cart + check out as me
] as const;

export type CustomerMcpScope = (typeof CUSTOMER_MCP_SCOPES)[number];
