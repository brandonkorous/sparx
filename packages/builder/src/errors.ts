// Service-layer error types. Each transport (REST, MCP, Server Actions) maps
// these to its native envelope, so every condition is reported the same way
// without re-deriving status codes from generic exceptions. Mirrors
// packages/sitebuilder/src/errors.ts.

import type { TenantContext } from '@sparx/db';

export type ServiceContext = TenantContext;

/**
 * A ServiceContext scoped to a specific web PROPERTY (site). Required by the
 * per-property Builder services — pages, layouts, per-record assignments, and
 * the Surface stylesheet (docs/49). `propertyId` is application-tier scoping,
 * NOT a security boundary (tenant_id + RLS is). Tenant-wide services (emails,
 * components, the binding catalog) keep the base ServiceContext.
 */
export interface PropertyContext extends TenantContext {
  propertyId: string;
}

export class BuilderNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly entityType: string;
  readonly entityId: string;
  constructor(entityType: string, entityId: string) {
    super(`${entityType} ${entityId} not found`);
    this.entityType = entityType;
    this.entityId = entityId;
  }
}

export class BuilderValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly details: { field: string; message: string }[];
  constructor(message: string, details: { field: string; message: string }[] = []) {
    super(message);
    this.details = details;
  }
}

export class BuilderConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

export type NotFoundError = BuilderNotFoundError;
export type ValidationError = BuilderValidationError;
