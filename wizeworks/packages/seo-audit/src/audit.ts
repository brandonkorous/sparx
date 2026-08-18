// SEO Audit Scorecard — scoring engine (docs/50 §7).
//
// `auditEntity(entity)` is a pure function: same input → same output, no I/O and
// no clock. It runs the 12-check catalog, rolls the per-check `earned` points up
// into category and overall scores, and surfaces the single highest-leverage fix.
// `info` checks (an intentional `noindex`, the always-true llms.txt fact) are
// shown but excluded from the denominator, so the score reflects only what the
// author can actually act on.

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

const CATEGORY_LABELS: Record<CategoryKey, string> = {
  meta: 'Title & Meta',
  index: 'Indexability',
  content: 'Content',
  social: 'Social & AIO',
};

// Entity-aware minimum word count for the content-depth check. Prose pages are
// expected to carry a real body; a product/collection blurb is naturally short.
const WORD_THRESHOLD: Record<EntityType, number> = {
  builder_page: 200,
  cms_page: 250,
  product: 50,
  collection: 40,
};

// The schema.org @type a given entity should ideally emit. `null` = no single
// canonical type, so any JSON-LD passes and none warns.
const EXPECTED_SCHEMA: Record<EntityType, string | null> = {
  product: 'Product',
  collection: null,
  cms_page: null,
  builder_page: null,
};

function earnedFor(status: CheckStatus, weight: number): number {
  if (status === 'pass') return weight;
  if (status === 'warn') return weight / 2;
  return 0; // fail or info
}

interface CheckDraft {
  id: string;
  category: CategoryKey;
  label: string;
  weight: number;
  status: CheckStatus;
  value?: string;
  tip?: string;
  action?: SeoAuditAction;
}

function finalize(d: CheckDraft): CheckResult {
  return { ...d, earned: earnedFor(d.status, d.weight) };
}

// A slug is "clean" when each path segment is lowercase alphanumerics joined by
// single hyphens — no spaces, underscores, or uppercase. Empty (root/home) is fine.
function isCleanSlug(slug: string): boolean {
  if (slug === '') return true;
  if (slug.length > 80) return false;
  return /^[a-z0-9]+(?:-[a-z0-9]+)*(?:\/[a-z0-9]+(?:-[a-z0-9]+)*)*$/.test(slug);
}

// Deterministic thousands separator (avoids locale-dependent toLocaleString).
function formatInt(n: number): string {
  return Math.max(0, Math.trunc(n))
    .toString()
    .replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

function runChecks(e: AuditableEntity): CheckResult[] {
  const checks: CheckResult[] = [];
  const title = (e.title ?? '').trim();
  const desc = (e.description ?? '').trim();

  // 1 — Title present (meta, 12)
  checks.push(
    finalize({
      id: 'title-present',
      category: 'meta',
      label: 'Meta title is set',
      weight: 12,
      status: title.length > 0 ? 'pass' : 'fail',
      value: title.length > 0 ? 'present' : 'missing',
      ...(title.length === 0
        ? {
            tip: 'Every page needs a title — it is the headline in search results and browser tabs.',
            action: { label: 'Add a title', target: 'title' },
          }
        : {}),
    })
  );

  // 2 — Title length (meta, 8)
  const tl = title.length;
  let titleLen: CheckStatus;
  if (tl >= 30 && tl <= 60) titleLen = 'pass';
  else if ((tl >= 10 && tl < 30) || (tl > 60 && tl <= 70)) titleLen = 'warn';
  else titleLen = 'fail';
  checks.push(
    finalize({
      id: 'title-length',
      category: 'meta',
      label: 'Title length',
      weight: 8,
      status: titleLen,
      value: `${tl} chars`,
      // When the title is empty, check #1 already owns the message — stay quiet here.
      ...(titleLen !== 'pass' && tl > 0
        ? {
            tip:
              tl > 60
                ? 'Long titles get truncated in search results. Trim to about 60 characters.'
                : 'Short titles waste a ranking signal. Aim for 30–60 characters.',
            action: { label: 'Edit title', target: 'title' },
          }
        : {}),
    })
  );

  // 3 — Description present (meta, 6) — recommended, so absence warns (not fails)
  checks.push(
    finalize({
      id: 'desc-present',
      category: 'meta',
      label: 'Meta description is set',
      weight: 6,
      status: desc.length > 0 ? 'pass' : 'warn',
      value: desc.length > 0 ? 'present' : 'missing',
      ...(desc.length === 0
        ? {
            tip: 'The meta description is your pitch in search results. Add one to lift click-through.',
            action: { label: 'Add a description', target: 'description' },
          }
        : {}),
    })
  );

  // 4 — Description length (meta, 4)
  const dl = desc.length;
  const descLen: CheckStatus = dl >= 70 && dl <= 160 ? 'pass' : 'warn';
  checks.push(
    finalize({
      id: 'desc-length',
      category: 'meta',
      label: 'Description length',
      weight: 4,
      status: descLen,
      value: dl > 0 ? `${dl} chars` : '—',
      ...(descLen === 'warn' && dl > 0
        ? {
            tip:
              dl > 160
                ? 'Descriptions over ~160 characters get cut off. Tighten it up.'
                : 'Give the description room to sell — aim for 70–160 characters.',
            action: { label: 'Edit description', target: 'description' },
          }
        : {}),
    })
  );

  // 5 — Indexable (index, 9) — `noindex` is informational, never a penalty
  checks.push(
    finalize({
      id: 'indexable',
      category: 'index',
      label: 'Page is indexable',
      weight: 9,
      status: e.noindex ? 'info' : 'pass',
      value: e.noindex ? 'noindex — by design?' : 'noindex off',
      ...(e.noindex
        ? {
            tip: 'This page is set to noindex, so search engines skip it. Intentional? If not, turn indexing on.',
            action: { label: 'Review indexing', target: 'noindex' },
          }
        : {}),
    })
  );

  // 6 — In sitemap (index, 8) — info when noindex (correctly excluded already)
  let sitemap: CheckStatus;
  if (e.noindex) sitemap = 'info';
  else sitemap = e.inSitemap ? 'pass' : 'warn';
  checks.push(
    finalize({
      id: 'in-sitemap',
      category: 'index',
      label: 'Listed in sitemap.xml',
      weight: 8,
      status: sitemap,
      value: e.noindex ? 'excluded (noindex)' : e.inSitemap ? 'included' : 'not listed',
      ...(sitemap === 'warn'
        ? { tip: 'Publish the page so it enters your sitemap and search engines can discover it.' }
        : {}),
    })
  );

  // 7 — Canonical & readable slug (index, 8)
  const slug = (e.slug ?? '').trim();
  const slugClean = isCleanSlug(slug);
  checks.push(
    finalize({
      id: 'canonical-slug',
      category: 'index',
      label: 'Canonical & readable slug',
      weight: 8,
      status: slugClean ? 'pass' : 'warn',
      value: e.canonical ? 'custom canonical' : slugClean ? 'self · clean' : 'check slug',
      ...(!slugClean
        ? {
            tip: 'Use a short, lowercase, hyphenated slug (no spaces, underscores, or capitals).',
            action: { label: 'Edit slug', target: 'slug' },
          }
        : {}),
    })
  );

  // 8 — Image alt text (content, 10)
  let alt: CheckStatus;
  let altValue: string;
  if (e.imageCount === 0) {
    alt = 'pass';
    altValue = 'no images';
  } else {
    const missing = Math.min(Math.max(0, e.imagesMissingAlt), e.imageCount);
    altValue = `${e.imageCount - missing} / ${e.imageCount} ok`;
    if (missing === 0) alt = 'pass';
    else if (missing / e.imageCount < 1 / 3) alt = 'warn';
    else alt = 'fail';
  }
  checks.push(
    finalize({
      id: 'image-alt',
      category: 'content',
      label: 'Image alt text',
      weight: 10,
      status: alt,
      value: altValue,
      ...(alt !== 'pass'
        ? {
            tip: 'Alt text is how search engines and screen readers read your images. Describe each one.',
            action: { label: 'Fix images', target: 'images' },
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
    finalize({
      id: 'heading-h1',
      category: 'content',
      label: 'Heading structure',
      weight: 7,
      status: h1,
      value: `${e.h1Count}× H1`,
      ...(h1 !== 'pass'
        ? {
            tip:
              e.h1Count === 0
                ? 'Add a single H1 — it tells search engines the page’s main topic.'
                : 'Use exactly one H1. Demote the extra heading(s) to H2.',
            action: { label: 'Review headings', target: 'headings' },
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
    finalize({
      id: 'content-depth',
      category: 'content',
      label: 'Content depth & internal links',
      weight: 8,
      status: depth,
      value: `${formatInt(e.wordCount)} words · ${e.internalLinkCount} links`,
      ...(depth === 'warn'
        ? {
            tip: thin
              ? `Thin pages rank poorly. Aim for at least ${threshold} words of real content.`
              : 'Add a few links to related pages so visitors and crawlers can go deeper.',
          }
        : {}),
    })
  );

  // 11 — Social share image (social, 10) — generated card is a warn, never a fail
  let og: CheckStatus;
  if (e.ogImage === 'custom') og = 'pass';
  else if (e.ogImage === 'generated') og = 'warn';
  else og = 'fail';
  checks.push(
    finalize({
      id: 'og-image',
      category: 'social',
      label: 'Social share image',
      weight: 10,
      status: og,
      value:
        e.ogImage === 'custom' ? 'custom' : e.ogImage === 'generated' ? 'auto-generated' : 'none',
      ...(og !== 'pass'
        ? {
            tip:
              og === 'warn'
                ? 'A branded card is generated automatically. Upload a custom image for a stronger share.'
                : 'Add a social image so links to this page show a rich preview.',
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
    finalize({
      id: 'structured-data',
      category: 'social',
      label: 'Structured data (JSON-LD)',
      weight: 10,
      status: sdOk ? 'pass' : 'warn',
      value: e.structuredDataTypes.length > 0 ? e.structuredDataTypes.join(', ') : 'none',
      ...(!sdOk
        ? {
            tip: expected
              ? `Add ${expected} structured data so this page can earn rich results.`
              : 'Add structured data (JSON-LD) so engines understand this page.',
            action: { label: 'Enable schema', target: 'structured-data' },
          }
        : {}),
    })
  );

  // Info — AI-discoverable (social, 0) — platform-wide fact, shown for reassurance
  checks.push(
    finalize({
      id: 'ai-discoverable',
      category: 'social',
      label: 'Discoverable by AI engines',
      weight: 0,
      status: 'info',
      value: e.inLlmsTxt ? 'in llms.txt' : 'sitemap only',
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

// The single highest-leverage remediation: the warn/fail with the biggest point
// shortfall, breaking ties toward outright fails, then heavier checks.
function computeFixFirst(scored: CheckResult[]): string | null {
  const issues = scored.filter((c) => c.status === 'warn' || c.status === 'fail');
  if (issues.length === 0) return null;
  issues.sort((a, b) => {
    const shortfall = b.weight - b.earned - (a.weight - a.earned);
    if (shortfall !== 0) return shortfall;
    if (a.status !== b.status) return a.status === 'fail' ? -1 : 1;
    return b.weight - a.weight;
  });
  const top = issues[0];
  if (!top) return null;
  return top.tip ?? top.label;
}

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
