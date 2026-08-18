// Audit log helper. Structural state changes (page created / deleted / reordered
// / published / seeded) write an audit_logs row inside the same transaction as
// their primary write. High-frequency draft-tree saves deliberately do NOT
// audit (they'd swamp the log). Mirrors wizeworks/packages/sitebuilder/src/audit.ts.

import type { TxClient } from '@wizeworks/db';

export interface AuditWriteInput {
  tx: TxClient;
  tenantId: string;
  actorId: string | null;
  actorType: 'user' | 'system' | 'api' | 'mcp' | 'customer';
  action: string;
  entityType: string;
  // Nullable: catalog-level actions (seed, reorder) aren't tied to one page.
  // audit_logs.entity_id is a nullable UUID — a non-UUID sentinel throws P2023.
  entityId: string | null;
  diff?: {
    before?: Record<string, unknown> | null;
    after?: Record<string, unknown> | null;
  } | null;
}

export async function writeAuditLog(input: AuditWriteInput): Promise<void> {
  await input.tx.auditLog.create({
    data: {
      tenantId: input.tenantId,
      actorId: input.actorId,
      actorType: input.actorType,
      action: input.action,
      entityType: input.entityType,
      entityId: input.entityId,
      diff: (input.diff ?? null) as never,
    },
  });
}
