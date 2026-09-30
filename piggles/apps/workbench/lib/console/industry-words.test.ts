import { existsSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { REWRITTEN_INDUSTRIES, industryDescription } from './industry-words';

// A REWRITE FOR A LINE OF WORK NOBODY OFFERS REWRITES NOTHING.
//
// These are keyed by the starter's slug, which lives in api-rest and has no type
// this console can check against. A typo, or a starter renamed upstream, leaves
// an entry here that reads as a sentence this brand has written while the screen
// goes on showing the platform's. The same trap `vocabulary.ts` warns about in
// its own header. [[feedback_absent_behaves_like_fine]]

function repoRoot(): string {
  let dir = import.meta.dirname;
  for (let i = 0; i < 12; i += 1) {
    if (existsSync(join(dir, 'pnpm-workspace.yaml'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  throw new Error('repo root not found: no pnpm-workspace.yaml above this file');
}

const STARTERS = join(
  repoRoot(),
  'wizeworks',
  'services',
  'api-rest',
  'src',
  'lib',
  'industry-starters.ts'
);

function offeredSlugs(): string[] {
  if (!existsSync(STARTERS)) throw new Error(`industry starters not found at ${STARTERS}`);
  const source = readFileSync(STARTERS, 'utf8');
  const start = source.indexOf('const STARTERS: IndustryStarter[] = [');
  if (start < 0) throw new Error('STARTERS array not found — the file has been restructured');
  return [...source.slice(start).matchAll(/^\s{4}slug: '([a-z-]+)',$/gm)].map(
    (m) => m[1] as string
  );
}

describe('what Piggles says a line of work sets up', () => {
  const offered = offeredSlugs();

  it('rewrites only lines of work the platform offers', () => {
    // The denominator. A parse that collapsed would make every key below look
    // wrong, or none of them checkable.
    expect(offered.length).toBeGreaterThan(5);
    expect(REWRITTEN_INDUSTRIES.length).toBeGreaterThan(5);

    const unknown = REWRITTEN_INDUSTRIES.filter((slug) => !offered.includes(slug));
    expect(unknown, 'these keys rewrite nothing: no starter has that slug').toEqual([]);
  });

  it('covers every one of them, so no card is left speaking the other language', () => {
    // Unlike the other brand vocabularies, absence here is NOT a statement that
    // the platform got it right: every one of these sentences lists the parts by
    // their internal names. A new starter needs a sentence written for it.
    const missing = offered.filter((slug) => !REWRITTEN_INDUSTRIES.includes(slug));
    expect(missing, 'these lines of work still show the platform’s own wording').toEqual([]);
  });

  it('never reaches for a word the brand has taken off its screens', () => {
    const BANNED = [
      'catalog',
      'segment',
      'pipeline',
      'markup',
      'content type',
      'collection',
      'fitment',
      'sku',
      'b2b',
      'crm',
      'module',
    ];
    const offenders: string[] = [];
    for (const slug of REWRITTEN_INDUSTRIES) {
      const said = industryDescription(slug, '').toLowerCase();
      for (const word of BANNED) {
        if (said.includes(word)) offenders.push(`${slug}: "${word}"`);
      }
    }
    expect(offenders).toEqual([]);
  });

  it('never puts a glyph where a word belongs', () => {
    // The platform's auto-parts sentence read "a quote→invoice flow" and the
    // apparel one "a newsletter + sale campaign". An arrow and a plus doing the
    // work of "that becomes" and "and".
    for (const slug of REWRITTEN_INDUSTRIES) {
      const said = industryDescription(slug, '');
      expect(said, `${slug} uses a glyph as a word`).not.toMatch(/[→↦+/]/);
    }
  });

  it('leaves a starter it has no sentence for alone', () => {
    expect(industryDescription('something-new', 'The API said this')).toBe('The API said this');
  });
});
