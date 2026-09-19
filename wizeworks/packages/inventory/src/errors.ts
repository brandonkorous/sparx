// Inventory service-layer error vocabulary. Each transport (REST, GraphQL,
// MCP, Server Actions) maps these to its native envelope — mirroring the
// per-module pattern used by @wizeworks/commerce, @wizeworks/crm, @wizeworks/email-platform,
// etc. (one error language per module, mapped once per transport).

import type { TenantContext } from '@wizeworks/db';

export type ServiceContext = TenantContext;

export class InventoryNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly entityType: string;
  readonly entityId: string;
  constructor(entityType: string, entityId: string) {
    super(`${entityType} ${entityId} not found`);
    this.entityType = entityType;
    this.entityId = entityId;
  }
}

export class InventoryValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly details: { field: string; message: string }[];
  constructor(message: string, details: { field: string; message: string }[] = []) {
    super(message);
    this.details = details;
  }
}

export class InventoryConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

/**
 * Not enough stock, as a sentence somebody can act on.
 *
 * ── Why the name is a constructor argument ─────────────────────────────────
 *
 * This message used to be built from the variant's UUID, and it reaches people:
 * Juniper Row tried to move 100 antique belt buckles out of a warehouse holding
 * 58, and the refusal read
 *
 *     Variant 4fc1c2e4-ee74-4f65-a5ad-4533c63e3cf5 out of stock
 *     (requested 100, available 58)
 *
 * on a screen whose one line said "Brass belt hardware, antique · BRASS-BELT-1"
 * six centimetres above it. The refusal was RIGHT, and it was the only part of
 * the exchange she could not read. A database id in a message is the same defect
 * as a database id in a ledger note (issue 558).
 *
 * `label` is optional because a caller that genuinely cannot name the thing must
 * still be able to refuse, and a refusal with a worse sentence beats no refusal.
 * Every caller in this package passes one; `variantLabel` is the lookup, and it
 * runs only on this path, so naming the item costs nothing on the way anybody
 * actually takes.
 *
 * Distinct from a generic 422 because the storefront has a specific recovery
 * path: surface a "wait-list me" or "swap to a back-orderable variant" CTA.
 */
export class InventoryOutOfStockError extends Error {
  readonly code = 'OUT_OF_STOCK' as const;
  readonly variantId: string;
  readonly requested: number;
  readonly available: number;
  /** What a person calls it, when the caller knew. */
  readonly label: string | null;
  constructor(variantId: string, requested: number, available: number, label?: string | null) {
    const named = label?.trim();
    super(
      named
        ? `Not enough ${named}. This asks for ${String(requested)} and ${String(available)} ${available === 1 ? 'is' : 'are'} available.`
        : `Not enough stock for variant ${variantId}. This asks for ${String(requested)} and ${String(available)} ${available === 1 ? 'is' : 'are'} available.`
    );
    this.variantId = variantId;
    this.requested = requested;
    this.available = available;
    this.label = named && named !== '' ? named : null;
  }
}

// Aliased exports so transports can write `import type { NotFoundError } from
// '@wizeworks/inventory'` without dragging the implementation class names through.
export type NotFoundError = InventoryNotFoundError;
export type ValidationError = InventoryValidationError;
export type ConflictError = InventoryConflictError;
export type OutOfStockError = InventoryOutOfStockError;
