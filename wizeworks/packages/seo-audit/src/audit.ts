// SEO Audit Scorecard — scoring engine (docs/50 §7).
//
// `auditEntity(entity)` is a pure function: same input → same output, no I/O and
// no clock. It runs the 12-check catalog, rolls the per-check `earned` points up
// into category and overall scores, and surfaces the single highest-leverage fix.
// `info` checks (an intentional `noindex`, the always-true llms.txt fact) are
// shown but excluded from the denominator, so the score reflects only what the
// author can actually act on.
//
// THE WORDS ARE NOT HERE. Every label and every tip comes from `check-copy.ts`,
// because a scored card is STORED and a card that holds its own sentences keeps
// June's wording for ever - 15 of the 16 businesses on this database were reading
// the pre-rewrite developer vocabulary (issue 863). The engine reading the same
// module the read paths read is what proves the derivation on every fresh card.

import type {
  AuditableEntity,
  CategoryKey,
  CategoryScore,
  CheckResult,
  CheckStatus,
  EntityType,
  Grade,
  Scorecard,
  SeoAuditAction,
} from './types';
import {
  AS_SERVED,
  CHECK_LABELS,
  EXPECTED_SCHEMA,
  WORD_THRESHOLD,
  checkTip,
  computeFixFirst,
  formatInt,
} from './check-copy';

// Named for what an owner is trying to do, not for the part of the spec each
// check comes from. "Indexability" and "AIO" are the vocabulary of somebody who
// already knows the answer.
const CATEGORY_LABELS: Record<CategoryKey, string> = {
  meta: 'Title and summary',
  index: 'Being found at all',
  content: 'What is on the page',
  social: 'Sharing, and AI',
};

// `WORD_THRESHOLD` and `EXPECTED_SCHEMA` live in check-copy.ts, beside the tips
// that quote them: the content-depth sentence names the word count and the
// structured-data sentence changes with the expected type, so a threshold in one
// file and its sentence in another is two things that must agree and can drift.

function earnedFor(status: CheckStatus, weight: number): number {
  if (status === 'pass') return weight;
  if (status === 'warn') return weight / 2;
  return 0; // fail or info
}

interface CheckDraft {
  id: string;
  category: CategoryKey;
  /** NO `label`. The words are `CHECK_LABELS[id]`, filled in by `finalize` — a
   *  draft that carried its own would be a second copy of the one string, which
   *  is the whole shape of issue 863 reappearing inside the engine. */
  weight: number;
  status: CheckStatus;
  value?: string;
  /** NO `tip` either. The advice is `checkTip(id, finding)`, derived from what the
   *  check FOUND — so a stored card can be re-said in today's words from the
   *  status and value it already keeps. */
  action?: SeoAuditAction;
}

/**
 * An `info` check never carries advice.
 *
 * A fact is not a task. When "Every picture is described" went `info` for a
 * page with no pictures, its tip was gated on `!== 'pass'` and so came along:
 * "Write one for each", about pictures that do not exist. Enforced here rather
 * than at each call site, so the NEXT check that turns out not to apply cannot
 * bring its advice with it.
 */
function finalize(entityType: EntityType, d: CheckDraft): CheckResult {
  const { action: _action, ...bare } = d;
  const kept = d.status === 'info' ? bare : d;
  const tip = checkTip(d.id, {
    status: d.status,
    ...(d.value === undefined ? {} : { value: d.value }),
    entityType,
  });
  return {
    ...kept,
    ...(tip === null ? {} : { tip }),
    // THE ONE PLACE THE WORDS COME FROM, for a card scored this second and for
    // one refreshed out of the database. Falling back to the id is deliberate and
    // loud: a check added without a label reads as `og-image` on screen, which
    // somebody notices, and `check-copy.test.ts` fails the build before they have
    // to. [[feedback_absent_behaves_like_fine]]
    label: CHECK_LABELS[d.id] ?? d.id,
    earned: earnedFor(d.status, d.weight),
  };
}

// A slug is "clean" when each path segment is lowercase alphanumerics joined by
// single hyphens — no spaces, underscores, or uppercase. Empty (root/home) is fine.
function isCleanSlug(slug: string): boolean {
  if (slug === '') return true;
  if (slug.length > 80) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(slug);
}

function runChecks(e: AuditableEntity): CheckResult[] {
  const checks: CheckResult[] = [];
  const title = (e.title ?? '').trim();
  const desc = (e.description ?? '').trim();

  // 1 — Title present (meta, 12)
  checks.push(
    finalize(e.entityType, {
      id: 'title-present',
      category: 'meta',
      weight: 12,
      status: title.length > 0 ? 'pass' : 'fail',
      value: title.length > 0 ? 'set' : 'not set yet',
      ...(title.length === 0
        ? {
            action: { label: 'Add a title', target: 'title' },
          }
        : {}),
    })
  );

  // 2 — Title length (meta, 8). Measured as SERVED: the site adds its name to the
  // title, and a search engine cuts what it serves, not what was typed.
  const served = (e.servedTitle ?? '').trim() || title;
  const tl = title.length === 0 ? 0 : served.length;
  let titleLen: CheckStatus;
  if (tl >= 30 && tl <= 60) titleLen = 'pass';
  else if ((tl >= 10 && tl < 30) || (tl > 60 && tl <= 70)) titleLen = 'warn';
  else titleLen = 'fail';
  checks.push(
    finalize(e.entityType, {
      id: 'title-length',
      category: 'meta',
      weight: 8,
      status: titleLen,
      value: served === title ? `${tl} characters` : `${tl} characters ${AS_SERVED}`,
      // When the title is empty, check #1 already owns the message — stay quiet here.
      ...(titleLen !== 'pass' && tl > 0
        ? {
            action: { label: 'Edit title', target: 'title' },
          }
        : {}),
    })
  );

  // 3 — Description present (meta, 6) — recommended, so absence warns (not fails)
  checks.push(
    finalize(e.entityType, {
      id: 'desc-present',
      category: 'meta',
      weight: 6,
      status: desc.length > 0 ? 'pass' : 'warn',
      value: desc.length > 0 ? 'written' : 'not written yet',
      ...(desc.length === 0
        ? {
            action: { label: 'Add a description', target: 'description' },
          }
        : {}),
    })
  );

  // 4 — Description length (meta, 4)
  //
  // With NO summary at all this is not a length problem, it is check 3 said
  // twice. The owner saw both rows in "Worth fixing" — "The page has a short
  // summary · not written yet" and "How long the summary is · nothing written"
  // — and the second carried no advice at all, because the tip below was
  // already gated on `dl > 0`. Somebody knew there was nothing to say and left
  // the row anyway.
  //
  // It also charged her twice for one absence: a `warn` earns half its weight,
  // so an unwritten summary lost 3 of 6 here AND 2 of 4 there.
  //
  // `info` is the status this file already keeps for a check the author cannot
  // act on ("shown but excluded from the denominator"). Once a summary exists
  // its length is a real question again.
  const dl = desc.length;
  const descLen: CheckStatus = dl === 0 ? 'info' : dl >= 70 && dl <= 160 ? 'pass' : 'warn';
  checks.push(
    finalize(e.entityType, {
      id: 'desc-length',
      category: 'meta',
      weight: 4,
      status: descLen,
      value: dl > 0 ? `${dl} characters` : 'nothing to measure yet',
      ...(descLen === 'warn' && dl > 0
        ? {
            action: { label: 'Edit description', target: 'description' },
          }
        : {}),
    })
  );

  // 5 — Indexable (index, 9) — `noindex` is informational, never a penalty
  checks.push(
    finalize(e.entityType, {
      id: 'indexable',
      category: 'index',
      weight: 9,
      status: e.noindex ? 'info' : 'pass',
      value: e.noindex ? 'hidden from search' : 'allowed',
      ...(e.noindex
        ? {
            action: { label: 'Check this setting', target: 'noindex' },
          }
        : {}),
    })
  );

  // 6 — In sitemap (index, 8) — info when noindex (correctly excluded already)
  let sitemap: CheckStatus;
  if (e.noindex) sitemap = 'info';
  else sitemap = e.inSitemap ? 'pass' : 'warn';
  checks.push(
    finalize(e.entityType, {
      id: 'in-sitemap',
      category: 'index',
      weight: 8,
      status: sitemap,
      value: e.noindex ? 'left off on purpose' : e.inSitemap ? 'on the list' : 'not on the list',
      ...(sitemap === 'warn' ? {} : {}),
    })
  );

  // 7 — Canonical & readable slug (index, 8)
  const slug = (e.slug ?? '').trim();
  const slugClean = isCleanSlug(slug);
  checks.push(
    finalize(e.entityType, {
      id: 'canonical-slug',
      category: 'index',
      weight: 8,
      status: slugClean ? 'pass' : 'warn',
      value: e.canonical ? 'points at another page' : slugClean ? 'tidy' : 'worth tidying',
      ...(!slugClean
        ? {
            action: { label: 'Edit the address', target: 'slug' },
          }
        : {}),
    })
  );

  // 8 — Image alt text (content, 10)
  //
  // A page with no pictures used to PASS this, which handed it the full 10
  // points — the heaviest check in the catalog — for a test that never ran, and
  // filed it under "Already good · these are set up correctly". Nothing was set
  // up; there was nothing to set up ([[feedback_never_present_absence_as_measurement]]).
  //
  // `info`: shown, so she can see the checker looked, and out of the
  // denominator, so the score is over what was actually measured.
  let alt: CheckStatus;
  let altValue: string;
  if (e.imageCount === 0) {
    alt = 'info';
    altValue = 'no pictures on this page';
  } else {
    const missing = Math.min(Math.max(0, e.imagesMissingAlt), e.imageCount);
    altValue = `${e.imageCount - missing} of ${e.imageCount} described`;
    if (missing === 0) alt = 'pass';
    else if (missing / e.imageCount < 1 / 3) alt = 'warn';
    else alt = 'fail';
  }
  checks.push(
    finalize(e.entityType, {
      id: 'image-alt',
      category: 'content',
      weight: 10,
      status: alt,
      value: altValue,
      ...(alt === 'warn' || alt === 'fail'
        ? {
            action: { label: 'Describe the pictures', target: 'images' },
          }
        : {}),
    })
  );

  // 9 — Heading structure (content, 7)
  let h1: CheckStatus;
  if (e.h1Count === 1) h1 = 'pass';
  else if (e.h1Count === 0) h1 = 'fail';
  else h1 = 'warn';
  checks.push(
    finalize(e.entityType, {
      id: 'heading-h1',
      category: 'content',
      weight: 7,
      status: h1,
      value:
        e.h1Count === 0
          ? 'no main heading'
          : e.h1Count === 1
            ? 'one main heading'
            : `${e.h1Count} main headings`,
      ...(h1 !== 'pass'
        ? {
            action: { label: 'Check the headings', target: 'headings' },
          }
        : {}),
    })
  );

  // 10 — Content depth & internal links (content, 8) — advisory, so warns at worst
  const threshold = WORD_THRESHOLD[e.entityType];
  const thin = e.wordCount < threshold;
  const noLinks = e.internalLinkCount === 0;
  const depth: CheckStatus = thin || noLinks ? 'warn' : 'pass';
  checks.push(
    finalize(e.entityType, {
      id: 'content-depth',
      category: 'content',
      weight: 8,
      status: depth,
      value: `${formatInt(e.wordCount)} words · ${e.internalLinkCount} links`,
      ...(depth === 'warn' ? {} : {}),
    })
  );

  // 11 — Social share image (social, 10) — generated card is a warn, never a fail
  let og: CheckStatus;
  if (e.ogImage === 'custom') og = 'pass';
  else if (e.ogImage === 'generated') og = 'warn';
  else og = 'fail';
  checks.push(
    finalize(e.entityType, {
      id: 'og-image',
      category: 'social',
      weight: 10,
      status: og,
      value:
        e.ogImage === 'custom' ? 'your own' : e.ogImage === 'generated' ? 'made for you' : 'none',
      ...(og !== 'pass'
        ? {
            action: { label: 'Add an image', target: 'og-image' },
          }
        : {}),
    })
  );

  // 12 — Structured data (social, 10)
  const expected = EXPECTED_SCHEMA[e.entityType];
  const hasExpected = expected === null || e.structuredDataTypes.includes(expected);
  const sdOk = hasExpected && e.structuredDataTypes.length > 0;
  checks.push(
    finalize(e.entityType, {
      id: 'structured-data',
      category: 'social',
      weight: 10,
      status: sdOk ? 'pass' : 'warn',
      value: e.structuredDataTypes.length > 0 ? e.structuredDataTypes.join(', ') : 'none',
      ...(!sdOk
        ? {
            action: { label: 'Turn it on', target: 'structured-data' },
          }
        : {}),
    })
  );

  // Info — AI-discoverable (social, 0) — platform-wide fact, shown for reassurance
  checks.push(
    finalize(e.entityType, {
      id: 'ai-discoverable',
      category: 'social',
      weight: 0,
      status: 'info',
      value: e.inLlmsTxt ? 'listed for AI assistants' : 'findable by search only',
    })
  );

  return checks;
}

function gradeFor(score: number): Grade {
  if (score >= 90) return 'excellent';
  if (score >= 70) return 'good';
  if (score >= 50) return 'needs-work';
  return 'poor';
}

// `computeFixFirst` lives in check-copy.ts: it is a COPY of one check's tip, so a
// read path refreshing a stored card's words has to re-say this line too.

function round1(n: number): number {
  return Math.round(n * 10) / 10;
}

/** Grade a normalized entity. The result's `computedAt` is left for the caller
 *  to stamp (the engine has no clock). */
export function auditEntity(entity: AuditableEntity): Scorecard {
  const checks = runChecks(entity);
  const scored = checks.filter((c) => c.status !== 'info');

  const totalWeight = scored.reduce((s, c) => s + c.weight, 0);
  const totalEarned = scored.reduce((s, c) => s + c.earned, 0);
  const score = totalWeight > 0 ? Math.round((totalEarned / totalWeight) * 100) : 0;

  const categories: CategoryScore[] = (Object.keys(CATEGORY_LABELS) as CategoryKey[]).map((key) => {
    const inCat = checks.filter((c) => c.category === key && c.status !== 'info');
    return {
      key,
      label: CATEGORY_LABELS[key],
      earned: round1(inCat.reduce((s, c) => s + c.earned, 0)),
      max: inCat.reduce((s, c) => s + c.weight, 0),
    };
  });

  return {
    entityType: entity.entityType,
    score,
    grade: gradeFor(score),
    categories,
    checks,
    fixFirst: computeFixFirst(scored),
  };
}
