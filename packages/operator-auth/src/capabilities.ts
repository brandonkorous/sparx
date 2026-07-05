// Operator capability persistence (docs/apps/admin/build-plan.md §2 D5).
//
// Capabilities live in wize_admin.platform_operator_capabilities, one row per
// (operator, capability) grant, default none. The authoritative authz check
// runs in the admin app (requireCapability, ./next) against what this loads —
// api-rest never reads this store (it can't; it's sparx_app).

import { operatorPool } from './db';
import { isOperatorCapability, type OperatorCapability } from '@sparx/operator';

/** Every capability currently granted to an operator (unknown/legacy strings
 *  are filtered out so a removed capability can't accidentally still authorize). */
export async function loadOperatorCapabilities(operatorId: string): Promise<OperatorCapability[]> {
  const { rows } = await operatorPool.query<{ capability: string }>(
    'SELECT capability FROM wize_admin.platform_operator_capabilities WHERE operator_id = $1 ORDER BY capability',
    [operatorId]
  );
  return rows.map((r) => r.capability).filter(isOperatorCapability);
}

/** Grant a set of capabilities (idempotent — ON CONFLICT does nothing). Returns
 *  the operator's full capability set after the grant. */
export async function grantCapabilities(
  operatorId: string,
  capabilities: readonly OperatorCapability[],
  grantedBy: string | null = null
): Promise<OperatorCapability[]> {
  for (const capability of capabilities) {
    await operatorPool.query(
      `INSERT INTO wize_admin.platform_operator_capabilities (operator_id, capability, granted_by)
       VALUES ($1, $2, $3)
       ON CONFLICT (operator_id, capability) DO NOTHING`,
      [operatorId, capability, grantedBy]
    );
  }
  return loadOperatorCapabilities(operatorId);
}

/** Revoke a single capability. Returns true if a grant row was removed. */
export async function revokeCapability(
  operatorId: string,
  capability: OperatorCapability
): Promise<boolean> {
  const result = await operatorPool.query(
    'DELETE FROM wize_admin.platform_operator_capabilities WHERE operator_id = $1 AND capability = $2',
    [operatorId, capability]
  );
  return (result.rowCount ?? 0) > 0;
}
