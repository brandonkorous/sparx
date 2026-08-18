// Service-layer barrel. Namespaced so callers write
// `inventoryService.adjust(ctx, ...)` — symmetric with how the MCP tool
// registry and the @wizeworks/commerce service barrel expose their services.

export * as inventoryService from './inventory-service';
