// Inventory service-layer error vocabulary. Each transport (REST, GraphQL,
// MCP, Server Actions) maps these to its native envelope — mirroring the
// per-module pattern used by @sparx/commerce, @sparx/crm, @sparx/email-platform,
// etc. (one error language per module, mapped once per transport).

import type { TenantContext } from '@sparx/db';

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

// Out-of-stock / inventory-policy violations. Distinct from a generic 422
// because the storefront has a specific recovery path: surface a "wait-list me"
// or "swap to a back-orderable variant" CTA.
export class InventoryOutOfStockError extends Error {
  readonly code = 'OUT_OF_STOCK' as const;
  readonly variantId: string;
  readonly requested: number;
  readonly available: number;
  constructor(variantId: string, requested: number, available: number) {
    super(`Variant ${variantId} out of stock (requested ${requested}, available ${available})`);
    this.variantId = variantId;
    this.requested = requested;
    this.available = available;
  }
}

// Aliased exports so transports can write `import type { NotFoundError } from
// '@sparx/inventory'` without dragging the implementation class names through.
export type NotFoundError = InventoryNotFoundError;
export type ValidationError = InventoryValidationError;
export type ConflictError = InventoryConflictError;
export type OutOfStockError = InventoryOutOfStockError;
