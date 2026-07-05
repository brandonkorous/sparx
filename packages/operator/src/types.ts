// Shared DTOs for the operator ↔ api-rest internal seam (docs/apps/admin
// build-plan §2 D6). Kept dependency-free so both the caller (apps/admin) and
// the handler (services/api-rest) share one contract.

import type { OperatorCapability } from './capabilities';

/** The authenticated operator, as the admin app knows them after a session
 *  lookup. No `tid` — operators are tenant-less (docs/16 §2.4). */
export interface OperatorIdentity {
  id: string;
  email: string;
  name: string | null;
  capabilities: OperatorCapability[];
}

/** Response of the Slice-1 round-trip probe `GET /internal/operator/whoami`.
 *  Proves the shared-secret auth + the X-Operator-Id header made it through the
 *  Layer-5 seam end-to-end before any real data endpoint is built. */
export interface OperatorWhoAmIResult {
  ok: true;
  /** The operator id api-rest received in the `X-sparx-Operator-Id` header
   *  (echoed back so the admin app can confirm the round-trip), or null if the
   *  header was absent. */
  operatorId: string | null;
  /** Always 'api-rest' — identifies which service answered. */
  service: 'api-rest';
  /** Server timestamp (ISO-8601) so a stale/cached response is obvious. */
  time: string;
}

/** Error shape the internal client throws on a non-2xx api-rest response. */
export interface OperatorApiErrorBody {
  code: string;
  message: string;
}
