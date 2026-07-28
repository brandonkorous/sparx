// Service namespaces — the shared core behind every transport (REST, MCP,
// Server Actions). Mirrors packages/sitebuilder/src/services/index.ts.

export * as pageService from './page-service';
export * as siteService from './site-service';
export * as assignmentService from './assignment-service';
export * as layoutService from './layout-service';
export * as formService from './form-submit-service';
export * as formDefinitionService from './form-definition-service';
export * as emailService from './email-service';
export * as emailVersionService from './email-version-service';
export * as savedEmailBlockService from './saved-email-block-service';
export * as componentService from './component-service';
export * as bindingService from './binding-service';
export * as surfaceCssService from './surface-css-service';
export * as governanceService from './governance-service';
export * as archetypeService from './archetype-service';
export * as platformCatalogService from './platform-catalog-service';
export * as nodeIndexService from './node-index-service';
export * as artifactService from './artifact-service';
export * as opLogService from './op-log-service';
export * as draftVersionService from './draft-version-service';

// Types callers pass INTO a service. The namespace exports above carry functions, not
// the types their parameters speak, so anything a transport must name — a stage, an
// option union — is re-exported here.
export type { SiteStage } from './site-service';
