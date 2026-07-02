// @sparx/customer-auth — Layer-2 storefront shopper authentication, on a
// dedicated tenant-scoped Better Auth instance (docs/27 v2). Server-only;
// consumed by api-rest's public account routes + the storefront-MCP customer
// tier. The storefront never imports this directly (it talks to api-rest).

export { getCustomerAuth, type CustomerAuth } from './server';

export {
  signUpCustomer,
  signInCustomer,
  getCustomerSession,
  signOutCustomer,
  sendCustomerPasswordReset,
  resetCustomerPassword,
  type CustomerAuthContext,
  type SessionMeta,
  type AuthOutcome,
  type SessionUser,
} from './service';

export {
  ensureMembership,
  type EnsureMembershipContext,
  type EnsureMembershipNames,
  type EnsureMembershipResult,
} from './membership';

export { verifyCustomerMcpToken, type VerifiedCustomerMcp } from './mcp-verify';

export { CustomerAuthError, type CustomerAuthErrorCode } from './errors';

export {
  SESSION_COOKIE_NAME,
  SESSION_COOKIE_OPTIONS,
  SESSION_TTL_SECONDS,
  RESET_TTL_SECONDS,
} from './session';

export { CUSTOMER_MCP_SCOPES, type CustomerMcpScope } from './mcp-scopes';

export { hashPassword, verifyPassword } from './hash';
