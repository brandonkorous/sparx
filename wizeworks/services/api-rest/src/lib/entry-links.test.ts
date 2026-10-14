import { describe, expect, it } from 'vitest';
import { linkPatterns } from './entry-links';

// The patterns run against JSON text with ILIKE; check them the same way.
function matches(pattern: string, text: string): boolean {
  const body = pattern
    .slice(1, -1)
    .replace(/\\([\\%_])|([.*+?^${}()|[\]])|%|_/g, (all, escaped: string, special: string) =>
      escaped ? `\\${escaped}` : special ? `\\${special}` : all === '%' ? '.*' : '.'
    );
  return new RegExp(`^.*${body}.*$`, 'is').test(text);
}

const found = (path: string, json: string) => linkPatterns(path).some((p) => matches(p, json));

describe('linkPatterns', () => {
  const path = '/articles/a-correction';

  it('finds a link written as the path alone or after a host', () => {
    expect(found(path, '{"href": "/articles/a-correction"}')).toBe(true);
    expect(found(path, '{"href": "https://marrowreview.co.uk/articles/a-correction"}')).toBe(true);
    expect(found(path, '{"href": "/articles/a-correction/"}')).toBe(true);
    expect(found(path, '{"href": "/articles/a-correction#note"}')).toBe(true);
    expect(found(path, '{"href": "/articles/a-correction?ref=mill"}')).toBe(true);
  });

  it('does not find a different piece whose address starts the same', () => {
    expect(found(path, '{"href": "/articles/a-correction-to-the-mill"}')).toBe(false);
  });

  it('takes the LIKE wildcards in a path literally', () => {
    expect(linkPatterns('/a_b')[0]).toBe('%/a\\_b"%');
  });
});
