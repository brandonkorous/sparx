// What a search engine and a shared link show for each page.
//
// WHERE THE LINE WITH @sparx/seo-audit IS. That package grades ONE entity 0–100
// across twelve checks — length, keyword placement, image coverage, word count — and
// it is the authority on the quality of a single page's metadata. It cannot see the
// rest of the site, so the one class of defect it structurally cannot report is the
// one that only exists in relation to other pages: four pages sharing a title, which
// is how a site ends up with three of its five pages missing from search results
// entirely.
//
// So this file checks PRESENCE and UNIQUENESS and nothing else. No length rules, no
// wording rules, no scoring — those exist, they are already good, and a second
// half-implementation of them here would eventually contradict the first.

import type { RawFinding } from './finding';
import type { LintablePage } from './types';

function clean(value: string | null | undefined): string {
  return (value ?? '').trim();
}

function pageOrigin(page: LintablePage): RawFinding['origin'] {
  return { scope: 'page', ownerId: page.id, ownerName: page.name };
}

/** Count how many pages share each non-empty value, case- and space-insensitively —
 *  "Our Story" and "our story " are the same title to a search engine. */
function duplicatesOf(
  pages: readonly LintablePage[],
  pick: (page: LintablePage) => string
): Map<string, number> {
  const counts = new Map<string, number>();
  for (const page of pages) {
    const value = pick(page).toLowerCase().replace(/\s+/g, ' ');
    if (!value) continue;
    counts.set(value, (counts.get(value) ?? 0) + 1);
  }
  return counts;
}

/**
 * The search-engine findings for the whole site at once.
 *
 * Site-wide rather than per-page because duplication is only visible across the set,
 * and because these read off page metadata rather than the tree — walking the
 * composed document to check a title would be work for nothing.
 *
 * A page marked as hidden from search engines is EXEMPT from every other rule here.
 * A thank-you page or a private landing page has no business carrying a search
 * description, and asking for one is the kind of finding that teaches an owner to
 * dismiss the whole list.
 */
export function checkSeo(pages: readonly LintablePage[]): RawFinding[] {
  const findings: RawFinding[] = [];
  const visible = pages.filter((page) => !page.noindex);
  const titles = duplicatesOf(visible, (page) => clean(page.seoTitle));
  const descriptions = duplicatesOf(visible, (page) => clean(page.seoDescription));

  for (const page of pages) {
    const origin = pageOrigin(page);
    const base = { origin, nodeId: null, nodePath: '' };

    if (page.noindex) {
      findings.push({
        ...base,
        rule: 'seo-page-hidden',
        severity: 'suggestion',
        title: 'This page is hidden from search engines',
        detail:
          'It is set so that Google and other search engines will not list it, and it will not ' +
          'appear in your sitemap. That is the right setting for a thank-you page or a private ' +
          'landing page — but if you want people to be able to find this page by searching, turn ' +
          'it off in the page settings.',
      });
      continue;
    }

    const title = clean(page.seoTitle);
    const description = clean(page.seoDescription);

    if (!title) {
      findings.push({
        ...base,
        rule: 'seo-title-missing',
        severity: 'suggestion',
        title: 'This page has no search title',
        detail:
          'Search results and browser tabs will fall back to the page name and your site name. ' +
          'That works, but a title written for the result — what someone would be searching for ' +
          'when they should land here — is the single biggest thing you can change about how ' +
          'often this page gets clicked.',
      });
    } else if ((titles.get(title.toLowerCase().replace(/\s+/g, ' ')) ?? 0) > 1) {
      findings.push({
        ...base,
        rule: 'seo-title-duplicate',
        severity: 'warning',
        title: 'Another page uses this exact search title',
        detail:
          'When several pages share a title, search engines usually pick one and leave the rest ' +
          'out of results altogether — so the pages compete with each other instead of adding up. ' +
          'Give each page a title that describes only that page.',
        evidence: title,
      });
    }

    if (!description) {
      findings.push({
        ...base,
        rule: 'seo-description-missing',
        severity: 'warning',
        title: 'This page has no search description',
        detail:
          'The description is the sentence or two shown under the title in search results, and it ' +
          'is what appears when someone shares the page in a message or on social media. With ' +
          'none set, that space is filled with whatever text happens to be near the top of the ' +
          'page — often a menu.',
      });
    } else if ((descriptions.get(description.toLowerCase().replace(/\s+/g, ' ')) ?? 0) > 1) {
      findings.push({
        ...base,
        rule: 'seo-description-duplicate',
        severity: 'warning',
        title: 'Another page uses this exact search description',
        detail:
          'Two pages promising the same thing in search results look like the same page. Describe ' +
          'what is on THIS page specifically, so someone reading the result knows which one they ' +
          'want.',
        evidence: description,
      });
    }
  }

  return findings;
}
