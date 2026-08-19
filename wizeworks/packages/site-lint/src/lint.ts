// The whole check, in one call.
//
// ADVISORY, ALWAYS. Nothing this engine returns can stop a publish, and no caller
// should give it that power. The site belongs to the person who built it: they may
// have a reason for the empty page, they may be publishing a broken link on purpose
// because the page it points at goes live in an hour, and a tool that refuses them is
// a tool they learn to route around. The report says what a visitor will run into;
// the decision is theirs. `status` is a summary of severity, never a verdict on
// whether publishing is allowed.
//
// PURE. No I/O, no clock, no randomness — the same site in gives the same report out,
// which is what lets it run in three places without a service between them: the Check
// step before publishing, the publish path recording what was known at the time, and
// a test.

import { measureSite } from './budget';
import { checkClasses } from './classes';
import { checkContrast, checkThemeContrast } from './contrast';
import { checkContent } from './content';
import { mergeFindings, type RawFinding } from './finding';
import { checkLinks, resolveTargets } from './links';
import { checkAddresses } from './addresses';
import { checkSeo } from './seo';
import { checkDuplicateIds, checkStructure } from './structure';
import type { LintSeverity, LintStatus, SiteLintInput, SiteLintReport } from './types';
import { inventoryOf } from './walk';

/** Site-wide findings are attributed to the first page for the purpose of "seen on",
 *  which would be misleading — so they carry this instead. */
const WHOLE_SITE = 'Across your site';

function statusOf(counts: Record<LintSeverity, number>): LintStatus {
  if (counts.error > 0) return 'fail';
  if (counts.warning > 0) return 'warn';
  return 'pass';
}

/**
 * Check a site the way a visitor meets it.
 *
 * Per page, the frame, the page body and every saved component are composed into one
 * document and walked once; the link, content, styling and structure rules all read
 * that single traversal. Search-engine metadata and duplicate block ids are checked
 * once for the whole site, because neither is answerable from a single page.
 *
 * A problem authored outside a page body — in the header, the footer, or a saved
 * component — is met again on every page. It is reported ONCE, with every page it
 * appears on listed in `location.seenOn`. See `finding.ts` for why that matters more
 * than it sounds.
 */
export function lintSite(input: SiteLintInput): SiteLintReport {
  const sightings: { finding: RawFinding; page: string }[] = [];
  // `resolveTargets` drops record addresses from the roster itself — see the note there.
  const targets = resolveTargets(
    input.pages.map((page) => page.slug),
    input.targets
  );

  // Kept, not discarded per page: the theme's own color pairs are checked ONCE and
  // only for colors the site actually paints with, which needs every page's classes.
  const inventories = input.pages.map((page) => inventoryOf(page, input.frame, input.symbols));

  for (const inventory of inventories) {
    const findings = [
      ...checkStructure(inventory),
      ...checkContent(inventory),
      ...checkLinks(inventory, targets),
      ...checkClasses(inventory),
      ...checkContrast(inventory, input.theme),
    ];
    for (const finding of findings) sightings.push({ finding, page: inventory.page.name });
  }

  for (const finding of checkThemeContrast(input.theme, inventories)) {
    sightings.push({ finding, page: WHOLE_SITE });
  }
  for (const finding of checkAddresses(input.addressing ?? input.pages)) {
    sightings.push({ finding, page: finding.origin.ownerName });
  }
  for (const finding of checkSeo(input.pages)) {
    sightings.push({ finding, page: finding.origin.ownerName });
  }
  for (const finding of checkDuplicateIds(input.pages, input.frame, input.symbols)) {
    sightings.push({
      finding,
      page: finding.origin.scope === 'page' ? finding.origin.ownerName : WHOLE_SITE,
    });
  }

  const findings = mergeFindings(sightings);
  const counts: Record<LintSeverity, number> = { error: 0, warning: 0, suggestion: 0 };
  for (const finding of findings) counts[finding.severity] += 1;

  return {
    status: statusOf(counts),
    findings,
    counts,
    pagesChecked: input.pages.length,
    // Measured from the same inventories, and deliberately NOT folded into `counts`
    // or `status`: weight is a trade the owner makes, not a defect the tool found.
    budget: measureSite(input, inventories),
  };
}
