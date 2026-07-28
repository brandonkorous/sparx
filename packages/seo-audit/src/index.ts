// @sparx/seo-audit — the SEO scoring engine (docs/50 §7).
// Pure, dependency-free. Consumers normalize their entity into an
// `AuditableEntity` and call `auditEntity` to get a `Scorecard`.

export { auditEntity } from './audit';
export {
  extractBuilderTreeSignals,
  extractCmsDocSignals,
  extractSilicaTreeSignals,
} from './extract';
export type {
  AuditableEntity,
  CategoryKey,
  CategoryScore,
  CheckResult,
  CheckStatus,
  ContentSignals,
  EntityType,
  Grade,
  OgImageState,
  Scorecard,
  SeoAuditAction,
} from './types';
