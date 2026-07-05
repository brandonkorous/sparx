// @sparx/cms — the CMS service layer (docs/12). Extracted from @sparx/api-core so
// the module owns its content-type resolution, body validation, and the entry
// revision/reference write path, consistent with every other module package
// (@sparx/commerce, @sparx/crm, @sparx/scheduling). The field schemas live in the
// sibling @sparx/cms-schemas. Consumed by api-rest, api-graphql, and the CMS MCP
// tools.

export * from './content-types.js';
export * from './entries.js';
export * from './references.js';
