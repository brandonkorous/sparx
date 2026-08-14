// Default export is the server instance. Client-side code should import from
// '@sparx/auth/client' explicitly to keep the React/browser-only surface out
// of server bundles.

export { auth, type Auth } from './server';
// The auth-layer Prisma client (connects as `sparx_owner`, so it is NOT subject
// to the ENABLE-but-not-FORCE RLS on the auth tables). Exported ONLY so callers
// outside this package can read `members` / `invitations` and their joined
// `users` rows: a member's user row may legitimately belong to a DIFFERENT
// tenant than the org they are a member of (someone who owns tenant A and
// consults for tenant B has `users.tenant_id = A`, `members.organization_id = B`),
// and an RLS-scoped connection hides that user row — which makes Prisma's
// required `user`/`inviter` relation resolve to nothing and throw.
//
// Using this client means RLS is NOT your tenant guard: every query MUST carry
// an explicit `organizationId` (or a `member: { organizationId }` relation
// filter) pinned to the caller's tenant. Business data still belongs on the
// @sparx/db client inside withTenant()/withRequestTenant().
export { authPrisma } from './prisma';
// Publishes an `email.send` event from auth-side contexts (better-auth callbacks +
// the workbench accept-invite server action). See email-events.ts.
export { publishAuthEmail, type PublishAuthEmailInput } from './email-events';
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
export {
  provisionInvitedOwner,
  type ProvisionInvitedOwnerInput,
  type ProvisionInvitedOwnerResult,
} from './provision-invited-owner';
export { randomFriendlySlug } from './friendly-slug';
export { getSession, requireSession, type SparxSession } from './session';
export { ORG_ROLES, ASSIGNABLE_ORG_ROLES, type OrgRole, type AssignableOrgRole } from './org-roles';
export {
  MODULE_ACCESS_MODES,
  memberCanReachModule,
  effectiveModules,
  roleIgnoresModuleAccess,
  parseModuleAccessMode,
  type ModuleAccessMode,
  type MemberModuleAccessInput,
} from './module-access';
export {
  PROPERTY_ACCESS_MODES,
  memberCanReachProperty,
  reachableProperties,
  roleIgnoresPropertyAccess,
  parsePropertyAccessMode,
  type PropertyAccessMode,
  type MemberPropertyAccessInput,
} from './property-access';
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
  ALL_MODULES,
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
