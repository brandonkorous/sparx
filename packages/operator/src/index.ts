// @sparx/operator — dependency-free operator contracts shared across the admin
// console (apps/admin), the operator auth package (@sparx/operator-auth), and
// api-rest's /internal/operator/* handlers. See docs/apps/admin/build-plan.md.

export {
  OPERATOR_CAPABILITIES,
  OPERATOR_CAPABILITY_LABELS,
  CAPABILITY_BUNDLES,
  bundleCapabilities,
  isOperatorCapability,
  type OperatorCapability,
  type CapabilityBundle,
} from './capabilities';

export {
  createOperatorApiClient,
  OperatorApiError,
  INTERNAL_OPERATOR_TOKEN_HEADER,
  OPERATOR_ID_HEADER,
  type OperatorApiClient,
  type OperatorApiClientConfig,
  type OperatorApiRequestOptions,
} from './api-client';

export type { OperatorIdentity, OperatorWhoAmIResult, OperatorApiErrorBody } from './types';
