// @sparx/operator-auth — the WizeWorks operator (Layer-4) Better Auth instance
// and its wize_admin data helpers. Server-only barrel. Next.js session helpers
// live on the `/next` subpath; the browser client on `/client`. See
// docs/apps/admin/build-plan.md.

export { operatorAuth, type OperatorAuth } from './server';
export { operatorPool } from './db';
export { loadOperatorCapabilities, grantCapabilities, revokeCapability } from './capabilities';
export { logOperatorAction, type OperatorAuditInput } from './audit';
export { ensureSeedOperator, type SeedOperatorResult } from './bootstrap';
export { publishOperatorEmail, type PublishOperatorEmailInput } from './email';
