// Operator audit log (docs/apps/admin/build-plan.md §2, §7 — "every cross-tenant
// READ is audited at the action level").
//
// Append-only, global, FK-free to `public` (docs/16 §2.4, F3): the target tenant
// is stored as a bare UUID value, never a foreign key, so the whole wize_admin
// schema lifts out cleanly in a future split. Operator email is denormalized so
// a row stays readable even after an operator is removed.

import { operatorPool } from './db';

export interface OperatorAuditInput {
  /** The acting operator's id (null only for system-level seed actions). */
  operatorId: string | null;
  /** Denormalized email, kept so the row survives operator deletion. */
  operatorEmail?: string | null;
  /** Which capability authorized this action (for the audit trail). */
  capability?: string | null;
  /** Verb-noun action key, e.g. `tenant.view`, `tenant.suspend`, `metrics.read`. */
  action: string;
  /** The tenant this action touched, as a BARE UUID value (no FK — F3). */
  targetTenantId?: string | null;
  /** Optional finer-grained target (`order`, `customer`, …) + its id. */
  targetType?: string | null;
  targetId?: string | null;
  /** Optional before/after diff for mutations. */
  diff?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
}

/**
 * Write one audit row. Fire-and-forget from the caller's perspective, but we
 * await the insert so a logging failure surfaces rather than silently dropping
 * the trail — an unaudited cross-tenant action is a security bug, not a nice-to-have.
 */
export async function logOperatorAction(input: OperatorAuditInput): Promise<void> {
  await operatorPool.query(
    `INSERT INTO wize_admin.platform_operator_audit_logs
       (operator_id, operator_email, capability, action, target_tenant_id,
        target_type, target_id, diff, ip_address, user_agent)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)`,
    [
      input.operatorId,
      input.operatorEmail ?? null,
      input.capability ?? null,
      input.action,
      input.targetTenantId ?? null,
      input.targetType ?? null,
      input.targetId ?? null,
      input.diff === undefined ? null : JSON.stringify(input.diff),
      input.ipAddress ?? null,
      input.userAgent ?? null,
    ]
  );
}
