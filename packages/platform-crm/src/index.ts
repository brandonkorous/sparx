// @sparx/platform-crm — sparx's own customer base, kept in sparx (docs/140).
//
// Every tenant that signs up becomes a contact + a deal in the PLATFORM tenant's
// CRM (WizeWorks, the dogfood tenant-of-record of docs/80 §2), and the deal
// tracks that tenant from trial through activation to paying or churned. Same
// engine a customer of ours uses on their own leads — which is the point.
//
// Two callers share this package so both behave identically:
//   • services/platform-crm-worker — prod, on the tenant/module Pub/Sub pushes;
//   • packages/auth's tenant-events — dev/in-process, where no worker runs.

export {
  mirrorTenant,
  recordSubscriptionChange,
  recordModuleChange,
  type MirrorLogger,
  type MirrorOutcome,
  type MirrorSkipReason,
  type ModuleChange,
  type SubscriptionChange,
} from './mirror';

export {
  ensurePlatformPipeline,
  PLATFORM_PIPELINE_NAME,
  PLATFORM_PIPELINE_SLUG,
  PLATFORM_PIPELINE_STAGES,
  type ResolvedPipeline,
  type StageKey,
} from './pipeline';

export {
  isPaymentTrouble,
  nextStageForModuleActivation,
  nextStageForSubscription,
  subscriptionActivityDescription,
  type SubscriptionStatus,
} from './lifecycle';

export { resolvePlatformTarget, resetPlatformTargetCache, type PlatformTarget } from './target';
