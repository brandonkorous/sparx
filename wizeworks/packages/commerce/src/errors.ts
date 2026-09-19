// Service-layer error vocabulary. Every transport (REST, GraphQL, Server
// Actions, MCP) maps these to its native envelope so a 404 from the
// service surfaces as a 404 HTTP status, a GraphQLError with code
// 'NOT_FOUND', and an { ok:false, error:{ code:'NOT_FOUND', ... } }
// envelope from a Server Action — all in one place.

import type { TenantContext } from '@wizeworks/db';

export type ServiceContext = TenantContext;

export class CommerceNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly entityType: string;
  readonly entityId: string;
  constructor(entityType: string, entityId: string) {
    super(`${entityType} ${entityId} not found`);
    this.entityType = entityType;
    this.entityId = entityId;
  }
}

export class CommerceValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly details: { field: string; message: string }[];
  constructor(message: string, details: { field: string; message: string }[] = []) {
    super(message);
    this.details = details;
  }
}

export class CommerceConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

/**
 * The commerce-side twin of `InventoryOutOfStockError`, kept in step with it
 * deliberately: the two packages raise the same refusal and api-rest maps both
 * to one 409, so a shopper must never get two different sentences for one fact.
 * The reasoning for the wording, and for naming the item rather than its id,
 * lives on the inventory copy.
 *
 * Nothing in this package throws it today. It is kept because the mapping in
 * api-rest's error handler is written against it and the checkout paths that
 * will raise it are the ones a UUID would reach a SHOPPER through.
 */
export class CommerceOutOfStockError extends Error {
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

// Pricing pipeline rejected a discount/gift-card/account-credit application
// because a precondition was unmet. The pricing trace explains why.
export class CommercePricingError extends Error {
  readonly code = 'PRICING_ERROR' as const;
  readonly reason: string;
  readonly trace?: unknown;
  constructor(reason: string, trace?: unknown) {
    super(reason);
    this.reason = reason;
    this.trace = trace;
  }
}

// Provider call failed in a way the merchant has to resolve. Distinct
// from a transient network error (which the worker retries) — provider
// errors surface to the merchant dashboard for manual action.
export class CommerceProviderError extends Error {
  readonly code = 'PROVIDER_ERROR' as const;
  readonly providerSlug: string;
  readonly providerErrorCode?: string;
  readonly retryable: boolean;
  constructor(
    providerSlug: string,
    message: string,
    opts: { providerErrorCode?: string; retryable?: boolean } = {}
  ) {
    super(message);
    this.providerSlug = providerSlug;
    this.providerErrorCode = opts.providerErrorCode;
    this.retryable = opts.retryable ?? false;
  }
}

// Aliased exports so transports can write `import type { NotFoundError }
// from '@wizeworks/commerce'` without dragging the implementation class
// names through their code.
export type NotFoundError = CommerceNotFoundError;
export type ValidationError = CommerceValidationError;
export type ConflictError = CommerceConflictError;
export type OutOfStockError = CommerceOutOfStockError;
export type PricingError = CommercePricingError;
export type ProviderError = CommerceProviderError;
