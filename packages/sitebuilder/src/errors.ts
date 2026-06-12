// Service-layer error types. Each transport (REST, MCP, Server Actions) maps
// these to its native envelope, so every condition is reported the same way
// without re-deriving status codes from generic exceptions. Mirrors
// packages/crm/src/errors.ts.

import type { TenantContext } from '@sparx/db';

export type ServiceContext = TenantContext;

/**
 * A ServiceContext scoped to a specific web PROPERTY (site). Required by the
 * per-property sitebuilder services — the applied-theme draft/publish/schedule
 * lifecycle (docs/49 Phase 6). `propertyId` is application-tier scoping, NOT a
 * security boundary (tenant_id + RLS is). Tenant-wide services (the static theme
 * catalog, the saved-theme LIBRARY CRUD, the legacy section tier) keep the base
 * ServiceContext. Mirrors packages/builder/src/errors.ts.
 */
export interface PropertyContext extends TenantContext {
  propertyId: string;
}

export class SitebuilderNotFoundError extends Error {
  readonly code = 'NOT_FOUND' as const;
  readonly entityType: string;
  readonly entityId: string;
  constructor(entityType: string, entityId: string) {
    super(`${entityType} ${entityId} not found`);
    this.entityType = entityType;
    this.entityId = entityId;
  }
}

export class SitebuilderValidationError extends Error {
  readonly code = 'VALIDATION_ERROR' as const;
  readonly details: { field: string; message: string }[];
  constructor(message: string, details: { field: string; message: string }[] = []) {
    super(message);
    this.details = details;
  }
}

export class SitebuilderConflictError extends Error {
  readonly code = 'CONFLICT' as const;
  readonly field?: string;
  constructor(message: string, field?: string) {
    super(message);
    this.field = field;
  }
}

export type NotFoundError = SitebuilderNotFoundError;
export type ValidationError = SitebuilderValidationError;
