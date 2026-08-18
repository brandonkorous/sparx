// Commerce MCP tool registry barrel.
//
// `commerceMcpTools` is the array the MCP server iterates to register
// commerce-side tools alongside `crmMcpTools`. Each tool is a thin
// wrapper over a service-layer function — fix once, fix everywhere.

export type { McpScope, McpToolDefinition, AnyMcpTool } from './registry';

import { readTools } from './read-tools';
import { writeTools } from './write-tools';
import { catalogWriteTools } from './write-catalog-tools';
import { pricingWriteTools } from './write-pricing-tools';
import { fulfillmentWriteTools } from './write-fulfillment-tools';
import { merchandisingWriteTools } from './write-merchandising-tools';

export * from './read-tools';
export * from './write-tools';
export { catalogWriteTools } from './write-catalog-tools';
export { pricingWriteTools } from './write-pricing-tools';
export { fulfillmentWriteTools } from './write-fulfillment-tools';
export { merchandisingWriteTools } from './write-merchandising-tools';

/** The full Commerce tool set the MCP server publishes. */
export const commerceMcpTools = [
  ...readTools,
  ...writeTools,
  ...catalogWriteTools,
  ...pricingWriteTools,
  ...fulfillmentWriteTools,
  ...merchandisingWriteTools,
];
