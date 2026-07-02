// Default export is the server instance. Client-side code should import from
// '@sparx/auth/client' explicitly to keep the React/browser-only surface out
// of server bundles.

export { auth, type Auth } from './server';
export {
  signUpMerchant,
  SignUpError,
  type SignUpMerchantInput,
  type SignUpMerchantResult,
  type SignUpAcquisition,
} from './sign-up';
export {
  provisionTenant,
  generateUniqueTenantSlug,
  type ProvisionTenantInput,
} from './provision-tenant';
export { randomFriendlySlug } from './friendly-slug';
export { getSession, requireSession, type SparxSession } from './session';
export { ORG_ROLES, ASSIGNABLE_ORG_ROLES, type OrgRole, type AssignableOrgRole } from './org-roles';
export {
  listMyMemberships,
  listPendingInvitations,
  getInvitationDetail,
  listOrgMembers,
  listOrgInvitations,
  type OrgMembership,
  type PendingInvitation,
  type InvitationDetail,
  type OrgMember,
  type OrgInvitation,
} from './organizations';
export {
  isModuleEnabled,
  listEnabledModules,
  requireModule,
  invalidateModuleCache,
  moduleDisabledEnvelope,
  ModuleDisabledError,
  type ModuleSlug,
  BUNDLED_FREE,
  REQUIRES,
  requiredModules,
  blockingDependents,
  isModuleFlagOn,
  deriveModuleStates,
  type ModuleEnabledSource,
  ModulePresetRegistry,
  toModulePresetView,
  definePreset,
  type ModulePreset,
  type ModulePresetKind,
  type ModulePresetSummaryChip,
  type ModulePresetInstallResult,
  type ModulePresetView,
  IndustryStarterRegistry,
  starterModules,
  toIndustryStarterView,
  type IndustryStarter,
  type IndustryStarterPresetRef,
  type IndustryStarterView,
} from './module-gate';
export {
  issueApiKey,
  verifyApiKey,
  listApiKeys,
  revokeApiKey,
  type IssueArgs,
  type IssuedKey,
  type VerifiedKey,
  type ApiKeySummary,
} from './api-keys';
export {
  OIDC_BASE_SCOPES,
  MCP_SCOPE_CATALOG,
  MCP_BUSINESS_SCOPES,
  MCP_ALL_OAUTH_SCOPES,
  grantableScopesForRole,
  capBusinessScopes,
  signConsentGrant,
  verifyConsentGrant,
  type McpBusinessScope,
  type McpScopeMeta,
  type ConsentGrantPayload,
  type StaffRole,
} from './mcp-scopes';
export { verifyMcpOAuthToken, type VerifiedMcpOAuth } from './mcp-oauth';
export {
  listMcpConnections,
  revokeMcpConnection,
  getRegisteredMcpClient,
  type McpConnectionSummary,
  type RegisteredMcpClient,
} from './mcp-connections';
