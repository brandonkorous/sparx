// ══════════════════════════════════════════════════════════════════════════
// THE WORDS EVERY SEO CHECK IS SAID IN, AND THE ONE PLACE THEY LIVE
//
// ── Why this file exists ────────────────────────────────────────────────────
//
// A scorecard is STORED (`seo_audits.card`), and the stored card held the
// sentences. So a page scored in June carries June's wording for ever, and a
// rewrite of the copy reaches the code and not the rows.
//
// The thirteen checks were rewritten out of developer vocabulary into the plain
// words this platform requires — "Listed in sitemap.xml" became "It is on the
// list we give search engines", "Canonical & readable slug" became "The web
// address is tidy", "Structured data (JSON-LD)" became "Extra detail search
// engines can read". MEASURED 2026-09-28 on the local database: of 370 stored
// scorecards across 16 businesses, 226 still carry the OLD set, and **15 of the
// 16 businesses carry nothing but the old set**, because a card is only rewritten
// when that page is saved or somebody runs a scan. Every one of the thirteen
// checks had two stored names.
//
// The site-wide band had already been patched for this, and the patch is the
// thing to learn from. It groups by check `id` (right) and then takes the words
// from the most recently scored card, with a comment claiming that is "the
// wording the product uses today". It is not: it is the wording of whichever row
// happens to be newest, which on 15 of 16 businesses is the old one. A guess that
// is usually right is still a guess. [[feedback_never_present_absence_as_measurement]]
//
// So: the words come from HERE, always, for a card written a minute ago or in
// June. The engine reads this module, and so does every read path that serves a
// stored card, which means a copy edit lands on all 370 rows at once and on no
// rescan at all.
//
// ── Why the tip is derived rather than stored ───────────────────────────────
//
// Six of the thirteen checks say different things depending on what they found:
// a title can be too short or too long, a heading can be missing or duplicated.
// That looks like a reason to store the sentence, and it is not — the finding is
// recoverable from what the row already keeps (`status`, `value`, and the row's
// own `entity_type`), because `value` is written by this same engine in a fixed
// shape.
//
// The engine derives its tips through this module too, on every fresh card. That
// is deliberate: the parsing below is exercised by the whole existing audit test
// suite, so a value format that stops matching fails immediately rather than
// silently on old rows only. [[feedback_a_test_that_cannot_go_red]]
// ══════════════════════════════════════════════════════════════════════════

import type { CheckResult, CheckStatus, EntityType, Scorecard } from './types';

/**
 * What each check is CALLED. A pure function of the check's id and nothing else,
 * which is exactly why storing it was wrong.
 *
 * Named for what an owner is trying to do, not for the part of the spec the check
 * comes from. `check-copy.test.ts` fails if the engine emits a check that is not
 * in here.
 */
export const CHECK_LABELS: Record<string, string> = {
  'title-present': 'The page has a title',
  'title-length': 'How long the title is',
  'desc-present': 'The page has a short summary',
  'desc-length': 'How long the summary is',
  indexable: 'Search engines are allowed to list it',
  'in-sitemap': 'It is on the list we give search engines',
  'canonical-slug': 'The web address is tidy',
  'image-alt': 'Every picture is described',
  'heading-h1': 'One main heading',
  'content-depth': 'Enough to read, and somewhere to go next',
  'og-image': 'The picture shown when it is shared',
  'structured-data': 'Extra detail search engines can read',
  'ai-discoverable': 'AI assistants can find it',
};

/** Entity-aware minimum word count for `content-depth`. Lives here because the
 *  tip quotes the number, so the sentence and the threshold cannot drift. */
export const WORD_THRESHOLD: Record<EntityType, number> = {
  builder_page: 200,
  cms_page: 250,
  product: 50,
  collection: 40,
};

/** The schema.org `@type` a given entity should ideally emit. `null` = no single
 *  canonical type, which changes what the structured-data tip says. */
export const EXPECTED_SCHEMA: Record<EntityType, string | null> = {
  product: 'Product',
  collection: null,
  cms_page: null,
  builder_page: null,
};

/** Deterministic thousands separator (no locale, so a card reads the same on
 *  every machine that renders it). */
export function formatInt(n: number): string {
  return Math.max(0, Math.trunc(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/** The leading integer of a `value` this engine wrote — "154 characters",
 *  "1,240 words · 3 links". Null when there is no number to read, which is a
 *  real answer ("nothing to measure yet") and never a parse failure to hide. */
function leadingCount(value: string | undefined): number | null {
  const match = /^(\d[\d,]*)\b/.exec(value ?? '');
  if (!match?.[1]) return null;
  const n = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** The second integer of a two-number `value` — the links in "12 words · 3 links". */
function secondCount(value: string | undefined): number | null {
  const match = /·\s*(\d[\d,]*)\b/.exec(value ?? '');
  if (!match?.[1]) return null;
  const n = Number(match[1].replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
}

/** What the check found, as the tip needs it. Everything here is either stored on
 *  the check or stored on the audit row. */
export interface Finding {
  status: CheckStatus;
  value?: string;
  entityType: EntityType;
}

/**
 * The advice for one check, or null when there is nothing to say.
 *
 * Null for a `pass`, and null for an `info` — a fact is not a task, which is the
 * rule `finalize` in the engine already enforces by stripping advice off an info
 * check. Written as null HERE too, rather than relying on that stripping, so the
 * sentence cannot be authored in a place it can never be read from.
 */
export function checkTip(id: string, found: Finding): string | null {
  if (found.status === 'pass' || found.status === 'info') return null;
  const { status, value, entityType } = found;

  switch (id) {
    case 'title-present':
      return 'Every page needs a title. It is the headline people read in search results, and the words on the browser tab.';

    case 'title-length': {
      // Quiet when there is no title at all: `title-present` owns that message,
      // and saying it twice charges her twice for one absence.
      const chars = leadingCount(value);
      if (chars === null || chars === 0) return null;
      return chars > 60
        ? 'A long title gets cut off in search results. Trim it to about 60 characters.'
        : 'A very short title wastes the best chance you have of being found. Aim for 30 to 60 characters.';
    }

    case 'desc-present':
      return 'This is the couple of lines shown under your title in search results. It is your pitch, and writing one gets more people to click.';

    case 'desc-length': {
      const chars = leadingCount(value);
      if (chars === null || chars === 0) return null;
      return chars > 160
        ? 'Anything past about 160 characters gets cut off. Tighten it up.'
        : 'Give yourself room to sell the page. Aim for 70 to 160 characters.';
    }

    case 'in-sitemap':
      return 'Publish the page and it joins the list of addresses we hand to search engines, which is how they find it.';

    case 'canonical-slug':
      return 'Keep the last part of the address short and in small letters, with hyphens between the words rather than spaces, underscores or capitals.';

    case 'image-alt':
      return 'A short description of each picture is how a search engine, and anyone using a screen reader, knows what it shows. Write one for each.';

    case 'heading-h1':
      // The value says which it is in words, so there is nothing to parse: "no
      // main heading" or "3 main headings".
      return value === 'no main heading'
        ? 'Give the page one big heading at the top. It is how a search engine works out what the page is about.'
        : 'Keep one big heading and make the others a size smaller, so it is clear which one the page is about.';

    case 'content-depth': {
      const words = leadingCount(value);
      const links = secondCount(value);
      const threshold = WORD_THRESHOLD[entityType];
      const thin = words === null ? true : words < threshold;
      // Thin wins when both are true, because a page nobody can read is the
      // bigger problem than a page with nowhere to go next.
      if (thin) {
        return `A page with very little on it rarely gets found. Aim for at least ${formatInt(threshold)} words of real writing.`;
      }
      if (links === 0) {
        return 'Add a few links to your other pages, so a reader who is interested has somewhere to go and search engines can follow you around the site.';
      }
      return null;
    }

    case 'og-image':
      // `warn` is the card we generate; `fail` is nothing at all.
      return status === 'warn'
        ? 'We make one for you in your colors. Your own photograph will always do better.'
        : 'Add a picture, so a link to this page shows something rather than a bare address.';

    case 'structured-data':
      return EXPECTED_SCHEMA[entityType] !== null
        ? 'Tell search engines this page is a product, so a price and a rating can show up beside it in the results.'
        : 'Spell out what this page is about in a form search engines read directly, so they describe it correctly.';

    default:
      return null;
  }
}

/**
 * Re-say a stored check in today's words, keeping every measurement it made.
 *
 * Only the words move. `status`, `value`, `earned`, `weight`, `category` and the
 * action are the scan's findings and stay exactly as they were scored — a
 * refreshed card must never be a re-scored one, or a list would silently change
 * its own scores on read.
 */
export function refreshCheck(check: CheckResult, entityType: EntityType): CheckResult {
  const label = CHECK_LABELS[check.id] ?? check.label;
  const tip = checkTip(check.id, {
    status: check.status,
    ...(check.value === undefined ? {} : { value: check.value }),
    entityType,
  });
  const { tip: _dropped, ...bare } = check;
  return tip === null ? { ...bare, label } : { ...bare, label, tip };
}

/**
 * The single highest-leverage remediation: the warn/fail with the biggest point
 * shortfall, breaking ties toward outright fails, then heavier checks.
 *
 * Exported because a card refreshed into today's words has to re-say this line
 * too — it is a COPY of one check's tip, so leaving it alone would put the old
 * sentence back on the very row the refresh just fixed.
 */
export function computeFixFirst(scored: readonly CheckResult[]): string | null {
  const issues = scored.filter((c) => c.status === 'warn' || c.status === 'fail');
  if (issues.length === 0) return null;
  const sorted = [...issues].sort((a, b) => {
    const shortfall = b.weight - b.earned - (a.weight - a.earned);
    if (shortfall !== 0) return shortfall;
    if (a.status !== b.status) return a.status === 'fail' ? -1 : 1;
    return b.weight - a.weight;
  });
  const top = sorted[0];
  if (!top) return null;
  return top.tip ?? top.label;
}

/**
 * A whole stored card, re-said in today's words.
 *
 * What a read path calls. Scores, grades and findings are untouched; the labels,
 * the tips and the fix-first sentence are taken from this module. A card written
 * in June comes out reading exactly like one written this morning.
 */
export function refreshCard(card: Scorecard, entityType: EntityType): Scorecard {
  const checks = card.checks.map((check) => refreshCheck(check, entityType));
  return { ...card, checks, fixFirst: computeFixFirst(checks) };
}
