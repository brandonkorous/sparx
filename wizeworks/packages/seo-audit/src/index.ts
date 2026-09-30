// @wizeworks/seo-audit — the SEO scoring engine (docs/50 §7).
// Pure, dependency-free. Consumers normalize their entity into an
// `AuditableEntity` and call `auditEntity` to get a `Scorecard`.

export { auditEntity } from './audit';

/**
 * THE WORDS, for a read path serving a card it did not just compute.
 *
 * A stored scorecard is a snapshot of the SCORE, and it used to be a snapshot of
 * the SENTENCES as well — so 15 of the 16 businesses on the local database were
 * reading the developer vocabulary the plain-English pass replaced months ago
 * (issue 863). `refreshCard` re-says a stored card in today's words and changes no
 * finding, and `CHECK_LABELS` is the one list of what each check is called for a
 * query that rolls checks up without holding whole cards.
 */
export { CHECK_LABELS, refreshCard, refreshCheck, checkTip, computeFixFirst } from './check-copy';
export type { Finding } from './check-copy';
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
