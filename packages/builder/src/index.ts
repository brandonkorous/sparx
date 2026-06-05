// @sparx/builder — public package barrel.
//
// The service layer is the single source of truth shared by REST, MCP, and
// Server Actions (one service, many transports). The serializable contract
// (node tree + page shapes + starter pages) lives in @sparx/builder-schemas,
// which is dependency-light so the editor's client components can import it too.

export * from './services/index';
export * from './events';
export type { ServiceContext, PropertyContext, NotFoundError, ValidationError } from './errors';
export { BuilderNotFoundError, BuilderValidationError, BuilderConflictError } from './errors';
