// @sparx/customer-auth — Layer-2 storefront shopper authentication, on a
// dedicated tenant-scoped Better Auth instance (docs/27 v2). Server-only;
// consumed by api-rest's public account routes + the storefront-MCP customer
// tier. The storefront never imports this directly (it talks to api-rest).

export { getCustomerAuth, customerAuthSecret, type CustomerAuth } from './server';

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

// Shopper MCP OAuth: scope vocabulary + consent-grant crypto (docs/113 §5).
export {
  CUSTOMER_MCP_SCOPES,
  CUSTOMER_OIDC_BASE_SCOPES,
  CUSTOMER_ALL_OAUTH_SCOPES,
  CUSTOMER_MCP_SCOPE_CATALOG,
  capCustomerScopes,
  signCustomerConsentGrant,
  verifyCustomerConsentGrant,
  type CustomerMcpScope,
  type CustomerScopeMeta,
  type CustomerConsentGrantPayload,
} from './mcp-scopes';

// Shopper OAuth authorization-server metadata + authorize-request validation.
export {
  buildCustomerAuthServerMetadata,
  getRegisteredCustomerMcpClient,
  parseCustomerAuthorizeParams,
  customerAuthorizeParamsRecord,
  validateCustomerAuthorizeRequest,
  type RegisteredCustomerMcpClient,
  type CustomerAuthorizeParams,
  type CustomerAuthorizeValidation,
} from './as-metadata';

export { hashPassword, verifyPassword } from './hash';
