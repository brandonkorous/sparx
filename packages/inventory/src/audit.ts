// Audit-log helper. Mirrors @sparx/commerce's / @sparx/crm's audit shape so
// every inventory state change is captured the same way and downstream tooling
// (compliance export, internal investigation queries, CRM activity feed) reads
// across modules with one shape.

import type { TxClient } from '@sparx/db';

export interface AuditWriteInput {
  tx: TxClient;
  tenantId: string;
  actorId: string | null;
  actorType: 'user' | 'system' | 'api' | 'mcp' | 'customer';
  action: string; // e.g. "inventory.warehouse.created", "inventory.adjusted"
  entityType: string; // e.g. "Warehouse", "InventoryLevel", "LotBatch"
  entityId: string;
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
