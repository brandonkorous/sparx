// Operator directory reads (docs/apps/admin/build-plan.md §4). The feedback
// triage surface needs to resolve an `assignee_staff_id` (a bare wize_admin
// operator uuid stored on the tenant-schema feedback row, FK-free by D3) back to
// a name, and to offer the roster of operators as assignees. Both read
// wize_admin.platform_operators through the operator pool — api-rest (sparx_app)
// cannot, so this resolution belongs here, in the admin-side package.

import { operatorPool } from './db';

export interface OperatorSummary {
  id: string;
  email: string;
  name: string | null;
}

/** Every operator, for the assignee picker. Ordered by name then email. */
export async function listOperators(): Promise<OperatorSummary[]> {
  const { rows } = await operatorPool.query<OperatorSummary>(
    'SELECT id, email, name FROM wize_admin.platform_operators ORDER BY name NULLS LAST, email'
  );
  return rows;
}

/** Resolve a set of operator ids to their summaries in one query — used to label
 *  the `assignee_staff_id` on feedback rows. Unknown ids are simply absent. */
export async function getOperatorsByIds(ids: string[]): Promise<Map<string, OperatorSummary>> {
  const unique = [...new Set(ids)].filter(Boolean);
  if (unique.length === 0) return new Map();
  const { rows } = await operatorPool.query<OperatorSummary>(
    'SELECT id, email, name FROM wize_admin.platform_operators WHERE id = ANY($1)',
    [unique]
  );
  return new Map(rows.map((r) => [r.id, r]));
}
