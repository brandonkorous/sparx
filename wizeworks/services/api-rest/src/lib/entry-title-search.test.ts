import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { containsPattern } from './entry-title-search';

describe('containsPattern', () => {
  it('matches the text anywhere', () => {
    expect(containsPattern('a correction')).toBe('%a correction%');
  });

  it('takes a typed % or _ literally', () => {
    expect(containsPattern('50%_off')).toBe('%50\\%\\_off%');
    expect(containsPattern('a\\b')).toBe('%a\\\\b%');
  });
});

// P09: "a correction" found nothing when the piece was called "A correction to ...",
// because the list searched the title with a case-sensitive JSON match.
describe('the content list search', () => {
  it('finds a title whatever its capitals', () => {
    const route = readFileSync(
      join(import.meta.dirname, '..', 'routes', 'v1', 'content', 'entries.ts'),
      'utf8'
    );
    expect(route).toContain('entryIdsByTitle(tx, q.q)');
    expect(route).not.toContain('string_contains: q.q');
    const search = readFileSync(join(import.meta.dirname, 'entry-title-search.ts'), 'utf8');
    expect(search).toMatch(/body->>'title' ILIKE/);
  });
});
