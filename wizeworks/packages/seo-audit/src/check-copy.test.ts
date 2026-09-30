import { describe, expect, it } from 'vitest';

import { auditEntity } from './audit';
import { CHECK_LABELS, checkTip, refreshCard, computeFixFirst } from './check-copy';
import type { AuditableEntity, EntityType, Scorecard } from './types';

// A stored scorecard used to hold its own SENTENCES, so a page scored in June kept
// June's wording for ever. Measured 2026-09-28: of 370 stored cards across 16
// businesses, 226 carried the pre-rewrite developer vocabulary, and 15 of the 16
// businesses carried nothing else. Every one of the thirteen checks had two stored
// names (issue 863).

const ENTITY_TYPES: EntityType[] = ['builder_page', 'cms_page', 'product', 'collection'];

function entity(over: Partial<AuditableEntity> = {}): AuditableEntity {
  return {
    entityType: 'builder_page',
    title: 'A reasonable page title that is about right in length',
    description:
      'A summary of the page that runs to a sensible length, somewhere between seventy and a hundred and sixty characters.',
    noindex: false,
    canonical: null,
    slug: 'a-tidy-address',
    inSitemap: true,
    h1Count: 1,
    wordCount: 900,
    imageCount: 2,
    imagesMissingAlt: 0,
    internalLinkCount: 4,
    ogImage: 'custom',
    structuredDataTypes: ['WebPage'],
    inLlmsTxt: true,
    ...over,
  };
}

describe('the one list of what a check is called', () => {
  it('has an entry for every check the engine emits, on every entity type', () => {
    // The guard that makes "one place for the words" hold: a fourteenth check
    // cannot ship without its label, and the fallback in `finalize` is the id,
    // which is loud rather than silently wrong.
    const missing: string[] = [];
    for (const entityType of ENTITY_TYPES) {
      for (const card of [
        auditEntity(entity({ entityType })),
        auditEntity(
          entity({
            entityType,
            title: '',
            description: '',
            h1Count: 0,
            imageCount: 3,
            imagesMissingAlt: 3,
            wordCount: 1,
            internalLinkCount: 0,
            ogImage: 'none',
            structuredDataTypes: [],
            slug: 'Bad Slug',
            inSitemap: false,
          })
        ),
      ]) {
        for (const check of card.checks) {
          if (CHECK_LABELS[check.id] === undefined) missing.push(`${entityType}:${check.id}`);
        }
      }
    }
    expect(missing).toEqual([]);
  });

  it('never leaves a check wearing its own id on screen', () => {
    for (const check of auditEntity(entity()).checks) {
      expect(check.label).not.toBe(check.id);
    }
  });

  it('is exactly this, and a change to it is a deliberate edit', () => {
    // PINNED, not pattern-matched. A regex for markup words let "Heading
    // structure" and "Content depth & internal links" through, which are the very
    // labels the rewrite replaced — they are not jargon, they are just somebody
    // else's vocabulary. And a label edit now lands on all 370 stored cards at
    // once rather than on the next rescan, so it is worth having to come here.
    // [[feedback_a_test_that_cannot_go_red]]
    expect(CHECK_LABELS).toEqual({
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
    });
  });

  it('says none of the thirteen in developer words', () => {
    // The vocabulary the rewrite removed. If any of these comes back, the copy has
    // regressed to the set 15 of 16 businesses were still reading.
    const jargon = /\bH1\b|JSON-LD|sitemap\.xml|\bmeta\b|alt text|canonical|slug|indexable/i;
    const offenders = Object.entries(CHECK_LABELS).filter(([, label]) => jargon.test(label));
    expect(offenders).toEqual([]);
  });
});

describe('the advice, derived from what the check found', () => {
  it('says nothing for a pass and nothing for a fact', () => {
    expect(checkTip('image-alt', { status: 'pass', entityType: 'product' })).toBeNull();
    // A fact is not a task: a page with no pictures must not be told to describe
    // them, and a page deliberately kept out of search is not a job to do.
    expect(checkTip('image-alt', { status: 'info', entityType: 'product' })).toBeNull();
    expect(checkTip('indexable', { status: 'info', entityType: 'product' })).toBeNull();
  });

  it('tells a short title and a long one apart, from the stored value', () => {
    const short = checkTip('title-length', {
      status: 'fail',
      value: '15 characters',
      entityType: 'product',
    });
    const long = checkTip('title-length', {
      status: 'warn',
      value: '84 characters',
      entityType: 'product',
    });
    expect(short).toMatch(/very short/);
    expect(long).toMatch(/gets cut off/);
  });

  it('tells a missing heading from a duplicated one', () => {
    expect(
      checkTip('heading-h1', { status: 'fail', value: 'no main heading', entityType: 'cms_page' })
    ).toMatch(/one big heading at the top/);
    expect(
      checkTip('heading-h1', { status: 'warn', value: '3 main headings', entityType: 'cms_page' })
    ).toMatch(/a size smaller/);
  });

  it('quotes the word count the entity type actually needs', () => {
    const forProduct = checkTip('content-depth', {
      status: 'warn',
      value: '10 words · 2 links',
      entityType: 'product',
    });
    const forPage = checkTip('content-depth', {
      status: 'warn',
      value: '10 words · 2 links',
      entityType: 'cms_page',
    });
    expect(forProduct).toContain('50 words');
    expect(forPage).toContain('250 words');
  });

  it('reads a thousands separator back out of its own value', () => {
    // The engine writes "1,240 words · 3 links". A parser that stopped at the
    // comma would read 1 word and call a long article thin.
    const tip = checkTip('content-depth', {
      status: 'warn',
      value: '1,240 words · 0 links',
      entityType: 'cms_page',
    });
    expect(tip).toMatch(/links to your other pages/);
  });

  it('never carries an em dash or a piece of markup vocabulary', () => {
    const said: string[] = [];
    for (const entityType of ENTITY_TYPES) {
      for (const id of Object.keys(CHECK_LABELS)) {
        for (const status of ['warn', 'fail'] as const) {
          for (const value of [
            '0 characters',
            '84 characters',
            'no main heading',
            '3 main headings',
            '10 words · 0 links',
            'none',
          ]) {
            const tip = checkTip(id, { status, value, entityType });
            if (tip !== null) said.push(tip);
          }
        }
      }
    }
    expect(said.length).toBeGreaterThan(20);
    expect(said.filter((t) => t.includes('—'))).toEqual([]);
    expect(said.filter((t) => /\bH1\b|JSON-LD|alt text|canonical/i.test(t))).toEqual([]);
  });
});

describe('re-saying a card stored in older words', () => {
  /** A card as the database held one: today's findings, yesterday's sentences. */
  function asStored(card: Scorecard): Scorecard {
    return {
      ...card,
      fixFirst: 'Add a single H1 — it tells search engines the page’s main topic.',
      checks: card.checks.map((c) => ({
        ...c,
        label: c.id === 'heading-h1' ? 'Heading structure' : `Old name for ${c.id}`,
        ...(c.tip === undefined
          ? {}
          : { tip: 'Add a single H1 — it tells search engines the page’s main topic.' }),
      })),
    };
  }

  const broken = entity({ h1Count: 0, title: 'Short', description: '', ogImage: 'none' });

  it('replaces every stored label with today’s', () => {
    const refreshed = refreshCard(asStored(auditEntity(broken)), 'builder_page');
    for (const check of refreshed.checks) {
      expect(check.label).toBe(CHECK_LABELS[check.id]);
      expect(check.label).not.toMatch(/^Old name for/);
    }
  });

  it('replaces the fix-first sentence, which is a copy of one tip', () => {
    const refreshed = refreshCard(asStored(auditEntity(broken)), 'builder_page');
    expect(refreshed.fixFirst).not.toMatch(/H1/);
    expect(refreshed.fixFirst).not.toContain('—');
  });

  it('changes not one finding', () => {
    // A refreshed card must never be a re-scored one, or a list would quietly
    // move its own numbers on read.
    const fresh = auditEntity(broken);
    const refreshed = refreshCard(asStored(fresh), 'builder_page');
    expect(refreshed.score).toBe(fresh.score);
    expect(refreshed.grade).toBe(fresh.grade);
    expect(refreshed.checks.map((c) => [c.id, c.status, c.value, c.earned, c.weight])).toEqual(
      fresh.checks.map((c) => [c.id, c.status, c.value, c.earned, c.weight])
    );
  });

  it('lands on exactly what a fresh scan would have said', () => {
    // The whole claim of this change: a card written in June and one written this
    // morning read identically once refreshed.
    for (const entityType of ENTITY_TYPES) {
      const fresh = auditEntity(entity({ entityType, h1Count: 0, title: 'Hi', ogImage: 'none' }));
      expect(refreshCard(asStored(fresh), entityType)).toEqual(fresh);
    }
  });

  it('drops advice a refreshed check no longer has', () => {
    // A stored card can carry a tip on a check that passes today's rules with
    // nothing to say. Leaving it would put advice under a green tick.
    const fresh = auditEntity(entity());
    const stored: Scorecard = {
      ...fresh,
      checks: fresh.checks.map((c) => ({ ...c, tip: 'Something from an older build.' })),
    };
    const refreshed = refreshCard(stored, 'builder_page');
    const passing = refreshed.checks.filter((c) => c.status === 'pass');
    expect(passing.length).toBeGreaterThan(3);
    for (const check of passing) expect(check.tip).toBeUndefined();
  });
});

describe('the fix-first line', () => {
  it('is silent on a card with nothing wrong', () => {
    expect(computeFixFirst(auditEntity(entity()).checks)).toBeNull();
  });

  it('names the biggest shortfall, not the first problem found', () => {
    const card = auditEntity(entity({ title: '', h1Count: 0 }));
    // Title present is weight 12 and an outright fail; the heading check is 7.
    expect(computeFixFirst(card.checks)).toMatch(/Every page needs a title/);
  });
});
