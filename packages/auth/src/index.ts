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
