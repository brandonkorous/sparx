// Service-layer barrel. Namespaced so callers write
// `inventoryService.adjust(ctx, ...)` — symmetric with how the MCP tool
// registry and the @sparx/commerce service barrel expose their services.

export * as inventoryService from './inventory-service';
